package com.tugaskuliah.pos.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
        @NotBlank(message = "username wajib diisi") String username,
        @NotBlank(message = "password wajib diisi") String password) {
}
