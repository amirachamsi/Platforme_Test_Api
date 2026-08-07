package com.bct.back.DTO;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class ProfileUpdateInitiationResponse {
    private String requestId;
    private int expiresInMinutes;
}
