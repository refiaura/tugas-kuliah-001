package com.tugaskuliah.pos.inventory.repository;

import com.tugaskuliah.pos.inventory.entity.DocumentCounter;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.util.Optional;

public interface DocumentCounterRepository
        extends JpaRepository<DocumentCounter, DocumentCounter.Pk> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<DocumentCounter> findById(DocumentCounter.Pk id);
}
