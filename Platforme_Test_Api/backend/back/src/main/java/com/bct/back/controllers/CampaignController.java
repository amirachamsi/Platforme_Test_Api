package com.bct.back.controllers;

import com.bct.back.DTO.CampaignRequest;
import com.bct.back.entities.Campaign;
import com.bct.back.entities.CampaignLaunch;
import com.bct.back.services.CampaignService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/campaigns")
@RequiredArgsConstructor
public class CampaignController {

    private final CampaignService campaignService;

    @GetMapping
    public List<Campaign> findAll() {
        return campaignService.findAll();
    }

    @GetMapping("/{id}")
    public Campaign findById(@PathVariable Long id) {
        return campaignService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Campaign create(@RequestBody CampaignRequest request) {
        return campaignService.create(request);
    }

    @PutMapping("/{id}")
    public Campaign update(@PathVariable Long id, @RequestBody CampaignRequest request) {
        return campaignService.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        campaignService.delete(id);
        return ResponseEntity.noContent().build();
    }

    // Timestamps the launch; the frontend then fires the individual
    // /api/executions/testcase/{id} calls itself (parallel or sequential).
    @PostMapping("/{id}/launch")
    public Campaign launch(@PathVariable Long id) {
        return campaignService.markLaunched(id);
    }

    // Full launch history across all campaigns, newest first — for the History page.
    @GetMapping("/launches")
    public List<CampaignLaunch> launchHistory() {
        return campaignService.findAllLaunches();
    }
}