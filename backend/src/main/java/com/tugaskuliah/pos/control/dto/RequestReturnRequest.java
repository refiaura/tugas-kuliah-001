package com.tugaskuliah.pos.control.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record RequestReturnRequest(
        @NotBlank(message = "Alasan retur wajib diisi") String reason,
        @NotEmpty(message = "Minimal satu item diretur") @Valid List<ReturnLineRequest> lines
) {}
