package com.bct.back.repositories;

import com.bct.back.entities.ApiTarget;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ApiTargetRepository extends JpaRepository<ApiTarget, Long> {
}
