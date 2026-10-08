package com.tugaskuliah.pos.report.service;

import com.tugaskuliah.pos.common.exception.ApiException;
import com.tugaskuliah.pos.common.exception.ErrorCode;
import com.tugaskuliah.pos.common.security.UserPrincipal;
import com.tugaskuliah.pos.control.entity.Approval;
import com.tugaskuliah.pos.inventory.entity.InventoryBalance;
import com.tugaskuliah.pos.inventory.repository.InventoryBalanceRepository;
import com.tugaskuliah.pos.masterdata.entity.Product;
import com.tugaskuliah.pos.purchase.entity.PurchaseOrder;
import com.tugaskuliah.pos.report.dto.NotificationResponse;
import com.tugaskuliah.pos.report.entity.Notification;
import com.tugaskuliah.pos.report.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * In-app notifications (Milestone 8, PRD §27).
 *
 * Notifications are best-effort: hook methods never throw, so a notification
 * failure can never roll back the business transaction that triggered it.
 * All event notifications are broadcasts (user_id = null).
 */
@Service
@RequiredArgsConstructor
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final NotificationRepository notificationRepository;
    private final InventoryBalanceRepository balanceRepository;

    // ---------- user-facing reads ----------

    @Transactional(readOnly = true)
    public Page<NotificationResponse> list(Pageable pageable) {
        return notificationRepository.findVisibleForUser(currentUserId(), pageable)
                .map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public long unreadCount() {
        return notificationRepository.countUnreadForUser(currentUserId());
    }

    @Transactional
    public NotificationResponse markRead(Long id) {
        Notification n = notificationRepository.findById(id)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Notifikasi tidak ditemukan"));
        Long userId = currentUserId();
        if (n.getUserId() != null && !n.getUserId().equals(userId)) {
            throw new ApiException(ErrorCode.FORBIDDEN, "Notifikasi milik pengguna lain");
        }
        n.setRead(true);
        return toResponse(notificationRepository.save(n));
    }

    @Transactional
    public int markAllRead() {
        return notificationRepository.markAllReadForUser(currentUserId());
    }

    // ---------- event hooks (called from other services) ----------

    /**
     * After a checkout: broadcast LOW_STOCK / OUT_OF_STOCK for products whose
     * balance is at/below minimum stock. Dedup: no duplicate unread
     * notification of the same type for the same product within 24 hours.
     */
    public void checkStockAfterSale(List<Product> products) {
        for (Product p : products) {
            try {
                BigDecimal qty = balanceRepository.findById(p.getId())
                        .map(InventoryBalance::getQty).orElse(BigDecimal.ZERO);
                String type;
                String title;
                if (qty.compareTo(BigDecimal.ZERO) <= 0) {
                    type = Notification.OUT_OF_STOCK;
                    title = "Stok habis: " + p.getName();
                } else if (qty.compareTo(p.getMinimumStock()) <= 0) {
                    type = Notification.LOW_STOCK;
                    title = "Stok menipis: " + p.getName();
                } else {
                    continue;
                }
                if (isDuplicate(type, "PRODUCT", p.getId())) {
                    continue;
                }
                save(null, type, title,
                        "Sisa " + qty.stripTrailingZeros().toPlainString()
                                + " (min. " + p.getMinimumStock().stripTrailingZeros().toPlainString() + ")",
                        "PRODUCT", p.getId());
            } catch (Exception e) {
                log.warn("Gagal membuat notifikasi stok untuk produk {}: {}",
                        p.getId(), e.getMessage());
            }
        }
    }

    /** When an approval request is created: broadcast to approvers. */
    public void notifyPendingApproval(Approval approval) {
        try {
            save(null, Notification.PENDING_APPROVAL,
                    "Pengajuan menunggu persetujuan",
                    "Pengajuan " + approval.getSubjectType() + " #" + approval.getSubjectId()
                            + " dari " + approval.getRequestedBy() + " menunggu keputusan.",
                    "APPROVAL", approval.getId());
        } catch (Exception e) {
            log.warn("Gagal membuat notifikasi approval: {}", e.getMessage());
        }
    }

    /** When a shift closes with variance above the threshold. */
    public void notifyShiftVariance(Long shiftId, String cashierUsername, BigDecimal variance) {
        try {
            if (isDuplicate(Notification.SHIFT_VARIANCE, "SHIFT", shiftId)) {
                return;
            }
            save(null, Notification.SHIFT_VARIANCE,
                    "Selisih kas shift melebihi batas",
                    "Shift #" + shiftId + " (" + cashierUsername + ") ditutup dengan selisih Rp"
                            + variance.abs().stripTrailingZeros().toPlainString() + ".",
                    "SHIFT", shiftId);
        } catch (Exception e) {
            log.warn("Gagal membuat notifikasi selisih shift: {}", e.getMessage());
        }
    }

    /** When a shift is opened. */
    public void notifyShiftOpen(Long shiftId, String cashierUsername) {
        try {
            save(null, Notification.SHIFT_OPEN,
                    "Shift dibuka",
                    cashierUsername + " membuka shift #" + shiftId + ".",
                    "SHIFT", shiftId);
        } catch (Exception e) {
            log.warn("Gagal membuat notifikasi buka shift: {}", e.getMessage());
        }
    }

    /** When a purchase order is created (DRAFT): needs follow-up action. */
    public void notifyPoPending(PurchaseOrder po) {
        try {
            save(null, Notification.PO_PENDING,
                    "Purchase order perlu tindakan",
                    "PO " + po.getDocNo() + " (" + po.getSupplier().getName()
                            + ") masih DRAFT dan menunggu diproses.",
                    "PURCHASE_ORDER", po.getId());
        } catch (Exception e) {
            log.warn("Gagal membuat notifikasi PO: {}", e.getMessage());
        }
    }

    // ---------- helpers ----------

    private boolean isDuplicate(String type, String entityType, Long entityId) {
        return notificationRepository.existsByTypeAndEntityTypeAndEntityIdAndReadFalseAndCreatedAtAfter(
                type, entityType, entityId, OffsetDateTime.now().minusHours(24));
    }

    private Notification save(Long userId, String type, String title,
                              String message, String entityType, Long entityId) {
        Notification n = new Notification();
        n.setUserId(userId);
        n.setType(type);
        n.setTitle(title);
        n.setMessage(message);
        n.setEntityType(entityType);
        n.setEntityId(entityId);
        return notificationRepository.save(n);
    }

    private NotificationResponse toResponse(Notification n) {
        return new NotificationResponse(
                n.getId(), n.getType(), n.getTitle(), n.getMessage(),
                n.getEntityType(), n.getEntityId(), n.isRead(), n.getCreatedAt());
    }

    private Long currentUserId() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal p) {
            return p.getId();
        }
        throw new ApiException(ErrorCode.AUTH_TOKEN_INVALID, "Belum login");
    }
}
