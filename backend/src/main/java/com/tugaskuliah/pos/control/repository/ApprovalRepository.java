package com.tugaskuliah.pos.control.repository;

import com.tugaskuliah.pos.control.entity.Approval;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ApprovalRepository extends JpaRepository<Approval, Long> {

    Page<Approval> findByStatusOrderByCreatedAtDesc(Approval.Status status, Pageable pageable);

    Page<Approval> findAllByOrderByCreatedAtDesc(Pageable pageable);

    boolean existsBySubjectTypeAndSubjectIdAndStatus(
            Approval.SubjectType subjectType, Long subjectId, Approval.Status status);
}
