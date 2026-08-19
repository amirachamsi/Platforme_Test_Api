package com.bct.back.DTO;

import com.bct.back.enums.CampaignMode;

import java.util.List;

public record CampaignRequest(
        String nom,
        String description,
        CampaignMode mode,
        List<Long> testCaseIds // ordered — position in this list becomes CampaignTestCase.ordre
) {
}