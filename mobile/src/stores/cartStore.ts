/**
 * POS cart (Zustand). Lives only in memory — cleared after checkout or hold.
 */
import { create } from 'zustand';

export interface CartItem {
  productId: number;
  sku: string;
  name: string;
  unitPrice: number;
  qty: number;
  /** Discount in rupiah for this line. */
  discount: number;
}

interface CartState {
  items: CartItem[];
  /** Total-level discount in rupiah. */
  discountTotal: number;
  notes: string;
  customerId: number | null;
  addItem: (item: Omit<CartItem, 'qty' | 'discount'>, qty?: number) => void;
  updateQty: (productId: number, qty: number) => void;
  setItemDiscount: (productId: number, discount: number) => void;
  removeItem: (productId: number) => void;
  setDiscountTotal: (value: number) => void;
  setNotes: (value: string) => void;
  setCustomerId: (id: number | null) => void;
  clear: () => void;
  subtotal: () => number;
  itemCount: () => number;
}

export const useCartStore = create<CartState>()((set, get) => ({
  items: [],
  discountTotal: 0,
  notes: '',
  customerId: null,

  addItem: (item, qty = 1) => {
    set(state => {
      const existing = state.items.find(i => i.productId === item.productId);
      if (existing) {
        return {
          items: state.items.map(i =>
            i.productId === item.productId
              ? { ...i, qty: i.qty + qty }
              : i,
          ),
        };
      }
      return {
        items: [...state.items, { ...item, qty, discount: 0 }],
      };
    });
  },

  updateQty: (productId, qty) => {
    if (qty <= 0) {
      get().removeItem(productId);
      return;
    }
    set(state => ({
      items: state.items.map(i =>
        i.productId === productId ? { ...i, qty } : i,
      ),
    }));
  },

  setItemDiscount: (productId, discount) => {
    set(state => ({
      items: state.items.map(i =>
        i.productId === productId
          ? { ...i, discount: Math.max(0, discount) }
          : i,
      ),
    }));
  },

  removeItem: productId => {
    set(state => ({
      items: state.items.filter(i => i.productId !== productId),
    }));
  },

  setDiscountTotal: value => set({ discountTotal: Math.max(0, value) }),
  setNotes: value => set({ notes: value }),
  setCustomerId: id => set({ customerId: id }),

  clear: () =>
    set({ items: [], discountTotal: 0, notes: '', customerId: null }),

  subtotal: () =>
    get().items.reduce(
      (sum, i) => sum + Math.max(0, i.unitPrice * i.qty - i.discount),
      0,
    ),

  itemCount: () => get().items.reduce((sum, i) => sum + i.qty, 0),
}));

/** Grand total = subtotal - discountTotal (never negative). */
export function cartGrandTotal(items: CartItem[], discountTotal: number): number {
  const sub = items.reduce(
    (sum, i) => sum + Math.max(0, i.unitPrice * i.qty - i.discount),
    0,
  );
  return Math.max(0, sub - discountTotal);
}

export function formatRupiah(value: number): string {
  return 'Rp ' + Math.round(value).toLocaleString('id-ID');
}
