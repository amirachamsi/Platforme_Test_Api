package com.bct.back.services;

import com.bct.back.DTO.ConfirmProfileUpdateRequest;
import com.bct.back.DTO.ProfileResponse;
import com.bct.back.DTO.ProfileUpdateInitiationResponse;
import com.bct.back.DTO.UpdateProfileRequest;
import com.bct.back.entities.User;
import com.bct.back.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class ProfileService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;

    public ProfileResponse getProfile(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));
        return new ProfileResponse(user.getEmail(), user.getUsername(), user.getRole().name());
    }

    @Transactional
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

        String verificationCode = String.format("%06d", (int) (Math.random() * 1_000_000));
        LocalDateTime expiresAt = LocalDateTime.now().plusMinutes(15);

        // Affectation explicite uniquement en cas de changement
        if (usernameChanged) {
            user.setNewUsername(request.getUsername());
        }
        if (passwordChanged) {
            user.setNewPassword(passwordEncoder.encode(request.getPassword()));
        }

        user.setProfileVerificationCode(verificationCode);
        user.setProfileVerificationExpiresAt(expiresAt);

        userRepository.save(user);
        emailService.sendVerificationCode(user.getEmail(), verificationCode);

        return new ProfileUpdateInitiationResponse(user.getEmail(), 15);
    }

    @Transactional
    public ProfileResponse confirmProfileUpdate(ConfirmProfileUpdateRequest request) {
        User user = userRepository.findByEmail(request.getRequestId())
                .orElseThrow(() -> new RuntimeException("Demande de mise à jour introuvable."));

        if (user.getProfileVerificationCode() == null || user.getProfileVerificationExpiresAt() == null) {
            throw new RuntimeException("Aucune demande de modification en cours.");
        }

        if (user.getProfileVerificationExpiresAt().isBefore(LocalDateTime.now())) {
            clearPendingFields(user);
            userRepository.save(user);
            throw new RuntimeException("Le code de confirmation a expiré.");
        }

        if (!user.getProfileVerificationCode().equals(request.getVerificationCode())) {
            throw new RuntimeException("Code de confirmation incorrect.");
        }

        // Application des nouvelles valeurs si elles existent
        if (user.getNewUsername() != null && !user.getNewUsername().isBlank()) {
            user.setUsername(user.getNewUsername());
        }
        if (user.getNewPassword() != null && !user.getNewPassword().isBlank()) {
            user.setPassword(user.getNewPassword());
        }

        // Nettoyage après validation
        clearPendingFields(user);
        userRepository.save(user);

        return new ProfileResponse(user.getEmail(), user.getUsername(), user.getRole().name());
    }

    private void clearPendingFields(User user) {
        user.setNewUsername(null);
        user.setNewPassword(null);
        user.setProfileVerificationCode(null);
        user.setProfileVerificationExpiresAt(null);
    }
}