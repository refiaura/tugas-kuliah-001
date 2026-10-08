package com.tugaskuliah.pos.purchase.dto;

import java.time.OffsetDateTime;
import java.util.List;

public record GoodsReceiptResponse(
        Long id,
        String docNo,
        Long poId,
        String poDocNo,
        String notes,
        String createdBy,
        OffsetDateTime createdAt,
        List<GrLineResponse> lines) {
}
