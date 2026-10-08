package com.tugaskuliah.pos.purchase.repository;

import com.tugaskuliah.pos.purchase.entity.GoodsReceiptLine;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;

public interface GoodsReceiptLineRepository extends JpaRepository<GoodsReceiptLine, Long> {

    /** Total received so far for one PO line (partial receipts add up). */
    @Query("SELECT COALESCE(SUM(l.receivedQty), 0) FROM GoodsReceiptLine l WHERE l.poLine.id = :poLineId")
    BigDecimal sumReceivedByPoLineId(@Param("poLineId") Long poLineId);
}
