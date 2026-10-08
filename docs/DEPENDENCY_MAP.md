# DEPENDENCY MAP

Aturan: **jangan implementasi domain sebelum dependency pentingnya stabil.**

## Graph

```
                        ┌──────────────┐
                        │  AUTH / RBAC │  (Phase 1)
                        │ user·role·   │
                        │ permission   │
                        └──────┬───────┘
                               │ dipakai semua endpoint & menu
               ┌───────────────┼────────────────┐
               ▼               ▼                ▼
     ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
     │ MASTER DATA  │  │    SHIFT     │  │   APPROVAL   │
     │ category·unit│  │ open·close·  │  │  AUDIT LOG  │
     │ product·price│  │ cash in/out  │  │ (cross-      │
     │ customer·    │  │ reconcile    │  │  cutting)    │
     │ supplier·    │  └──────┬───────┘  └──────┬───────┘
     │ pay_method   │         │                 │
     │ (Phase 2)    │         │                 │
     └──────┬───────┘         │                 │
            │                 ▼                 │
            │         ┌──────────────┐          │
            │         │  SALES / POS │◄─────────┘ (void/return butuh approval+audit)
            │         │ cart·checkout│
            │         │ payment·     │
            │         │ receipt      │
            │         │ (Phase 3+4)  │
            │         └──────┬───────┘
            │                │ sale → stock_movement(SALE)
            ▼                ▼
     ┌──────────────┐  ┌──────────────┐
     │  INVENTORY   │  │   PURCHASE   │
     │ movement·    │  │ PO·approval· │
     │ balance·     │  │ receipt·     │
     │ adjust·opname│  │ return       │
     │ (Phase 5)    │  │ (Phase 6)    │
     └──────┬───────┘  └──────┬───────┘
            │  receipt → movement(PURCHASE)
            └────────┬────────┘
                     ▼
            ┌──────────────┐
            │ REPORTS ·    │
            │ DASHBOARD ·  │
            │ NOTIFICATION │
            │ (Phase 8)    │
            └──────────────┘
```

## Aturan dependency konkret

| Domain | Wajib ada dulu | Alasan |
|---|---|---|
| Sales checkout | Auth, Product (+price), Shift, Payment method | Validasi permission, harga, stok, shift aktif, metode bayar |
| Stock movement | Product, Sale / Purchase receipt | Movement selalu punya referensi |
| Goods receipt | Purchase (PO approved) | PO tidak menambah stok; receipt yang menambah |
| Void / Return / Refund | Sale (COMPLETED), Approval, Audit | Finalized tx tidak di-hard-delete |
| Cash reconciliation | Shift, Sale payments (cash), Cash movements | Expected cash dihitung backend |
| Reports | Semua domain sumber | Agregasi konsisten dengan transaksi finalized |
| Approval | User/Role | requester & approver teridentifikasi |

## Urutan implementasi (final)

`0 setup → 1 auth → 2 master → 3 sales/pos → 4 shift → 5 inventory → 6 purchase → 7 control → 8 reports → 9 hardening`
