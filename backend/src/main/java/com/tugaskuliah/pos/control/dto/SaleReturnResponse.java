package com.tugaskuliah.pos.control.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

public record SaleReturnResponse(
        Long id,
        String returnNo,
        Long saleId,
        String invoiceNo,
        Long approvalId,
        String reason,
        BigDecimal refundAmount,
        Long shiftId,
        String status,
        String createdBy,
        OffsetDateTime createdAt,
        List<ReturnLineResponse> lines
) {}
