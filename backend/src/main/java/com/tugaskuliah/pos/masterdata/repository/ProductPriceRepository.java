package com.tugaskuliah.pos.masterdata.repository;

import com.tugaskuliah.pos.masterdata.entity.ProductPrice;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductPriceRepository extends JpaRepository<ProductPrice, Long> {
    Page<ProductPrice> findByProductIdOrderByChangedAtDesc(Long productId, Pageable pageable);
}
