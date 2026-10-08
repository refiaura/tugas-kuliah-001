/**
 * Color system — modern minimalist.
 * Single accent (emerald) + neutral slate scale.
 */
export const colors = {
  // Accent — the ONE brand color. Used sparingly: primary actions, active states.
  accent: {
    50: '#ECFDF5',
    100: '#D1FAE5',
    200: '#A7F3D0',
    500: '#10B981',
    600: '#059669',
    700: '#047857',
  },

  // Neutrals — everything else.
  slate: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
  },

  // Semantic — reserved for meaning, never decoration.
  danger: {
    50: '#FEF2F2',
    600: '#DC2626',
    700: '#B91C1C',
  },
  warning: {
    50: '#FFFBEB',
    600: '#D97706',
  },
  info: {
    50: '#EFF6FF',
    600: '#2563EB',
  },

  white: '#FFFFFF',
  black: '#000000',

  // Aliases — semantic usage, so screens don't hardcode hex.
  background: '#F8FAFC', // slate-50, screen background
  surface: '#FFFFFF', // cards, sheets
  border: '#E2E8F0', // slate-200
  text: '#0F172A', // slate-900, headings
  textSecondary: '#475569', // slate-600, body
  textMuted: '#94A3B8', // slate-400, captions
  primary: '#059669', // accent-600
  primaryDark: '#047857', // accent-700, pressed state
  primarySoft: '#ECFDF5', // accent-50, tinted backgrounds
} as const;

export type Colors = typeof colors;
