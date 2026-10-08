package com.tugaskuliah.pos.masterdata.service;

import com.tugaskuliah.pos.common.exception.ApiException;
import com.tugaskuliah.pos.common.exception.ErrorCode;
import com.tugaskuliah.pos.masterdata.dto.CreateCustomerRequest;
import com.tugaskuliah.pos.masterdata.dto.CustomerResponse;
import com.tugaskuliah.pos.masterdata.entity.Customer;
import com.tugaskuliah.pos.masterdata.repository.CustomerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

@Service
@RequiredArgsConstructor
public class CustomerService {

    private final CustomerRepository customerRepository;

    @Transactional(readOnly = true)
    public Page<CustomerResponse> list(String search, Pageable pageable) {
        Page<Customer> page = (search == null || search.isBlank())
                ? customerRepository.findAll(pageable)
                : customerRepository.findByNameContainingIgnoreCase(search, pageable);
        return page.map(this::toResponse);
    }

    @Transactional
    public CustomerResponse create(CreateCustomerRequest req) {
        if (customerRepository.existsByCustomerCode(req.customerCode())) {
            throw new ApiException(ErrorCode.CONFLICT, "Kode customer sudah dipakai: " + req.customerCode());
        }
        Customer c = new Customer();
        c.setCustomerCode(req.customerCode());
        c.setName(req.name());
        c.setPhone(req.phone());
        c.setAddress(req.address());
        c.setMemberStatus(req.memberStatus() != null ? req.memberStatus() : "REGULAR");
        c.setActive(req.active() == null || req.active());
        return toResponse(customerRepository.save(c));
    }

    @Transactional
    public CustomerResponse update(Long id, CreateCustomerRequest req) {
        Customer c = customerRepository.findById(id)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Customer tidak ditemukan"));
        if (!c.getCustomerCode().equals(req.customerCode())
                && customerRepository.existsByCustomerCode(req.customerCode())) {
            throw new ApiException(ErrorCode.CONFLICT, "Kode customer sudah dipakai: " + req.customerCode());
        }
        c.setCustomerCode(req.customerCode());
        c.setName(req.name());
        c.setPhone(req.phone());
        c.setAddress(req.address());
        if (req.memberStatus() != null) c.setMemberStatus(req.memberStatus());
        if (req.active() != null) c.setActive(req.active());
        c.setUpdatedAt(OffsetDateTime.now());
        return toResponse(customerRepository.save(c));
    }

    private CustomerResponse toResponse(Customer c) {
        return new CustomerResponse(c.getId(), c.getCustomerCode(), c.getName(), c.getPhone(),
                c.getAddress(), c.getMemberStatus(), c.getPoints(), c.isActive());
    }
}
