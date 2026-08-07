package com.bct.back.controllers;

import com.bct.back.entities.Execution;
import com.bct.back.services.ExecutionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/executions")
@RequiredArgsConstructor
public class ExecutionController {

    private final ExecutionService executionService;

    @GetMapping
    public List<Execution> findAll(@RequestParam(required = false) Long testcaseId) {
        if (testcaseId != null) {
            return executionService.findByTestcaseId(testcaseId);
        }
        return executionService.findAll();
    }

    @GetMapping("/testcase/{testcaseId}")
    public List<Execution> findByTestcase(@PathVariable Long testcaseId) {
        return executionService.findByTestcaseId(testcaseId);
    }

    @GetMapping("/{id}")
    public Execution findById(@PathVariable Long id) {
        return executionService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Execution create(@Valid @RequestBody Execution execution) {
        return executionService.create(execution);
    }

    @PutMapping("/{id}")
    public Execution update(@PathVariable Long id, @Valid @RequestBody Execution execution) {
        return executionService.update(id, execution);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        executionService.delete(id);
        return ResponseEntity.noContent().build();
    }
}