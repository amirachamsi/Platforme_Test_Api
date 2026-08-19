package com.bct.back.entities;

import com.bct.back.enums.Role;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Setter
@Getter
@AllArgsConstructor @NoArgsConstructor
@Builder
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String username;
    private String password;
    private String email;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private Role role = Role.ADMIN;

    // Champs pour la mise à jour temporaire du profil
    private String newUsername;
    private String newPassword;
    private String profileVerificationCode;
    private LocalDateTime profileVerificationExpiresAt;
}