package com.tugaskuliah.pos.report.repository;

import com.tugaskuliah.pos.report.dto.CashReportRow;
import com.tugaskuliah.pos.shift.entity.CashMovement;
import com.tugaskuliah.pos.shift.entity.CashierShift;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * Read-only aggregate queries for cash dashboard & reports (Milestone 8).
 */
public interface CashReportRepository extends JpaRepository<CashierShift, Long> {

    List<CashierShift> findByStatusOrderByOpenedAtDesc(CashierShift.Status status);

    @Query("SELECT COUNT(s) FROM CashierShift s WHERE s.status = 'OPEN' AND s.openedAt < :cutoff")
    long countStaleOpenShifts(@Param("cutoff") OffsetDateTime cutoff);

    /** Closed shifts today with absolute variance above the threshold. */
    @Query("""
            SELECT COUNT(s) FROM CashierShift s
            WHERE s.status = 'CLOSED'
              AND s.closedAt >= :start AND s.closedAt < :end
              AND s.variance IS NOT NULL AND ABS(s.variance) > :threshold
            """)
    long countShiftsWithVariance(@Param("start") OffsetDateTime start,
                                @Param("end") OffsetDateTime end,
                                @Param("threshold") BigDecimal threshold);

    /** Cash sales (CASH payment method, completed sales) for one shift. */
    @Query("""
            SELECT COALESCE(SUM(sp.amount), 0) FROM SalePayment sp
            WHERE sp.sale.shift.id = :shiftId
              AND sp.sale.status = 'COMPLETED'
              AND sp.paymentMethod.code = 'CASH'
            """)
    BigDecimal cashSalesByShift(@Param("shiftId") Long shiftId);

    @Query("""
            SELECT COALESCE(SUM(cm.amount), 0) FROM CashMovement cm
            WHERE cm.shift.id = :shiftId AND cm.type = :type
            """)
    BigDecimal cashMovementSumByShift(@Param("shiftId") Long shiftId,
                                     @Param("type") CashMovement.Type type);

    @Query("""
            SELECT COALESCE(SUM(cm.amount), 0) FROM CashMovement cm
            WHERE cm.type = :type
              AND cm.createdAt >= :start AND cm.createdAt < :end
            """)
    BigDecimal cashMovementSumByTypeAndDate(@Param("type") CashMovement.Type type,
                                           @Param("start") OffsetDateTime start,
                                           @Param("end") OffsetDateTime end);

    /** Per-shift cash report (PRD §25.4). */
    @Query("""
            SELECT new com.tugaskuliah.pos.report.dto.CashReportRow(
                CONCAT('SHF-', s.id), c.username, s.openedAt, s.closedAt, s.openingCash,
                (SELECT COALESCE(SUM(sp.amount), 0) FROM SalePayment sp
                 WHERE sp.sale.shift = s AND sp.sale.status = 'COMPLETED'
                   AND sp.paymentMethod.code = 'CASH'),
                (SELECT COALESCE(SUM(cm.amount), 0) FROM CashMovement cm
                 WHERE cm.shift = s AND cm.type = 'IN'),
                (SELECT COALESCE(SUM(cm.amount), 0) FROM CashMovement cm
                 WHERE cm.shift = s AND cm.type = 'OUT'),
                (SELECT COALESCE(SUM(cm.amount), 0) FROM CashMovement cm
                 WHERE cm.shift = s AND cm.type = 'REFUND'),
                s.expectedCash, s.actualCash, s.variance)
            FROM CashierShift s JOIN s.cashier c
            WHERE (:start IS NULL OR s.openedAt >= :start)
              AND (:end IS NULL OR s.openedAt < :end)
              AND (:cashierId IS NULL OR c.id = :cashierId)
            ORDER BY s.openedAt DESC
            """)
    Page<CashReportRow> findCashReport(@Param("start") OffsetDateTime start,
                                      @Param("end") OffsetDateTime end,
                                      @Param("cashierId") Long cashierId,
                                      Pageable pageable);
}
