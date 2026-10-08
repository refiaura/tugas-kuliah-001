package com.tugaskuliah.pos.inventory.repository;

import com.tugaskuliah.pos.inventory.entity.StockAdjustment;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StockAdjustmentRepository extends JpaRepository<StockAdjustment, Long> {
}
