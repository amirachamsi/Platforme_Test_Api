package com.bct.back.services;

import com.bct.back.DTO.*;
import com.bct.back.entities.ApiTarget;
import com.bct.back.entities.Endpoint;
import com.bct.back.entities.Execution;
import com.bct.back.entities.TestCase;
import com.bct.back.enums.AuthType;
import com.bct.back.enums.ExecutionMode;
import com.bct.back.enums.KeyLocation;
import com.bct.back.enums.TestStatus;
import com.bct.back.repositories.ExecutionRepository;
import com.bct.back.repositories.TestCaseRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ExecutionService {

    private final TestCaseRepository testCaseRepository;
    private final ExecutionRepository executionRepository;
    private final K6Runner k6Runner;
    private final K6ResultParser k6ResultParser;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Synchronous by design (per your call): the HTTP request blocks until k6
     * finishes and the parsed Execution is persisted, then returns it.
     */
    public Execution execute(Long testCaseId) {
        TestCaseSnapshot snapshot = buildSnapshot(testCaseId);
        String correlationId = UUID.randomUUID().toString();
        LocalDateTime start = LocalDateTime.now();

        Execution execution;
        try {
            K6RunOutput output = k6Runner.run(snapshot);
            execution = k6ResultParser.parse(output.summaryJson(), output.consoleOutput(), snapshot, correlationId, start);
        } catch (Exception e) {
            execution = Execution.builder()
                    .correlationId(correlationId)
                    .dateDebut(start)
                    .dateFin(LocalDateTime.now())
                    .statut(TestStatus.ECHOUEE)
                    .vus(snapshot.vus())
                    .dureeSec(snapshot.durationSeconds())
                    .executionMode(snapshot.executionMode())
                    .nombreRequetes(snapshot.requestCount())
                    .rapportK6Json("Erreur d'exécution k6: " + e.getMessage())
                    .build();
        }

        execution.setTestcase(testCaseRepository.getReferenceById(testCaseId));
        return executionRepository.save(execution);
    }

    /**
     * Resolves everything from the DB (endpoint, target, auth) up front, inside
     * a short read-only transaction, and converts it to plain values — so the
     * (potentially slow) k6 process never runs while holding a DB connection/tx
     * open.
     */
    @Transactional(readOnly = true)
    protected TestCaseSnapshot buildSnapshot(Long testCaseId) {
        TestCase tc = testCaseRepository.findById(testCaseId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Cas de test introuvable, id=" + testCaseId));
        Endpoint ep = tc.getEndpoint();
        ApiTarget target = ep.getTarget();

        String url = target.getUrlBase() + (ep.getChemin() != null ? ep.getChemin() : "");

        Map<String, String> headers = new HashMap<>();
        if (ep.getContentType() != null) {
            headers.put("Content-Type", ep.getContentType());
        }
        if (ep.getHeaders() != null && !ep.getHeaders().isBlank()) {
            try {
                Map<String, String> parsed = objectMapper.readValue(ep.getHeaders(), Map.class);
                headers.putAll(parsed);
            } catch (Exception ignored) {
                // Endpoint.headers wasn't valid JSON — skip merging rather than fail the run.
            }
        }

        // Same auth logic as EndpointService.ping() — kept in sync intentionally.
        if (target.getAuthType() == AuthType.BEARER && target.getSecretRef() != null) {
            headers.put("Authorization", "Bearer " + target.getSecretRef());
        } else if (target.getAuthType() == AuthType.API_KEY
                && target.getKeyIn() == KeyLocation.HEADER
                && target.getKeyName() != null && target.getSecretRef() != null) {
            headers.put(target.getKeyName(), target.getSecretRef());
        } else if (target.getAuthType() == AuthType.API_KEY
                && target.getKeyIn() == KeyLocation.QUERY
                && target.getKeyName() != null && target.getSecretRef() != null) {
            String separator = url.contains("?") ? "&" : "?";
            url = url + separator + target.getKeyName() + "=" + target.getSecretRef();
        }

        int expectedStatus = parseExpectedStatus(tc.getExpectedCode(), ep.getCodeAttendu());
        String body = (tc.getJSONBody() != null && !tc.getJSONBody().isBlank()) ? tc.getJSONBody() : ep.getBody();

        String headersJson;
        try {
            headersJson = objectMapper.writeValueAsString(headers);
        } catch (Exception e) {
            headersJson = "{}";
        }

        ExecutionMode mode = tc.getExecutionMode() != null ? tc.getExecutionMode() : ExecutionMode.DUREE;

        return new TestCaseSnapshot(
                tc.getId(),
                url,
                ep.getMethode().name(),
                headersJson,
                body,
                expectedStatus,
                tc.getTimeoutMs() != null ? tc.getTimeoutMs() : 5000,
                tc.getSeuilMs() != null ? tc.getSeuilMs() : 1000,
                tc.getTauxErreurMax() != null ? tc.getTauxErreurMax() / 100.0 : 0.05,
                tc.getVus() != null ? tc.getVus() : 1,
                mode,
                mode == ExecutionMode.DUREE ? (tc.getDureeSec() != null ? tc.getDureeSec() : 10) : null,
                mode == ExecutionMode.REQUETES ? (tc.getNombreRequetes() != null ? tc.getNombreRequetes() : 100) : null
        );
    }

    private int parseExpectedStatus(String expectedCode, Integer endpointDefault) {
        if (expectedCode != null) {
            try {
                return Integer.parseInt(expectedCode.trim());
            } catch (NumberFormatException ignored) {
                // e.g. "2xx" isn't a single status code the script can compare against directly — fall back.
            }
        }
        return endpointDefault != null ? endpointDefault : 200;
    }
}