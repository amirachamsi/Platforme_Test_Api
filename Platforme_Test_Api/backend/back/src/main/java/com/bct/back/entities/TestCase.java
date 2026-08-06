package com.bct.back.entities;

import com.bct.back.enums.TestStatus;
import com.bct.back.enums.TypeStatus;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Table(name = "testCase")
public class TestCase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // NB: le modèle frontend référence `endpoint`, pas `apiTarget`.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "endpoint_id", nullable = false)
    @JsonIgnoreProperties({"target"})
    private Endpoint endpoint;

    @Column(nullable = false)
    private String nom;

    @Enumerated(EnumType.STRING)
    private TypeStatus typeStatus;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private TestStatus teststatus = TestStatus.EN_ATTENTE;

    @Column(name = "seuil_ms")
    private Integer seuilMs;

    @Column(name = "taux_erreur_max")
    private Double tauxErreurMax;

    @Column(name = "timeout_ms")
    private Integer timeoutMs;
}