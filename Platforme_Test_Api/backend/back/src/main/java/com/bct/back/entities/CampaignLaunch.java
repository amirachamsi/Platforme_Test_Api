package com.bct.back.entities;

import com.bct.back.enums.CampaignMode;
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
@Table(name = "campaign_launch")
public class CampaignLaunch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "campaign_id", nullable = false)
    @JsonIgnoreProperties({"testCases"})
    private Campaign campaign;

    @Column(name = "launched_at", nullable = false)
    private LocalDateTime launchedAt;

    // Snapshotted at launch time — the campaign's mode or test case list could
    // change afterward, but this row should still reflect what actually ran.
    @Enumerated(EnumType.STRING)
    private CampaignMode mode;

    @Column(name = "testcase_count")
    private Integer testCaseCount;
}