package com.bct.back.entities;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * One cached AI-generated report per Execution — generated once (on first
 * request), reused on every subsequent view rather than re-calling Gemini.
 */
@Entity
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Table(name = "ai_report")
public class AiReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "execution_id", nullable = false, unique = true)
    @JsonIgnoreProperties({"testcase", "rapportK6Json", "corpsReponsesJson"})
    private Execution execution;

    @Column(name = "generated_at", nullable = false)
    private LocalDateTime generatedAt;

    // FAIBLE / MOYEN / ELEVE — plain String rather than an enum since this is
    // LLM output; an unexpected value shouldn't blow up deserialization.
    @Column(nullable = false)
    private String severity;

    @Column(columnDefinition = "TEXT")
    private String summary;

    // Stored as JSON arrays (TEXT), same pattern as Execution.corpsReponsesJson —
    // parsed client-side.
    @Column(name = "strengths_json", columnDefinition = "TEXT")
    private String strengthsJson;

    @Column(name = "risks_json", columnDefinition = "TEXT")
    private String risksJson;

    @Column(name = "recommendations_json", columnDefinition = "TEXT")
    private String recommendationsJson;

    // Kept for debugging / as a fallback if structured parsing failed.
    @Column(name = "raw_response", columnDefinition = "TEXT")
    private String rawResponse;
}