package com.tugaskuliah.pos.purchase.repository;

import com.tugaskuliah.pos.purchase.entity.GoodsReceipt;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GoodsReceiptRepository extends JpaRepository<GoodsReceipt, Long> {

    Page<GoodsReceipt> findByPurchaseOrderIdOrderByCreatedAtDesc(Long poId, Pageable pageable);
}
