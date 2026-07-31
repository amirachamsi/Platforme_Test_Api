package com.bct.back.controllers;

import com.bct.back.entities.*;
import com.bct.back.services.ApiTargetService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/targets")
@CrossOrigin(origins = "http://localhost:4200")
public class ApiTargetController {

    private final ApiTargetService service;

    public ApiTargetController(ApiTargetService service) {
        this.service = service;
    }

    @GetMapping
    public List<ApiTarget> getAll() {
        return service.findAll();
    }

    @GetMapping("/{id}")
    public ApiTarget getOne(@PathVariable Long id) {
        return service.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiTarget create(@RequestBody ApiTarget target) {
        return service.create(target);
    }

    @PutMapping("/{id}")
    public ApiTarget update(@PathVariable Long id, @RequestBody ApiTarget target) {
        return service.update(id, target);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}