package com.tugaskuliah.pos.purchase.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Return goods to the supplier (PRD §21.3).
 * One return posts PURCHASE_RETURN stock movements (stock out) and
 * accumulates a simple supplier credit. The full payable cycle is deferred.
 */
@Entity
@Table(name = "purchase_returns")
@Getter
@Setter
@NoArgsConstructor
public class PurchaseReturn {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "doc_no", nullable = false, unique = true, length = 50)
    private String docNo;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "po_id", nullable = false)
    private PurchaseOrder purchaseOrder;

    @Column(nullable = false, length = 255)
    private String reason;

    @Column(name = "supplier_credit", nullable = false, precision = 19, scale = 2)
    private BigDecimal supplierCredit = BigDecimal.ZERO;

    @Column(name = "created_by", length = 50)
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @OneToMany(mappedBy = "purchaseReturn", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PurchaseReturnLine> lines = new ArrayList<>();
}
