package com.tugaskuliah.pos.inventory.repository;

import com.tugaskuliah.pos.inventory.entity.StockMovement;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StockMovementRepository extends JpaRepository<StockMovement, Long> {
}
