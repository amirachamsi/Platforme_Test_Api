package com.bct.back.controllers;

import com.bct.back.DTO.ConfirmProfileUpdateRequest;
import com.bct.back.DTO.ProfileResponse;
import com.bct.back.DTO.ProfileUpdateInitiationResponse;
import com.bct.back.DTO.UpdateProfileRequest;
import com.bct.back.services.ProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class ProfileController {

    private final ProfileService profileService;

    @GetMapping("/me")
    public ResponseEntity<ProfileResponse> getProfile() {
        String email = getAuthenticatedEmail();
        return ResponseEntity.ok(profileService.getProfile(email));
    }

    @PostMapping("/profile/request-update")
    public ResponseEntity<ProfileUpdateInitiationResponse> requestUpdate(@RequestBody UpdateProfileRequest request) {
        String email = getAuthenticatedEmail();
        return ResponseEntity.ok(profileService.requestProfileUpdate(email, request));
    }

    @PostMapping("/profile/confirm-update")
    public ResponseEntity<ProfileResponse> confirmUpdate(@RequestBody ConfirmProfileUpdateRequest request) {
        return ResponseEntity.ok(profileService.confirmProfileUpdate(request));
    }

    private String getAuthenticatedEmail() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            throw new RuntimeException("Utilisateur non authentifié.");
        }
        return authentication.getName();
    }
}
