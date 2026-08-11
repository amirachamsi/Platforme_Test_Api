package com.bct.back.entities;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Table(name = "campaign_testcase")
public class CampaignTestCase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "campaign_id", nullable = false)
    @JsonIgnoreProperties({"testCases"})
    private Campaign campaign;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "testcase_id", nullable = false)
    @JsonIgnoreProperties({"endpoint"})
    private TestCase testcase;

    // Position within the campaign, 0-based. Drives execution order in
    // SEQUENTIELLE mode; ignored (but still stored) in PARALLELE mode.
    @Column(nullable = false)
    private Integer ordre;
}