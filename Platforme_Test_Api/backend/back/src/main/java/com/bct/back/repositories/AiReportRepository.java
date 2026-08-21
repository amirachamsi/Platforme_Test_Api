package com.bct.back.repositories;

import com.bct.back.entities.AiReport;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AiReportRepository extends JpaRepository<AiReport, Long> {
    Optional<AiReport> findByExecutionId(Long executionId);
}