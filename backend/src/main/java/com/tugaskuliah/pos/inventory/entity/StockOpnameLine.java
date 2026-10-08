package com.tugaskuliah.pos.inventory.entity;

import com.tugaskuliah.pos.masterdata.entity.Product;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * One counted product inside an opname document.
 * differenceQty = countedQty - expectedQty (posted to the ledger when != 0).
 */
@Entity
@Table(name = "stock_opname_lines")
@Getter
@Setter
@NoArgsConstructor
public class StockOpnameLine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "opname_id", nullable = false)
    private StockOpnameDoc opname;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(name = "expected_qty", nullable = false, precision = 19, scale = 2)
    private BigDecimal expectedQty;

    @Column(name = "counted_qty", nullable = false, precision = 19, scale = 2)
    private BigDecimal countedQty;

    @Column(name = "difference_qty", nullable = false, precision = 19, scale = 2)
    private BigDecimal differenceQty;
}
