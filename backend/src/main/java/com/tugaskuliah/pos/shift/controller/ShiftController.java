package com.tugaskuliah.pos.shift.controller;

import com.tugaskuliah.pos.common.response.ApiResponse;
import com.tugaskuliah.pos.shift.dto.*;
import com.tugaskuliah.pos.shift.service.ShiftService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/shifts")
@RequiredArgsConstructor
public class ShiftController {

    private final ShiftService shiftService;

    @GetMapping("/current")
    @PreAuthorize("hasAuthority('shift.open')")
    public ResponseEntity<ApiResponse<ShiftResponse>> current() {
        return shiftService.currentShift()
                .map(s -> ResponseEntity.ok(ApiResponse.ok(s, "Shift aktif")))
                .orElseGet(() -> ResponseEntity.ok(ApiResponse.ok(null, "Tidak ada shift aktif")));
    }

    @PostMapping("/open")
    @PreAuthorize("hasAuthority('shift.open')")
    public ResponseEntity<ApiResponse<ShiftResponse>> open(@Valid @RequestBody OpenShiftRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(shiftService.open(req), "Shift dibuka"));
    }

    @PostMapping("/close")
    @PreAuthorize("hasAuthority('shift.close')")
    public ResponseEntity<ApiResponse<ShiftResponse>> close(@Valid @RequestBody CloseShiftRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(shiftService.close(req), "Shift ditutup"));
    }

    @PostMapping("/cash-movement")
    @PreAuthorize("hasAnyAuthority('cash.in','cash.out')")
    public ResponseEntity<ApiResponse<ShiftResponse>> cashMovement(@Valid @RequestBody CashMovementRequest req) {
        // IN needs cash.in, OUT needs cash.out — enforced below
        var auth = org.springframework.security.core.context.SecurityContextHolder
                .getContext().getAuthentication();
        String needed = req.type() == CashMovementRequest.CashMovementType.IN ? "cash.in" : "cash.out";
        boolean allowed = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals(needed));
        if (!allowed) {
            throw new com.tugaskuliah.pos.common.exception.ApiException(
                    com.tugaskuliah.pos.common.exception.ErrorCode.FORBIDDEN,
                    "Tidak memiliki izin " + needed);
        }
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(shiftService.cashMovement(req), "Kas dicatat"));
    }

    @GetMapping("/{id}/summary")
    @PreAuthorize("hasAuthority('shift.open')")
    public ResponseEntity<ApiResponse<ShiftSummaryResponse>> summary(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(shiftService.summary(id), "Ringkasan shift"));
    }
}
