package com.bct.back.services;

import com.bct.back.DTO.*;
import com.bct.back.enums.ExecutionMode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Service
public class K6Runner {

    // Override in application.properties once k6 is installed, e.g.:
    // k6.executable=C:/k6/k6.exe   (Windows)
    // k6.executable=/usr/local/bin/k6   (Linux/mac)
    @Value("${k6.executable:k6}")
    private String k6Executable;

    // Only used in REQUETES mode, where we don't know the real duration up front
    // (unlike DUREE mode, which just waits durationSeconds + 60s). Bump this if
    // you expect very large request counts against a slow target.
    @Value("${k6.max-wait-seconds-requetes:300}")
    private long maxWaitSecondsForRequestCountMode;

    public K6RunOutput run(TestCaseSnapshot snapshot) throws IOException, InterruptedException {
        Path scriptPath = extractScript();
        Path summaryPath = Files.createTempFile("k6-summary-" + snapshot.testCaseId() + "-", ".json");
        Path bodyPath = null;

        try {
            List<String> cmd = new ArrayList<>(List.of(
                    k6Executable, "run",
                    "-e", "TARGET_URL=" + snapshot.url(),
                    "-e", "METHOD=" + snapshot.method(),
                    "-e", "VUS=" + snapshot.vus(),
                    "-e", "EXPECTED_STATUS=" + snapshot.expectedStatus(),
                    "-e", "TIMEOUT_MS=" + snapshot.timeoutMs(),
                    "-e", "THRESHOLD_MS=" + snapshot.thresholdMs(),
                    "-e", "MAX_ERROR_RATE=" + snapshot.maxErrorRate(),
                    "-e", "HEADERS=" + snapshot.headersJson(),
                    "-e", "RESULT_PATH=" + summaryPath,
                    scriptPath.toString()
            ));

            // Mutually exclusive: testcase-runner.js picks k6's "iterations" executor
            // when ITERATIONS is set, otherwise its default "duration" executor.
            if (snapshot.executionMode() == ExecutionMode.REQUETES) {
                cmd.add("-e");
                cmd.add("ITERATIONS=" + snapshot.requestCount());
            } else {
                cmd.add("-e");
                cmd.add("DURATION=" + snapshot.durationSeconds() + "s");
            }

            if (snapshot.body() != null && !snapshot.body().isBlank()) {
                // Passed via a file rather than "-e BODY=...": Windows' process-argument
                // quoting can mangle a raw JSON string containing quotes/braces on the
                // command line, corrupting the payload before it reaches the target server
                // (a very plausible cause of "500 on POST but the JSON looks fine to me").
                // k6's open() (called from init context, i.e. testcase-runner.js's top
                // level, not inside default()) reads the file exactly as written — no
                // shell/CLI parsing involved at all.
                bodyPath = Files.createTempFile("k6-body-" + snapshot.testCaseId() + "-", ".json");
                Files.writeString(bodyPath, snapshot.body(), StandardCharsets.UTF_8);
                cmd.add("-e");
                cmd.add("BODY_FILE=" + bodyPath);
            }

            Process process = new ProcessBuilder(cmd)
                    .redirectErrorStream(true)
                    .start();

            String stdout = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            // DUREE: we know exactly how long the run should take. REQUETES: we don't
            // (depends entirely on how fast the target responds), so fall back to a
            // generous configurable cap instead.
            long waitLimitSeconds = snapshot.executionMode() == ExecutionMode.DUREE
                    ? snapshot.durationSeconds() + 60
                    : maxWaitSecondsForRequestCountMode;
            boolean finished = process.waitFor(waitLimitSeconds, TimeUnit.SECONDS);

            if (!finished) {
                process.destroyForcibly();
                throw new IllegalStateException("k6 n'a pas terminé dans le délai imparti (" + waitLimitSeconds + "s)");
            }
            if (!Files.exists(summaryPath) || Files.size(summaryPath) == 0) {
                throw new IllegalStateException(
                        "k6 n'a produit aucun résultat (exit=" + process.exitValue() + "). Sortie: " + stdout);
            }

            String json = Files.readString(summaryPath);
            Files.deleteIfExists(summaryPath);
            return new K6RunOutput(json, stdout);
        } finally {
            if (bodyPath != null) {
                Files.deleteIfExists(bodyPath);
            }
        }
    }

    /**
     * k6 needs a real file path — this copies the script bundled on the
     * classpath (src/main/resources/k6/testcase-runner.js) out to a temp file
     * for each run.
     */
    private Path extractScript() throws IOException {
        Path target = Files.createTempFile("testcase-runner-", ".js");
        try (var in = new ClassPathResource("k6/testcase-runner.js").getInputStream()) {
            Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
        }
        target.toFile().deleteOnExit();
        return target;
    }
}