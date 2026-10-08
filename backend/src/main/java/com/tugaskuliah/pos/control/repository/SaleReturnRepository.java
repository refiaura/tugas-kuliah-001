package com.tugaskuliah.pos.control.repository;

import com.tugaskuliah.pos.control.entity.SaleReturn;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SaleReturnRepository extends JpaRepository<SaleReturn, Long> {

    Page<SaleReturn> findBySaleIdOrderByCreatedAtDesc(Long saleId, Pageable pageable);

    Page<SaleReturn> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
