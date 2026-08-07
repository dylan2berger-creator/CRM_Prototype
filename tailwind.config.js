/*
 * Rebound (shop performance recovery) - theme
 *
 * DESIGN DIRECTION:
 * Mirrors the "hub" design system. A dark navy brand shell (#002241) frames
 * white content cards; one primary blue (#00529b) carries "actionable /
 * selected". Headings are set in Oswald (the brand face), body copy in Fustat.
 * Status uses the hub's success / warning / error ramp; status is never encoded
 * in color alone (every state also carries a label and/or a shape).
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand base - the dark navy shell.
        navy: { DEFAULT: '#002241', light: '#0b3a63', line: '#173a5a' },
        // Primary blue - interactive / selected.
        accent: {
          DEFAULT: '#00529b', // foreground-primary-strong / border-focus
          hover: '#0a4585',
          soft: '#e7f0f9', // subtle primary wash (selected row / active nav)
          ring: '#8aafd1', // border-muted / focus ring
        },
        // Status ramp - hub success / warning / error.
        good: { DEFAULT: '#36832f', soft: '#e5f1e4', text: '#173714' },
        warn: { DEFAULT: '#b8860b', soft: '#fff2cf', text: '#6b5103' },
        bad: { DEFAULT: '#ba1a1a', soft: '#f6e1e1', text: '#4e0b0b' },
        neutral: { DEFAULT: '#5f5e5f', soft: '#f1f1f1', text: '#313031' },
        // Short-win / completed-card green.
        short: { DEFAULT: '#88f6bc', soft: '#c1d9bf', text: '#1d392b' },
        ink: '#313031', // primary text (on-surface-subtle)
        surface: '#ffffff', // cards
        panel: '#eef2f7', // content-area background behind cards
        line: '#e0e0e0', // hairline border
        'line-strong': '#c9c9c9',
        muted: '#6b6a6b', // secondary text
        nav: '#b0c9e0', // nav label on navy (inactive)
        'nav-dim': '#8aafd1', // nav icon on navy (inactive)
        // Brand gradient stops (navy -> blue) for the avatar / brand mark.
        brand: { purple: '#002241', pink: '#0a4585', blue: '#4483cd' },
      },
      fontFamily: {
        sans: ['Fustat', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        head: ['Oswald', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '0.9rem' }], // 11px, dense table meta
      },
      boxShadow: {
        card: '0 0 1px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.18)',
        pop: '0 2px 7px rgba(0,0,0,0.20)',
      },
      fontVariantNumeric: {
        tabular: 'tabular-nums',
      },
    },
  },
  plugins: [],
};
