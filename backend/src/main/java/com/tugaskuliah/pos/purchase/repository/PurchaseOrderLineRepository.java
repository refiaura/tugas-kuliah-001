package com.tugaskuliah.pos.purchase.repository;

import com.tugaskuliah.pos.purchase.entity.PurchaseOrderLine;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PurchaseOrderLineRepository extends JpaRepository<PurchaseOrderLine, Long> {

    List<PurchaseOrderLine> findByOrderId(Long orderId);
}
