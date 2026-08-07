package com.bct.back.repositories;

import com.bct.back.entities.Execution;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ExecutionRepository extends JpaRepository<Execution, Long>
{

    List<Execution> findByTestcaseId(Long testcaseId);
}
