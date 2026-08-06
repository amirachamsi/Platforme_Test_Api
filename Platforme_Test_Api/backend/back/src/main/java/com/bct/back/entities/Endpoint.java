package com.bct.back.entities;

import com.bct.back.enums.HttpMethodType;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Table(name = "endpoint")
public class Endpoint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "target_id", nullable = false)
    @JsonIgnoreProperties({"endpoints"})
    private ApiTarget target;

    @Column(nullable = false)
    private String nom;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private HttpMethodType methode;

    @Column(nullable = false)
    private String chemin;

    @Lob //la colonne accepte une taille quasi illimitée
    private String headers;

    @Lob
    private String params;

    @Column(name = "content_type")
    private String contentType;

    @Lob
    private String body;

    @Column(name = "code_attendu")
    private Integer codeAttendu;

    @Column(name = "temps_max_ms")
    private Integer tempsMaxMs;
}