package com.bct.back.controllers;

import com.bct.back.entities.ApiTarget;
import com.bct.back.services.ApiTargetService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/targets")
@RequiredArgsConstructor
public class ApiTargetController {

    private final ApiTargetService apiTargetService;

    @GetMapping
    public List<ApiTarget> findAll() {
        return apiTargetService.findAll();
    }

    @GetMapping("/{id}")
    public ApiTarget findById(@PathVariable Long id) {
        return apiTargetService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiTarget create(@Valid @RequestBody ApiTarget target) {
        return apiTargetService.create(target);
    }

    @PutMapping("/{id}")
    public ApiTarget update(@PathVariable Long id, @Valid @RequestBody ApiTarget target) {
        return apiTargetService.update(id, target);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        apiTargetService.delete(id);
        return ResponseEntity.noContent().build();
    }
}