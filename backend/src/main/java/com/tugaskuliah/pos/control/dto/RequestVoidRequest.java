package com.tugaskuliah.pos.control.dto;

import jakarta.validation.constraints.NotBlank;

public record RequestVoidRequest(
        @NotBlank(message = "Alasan void wajib diisi") String reason
) {}
