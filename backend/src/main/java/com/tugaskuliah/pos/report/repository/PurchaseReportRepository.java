package com.tugaskuliah.pos.report.repository;

import com.tugaskuliah.pos.purchase.entity.PurchaseOrder;
import com.tugaskuliah.pos.report.dto.PurchaseReportRow;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;

/**
 * Read-only queries for purchase reports & dashboard alerts (Milestone 8).
 */
public interface PurchaseReportRepository extends JpaRepository<PurchaseOrder, Long> {

    /**
     * Purchase report (PRD §25.5). receivedStatus is derived from the PO
     * lifecycle; paymentStatus defaults to BELUM_LUNAS because supplier
     * payments are not tracked yet (no payable module).
     */
    @Query("""
            SELECT new com.tugaskuliah.pos.report.dto.PurchaseReportRow(
                po.docNo, sup.name, po.createdAt, po.totalAmount,
                CASE WHEN po.status = 'RECEIVED' THEN 'DITERIMA'
                     WHEN po.status = 'PARTIALLY_RECEIVED' THEN 'DITERIMA_SEBAGIAN'
                     WHEN po.status = 'CANCELLED' THEN 'DIBATALKAN'
                     ELSE 'BELUM_DITERIMA' END,
                CASE WHEN po.status = 'CANCELLED' THEN '-' ELSE 'BELUM_LUNAS' END,
                po.status)
            FROM PurchaseOrder po JOIN po.supplier sup
            WHERE (:status IS NULL OR po.status = :status)
              AND (:supplierId IS NULL OR sup.id = :supplierId)
              AND (:start IS NULL OR po.createdAt >= :start)
              AND (:end IS NULL OR po.createdAt < :end)
            ORDER BY po.createdAt DESC
            """)
    Page<PurchaseReportRow> findPurchaseReport(@Param("status") PurchaseOrder.Status status,
                                              @Param("supplierId") Long supplierId,
                                              @Param("start") OffsetDateTime start,
                                              @Param("end") OffsetDateTime end,
                                              Pageable pageable);

    /** DRAFT purchase orders older than the given cutoff (dashboard alert). */
    @Query("""
            SELECT COUNT(po) FROM PurchaseOrder po
            WHERE po.status = 'DRAFT' AND po.createdAt < :cutoff
            """)
    long countStaleDraftPos(@Param("cutoff") OffsetDateTime cutoff);
}
