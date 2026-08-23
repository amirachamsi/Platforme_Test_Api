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
        System.out.println(">>> ETAPE 1: avant authenticate");
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
        );
        System.out.println(">>> ETAPE 2: apres authenticate, avant findByEmail");

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new UsernameNotFoundException("Utilisateur non trouvé"));
        System.out.println(">>> ETAPE 3: apres findByEmail, avant PrincipalUser");

        PrincipalUser principalUser = new PrincipalUser(user);
        System.out.println(">>> ETAPE 4: avant generateToken");

        String jwtToken = jwtUtils.generateToken(principalUser);
        System.out.println(">>> ETAPE 5: apres generateToken, avant return");

        String roleName = user.getRole() != null ? user.getRole().toString() : "ADMIN";
        return new AuthResponse(jwtToken, user.getEmail(), roleName, 60);
    }
}