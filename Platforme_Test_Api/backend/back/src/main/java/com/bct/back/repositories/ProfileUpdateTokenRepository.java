package com.bct.back.repositories;

import com.bct.back.entities.ProfileUpdateToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ProfileUpdateTokenRepository extends JpaRepository<ProfileUpdateToken, String> {
}
