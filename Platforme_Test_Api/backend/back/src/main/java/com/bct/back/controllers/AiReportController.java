package com.bct.back.controllers;

import com.bct.back.entities.AiReport;
import com.bct.back.services.AiReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/aireports")
@RequiredArgsConstructor
public class AiReportController {

    private final AiReportService aiReportService;

    // Idempotent in effect: returns the cached report if one already exists for
    // this execution, otherwise generates + caches it. POST because the first
    // call does have a side effect (calling Gemini, persisting a row).
    @PostMapping("/{id}/ai-report")
    public AiReport generateOrFetch(@PathVariable Long id) {
        return aiReportService.getOrGenerate(id);
    }
}