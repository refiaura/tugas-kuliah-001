package com.tugaskuliah.pos.inventory.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Stock opname document. One atomic submit: for every line the balance
 * snapshot is taken as expected, physical count is compared, and any
 * difference posts a STOCK_OPNAME movement (same transaction).
 */
@Entity
@Table(name = "stock_opname_docs")
@Getter
@Setter
@NoArgsConstructor
public class StockOpnameDoc {

    public enum Status { DRAFT, COMPLETED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "doc_no", nullable = false, unique = true, length = 50)
    private String docNo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.COMPLETED;

    @Column(length = 100)
    private String location;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_by", length = 50)
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "completed_at", nullable = false)
    private OffsetDateTime completedAt = OffsetDateTime.now();

    @OneToMany(mappedBy = "opname", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<StockOpnameLine> lines = new ArrayList<>();
}
