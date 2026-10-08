/**
 * Cashier shift state.
 *
 * Holds the user's current open shift (or null). Screens read this to
 * decide whether POS flows are allowed; refresh via fetchCurrent().
 */
import { create } from 'zustand';
import {
  getCurrentShift,
  ShiftResponse,
} from '../services/shiftApi';

interface ShiftState {
  currentShift: ShiftResponse | null;
  loading: boolean;
  initialized: boolean;
  fetchCurrent: () => Promise<void>;
  setCurrentShift: (shift: ShiftResponse | null) => void;
  clear: () => void;
}

export const useShiftStore = create<ShiftState>()(set => ({
  currentShift: null,
  loading: false,
  initialized: false,

  fetchCurrent: async () => {
    set({ loading: true });
    try {
      const shift = await getCurrentShift();
      set({ currentShift: shift, initialized: true });
    } catch {
      // Keep previous state; callers handle the error display.
      set({ initialized: true });
    } finally {
      set({ loading: false });
    }
  },

  setCurrentShift: shift => set({ currentShift: shift, initialized: true }),
  clear: () => set({ currentShift: null, initialized: false }),
}));
