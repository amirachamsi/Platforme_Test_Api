package com.bct.back.repositories;

import com.bct.back.entities.PingResult;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PingResultRepository extends JpaRepository<PingResult, Long> {
    List<PingResult> findAllByOrderByPingedAtDesc();
}