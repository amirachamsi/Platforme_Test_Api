package com.bct.back.services;

import com.bct.back.DTO.TestCaseSnapshot;
import com.bct.back.entities.Execution;
import com.bct.back.enums.TestStatus;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class K6ResultParser {

    private static final String BODY_VARIANT_PREFIX = "response body variant: ";
    private static final String BODY_SAMPLE_LOG_PREFIX = "BODY_SAMPLE|";

    private final ObjectMapper objectMapper = new ObjectMapper();

    public Execution parse(String rawJson, String consoleOutput, TestCaseSnapshot snapshot, String correlationId, LocalDateTime start) {
        try {
            JsonNode root = objectMapper.readTree(rawJson);
            JsonNode metrics = root.path("metrics");

            JsonNode duration = metrics.path("http_req_duration").path("values");
            JsonNode mismatchRate = metrics.path("status_mismatch_rate").path("values");

            long totalRequests = metrics.path("http_reqs").path("values").path("count").asLong(0);
            double reqRate = metrics.path("http_reqs").path("values").path("rate").asDouble(0);
            // Sole source of truth for success/failure — driven by our own status_mismatch_rate
            // metric (see testcase-runner.js), not k6's built-in http_req_failed. That metric
            // classifies any non-2xx/3xx as failed by k6's own default rules regardless of
            // EXPECTED_STATUS, and setResponseCallback wasn't reliably overriding it in practice.
            double errorRate = mismatchRate.path("rate").asDouble(0);

            long failedRequests = Math.round(totalRequests * errorRate);
            long successRequests = totalRequests - failedRequests;
            double successRatio = totalRequests > 0 ? (double) successRequests / totalRequests : 0;

            // thresholdsPassed already reflects whether you stayed within the P95/error-rate
            // limits you configured (seuilMs / tauxErreurMax) — that tolerance is exactly
            // what should decide pass/fail, not whether literally every individual
            // check() across potentially thousands of requests came back true (which almost
            // never happens at scale and previously made near-perfect runs show as ECHOUEE).
            boolean thresholdsPassed = !hasFailedThreshold(metrics);
            TestStatus statut;
            if (thresholdsPassed) {
                statut = TestStatus.REUSSIE;
            } else if (successRatio >= 0.5) {
                // Thresholds weren't met (e.g. P95 or error rate crept past your configured
                // limit), but the majority of requests still succeeded — worth flagging
                // distinctly from a genuinely broken run rather than lumping it in with ECHOUEE.
                statut = TestStatus.PARTIELLE;
            } else {
                statut = TestStatus.ECHOUEE;
            }

            return Execution.builder()
                    .correlationId(correlationId)
                    .dateDebut(start)
                    .dateFin(LocalDateTime.now())
                    .statut(statut)
                    .p95MesureMs((int) Math.round(duration.path("p(95)").asDouble(0)))
                    // stored as a percentage (e.g. 3.2 = 3.2%), matching how tauxErreurMax is entered in the form
                    .tauxErreurMesure(errorRate * 100.0)
                    .reqTotal((int) totalRequests)
                    .reqReussies((int) successRequests)
                    .reqEchouees((int) failedRequests)
                    .rpsMoyen(reqRate)
                    .vus(snapshot.vus())
                    .dureeSec(snapshot.durationSeconds())
                    .rapportK6Json(rawJson)
                    .corpsReponsesJson(buildBodyVariantsJson(root, consoleOutput))
                    .build();

        } catch (Exception e) {
            // k6 ran but produced something we couldn't parse (version drift, crash mid-run, etc).
            // Still persist an Execution so the frontend has something to show instead of nothing.
            return Execution.builder()
                    .correlationId(correlationId)
                    .dateDebut(start)
                    .dateFin(LocalDateTime.now())
                    .statut(TestStatus.ECHOUEE)
                    .vus(snapshot.vus())
                    .dureeSec(snapshot.durationSeconds())
                    .rapportK6Json("Erreur d'analyse du rapport k6: " + e.getMessage() + "\n\nRapport brut:\n" + rawJson)
                    .build();
        }
    }

    /**
     * Merges two sources into a [{preview, count}] JSON array:
     *  - counts per distinct body hash, from root_group.checks (aggregated correctly
     *    across all VUs by k6 itself — see "response body variant: <hash>" checks)
     *  - a text sample per hash, from the BODY_SAMPLE lines testcase-runner.js logs
     *    to stdout (one per distinct hash per VU)
     * Returns null (not an empty array) if nothing was found, so the frontend can
     * distinguish "no data" from "genuinely zero variants".
     */
    private String buildBodyVariantsJson(JsonNode root, String consoleOutput) {
        try {
            Map<String, Long> counts = new LinkedHashMap<>();
            for (JsonNode check : root.path("root_group").path("checks")) {
                String name = check.path("name").asText("");
                if (name.startsWith(BODY_VARIANT_PREFIX)) {
                    String hash = name.substring(BODY_VARIANT_PREFIX.length());
                    counts.put(hash, check.path("passes").asLong(0));
                }
            }
            if (counts.isEmpty()) {
                return null;
            }

            Map<String, String> samples = new LinkedHashMap<>();
            if (consoleOutput != null) {
                for (String line : consoleOutput.split("\\R")) {
                    if (!line.contains(BODY_SAMPLE_LOG_PREFIX)) continue;
                    // console.log lines are prefixed by k6 with a timestamp/level, e.g.
                    // "INFO[0002] BODY_SAMPLE|abc123|{...}" — find our marker anywhere in the line.
                    int start = line.indexOf(BODY_SAMPLE_LOG_PREFIX) + BODY_SAMPLE_LOG_PREFIX.length();
                    String[] parts = line.substring(start).split("\\|", 2);
                    if (parts.length == 2) {
                        samples.putIfAbsent(parts[0], parts[1]);
                    }
                }
            }

            List<Map<String, Object>> variants = new ArrayList<>();
            for (Map.Entry<String, Long> entry : counts.entrySet()) {
                Map<String, Object> variant = new LinkedHashMap<>();
                variant.put("preview", samples.getOrDefault(entry.getKey(), "(aperçu indisponible)"));
                variant.put("count", entry.getValue());
                variants.add(variant);
            }
            variants.sort((a, b) -> Long.compare((Long) b.get("count"), (Long) a.get("count")));

            return objectMapper.writeValueAsString(variants);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Scans each metric's "thresholds" node (present when options.thresholds targeted
     * that metric) for any ok:false entry — k6's JSON summary doesn't expose a single
     * stable top-level "did anything fail" flag across versions.
     */
    private boolean hasFailedThreshold(JsonNode metrics) {
        var fields = metrics.fields();
        while (fields.hasNext()) {
            JsonNode metric = fields.next().getValue();
            var thresholdFields = metric.path("thresholds").fields();
            while (thresholdFields.hasNext()) {
                if (!thresholdFields.next().getValue().path("ok").asBoolean(true)) {
                    return true;
                }
            }
        }
        return false;
    }
}