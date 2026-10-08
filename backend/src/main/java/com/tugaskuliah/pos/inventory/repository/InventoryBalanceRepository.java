package com.tugaskuliah.pos.inventory.repository;

import com.tugaskuliah.pos.inventory.entity.InventoryBalance;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface InventoryBalanceRepository extends JpaRepository<InventoryBalance, Long> {

    /** Pessimistic lock for concurrent-safe stock decrement. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from InventoryBalance b where b.productId = :productId")
    Optional<InventoryBalance> findByIdForUpdate(Long productId);
}
