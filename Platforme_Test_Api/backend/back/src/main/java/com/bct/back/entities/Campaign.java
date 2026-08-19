package com.bct.back.entities;

import com.bct.back.enums.CampaignMode;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Table(name = "campaign")
public class Campaign {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String nom;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private CampaignMode mode = CampaignMode.PARALLELE;

    @Column(name = "last_launched_at")
    private LocalDateTime lastLaunchedAt;

    // Ordering only matters in SEQUENTIELLE mode, but kept for every campaign so
    // the selection order is preserved regardless of mode (harmless in PARALLELE,
    // where it's simply ignored at launch time).
    @OneToMany(mappedBy = "campaign", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("ordre ASC")
    @JsonIgnoreProperties({"campaign"})
    @Builder.Default
    private List<CampaignTestCase> testCases = new ArrayList<>();
}