package com.tugaskuliah.pos.shift.repository;

import com.tugaskuliah.pos.shift.entity.CashMovement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.math.BigDecimal;
import java.util.List;

public interface CashMovementRepository extends JpaRepository<CashMovement, Long> {
    List<CashMovement> findByShiftIdOrderByCreatedAt(Long shiftId);

    @Query("select coalesce(sum(m.amount), 0) from CashMovement m where m.shift.id = :shiftId and m.type = :type")
    BigDecimal sumByShiftAndType(Long shiftId, CashMovement.Type type);
}
