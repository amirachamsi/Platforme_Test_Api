package com.bct.back.repositories;

import com.bct.back.entities.Campaign;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CampaignRepository extends JpaRepository<Campaign, Long> {
    // Used by the main listing endpoint — excludes soft-deleted rows.
    // findById() stays unfiltered so the History page can still expand a
    // deleted campaign and see its test cases.
    List<Campaign> findByDeletedFalse();
}