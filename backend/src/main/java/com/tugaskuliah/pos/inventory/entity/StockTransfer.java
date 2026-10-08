package com.tugaskuliah.pos.inventory.entity;

import com.tugaskuliah.pos.masterdata.entity.Product;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Stock transfer between simple locations. Posted atomically as a
 * TRANSFER_OUT + TRANSFER_IN movement pair; the product's total balance
 * is unchanged (balances are not split per location).
 */
@Entity
@Table(name = "stock_transfers")
@Getter
@Setter
@NoArgsConstructor
public class StockTransfer {

    public enum Status { COMPLETED }

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

    @Column(name = "from_location", nullable = false, length = 100)
    private String fromLocation;

    @Column(name = "to_location", nullable = false, length = 100)
    private String toLocation;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.COMPLETED;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_by", length = 50)
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();
}
