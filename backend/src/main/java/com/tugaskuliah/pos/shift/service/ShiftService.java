package com.tugaskuliah.pos.shift.service;

import com.tugaskuliah.pos.common.exception.ApiException;
import com.tugaskuliah.pos.common.exception.ErrorCode;
import com.tugaskuliah.pos.common.security.UserPrincipal;
import com.tugaskuliah.pos.sales.repository.SaleRepository;
import com.tugaskuliah.pos.shift.dto.*;
import com.tugaskuliah.pos.shift.entity.CashMovement;
import com.tugaskuliah.pos.shift.entity.CashierShift;
import com.tugaskuliah.pos.shift.repository.CashMovementRepository;
import com.tugaskuliah.pos.shift.repository.CashierShiftRepository;
import com.tugaskuliah.pos.user.entity.User;
import com.tugaskuliah.pos.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Optional;

/**
 * Cashier shift lifecycle.
 * - One OPEN shift per cashier (DB partial unique index + service check).
 * - Close computes expected cash from backend data; variance flagged if over threshold.
 */
@Service
@RequiredArgsConstructor
public class ShiftService {

    /** Variance above this (absolute) needs manager approval note. */
    private static final BigDecimal VARIANCE_THRESHOLD = new BigDecimal("50000");

    private final CashierShiftRepository shiftRepository;
    private final CashMovementRepository movementRepository;
    private final SaleRepository saleRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public Optional<ShiftResponse> currentShift() {
        Long cashierId = currentUserId();
        return shiftRepository.findByCashierIdAndStatus(cashierId, CashierShift.Status.OPEN)
                .map(this::toResponse);
    }

    @Transactional
    public ShiftResponse open(OpenShiftRequest req) {
        User cashier = currentUser();
        if (shiftRepository.findByCashierIdAndStatus(cashier.getId(), CashierShift.Status.OPEN).isPresent()) {
            throw new ApiException(ErrorCode.CONFLICT, "Masih ada shift yang terbuka");
        }
        CashierShift s = new CashierShift();
        s.setCashier(cashier);
        s.setStatus(CashierShift.Status.OPEN);
        s.setOpeningCash(req.openingCash());
        s.setNotes(req.notes());
        return toResponse(shiftRepository.save(s));
    }

    @Transactional
    public ShiftResponse cashMovement(CashMovementRequest req) {
        CashierShift shift = requireOpenShift();
        CashMovement m = new CashMovement();
        m.setShift(shift);
        m.setType(CashMovement.Type.valueOf(req.type().name()));
        m.setAmount(req.amount());
        m.setReason(req.reason());
        m.setReferenceNo(req.referenceNo());
        m.setCreatedBy(currentUsername());
        movementRepository.save(m);
        return toResponse(shift);
    }

    @Transactional(readOnly = true)
    public ShiftSummaryResponse summary(Long shiftId) {
        CashierShift s = shiftRepository.findById(shiftId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Shift tidak ditemukan"));
        BigDecimal cashSales = saleRepository.sumCashPaymentsByShift(shiftId);
        BigDecimal cashIn = movementRepository.sumByShiftAndType(shiftId, CashMovement.Type.IN);
        BigDecimal cashOut = movementRepository.sumByShiftAndType(shiftId, CashMovement.Type.OUT);
        BigDecimal expected = s.getOpeningCash().add(cashSales).add(cashIn).subtract(cashOut);
        return new ShiftSummaryResponse(toResponse(s), cashSales, cashIn, cashOut, expected);
    }

    @Transactional
    public ShiftResponse close(CloseShiftRequest req) {
        CashierShift shift = requireOpenShift();
        ShiftSummaryResponse sum = summary(shift.getId());
        BigDecimal expected = sum.expectedCash();
        BigDecimal variance = req.actualCash().subtract(expected);

        shift.setExpectedCash(expected);
        shift.setActualCash(req.actualCash());
        shift.setVariance(variance);
        shift.setStatus(CashierShift.Status.CLOSED);
        shift.setClosedAt(OffsetDateTime.now());
        if (req.notes() != null) {
            shift.setNotes(req.notes());
        }
        CashierShift saved = shiftRepository.save(shift);

        if (variance.abs().compareTo(VARIANCE_THRESHOLD) > 0) {
            // flagged for manager review; approval flow in Milestone 7
            // (variance_approved_by stays null until approved)
        }
        return toResponse(saved);
    }

    /** Used by checkout: fails if the cashier has no open shift. */
    @Transactional(readOnly = true)
    public CashierShift requireOpenShift() {
        Long cashierId = currentUserId();
        return shiftRepository.findByCashierIdAndStatus(cashierId, CashierShift.Status.OPEN)
                .orElseThrow(() -> new ApiException(ErrorCode.BUSINESS_ERROR,
                        "Tidak ada shift aktif. Buka shift terlebih dahulu."));
    }

    // ---------- helpers ----------

    private ShiftResponse toResponse(CashierShift s) {
        return new ShiftResponse(
                s.getId(),
                s.getCashier() != null ? s.getCashier().getUsername() : null,
                s.getStatus().name(),
                s.getOpeningCash(), s.getExpectedCash(),
                s.getActualCash(), s.getVariance(),
                s.getOpenedAt(), s.getClosedAt());
    }

    private User currentUser() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal p) {
            return userRepository.findById(p.getId())
                    .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "User tidak ditemukan"));
        }
        throw new ApiException(ErrorCode.FORBIDDEN, "Tidak terautentikasi");
    }

    private Long currentUserId() {
        return currentUser().getId();
    }

    private String currentUsername() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal p) {
            return p.getUsername();
        }
        return null;
    }
}
