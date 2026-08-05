package com.bct.back.services;

import com.bct.back.DTO.ConfirmProfileUpdateRequest;
import com.bct.back.DTO.ProfileResponse;
import com.bct.back.DTO.ProfileUpdateInitiationResponse;
import com.bct.back.DTO.UpdateProfileRequest;
import com.bct.back.entities.ProfileUpdateToken;
import com.bct.back.entities.User;
import com.bct.back.repositories.ProfileUpdateTokenRepository;
import com.bct.back.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProfileService {

    private final UserRepository userRepository;
    private final ProfileUpdateTokenRepository profileUpdateTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;

    public ProfileResponse getProfile(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));
        return new ProfileResponse(user.getEmail(), user.getUsername(), user.getRole().name());
    }

    public ProfileUpdateInitiationResponse requestProfileUpdate(String email, UpdateProfileRequest request) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));

        boolean usernameChanged = request.getUsername() != null && !request.getUsername().isBlank() && !request.getUsername().equals(user.getUsername());
        boolean passwordChanged = request.getPassword() != null && !request.getPassword().isBlank();

        if (!usernameChanged && !passwordChanged) {
            throw new RuntimeException("Aucun changement de profil détecté.");
        }

        if (usernameChanged && userRepository.existsByUsername(request.getUsername())) {
            throw new RuntimeException("Le nom d'utilisateur est déjà utilisé.");
        }

        String tokenId = UUID.randomUUID().toString();
        String verificationCode = String.format("%06d", (int) (Math.random() * 1_000_000));
        LocalDateTime expiresAt = LocalDateTime.now().plusMinutes(15);

        String encodedPassword = null;
        if (passwordChanged) {
            encodedPassword = passwordEncoder.encode(request.getPassword());
        }

        ProfileUpdateToken token = ProfileUpdateToken.builder()
                .id(tokenId)
                .userId(user.getId())
                .newUsername(usernameChanged ? request.getUsername() : null)
                .newPassword(encodedPassword)
                .verificationCode(verificationCode)
                .expiresAt(expiresAt)
                .build();

        profileUpdateTokenRepository.save(token);
        emailService.sendVerificationCode(user.getEmail(), verificationCode);

        return new ProfileUpdateInitiationResponse(tokenId, 15);
    }

    @Transactional
    public ProfileResponse confirmProfileUpdate(ConfirmProfileUpdateRequest request) {
        ProfileUpdateToken token = profileUpdateTokenRepository.findById(request.getRequestId())
                .orElseThrow(() -> new RuntimeException("Requête de confirmation introuvable."));

        if (token.getExpiresAt().isBefore(LocalDateTime.now())) {
            profileUpdateTokenRepository.delete(token);
            throw new RuntimeException("Le code de confirmation a expiré.");
        }

        if (!token.getVerificationCode().equals(request.getVerificationCode())) {
            throw new RuntimeException("Code de confirmation incorrect.");
        }

        User user = userRepository.findById(token.getUserId())
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable."));

        if (token.getNewUsername() != null && !token.getNewUsername().isBlank()) {
            user.setUsername(token.getNewUsername());
        }
        if (token.getNewPassword() != null && !token.getNewPassword().isBlank()) {
            user.setPassword(token.getNewPassword());
        }

        userRepository.save(user);
        profileUpdateTokenRepository.delete(token);

        return new ProfileResponse(user.getEmail(), user.getUsername(), user.getRole().name());
    }
}
