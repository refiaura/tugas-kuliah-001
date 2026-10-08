package com.tugaskuliah.pos.shift.repository;

import com.tugaskuliah.pos.shift.entity.CashierShift;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CashierShiftRepository extends JpaRepository<CashierShift, Long> {
    Optional<CashierShift> findByCashierIdAndStatus(Long cashierId, CashierShift.Status status);
    Page<CashierShift> findByCashierIdOrderByOpenedAtDesc(Long cashierId, Pageable pageable);
}
