package com.bct.back.entities;

import com.bct.back.enums.TestStatus;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Table(name = "execution")
public class Execution {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // UUID généré avant le lancement du test k6, pour pouvoir corréler cette exécution
// avec les logs externes (k6, API testée, monitoring) même si l'id JPA n'existe pas encore.
    @Column(name = "correlation_id")
    private String correlationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "testcase_id")
    @JsonIgnoreProperties({"endpoint"})
    private TestCase testcase;

    @Column(name = "date_debut")
    private LocalDateTime dateDebut;

    @Column(name = "date_fin")
    private LocalDateTime dateFin;

    @Enumerated(EnumType.STRING)
    private TestStatus statut;

    // --- Données extraites du rapport k6 ---
    @Column(name = "p95_mesure_ms")
    private Integer p95MesureMs;

    @Column(name = "taux_erreur_mesure")
    private Double tauxErreurMesure;

    @Column(name = "req_total")
    private Integer reqTotal;

    @Column(name = "rps_moyen")
    private Double rpsMoyen;

    @Lob
    @Column(name = "rapport_k6_json")
    private String rapportK6Json;
}