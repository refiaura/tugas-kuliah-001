package com.tugaskuliah.pos.masterdata.service;

import com.tugaskuliah.pos.common.exception.ApiException;
import com.tugaskuliah.pos.common.exception.ErrorCode;
import com.tugaskuliah.pos.masterdata.dto.CategoryRequest;
import com.tugaskuliah.pos.masterdata.dto.CategoryResponse;
import com.tugaskuliah.pos.masterdata.entity.Category;
import com.tugaskuliah.pos.masterdata.repository.CategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CategoryService {

    private final CategoryRepository categoryRepository;

    @Transactional(readOnly = true)
    public List<CategoryResponse> listActive() {
        return categoryRepository.findByActiveTrueOrderByName().stream()
                .map(this::toResponse).toList();
    }

    @Transactional
    public CategoryResponse create(CategoryRequest req) {
        Category c = new Category();
        c.setName(req.name());
        if (req.parentId() != null) {
            c.setParent(categoryRepository.findById(req.parentId())
                    .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Parent kategori tidak ditemukan")));
        }
        c.setActive(req.active() == null || req.active());
        return toResponse(categoryRepository.save(c));
    }

    @Transactional
    public CategoryResponse update(Long id, CategoryRequest req) {
        Category c = categoryRepository.findById(id)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Kategori tidak ditemukan"));
        c.setName(req.name());
        if (req.parentId() != null) {
            if (req.parentId().equals(id)) {
                throw new ApiException(ErrorCode.BUSINESS_ERROR, "Kategori tidak bisa menjadi parent dirinya sendiri");
            }
            c.setParent(categoryRepository.findById(req.parentId())
                    .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Parent kategori tidak ditemukan")));
        } else {
            c.setParent(null);
        }
        if (req.active() != null) c.setActive(req.active());
        c.setUpdatedAt(OffsetDateTime.now());
        return toResponse(categoryRepository.save(c));
    }

    private CategoryResponse toResponse(Category c) {
        return new CategoryResponse(c.getId(), c.getName(),
                c.getParent() != null ? c.getParent().getId() : null,
                c.getParent() != null ? c.getParent().getName() : null,
                c.isActive());
    }
}
