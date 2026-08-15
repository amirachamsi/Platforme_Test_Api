package com.bct.back.repositories;

import com.bct.back.entities.CampaignLaunch;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CampaignLaunchRepository extends JpaRepository<CampaignLaunch, Long> {
    List<CampaignLaunch> findAllByOrderByLaunchedAtDesc();
}