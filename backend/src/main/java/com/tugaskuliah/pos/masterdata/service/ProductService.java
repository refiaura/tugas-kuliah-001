package com.tugaskuliah.pos.masterdata.service;

import com.tugaskuliah.pos.common.exception.ApiException;
import com.tugaskuliah.pos.common.exception.ErrorCode;
import com.tugaskuliah.pos.common.security.UserPrincipal;
import com.tugaskuliah.pos.control.service.AuditService;
import com.tugaskuliah.pos.masterdata.dto.*;
import com.tugaskuliah.pos.masterdata.entity.*;
import com.tugaskuliah.pos.masterdata.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

/**
 * Product master data. Price changes are recorded in product_prices (audit trail).
 * Selling price changes require 'product.price.update' (enforced at controller).
 */
@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;
    private final ProductVariantRepository variantRepository;
    private final ProductPriceRepository priceRepository;
    private final CategoryRepository categoryRepository;
    private final UnitRepository unitRepository;
    private final AuditService auditService;

    @Transactional(readOnly = true)
    public Page<ProductResponse> search(String search, Long categoryId, boolean activeOnly, Pageable pageable) {
        return productRepository.search(search, categoryId, activeOnly, pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public ProductResponse get(Long id) {
        return toResponse(findById(id));
    }

    @Transactional
    public ProductResponse create(CreateProductRequest req) {
        if (productRepository.existsBySku(req.sku())) {
            throw new ApiException(ErrorCode.CONFLICT, "SKU sudah dipakai: " + req.sku());
        }
        if (req.barcode() != null && !req.barcode().isBlank()
                && productRepository.existsByBarcode(req.barcode())) {
            throw new ApiException(ErrorCode.CONFLICT, "Barcode sudah dipakai: " + req.barcode());
        }
        Product p = new Product();
        p.setSku(req.sku());
        p.setBarcode(blankToNull(req.barcode()));
        p.setName(req.name());
        if (req.categoryId() != null) {
            p.setCategory(categoryRepository.findById(req.categoryId())
                    .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Kategori tidak ditemukan")));
        }
        p.setUnit(unitRepository.findById(req.unitId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Satuan tidak ditemukan")));
        p.setPurchasePrice(req.purchasePrice());
        p.setSellingPrice(req.sellingPrice());
        p.setMinimumStock(req.minimumStock() != null ? req.minimumStock() : java.math.BigDecimal.ZERO);
        p.setActive(req.active() == null || req.active());
        p.setCreatedBy(currentUsername());
        p.setUpdatedBy(currentUsername());
        return toResponse(productRepository.save(p));
    }

    @Transactional
    public ProductResponse update(Long id, UpdateProductRequest req) {
        Product p = findById(id);
        if (req.barcode() != null) {
            String bc = blankToNull(req.barcode());
            if (bc != null && !bc.equals(p.getBarcode()) && productRepository.existsByBarcode(bc)) {
                throw new ApiException(ErrorCode.CONFLICT, "Barcode sudah dipakai: " + bc);
            }
            p.setBarcode(bc);
        }
        if (req.name() != null) p.setName(req.name());
        if (req.categoryId() != null) {
            p.setCategory(categoryRepository.findById(req.categoryId())
                    .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Kategori tidak ditemukan")));
        }
        if (req.unitId() != null) {
            p.setUnit(unitRepository.findById(req.unitId())
                    .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Satuan tidak ditemukan")));
        }
        if (req.minimumStock() != null) p.setMinimumStock(req.minimumStock());
        if (req.active() != null) p.setActive(req.active());
        p.setUpdatedAt(OffsetDateTime.now());
        p.setUpdatedBy(currentUsername());
        return toResponse(productRepository.save(p));
    }

    /**
     * Update prices with history. Selling price change is a sensitive action (PRICE_CHANGE audit).
     */
    @Transactional
    public ProductResponse updatePrice(Long id, UpdatePriceRequest req) {
        Product p = findById(id);
        String by = currentUsername();
        java.math.BigDecimal oldPurchase = p.getPurchasePrice();
        java.math.BigDecimal oldSelling = p.getSellingPrice();
        boolean changed = false;
        if (req.purchasePrice() != null && req.purchasePrice().compareTo(p.getPurchasePrice()) != 0) {
            recordPrice(p, null, ProductPrice.PriceType.PURCHASE,
                    p.getPurchasePrice(), req.purchasePrice(), req.reason(), by);
            p.setPurchasePrice(req.purchasePrice());
            changed = true;
        }
        if (req.sellingPrice().compareTo(p.getSellingPrice()) != 0) {
            recordPrice(p, null, ProductPrice.PriceType.SELLING,
                    p.getSellingPrice(), req.sellingPrice(), req.reason(), by);
            p.setSellingPrice(req.sellingPrice());
            changed = true;
        }
        p.setUpdatedAt(OffsetDateTime.now());
        p.setUpdatedBy(by);
        ProductResponse resp = toResponse(productRepository.save(p));
        if (changed) {
            // formal audit trail (deferred M2 item): who changed which price
            auditService.log(by, "PRICE_CHANGE", "PRODUCT", p.getId(),
                    java.util.Map.of("purchasePrice", String.valueOf(oldPurchase),
                            "sellingPrice", String.valueOf(oldSelling)),
                    java.util.Map.of("purchasePrice", String.valueOf(p.getPurchasePrice()),
                            "sellingPrice", String.valueOf(p.getSellingPrice()),
                            "reason", req.reason() != null ? req.reason() : ""));
        }
        return resp;
    }

    @Transactional(readOnly = true)
    public Page<ProductPrice> priceHistory(Long productId, Pageable pageable) {
        findById(productId); // ensure exists
        return priceRepository.findByProductIdOrderByChangedAtDesc(productId, pageable);
    }

    // ---------- helpers ----------

    private Product findById(Long id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Produk tidak ditemukan"));
    }

    private void recordPrice(Product p, ProductVariant v, ProductPrice.PriceType type,
                             java.math.BigDecimal oldPrice, java.math.BigDecimal newPrice,
                             String reason, String by) {
        ProductPrice h = new ProductPrice();
        h.setProduct(p);
        h.setVariant(v);
        h.setPriceType(type);
        h.setOldPrice(oldPrice);
        h.setNewPrice(newPrice);
        h.setReason(reason);
        h.setChangedBy(by);
        priceRepository.save(h);
    }

    private ProductResponse toResponse(Product p) {
        return new ProductResponse(
                p.getId(), p.getSku(), p.getBarcode(), p.getName(),
                p.getCategory() != null ? p.getCategory().getId() : null,
                p.getCategory() != null ? p.getCategory().getName() : null,
                p.getUnit().getId(), p.getUnit().getCode(),
                p.getPurchasePrice(), p.getSellingPrice(), p.getMinimumStock(),
                p.isActive(),
                p.getVariants().stream()
                        .map(v -> new VariantResponse(v.getId(), v.getName(), v.getSku(), v.getBarcode(),
                                v.getPurchasePrice(), v.getSellingPrice(), v.isActive()))
                        .toList());
    }

    private String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    private String currentUsername() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal p) {
            return p.getUsername();
        }
        return null;
    }
}
