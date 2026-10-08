package com.tugaskuliah.pos.purchase.repository;

import com.tugaskuliah.pos.purchase.entity.PurchaseReturnLine;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;

public interface PurchaseReturnLineRepository extends JpaRepository<PurchaseReturnLine, Long> {

    /** Total returned so far for one PO line; may never exceed received. */
    @Query("SELECT COALESCE(SUM(l.qty), 0) FROM PurchaseReturnLine l WHERE l.poLine.id = :poLineId")
    BigDecimal sumReturnedByPoLineId(@Param("poLineId") Long poLineId);
}
