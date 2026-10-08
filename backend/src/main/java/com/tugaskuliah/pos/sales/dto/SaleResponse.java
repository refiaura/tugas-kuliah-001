package com.tugaskuliah.pos.sales.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

public record SaleResponse(
        Long id, String invoiceNo, String status,
        String customerName, String cashierName,
        BigDecimal subtotal, BigDecimal discountTotal, BigDecimal taxTotal,
        BigDecimal grandTotal, BigDecimal paidTotal, BigDecimal changeAmount,
        String notes, OffsetDateTime completedAt,
        List<SaleItemResponse> items, List<SalePaymentResponse> payments) {
}
