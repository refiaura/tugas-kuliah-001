package com.tugaskuliah.pos.masterdata.controller;

import com.tugaskuliah.pos.common.response.ApiResponse;
import com.tugaskuliah.pos.masterdata.dto.CreateSupplierRequest;
import com.tugaskuliah.pos.masterdata.dto.SupplierResponse;
import com.tugaskuliah.pos.masterdata.service.SupplierService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/suppliers")
@RequiredArgsConstructor
public class SupplierController {

    private final SupplierService supplierService;

    @GetMapping
    @PreAuthorize("hasAuthority('supplier.view')")
    public ResponseEntity<ApiResponse<List<SupplierResponse>>> list(
            @RequestParam(required = false) String search,
            @PageableDefault(size = 20) Pageable pageable) {
        var page = supplierService.list(search, pageable);
        return ResponseEntity.ok(ApiResponse.paged(page.getContent(), "Daftar supplier",
                page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages()));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('supplier.create')")
    public ResponseEntity<ApiResponse<SupplierResponse>> create(@Valid @RequestBody CreateSupplierRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(supplierService.create(req), "Supplier dibuat"));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('supplier.update')")
    public ResponseEntity<ApiResponse<SupplierResponse>> update(
            @PathVariable Long id, @Valid @RequestBody CreateSupplierRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(supplierService.update(id, req), "Supplier diperbarui"));
    }
}
