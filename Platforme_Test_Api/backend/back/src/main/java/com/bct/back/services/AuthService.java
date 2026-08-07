package com.bct.back.services;

import com.bct.back.DTO.AuthRequest;
import com.bct.back.DTO.AuthResponse;
import com.bct.back.entities.User;
import com.bct.back.repositories.UserRepository;
import com.bct.back.security.JwtUtils; // Assure-toi d'importer ta classe JWT
import com.bct.back.security.PrincipalUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final JwtUtils jwtUtils; // Ton utilitaire de génération JWT

    public AuthResponse login(AuthRequest request) {
        // 1. Authentifier l'utilisateur
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
        );

        // 2. Récupérer l'utilisateur
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new UsernameNotFoundException("Utilisateur non trouvé"));

        // 3. Générer le Token JWT
        PrincipalUser principalUser = new PrincipalUser(user);
        String jwtToken = jwtUtils.generateToken(principalUser);
        // 4. Récupérer le nom du rôle sous forme de String
        String roleName = user.getRole() != null ? user.getRole().toString() : "ADMIN";

        // 5. Renvoyer la réponse à Angular
        return new AuthResponse(jwtToken, user.getEmail(), roleName, 60);
    }
}