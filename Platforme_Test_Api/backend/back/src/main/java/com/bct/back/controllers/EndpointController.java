package com.bct.back.controllers;

import com.bct.back.entities.Endpoint;
import com.bct.back.services.EndpointService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/endpoints")
@RequiredArgsConstructor
public class EndpointController {

    private final EndpointService apiEndpointService;

    /**
     * Sans paramètre : liste tous les endpoints.
     * Avec ?targetId=X : liste les endpoints d'une cible donnée
     * (correspond à l'appel `listEndpoints(targetId)` du frontend).
     */
    @GetMapping
    public List<Endpoint> findAll(@RequestParam(required = false) Long targetId) {
        if (targetId != null) {
            return apiEndpointService.findByTargetId(targetId);
        }
        return apiEndpointService.findAll();
    }

    @GetMapping("/target/{targetId}")
    public List<Endpoint> findByTarget(@PathVariable Long targetId) {
        return apiEndpointService.findByTargetId(targetId);
    }

    @GetMapping("/{id}")
    public Endpoint findById(@PathVariable Long id) {
        return apiEndpointService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Endpoint create(@Valid @RequestBody Endpoint endpoint) {
        return apiEndpointService.create(endpoint);
    }

    @PutMapping("/{id}")
    public Endpoint update(@PathVariable Long id, @Valid @RequestBody Endpoint endpoint) {
        return apiEndpointService.update(id, endpoint);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        apiEndpointService.delete(id);
        return ResponseEntity.noContent().build();
    }
}