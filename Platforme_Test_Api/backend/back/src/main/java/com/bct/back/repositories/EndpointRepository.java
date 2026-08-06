package com.bct.back.repositories;

import com.bct.back.entities.Endpoint;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EndpointRepository extends JpaRepository<Endpoint, Long> {
    List<Endpoint> findByTargetId(Long targetId);
}
