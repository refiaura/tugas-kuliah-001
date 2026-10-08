package com.tugaskuliah.pos.report.repository;

import com.tugaskuliah.pos.masterdata.entity.Product;
import com.tugaskuliah.pos.report.dto.InventoryReportRow;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * Read-only aggregate queries for inventory dashboard & reports (Milestone 8).
 * Movements are aggregated from the stock-movement ledger (PRD §17).
 */
public interface StockReportRepository extends JpaRepository<Product, Long> {

    @Query("SELECT COUNT(p) FROM Product p WHERE p.active = true")
    long countActiveSku();

    @Query("""
            SELECT COUNT(p) FROM Product p
            LEFT JOIN com.tugaskuliah.pos.inventory.entity.InventoryBalance b ON b.productId = p.id
            WHERE p.active = true AND COALESCE(b.qty, 0) <= 0
            """)
    long countOutOfStock();

    @Query("""
            SELECT COUNT(p) FROM Product p
            LEFT JOIN com.tugaskuliah.pos.inventory.entity.InventoryBalance b ON b.productId = p.id
            WHERE p.active = true
              AND COALESCE(b.qty, 0) > 0
              AND COALESCE(b.qty, 0) <= p.minimumStock
            """)
    long countLowStock();

    /** Stock value = qty * cost; falls back to selling price when cost is missing. */
    @Query("""
            SELECT COALESCE(SUM(COALESCE(b.qty, 0) *
                CASE WHEN p.purchasePrice > 0 THEN p.purchasePrice ELSE p.sellingPrice END), 0)
            FROM Product p
            LEFT JOIN com.tugaskuliah.pos.inventory.entity.InventoryBalance b ON b.productId = p.id
            WHERE p.active = true
            """)
    BigDecimal stockValue();

    /** Products currently at/below minimum stock (for dashboard alerts). */
    @Query("""
            SELECT p.name, p.sku, COALESCE(b.qty, 0) FROM Product p
            LEFT JOIN com.tugaskuliah.pos.inventory.entity.InventoryBalance b ON b.productId = p.id
            WHERE p.active = true AND COALESCE(b.qty, 0) <= p.minimumStock
            ORDER BY COALESCE(b.qty, 0) ASC
            """)
    List<Object[]> lowStockProducts(Pageable pageable);

    /**
     * Inventory report from the movement ledger. Opening stock = net movement
     * before startDate (0 when no date filter). In/out cover [start, end).
     */
    @Query(value = """
            SELECT new com.tugaskuliah.pos.report.dto.InventoryReportRow(
                p.name, p.sku,
                COALESCE(SUM(CASE WHEN (:start IS NOT NULL AND m.createdAt < :start)
                    THEN m.qtyChange ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN (:start IS NULL OR m.createdAt >= :start)
                        AND (:end IS NULL OR m.createdAt < :end)
                        AND m.qtyChange > 0 THEN m.qtyChange ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN (:start IS NULL OR m.createdAt >= :start)
                        AND (:end IS NULL OR m.createdAt < :end)
                        AND m.qtyChange < 0 THEN -m.qtyChange ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN (:start IS NULL OR m.createdAt >= :start)
                        AND (:end IS NULL OR m.createdAt < :end)
                        AND m.movementType IN ('ADJUSTMENT', 'STOCK_OPNAME')
                        THEN ABS(m.qtyChange) ELSE 0 END), 0),
                COALESCE(b.qty, 0))
            FROM Product p
            LEFT JOIN com.tugaskuliah.pos.inventory.entity.StockMovement m ON m.product = p
            LEFT JOIN com.tugaskuliah.pos.inventory.entity.InventoryBalance b ON b.productId = p.id
            WHERE p.active = true
            GROUP BY p.id, p.name, p.sku, b.qty
            ORDER BY p.name ASC
            """,
            countQuery = "SELECT COUNT(p) FROM Product p WHERE p.active = true")
    Page<InventoryReportRow> findInventoryReport(@Param("start") OffsetDateTime start,
                                                @Param("end") OffsetDateTime end,
                                                Pageable pageable);
}
