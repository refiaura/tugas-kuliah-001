package com.tugaskuliah.pos.inventory.entity;

import com.tugaskuliah.pos.masterdata.entity.Product;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Goods received into stock. Posts one RECEIVE movement and increases
 * the balance atomically.
 */
@Entity
@Table(name = "stock_receipts")
@Getter
@Setter
@NoArgsConstructor
public class StockReceipt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "doc_no", nullable = false, unique = true, length = 50)
    private String docNo;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal qty;

    @Column(length = 100)
    private String location;

    @Column(name = "supplier_ref", length = 100)
    private String supplierRef;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_by", length = 50)
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();
}
