package com.bct.back.repositories;

import com.bct.back.entities.TestCase;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TestCaseRepository extends JpaRepository<TestCase, Long> {
    List<TestCase> findByEndpointId(Long endpointId);

    // Used by listing endpoints — excludes soft-deleted rows. findById() stays
    // unfiltered so Execution/CampaignTestCase can still resolve deleted ones.
    List<TestCase> findByDeletedFalse();
    List<TestCase> findByEndpointIdAndDeletedFalse(Long endpointId);
}