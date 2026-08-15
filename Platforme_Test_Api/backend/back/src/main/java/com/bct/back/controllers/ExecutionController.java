package com.bct.back.controllers;

import com.bct.back.entities.Execution;
import com.bct.back.repositories.ExecutionRepository;
import com.bct.back.services.ExecutionReportHtmlService;
import com.bct.back.services.ExecutionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/executions")
@RequiredArgsConstructor
public class ExecutionController {

    private final ExecutionService executionService;
    private final ExecutionRepository executionRepository;
    private final ExecutionReportHtmlService executionReportHtmlService;

    // Blocking: runs k6 synchronously and returns once the result is saved.
    @PostMapping("/testcase/{testCaseId}")
    public Execution execute(@PathVariable Long testCaseId) {
        return executionService.execute(testCaseId);
    }

    // 200 + body if a result exists, 204 (no body) if this TestCase has never been run.
    @GetMapping("/testcase/{testCaseId}/latest")
    public ResponseEntity<Execution> latest(@PathVariable Long testCaseId) {
        return executionRepository.findFirstByTestcaseIdOrderByDateDebutDesc(testCaseId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/testcase/{testCaseId}")
    public List<Execution> history(@PathVariable Long testCaseId) {
        return executionRepository.findByTestcaseIdOrderByDateDebutDesc(testCaseId);
    }

    // All executions across every test case, newest first — for the History page.
    @GetMapping
    public List<Execution> all() {
        return executionRepository.findAllByOrderByDateDebutDesc();
    }

    /**
     * Rapport HTML autonome : résumé exécutif, attendu vs mesuré, détail k6
     * repliable, glossaire. Téléchargeable et ouvrable dans le navigateur.
     */
    @GetMapping(value = "/{id}/rapport", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<byte[]> downloadReport(
            @PathVariable Long id,
            @RequestParam(defaultValue = "attachment") String disposition) {
        byte[] html = executionReportHtmlService.generate(id);
        String disp = "inline".equalsIgnoreCase(disposition) ? "inline" : "attachment";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        disp + "; filename=\"rapport-execution-" + id + ".html\"")
                .contentType(new MediaType("text", "html", java.nio.charset.StandardCharsets.UTF_8))
                .contentLength(html.length)
                .body(html);
    }
}
