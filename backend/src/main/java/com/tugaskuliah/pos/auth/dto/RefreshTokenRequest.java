package com.tugaskuliah.pos.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record RefreshTokenRequest(
        @NotBlank(message = "refreshToken wajib diisi") String refreshToken) {
}
