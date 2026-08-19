package com.bct.back.entities;

import com.bct.back.enums.AuthType;
import com.bct.back.enums.KeyLocation;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Builder
@Getter
@Setter
@Entity
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "targets")
public class ApiTarget {


    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String nom;

    private String urlBase;

    @Enumerated(EnumType.STRING)
    private AuthType authType = AuthType.NONE;

    // Holds whichever secret applies: bearer token, API key value, or OAuth2 client secret
    private String secretRef;

    private String keyName;

    @Enumerated(EnumType.STRING)
    private KeyLocation keyIn = KeyLocation.HEADER;

    private String tokenUrl;

    private String clientId;

    @Builder.Default
    private Boolean actif = true;
    @JsonIgnore
    @OneToMany(mappedBy = "target", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<Endpoint> endpoints = new ArrayList<>();
}

