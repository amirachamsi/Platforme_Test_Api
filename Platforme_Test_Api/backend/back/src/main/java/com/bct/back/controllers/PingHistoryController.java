package com.bct.back.controllers;

import com.bct.back.entities.PingResult;
import com.bct.back.repositories.PingResultRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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

    @DeleteMapping
    public ResponseEntity<Void> deleteAll() {
        pingResultRepository.deleteAll();
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteById(@PathVariable Long id) {
        if (!pingResultRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        pingResultRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
