package com.tugaskuliah.pos.sales.repository;

import com.tugaskuliah.pos.sales.entity.Sale;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.math.BigDecimal;
import java.util.Optional;

public interface SaleRepository extends JpaRepository<Sale, Long> {
    Optional<Sale> findByInvoiceNo(String invoiceNo);
    Optional<Sale> findByIdempotencyKey(String idempotencyKey);
    Page<Sale> findByStatusOrderByCreatedAtDesc(Sale.Status status, Pageable pageable);

    /** Total CASH payments for completed sales in a shift (for expected cash calc). */
    @Query("""
        select coalesce(sum(p.amount), 0) from SalePayment p
        where p.sale.shift.id = :shiftId
          and p.sale.status = 'COMPLETED'
          and p.paymentMethod.code = 'CASH'
        """)
    BigDecimal sumCashPaymentsByShift(Long shiftId);
}
