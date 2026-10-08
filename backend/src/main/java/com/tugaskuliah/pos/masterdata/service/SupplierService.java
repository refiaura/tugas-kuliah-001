package com.tugaskuliah.pos.masterdata.service;

import com.tugaskuliah.pos.common.exception.ApiException;
import com.tugaskuliah.pos.common.exception.ErrorCode;
import com.tugaskuliah.pos.masterdata.dto.CreateSupplierRequest;
import com.tugaskuliah.pos.masterdata.dto.SupplierResponse;
import com.tugaskuliah.pos.masterdata.entity.Supplier;
import com.tugaskuliah.pos.masterdata.repository.SupplierRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

@Service
@RequiredArgsConstructor
public class SupplierService {

    private final SupplierRepository supplierRepository;

    @Transactional(readOnly = true)
    public Page<SupplierResponse> list(String search, Pageable pageable) {
        Page<Supplier> page = (search == null || search.isBlank())
                ? supplierRepository.findAll(pageable)
                : supplierRepository.findByNameContainingIgnoreCase(search, pageable);
        return page.map(this::toResponse);
    }

    @Transactional
    public SupplierResponse create(CreateSupplierRequest req) {
        if (supplierRepository.existsBySupplierCode(req.supplierCode())) {
            throw new ApiException(ErrorCode.CONFLICT, "Kode supplier sudah dipakai: " + req.supplierCode());
        }
        Supplier s = new Supplier();
        s.setSupplierCode(req.supplierCode());
        s.setName(req.name());
        s.setPhone(req.phone());
        s.setEmail(req.email());
        s.setAddress(req.address());
        s.setTaxNumber(req.taxNumber());
        s.setPaymentTerm(req.paymentTerm());
        s.setActive(req.active() == null || req.active());
        return toResponse(supplierRepository.save(s));
    }

    @Transactional
    public SupplierResponse update(Long id, CreateSupplierRequest req) {
        Supplier s = supplierRepository.findById(id)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Supplier tidak ditemukan"));
        if (!s.getSupplierCode().equals(req.supplierCode())
                && supplierRepository.existsBySupplierCode(req.supplierCode())) {
            throw new ApiException(ErrorCode.CONFLICT, "Kode supplier sudah dipakai: " + req.supplierCode());
        }
        s.setSupplierCode(req.supplierCode());
        s.setName(req.name());
        s.setPhone(req.phone());
        s.setEmail(req.email());
        s.setAddress(req.address());
        s.setTaxNumber(req.taxNumber());
        s.setPaymentTerm(req.paymentTerm());
        if (req.active() != null) s.setActive(req.active());
        s.setUpdatedAt(OffsetDateTime.now());
        return toResponse(supplierRepository.save(s));
    }

    private SupplierResponse toResponse(Supplier s) {
        return new SupplierResponse(s.getId(), s.getSupplierCode(), s.getName(), s.getPhone(),
                s.getEmail(), s.getAddress(), s.getTaxNumber(), s.getPaymentTerm(), s.isActive());
    }
}
