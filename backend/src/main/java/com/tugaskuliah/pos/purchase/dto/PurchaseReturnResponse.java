package com.tugaskuliah.pos.purchase.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

public record PurchaseReturnResponse(
        Long id,
        String docNo,
        Long poId,
        String poDocNo,
        String reason,
        BigDecimal supplierCredit,
        String createdBy,
        OffsetDateTime createdAt,
        List<PrLineResponse> lines) {
}
