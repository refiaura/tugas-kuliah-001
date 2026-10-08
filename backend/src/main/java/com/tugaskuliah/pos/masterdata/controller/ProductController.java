package com.tugaskuliah.pos.masterdata.controller;

import com.tugaskuliah.pos.common.response.ApiResponse;
import com.tugaskuliah.pos.masterdata.dto.*;
import com.tugaskuliah.pos.masterdata.service.ProductService;
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
@RequestMapping("/api/v1/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;

    @GetMapping
    @PreAuthorize("hasAuthority('product.view')")
    public ResponseEntity<ApiResponse<List<ProductResponse>>> search(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(defaultValue = "true") boolean activeOnly,
            @PageableDefault(size = 20) Pageable pageable) {
        var page = productService.search(search, categoryId, activeOnly, pageable);
        return ResponseEntity.ok(ApiResponse.paged(page.getContent(), "Daftar produk",
                page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('product.view')")
    public ResponseEntity<ApiResponse<ProductResponse>> get(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(productService.get(id), "Detail produk"));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('product.create')")
    public ResponseEntity<ApiResponse<ProductResponse>> create(@Valid @RequestBody CreateProductRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(productService.create(req), "Produk dibuat"));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('product.update')")
    public ResponseEntity<ApiResponse<ProductResponse>> update(
            @PathVariable Long id, @Valid @RequestBody UpdateProductRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(productService.update(id, req), "Produk diperbarui"));
    }

    @PutMapping("/{id}/price")
    @PreAuthorize("hasAuthority('product.price.update')")
    public ResponseEntity<ApiResponse<ProductResponse>> updatePrice(
            @PathVariable Long id, @Valid @RequestBody UpdatePriceRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(productService.updatePrice(id, req), "Harga diperbarui"));
    }

    @GetMapping("/{id}/price-history")
    @PreAuthorize("hasAuthority('product.view')")
    public ResponseEntity<ApiResponse<List<?>>> priceHistory(
            @PathVariable Long id, @PageableDefault(size = 20) Pageable pageable) {
        var page = productService.priceHistory(id, pageable);
        return ResponseEntity.ok(ApiResponse.paged(page.getContent(), "Histori harga",
                page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages()));
    }
}
