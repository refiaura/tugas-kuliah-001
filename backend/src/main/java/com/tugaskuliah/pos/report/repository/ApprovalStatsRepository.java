package com.tugaskuliah.pos.report.repository;

import com.tugaskuliah.pos.control.entity.Approval;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;

/**
 * Read-only approval statistics for dashboard alerts (Milestone 8).
 */
public interface ApprovalStatsRepository extends JpaRepository<Approval, Long> {

    long countByStatus(Approval.Status status);

    @Query("""
            SELECT COUNT(a) FROM Approval a
            WHERE a.status = 'PENDING' AND a.createdAt < :cutoff
            """)
    long countStalePending(@Param("cutoff") OffsetDateTime cutoff);
}
