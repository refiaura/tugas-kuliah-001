package com.tugaskuliah.pos.report.repository;

import com.tugaskuliah.pos.report.dto.ProductReportRow;
import com.tugaskuliah.pos.report.dto.SalesReportRow;
import com.tugaskuliah.pos.sales.entity.Sale;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Read-only aggregate queries for sales-related reports (Milestone 8).
 * Only COMPLETED sales count as final transactions (PRD §25).
 */
public interface SaleReportRepository extends JpaRepository<Sale, Long> {

    /** {revenue, txCount} for completed sales in [start, end). */
    @Query("""
            SELECT SUM(s.grandTotal) FROM Sale s
            WHERE s.status = 'COMPLETED'
              AND s.completedAt >= :start AND s.completedAt < :end
            """)
    BigDecimal salesRevenue(@Param("start") OffsetDateTime start, @Param("end") OffsetDateTime end);

    @Query("""
            SELECT COUNT(s) FROM Sale s
            WHERE s.status = 'COMPLETED'
              AND s.completedAt >= :start AND s.completedAt < :end
            """)
    long salesTxCount(@Param("start") OffsetDateTime start, @Param("end") OffsetDateTime end);

    @Query("""
            SELECT SUM(i.qty) FROM SaleItem i
            WHERE i.sale.status = 'COMPLETED'
              AND i.sale.completedAt >= :start AND i.sale.completedAt < :end
            """)
    BigDecimal itemsSold(@Param("start") OffsetDateTime start, @Param("end") OffsetDateTime end);

    /** COGS = sum of (net qty * product cost). Cost comes from master data (purchasePrice). */
    @Query("""
            SELECT SUM((i.qty - i.returnedQty) * p.purchasePrice)
            FROM SaleItem i JOIN i.product p
            WHERE i.sale.status = 'COMPLETED'
              AND i.sale.completedAt >= :start AND i.sale.completedAt < :end
            """)
    BigDecimal cogs(@Param("start") OffsetDateTime start, @Param("end") OffsetDateTime end);

    /** True when any sold product in the period has no usable cost (null or <= 0). */
    @Query("""
            SELECT COUNT(i) > 0 FROM SaleItem i JOIN i.product p
            WHERE i.sale.status = 'COMPLETED'
              AND i.sale.completedAt >= :start AND i.sale.completedAt < :end
              AND (p.purchasePrice IS NULL OR p.purchasePrice <= 0)
            """)
    boolean hasMissingCost(@Param("start") OffsetDateTime start, @Param("end") OffsetDateTime end);

    /** Total refunded via completed sale returns in [start, end). */
    @Query("""
            SELECT SUM(r.refundAmount) FROM SaleReturn r
            WHERE r.status = 'COMPLETED'
              AND r.createdAt >= :start AND r.createdAt < :end
            """)
    BigDecimal returnsTotal(@Param("start") OffsetDateTime start, @Param("end") OffsetDateTime end);

    /**
     * Sales report rows. When no explicit status filter is given, only
     * COMPLETED (final) transactions are returned.
     */
    @Query("""
            SELECT new com.tugaskuliah.pos.report.dto.SalesReportRow(
                s.invoiceNo, s.completedAt,
                COALESCE(cashier.username, '-'), COALESCE(cust.name, '-'),
                s.subtotal, s.discountTotal, s.taxTotal,
                s.grandTotal, s.paidTotal, s.status)
            FROM Sale s
            LEFT JOIN s.cashier cashier
            LEFT JOIN s.customer cust
            WHERE s.status = :status
              AND (:start IS NULL OR s.completedAt >= :start)
              AND (:end IS NULL OR s.completedAt < :end)
              AND (:cashierId IS NULL OR cashier.id = :cashierId)
              AND (:customerId IS NULL OR cust.id = :customerId)
              AND (:paymentMethodId IS NULL OR EXISTS (
                    SELECT 1 FROM SalePayment sp
                    WHERE sp.sale = s AND sp.paymentMethod.id = :paymentMethodId))
            ORDER BY s.completedAt DESC
            """)
    Page<SalesReportRow> findSalesReport(@Param("status") Sale.Status status,
                                        @Param("start") OffsetDateTime start,
                                        @Param("end") OffsetDateTime end,
                                        @Param("cashierId") Long cashierId,
                                        @Param("customerId") Long customerId,
                                        @Param("paymentMethodId") Long paymentMethodId,
                                        Pageable pageable);

    /** Per-product sales aggregates; netSales = revenue - returned value. */
    @Query(value = """
            SELECT new com.tugaskuliah.pos.report.dto.ProductReportRow(
                p.name, p.sku,
                SUM(i.qty),
                SUM(i.subtotal),
                SUM(i.discount),
                SUM(i.returnedQty),
                SUM(i.subtotal - (i.returnedQty * i.unitPrice)))
            FROM SaleItem i JOIN i.product p
            WHERE i.sale.status = 'COMPLETED'
              AND (:start IS NULL OR i.sale.completedAt >= :start)
              AND (:end IS NULL OR i.sale.completedAt < :end)
            GROUP BY p.id, p.name, p.sku
            ORDER BY SUM(i.subtotal) DESC
            """,
            countQuery = """
            SELECT COUNT(DISTINCT p.id) FROM SaleItem i JOIN i.product p
            WHERE i.sale.status = 'COMPLETED'
              AND (:start IS NULL OR i.sale.completedAt >= :start)
              AND (:end IS NULL OR i.sale.completedAt < :end)
            """)
    Page<ProductReportRow> findProductReport(@Param("start") OffsetDateTime start,
                                            @Param("end") OffsetDateTime end,
                                            Pageable pageable);
}
