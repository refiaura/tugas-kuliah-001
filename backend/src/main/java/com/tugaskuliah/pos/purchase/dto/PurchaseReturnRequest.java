package com.tugaskuliah.pos.purchase.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record PurchaseReturnRequest(
        @NotNull Long poId,
        @NotBlank @Size(max = 255) String reason,
        @NotEmpty(message = "minimal satu baris retur") @Valid List<PrLineRequest> lines) {
}
