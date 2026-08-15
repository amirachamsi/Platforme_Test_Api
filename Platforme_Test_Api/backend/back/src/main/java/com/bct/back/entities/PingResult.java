package com.bct.back.entities;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Table(name = "ping_result")
public class PingResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "endpoint_id", nullable = false)
    private Endpoint endpoint;

    @Column(name = "pinged_at", nullable = false)
    private LocalDateTime pingedAt;

    @Column(nullable = false)
    private Boolean success;

    // Null when the request never got a response at all (timeout, DNS failure,
    // connection refused, etc. — see message for details in that case).
    @Column(name = "status_code")
    private Integer statusCode;

    @Column(columnDefinition = "TEXT")
    private String message;
}