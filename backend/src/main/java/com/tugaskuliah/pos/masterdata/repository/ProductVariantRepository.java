package com.tugaskuliah.pos.masterdata.repository;

import com.tugaskuliah.pos.masterdata.entity.ProductVariant;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProductVariantRepository extends JpaRepository<ProductVariant, Long> {
    List<ProductVariant> findByProductId(Long productId);
    boolean existsBySku(String sku);
}
