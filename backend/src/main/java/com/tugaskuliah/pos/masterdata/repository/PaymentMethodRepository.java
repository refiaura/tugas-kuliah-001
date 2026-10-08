package com.tugaskuliah.pos.masterdata.repository;

import com.tugaskuliah.pos.masterdata.entity.PaymentMethod;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PaymentMethodRepository extends JpaRepository<PaymentMethod, Long> {
    List<PaymentMethod> findByActiveTrueOrderById();
}
