package com.tugaskuliah.pos.masterdata.controller;

import com.tugaskuliah.pos.common.response.ApiResponse;
import com.tugaskuliah.pos.masterdata.dto.CreateCustomerRequest;
import com.tugaskuliah.pos.masterdata.dto.CustomerResponse;
import com.tugaskuliah.pos.masterdata.service.CustomerService;
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
@RequestMapping("/api/v1/customers")
@RequiredArgsConstructor
public class CustomerController {

    private final CustomerService customerService;

    @GetMapping
    @PreAuthorize("hasAuthority('customer.view')")
    public ResponseEntity<ApiResponse<List<CustomerResponse>>> list(
            @RequestParam(required = false) String search,
            @PageableDefault(size = 20) Pageable pageable) {
        var page = customerService.list(search, pageable);
        return ResponseEntity.ok(ApiResponse.paged(page.getContent(), "Daftar customer",
                page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages()));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('customer.create')")
    public ResponseEntity<ApiResponse<CustomerResponse>> create(@Valid @RequestBody CreateCustomerRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(customerService.create(req), "Customer dibuat"));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('customer.update')")
    public ResponseEntity<ApiResponse<CustomerResponse>> update(
            @PathVariable Long id, @Valid @RequestBody CreateCustomerRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(customerService.update(id, req), "Customer diperbarui"));
    }
}
