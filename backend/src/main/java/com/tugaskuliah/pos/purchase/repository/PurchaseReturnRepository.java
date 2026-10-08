package com.tugaskuliah.pos.purchase.repository;

import com.tugaskuliah.pos.purchase.entity.PurchaseReturn;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PurchaseReturnRepository extends JpaRepository<PurchaseReturn, Long> {

    Page<PurchaseReturn> findByPurchaseOrderIdOrderByCreatedAtDesc(Long poId, Pageable pageable);
}
