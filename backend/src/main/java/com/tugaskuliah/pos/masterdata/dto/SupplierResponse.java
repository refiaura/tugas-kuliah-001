package com.tugaskuliah.pos.masterdata.dto;

public record SupplierResponse(
        Long id, String supplierCode, String name, String phone, String email,
        String address, String taxNumber, String paymentTerm, boolean active) {
}
