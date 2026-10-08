package com.tugaskuliah.pos.purchase.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record GoodsReceiptRequest(
        @NotNull Long poId,
        @Size(max = 2000) String notes,
        @NotEmpty(message = "minimal satu baris terima") @Valid List<GrLineRequest> lines) {
}
