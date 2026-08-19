package com.bct.back.repositories;

import com.bct.back.entities.TestCase;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TestCaseRepository extends JpaRepository<TestCase, Long> {
    List<TestCase> findByEndpointId(Long endpointId);
}
