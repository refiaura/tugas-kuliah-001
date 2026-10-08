package com.tugaskuliah.pos.shift.dto;

import java.math.BigDecimal;

public record ShiftSummaryResponse(
        ShiftResponse shift,
        BigDecimal cashSales,
        BigDecimal cashIn,
        BigDecimal cashOut,
        BigDecimal expectedCash) {
}
