package com.bct.back.controllers;

import com.bct.back.entities.Execution;
import com.bct.back.repositories.ExecutionRepository;
import com.bct.back.services.ExecutionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/executions")
@RequiredArgsConstructor
public class ExecutionController {

    private final ExecutionService executionService;
    private final ExecutionRepository executionRepository;

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
}