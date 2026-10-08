package com.tugaskuliah.pos.purchase.entity;

import com.tugaskuliah.pos.masterdata.entity.Product;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

/** Actual received quantity for one PO line within a receipt (positive). */
@Entity
@Table(name = "goods_receipt_lines")
@Getter
@Setter
@NoArgsConstructor
public class GoodsReceiptLine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "receipt_id", nullable = false)
    private GoodsReceipt receipt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "po_line_id", nullable = false)
    private PurchaseOrderLine poLine;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(name = "received_qty", nullable = false, precision = 19, scale = 2)
    private BigDecimal receivedQty;
}
