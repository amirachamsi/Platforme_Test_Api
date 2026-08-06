package com.bct.back.entities;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Data
@Table(name = "api_targets")
public class ApiTarget {


    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String nom;

    private String urlBase;

    private String endpoint;

    private HttpMethod httpMethod = HttpMethod.GET;

    @Enumerated(EnumType.STRING)
    private AuthType authType = AuthType.NONE;

    // Holds whichever secret applies: bearer token, API key value, or OAuth2 client secret
    private String secretRef;

    private String keyName;

    @Enumerated(EnumType.STRING)
    private KeyLocation keyIn = KeyLocation.HEADER;

    private String tokenUrl;

    private String clientId;

    private boolean actif = true;
}

