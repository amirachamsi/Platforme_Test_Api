package com.bct.back.repositories;

import com.bct.back.entities.ApiTarget;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ApiTargetRepository extends JpaRepository<ApiTarget, Long> {
    // Used by the main listing endpoint — excludes soft-deleted rows.
    // findById() stays unfiltered so Endpoint rows can still resolve their
    // (soft-deleted) target.
    List<ApiTarget> findByDeletedFalse();
}