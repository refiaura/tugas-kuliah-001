package com.tugaskuliah.pos.inventory.repository;

import com.tugaskuliah.pos.inventory.entity.StockReceipt;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StockReceiptRepository extends JpaRepository<StockReceipt, Long> {
}
