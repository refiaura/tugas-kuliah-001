package com.tugaskuliah.pos.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

import java.util.Set;

public record CreateRoleRequest(
        @NotBlank(message = "nama role wajib diisi")
        @Pattern(regexp = "^[A-Z0-9_]+$", message = "nama role huruf kapital, angka, underscore")
        String name,
        String description,
        Set<String> permissions) {
}
