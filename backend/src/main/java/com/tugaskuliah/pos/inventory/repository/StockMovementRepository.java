package com.tugaskuliah.pos.inventory.repository;

import com.tugaskuliah.pos.inventory.entity.StockMovement;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StockMovementRepository extends JpaRepository<StockMovement, Long> {

    /** Read-only movement history, newest first. */
    Page<StockMovement> findAllByOrderByCreatedAtDesc(Pageable pageable);

    /** Movement history for one product, newest first. */
    Page<StockMovement> findByProductIdOrderByCreatedAtDesc(Long productId, Pageable pageable);

    /** Used by void execution to reverse the original sale movements. */
    List<StockMovement> findByMovementTypeAndReferenceTypeAndReferenceId(
            String movementType, String referenceType, Long referenceId);
}
