package com.bct.back.controllers;

import com.bct.back.entities.PingResult;
import com.bct.back.repositories.PingResultRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

// Namespaced under /api/endpoints/** so the existing SecurityConfig permitAll
// rule for that prefix already covers this — no security config change needed.
@RestController
@RequestMapping("/api/endpoints/pings")
@RequiredArgsConstructor
public class PingHistoryController {

    private final PingResultRepository pingResultRepository;

    @GetMapping
    public List<PingResult> history() {
        return pingResultRepository.findAllByOrderByPingedAtDesc();
    }
}