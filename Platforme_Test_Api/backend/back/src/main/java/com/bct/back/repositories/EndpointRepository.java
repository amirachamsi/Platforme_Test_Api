package com.bct.back.repositories;

import com.bct.back.entities.Endpoint;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EndpointRepository extends JpaRepository<Endpoint, Long> {
    List<Endpoint> findByTargetId(Long targetId);

    // Used by listing endpoints — excludes soft-deleted rows. findById() stays
    // unfiltered so TestCase/PingResult can still resolve deleted endpoints.
    List<Endpoint> findByDeletedFalse();
    List<Endpoint> findByTargetIdAndDeletedFalse(Long targetId);
}