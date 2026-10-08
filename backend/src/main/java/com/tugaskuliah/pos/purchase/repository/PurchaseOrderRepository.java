package com.tugaskuliah.pos.purchase.repository;

import com.tugaskuliah.pos.purchase.entity.PurchaseOrder;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder, Long> {

    Page<PurchaseOrder> findByStatusOrderByCreatedAtDesc(PurchaseOrder.Status status, Pageable pageable);

    Page<PurchaseOrder> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
