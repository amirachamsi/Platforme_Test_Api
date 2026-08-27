package com.bct.back.entities;

import com.bct.back.enums.ExecutionMode;
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

    private String expectedCode;

    private String JSONBody;

    private String Assertions;

    // Nombre d'utilisateurs virtuels (VUs) à utiliser lors de l'exécution k6.
    @Column(name = "vus")
    @Builder.Default
    private Integer vus = 1;

    // Durée du test k6 en secondes. Utilisé uniquement si executionMode = DUREE.
    @Column(name = "duree_sec")
    @Builder.Default
    private Integer dureeSec = 10;

    // DUREE : le test tourne pendant dureeSec secondes.
    // REQUETES : le test s'arrête après nombreRequetes requêtes au total, quelle
    // que soit la durée réelle.
    @Enumerated(EnumType.STRING)
    @Column(name = "execution_mode")
    @Builder.Default
    private ExecutionMode executionMode = ExecutionMode.DUREE;

    // Nombre total de requêtes à envoyer. Utilisé uniquement si executionMode = REQUETES.
    @Column(name = "nombre_requetes")
    @Builder.Default
    private Integer nombreRequetes = 100;

    // Soft delete: hidden from normal listings, but the row stays intact so
    // Execution/CampaignTestCase rows referencing it keep resolving to full,
    // real data (name, thresholds, etc.) instead of going blank.
    @Builder.Default
    private Boolean deleted = false;
}