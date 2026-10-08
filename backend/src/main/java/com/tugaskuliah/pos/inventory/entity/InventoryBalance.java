package com.tugaskuliah.pos.inventory.entity;

import com.tugaskuliah.pos.masterdata.entity.Product;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "inventory_balances")
@Getter
@Setter
@NoArgsConstructor
public class InventoryBalance {

    @Id
    @Column(name = "product_id")
    private Long productId;

    @MapsId
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id")
    private Product product;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal qty = BigDecimal.ZERO;

    @Column(name = "damaged_qty", nullable = false, precision = 19, scale = 2)
    private BigDecimal damagedQty = BigDecimal.ZERO;

    @Version
    private Long version; // optimistic locking for concurrent checkout

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();
}
