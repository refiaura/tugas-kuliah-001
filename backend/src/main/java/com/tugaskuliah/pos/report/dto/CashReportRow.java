package com.tugaskuliah.pos.report.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/** One row of the cash/shift report (PRD §25.4). */
public record CashReportRow(
        String shiftNo,
        String cashierName,
        OffsetDateTime openedAt,
        OffsetDateTime closedAt,
        BigDecimal openingCash,
        BigDecimal cashSales,
        BigDecimal cashIn,
        BigDecimal cashOut,
        BigDecimal cashRefund,
        BigDecimal expectedCash,
        BigDecimal actualCash,
        BigDecimal variance) {
}
