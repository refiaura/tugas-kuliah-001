package com.tugaskuliah.pos.masterdata.repository;

import com.tugaskuliah.pos.masterdata.entity.Product;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface ProductRepository extends JpaRepository<Product, Long> {
    Optional<Product> findBySku(String sku);
    boolean existsBySku(String sku);
    boolean existsByBarcode(String barcode);

    @Query("""
        select p from Product p
        where (:search is null or lower(p.name) like lower(concat('%', :search, '%'))
           or lower(p.sku) like lower(concat('%', :search, '%'))
           or lower(p.barcode) like lower(concat('%', :search, '%')))
          and (:categoryId is null or p.category.id = :categoryId)
          and (:activeOnly = false or p.active = true)
        """)
    Page<Product> search(@Param("search") String search,
                         @Param("categoryId") Long categoryId,
                         @Param("activeOnly") boolean activeOnly,
                         Pageable pageable);
}
