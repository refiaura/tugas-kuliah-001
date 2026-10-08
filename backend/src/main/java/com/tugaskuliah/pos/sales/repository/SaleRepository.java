package com.tugaskuliah.pos.sales.repository;

import com.tugaskuliah.pos.sales.entity.Sale;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SaleRepository extends JpaRepository<Sale, Long> {
    Optional<Sale> findByInvoiceNo(String invoiceNo);
    Optional<Sale> findByIdempotencyKey(String idempotencyKey);
    Page<Sale> findByStatusOrderByCreatedAtDesc(Sale.Status status, Pageable pageable);
}
