package com.tugaskuliah.pos.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.Set;

public record CreateUserRequest(
        @NotBlank(message = "username wajib diisi")
        @Size(min = 3, max = 50, message = "username 3-50 karakter") String username,
        @NotBlank(message = "password wajib diisi")
        @Size(min = 6, max = 100, message = "password minimal 6 karakter") String password,
        @NotBlank(message = "nama lengkap wajib diisi") String fullName,
        @Email(message = "format email tidak valid") String email,
        String phone,
        Set<String> roles) {
}
