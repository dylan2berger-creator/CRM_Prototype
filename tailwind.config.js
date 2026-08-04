/*
 * CRM (Client Recovery Manager) — theme
 *
 * DESIGN DIRECTION (stated per spec):
 * This is a field operations tool a Client Performance Manager keeps open all
 * day next to a spreadsheet and a carrier portal. The look is a dense, legible
 * "operations console": near-white slate surfaces, hairline borders, tabular
 * numerics, minimal chrome. NOT a cream/serif/terracotta editorial look, and
 * NOT a consumer dashboard with big whitespace and gradients.
 *
 * COLOR SYSTEM:
 *  - One interactive accent (teal) carries "this is actionable / selected".
 *  - Status uses a blue / amber / red ramp, deliberately avoiding a red-green
 *    pairing so it stays legible for the ~8% of male users with color vision
 *    deficiency. Status is NEVER encoded in color alone anywhere in the UI —
 *    every status also carries a text label and/or a shape (dot, icon, ring).
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#0f766e', // teal-700 — interactive / selected
          hover: '#115e59', // teal-800
          soft: '#f0fdfa', // teal-50 — selected row wash
          ring: '#5eead4', // teal-300
        },
        // Status ramp — blue (good) / amber (watch) / red (bad) / slate (neutral).
        good: { DEFAULT: '#1d4ed8', soft: '#eff6ff', text: '#1e40af' },
        warn: { DEFAULT: '#b45309', soft: '#fffbeb', text: '#92400e' },
        bad: { DEFAULT: '#b91c1c', soft: '#fef2f2', text: '#991b1b' },
        neutral: { DEFAULT: '#475569', soft: '#f8fafc', text: '#334155' },
        ink: '#0f172a', // slate-900 primary text
        surface: '#ffffff',
        panel: '#f8fafc', // slate-50
        line: '#e2e8f0', // slate-200 hairline
        'line-strong': '#cbd5e1', // slate-300
        muted: '#64748b', // slate-500 secondary text
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '0.9rem' }], // 11px, dense table meta
      },
      fontVariantNumeric: {
        tabular: 'tabular-nums',
      },
    },
  },
  plugins: [],
};
