package com.tugaskuliah.pos.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

import java.util.Set;

public record UpdateUserRequest(
        @NotBlank(message = "nama lengkap wajib diisi") String fullName,
        @Email(message = "format email tidak valid") String email,
        String phone,
        Boolean active,
        Set<String> roles) {
}
