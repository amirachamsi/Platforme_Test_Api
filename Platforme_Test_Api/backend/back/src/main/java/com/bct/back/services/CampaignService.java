package com.bct.back.services;

import com.bct.back.DTO.CampaignRequest;
import com.bct.back.entities.Campaign;
import com.bct.back.entities.CampaignLaunch;
import com.bct.back.entities.CampaignTestCase;
import com.bct.back.entities.TestCase;
import com.bct.back.enums.CampaignMode;
import com.bct.back.repositories.CampaignLaunchRepository;
import com.bct.back.repositories.CampaignRepository;
import com.bct.back.repositories.TestCaseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class CampaignService {

    private final CampaignRepository campaignRepository;
    private final CampaignLaunchRepository campaignLaunchRepository;
    private final TestCaseRepository testCaseRepository;

    @Transactional(readOnly = true)
    public List<Campaign> findAll() {
        return campaignRepository.findByDeletedFalse();
    }

    @Transactional(readOnly = true)
    public Campaign findById(Long id) {
        return campaignRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Campagne introuvable, id=" + id));
    }

    public Campaign create(CampaignRequest req) {
        if (req.nom() == null || req.nom().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le nom de la campagne est obligatoire.");
        }
        Campaign campaign = Campaign.builder()
                .nom(req.nom())
                .description(req.description())
                .mode(req.mode() != null ? req.mode() : CampaignMode.PARALLELE)
                .build();
        applyTestCases(campaign, req.testCaseIds());
        return campaignRepository.save(campaign);
    }

    public Campaign update(Long id, CampaignRequest req) {
        Campaign campaign = findById(id);
        campaign.setNom(req.nom());
        campaign.setDescription(req.description());
        if (req.mode() != null) {
            campaign.setMode(req.mode());
        }
        // orphanRemoval=true on Campaign.testCases means clearing + re-adding
        // correctly deletes the old join rows and inserts the new ones on save.
        campaign.getTestCases().clear();
        applyTestCases(campaign, req.testCaseIds());
        return campaignRepository.save(campaign);
    }

    public void delete(Long id) {
        Campaign campaign = findById(id);
        campaign.setDeleted(true);
        campaignRepository.save(campaign);
    }

    /**
     * Called once when a launch begins (by the frontend, before it starts firing
     * individual /api/executions/testcase/{id} calls for each test case in the
     * campaign — see CampaignComponent). Timestamps the launch on the campaign
     * itself (for the quick "last launched" display on its card) AND records a
     * permanent history row, since lastLaunchedAt alone only remembers the most
     * recent launch. Actual test execution is orchestrated client-side, reusing
     * the existing single-testcase execution endpoint for both parallel and
     * sequential modes.
     */
    public Campaign markLaunched(Long id) {
        Campaign campaign = findById(id);
        LocalDateTime now = LocalDateTime.now();
        campaign.setLastLaunchedAt(now);
        Campaign saved = campaignRepository.save(campaign);

        campaignLaunchRepository.save(CampaignLaunch.builder()
                .campaign(saved)
                .launchedAt(now)
                .mode(saved.getMode())
                .testCaseCount(saved.getTestCases().size())
                .build());

        return saved;
    }

    @Transactional(readOnly = true)
    public List<CampaignLaunch> findAllLaunches() {
        return campaignLaunchRepository.findAllByOrderByLaunchedAtDesc();
    }

    private void applyTestCases(Campaign campaign, List<Long> testCaseIds) {
        if (testCaseIds == null) return;
        int ordre = 0;
        for (Long testCaseId : testCaseIds) {
            TestCase testCase = testCaseRepository.findById(testCaseId)
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.NOT_FOUND, "Cas de test introuvable, id=" + testCaseId));
            campaign.getTestCases().add(CampaignTestCase.builder()
                    .campaign(campaign)
                    .testcase(testCase)
                    .ordre(ordre++)
                    .build());
        }
    }
}