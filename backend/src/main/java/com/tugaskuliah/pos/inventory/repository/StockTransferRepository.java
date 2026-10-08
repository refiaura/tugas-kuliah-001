package com.tugaskuliah.pos.inventory.repository;

import com.tugaskuliah.pos.inventory.entity.StockTransfer;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StockTransferRepository extends JpaRepository<StockTransfer, Long> {
}
