package com.bct.back.repositories;

import com.bct.back.entities.Execution;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ExecutionRepository extends JpaRepository<Execution, Long> {

    List<Execution> findByTestcaseIdOrderByDateDebutDesc(Long testCaseId);

    Optional<Execution> findFirstByTestcaseIdOrderByDateDebutDesc(Long testCaseId);
}