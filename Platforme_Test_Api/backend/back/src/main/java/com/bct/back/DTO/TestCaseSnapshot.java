package com.bct.back.DTO;

/**
 * Plain snapshot of everything K6Runner needs to run a test, resolved once
 * inside a short read-only transaction (see ExecutionService.buildSnapshot).
 * Keeping this a simple record — rather than passing the TestCase entity
 * itself into the (slow) k6 process — means nothing here can trigger a lazy
 * load after the Hibernate session has closed.
 */
public record TestCaseSnapshot(
        Long testCaseId,
        String url,
        String method,
        String headersJson,
        String body,
        int expectedStatus,
        int timeoutMs,
        int thresholdMs,
        double maxErrorRate, // ratio 0.0–1.0, e.g. 0.05 for 5%
        int vus,
        int durationSeconds
) {
}