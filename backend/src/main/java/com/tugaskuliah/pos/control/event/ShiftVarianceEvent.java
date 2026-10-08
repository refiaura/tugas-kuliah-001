package com.tugaskuliah.pos.control.event;

import java.math.BigDecimal;

/**
 * Published by {@code ShiftService.close} when |variance| exceeds the threshold.
 * Handled in the control package so shift does not depend on control services
 * (avoids a circular bean dependency).
 */
public record ShiftVarianceEvent(
        Long shiftId,
        String cashierUsername,
        BigDecimal expectedCash,
        BigDecimal actualCash,
        BigDecimal variance
) {}
