package com.bct.back.config;

import com.bct.back.enums.Role;
import com.bct.back.entities.User;
import com.bct.back.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@Slf4j
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepo;
    private final PasswordEncoder passwordEncoder;

    @Value("${ADMIN_EMAIL:admin@bct.tn}")
    private String adminEmail;

    @Value("${ADMIN_PASSWORD:123456789}")
    private String adminPassword;

    @Override
    public void run(String... args) {
        initAdminAccount();
    }

    private void initAdminAccount() {
        if (userRepo.existsByEmail(adminEmail)) {
            log.info("Admin account already exists — skipping.");
            return;
        }

        User admin = User.builder()
                .username("Admin")
                .email(adminEmail)
                .password(passwordEncoder.encode(adminPassword))
                .role(Role.ADMIN)
                .build();

        userRepo.save(admin);
        log.info("✓ Admin account created — email={}", adminEmail);
    }
}