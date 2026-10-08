package com.tugaskuliah.pos.shift.entity;

import com.tugaskuliah.pos.user.entity.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "cashier_shifts")
@Getter
@Setter
@NoArgsConstructor
public class CashierShift {

    public enum Status { OPEN, CLOSED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cashier_id", nullable = false)
    private User cashier;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.OPEN;

    @Column(name = "opening_cash", nullable = false, precision = 19, scale = 2)
    private BigDecimal openingCash = BigDecimal.ZERO;

    @Column(name = "expected_cash", precision = 19, scale = 2)
    private BigDecimal expectedCash;

    @Column(name = "actual_cash", precision = 19, scale = 2)
    private BigDecimal actualCash;

    @Column(precision = 19, scale = 2)
    private BigDecimal variance;

    @Column(name = "variance_approved_by", length = 50)
    private String varianceApprovedBy;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "opened_at", nullable = false)
    private OffsetDateTime openedAt = OffsetDateTime.now();

    @Column(name = "closed_at")
    private OffsetDateTime closedAt;
}
