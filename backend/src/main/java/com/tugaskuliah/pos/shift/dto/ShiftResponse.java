package com.tugaskuliah.pos.shift.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record ShiftResponse(
        Long id, String cashierName, String status,
        BigDecimal openingCash, BigDecimal expectedCash,
        BigDecimal actualCash, BigDecimal variance,
        OffsetDateTime openedAt, OffsetDateTime closedAt) {
}
