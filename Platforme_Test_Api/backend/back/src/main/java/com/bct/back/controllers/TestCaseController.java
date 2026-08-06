package com.bct.back.controllers;

import com.bct.back.entities.TestCase;
import com.bct.back.services.TestCaseService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/testcases")
@RequiredArgsConstructor
public class TestCaseController {

    private final TestCaseService testCaseService;

    @GetMapping
    public List<TestCase> findAll(@RequestParam(required = false) Long endpointId) {
        if (endpointId != null) {
            return testCaseService.findByEndpointId(endpointId);
        }
        return testCaseService.findAll();
    }

    @GetMapping("/endpoint/{endpointId}")
    public List<TestCase> findByEndpoint(@PathVariable Long endpointId) {
        return testCaseService.findByEndpointId(endpointId);
    }

    @GetMapping("/{id}")
    public TestCase findById(@PathVariable Long id) {
        return testCaseService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TestCase create(@Valid @RequestBody TestCase testCase) {
        return testCaseService.create(testCase);
    }

    @PutMapping("/{id}")
    public TestCase update(@PathVariable Long id, @Valid @RequestBody TestCase testCase) {
        return testCaseService.update(id, testCase);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        testCaseService.delete(id);
        return ResponseEntity.noContent().build();
    }
}