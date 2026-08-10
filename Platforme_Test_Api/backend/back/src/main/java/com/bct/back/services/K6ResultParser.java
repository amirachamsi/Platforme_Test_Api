package com.bct.back.services;

import com.bct.back.DTO.TestCaseSnapshot;
import com.bct.back.entities.Execution;
import com.bct.back.enums.TestStatus;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
public class K6ResultParser {

    private final ObjectMapper objectMapper = new ObjectMapper();

    public Execution parse(String rawJson, TestCaseSnapshot snapshot, String correlationId, LocalDateTime start) {
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