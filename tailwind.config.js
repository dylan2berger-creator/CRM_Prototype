/*
 * Rebound (shop performance recovery) - theme
 *
 * DESIGN DIRECTION: mirror ClickUp. A clean, modern SaaS console - white
 * surfaces on a soft off-white canvas, generous rounding, soft shadows, and
 * ClickUp's signature purple as the single interactive accent (with a
 * purple -> pink -> blue gradient reserved for the brand mark). Line icons in a
 * consistent rounded style. It still reads as a dense operations tool, just
 * with ClickUp's polish rather than a spreadsheet's austerity.
 *
 * COLOR SYSTEM: purple accent carries "actionable / selected". Status uses a
 * ClickUp-style ramp (green complete / amber watch / coral at-risk / grey
 * neutral). Status is never color alone - every status keeps a text label and a
 * colored dot, so it reads for color vision deficiency and in grayscale.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#7B68EE', // ClickUp purple - interactive / selected
          hover: '#5f4bd8',
          soft: '#F1EEFE', // light purple wash for selected rows / active nav
          ring: '#C4B5FD', // purple-300
        },
        // ClickUp-style status ramp. green / amber / coral / grey.
        good: { DEFAULT: '#24B47E', soft: '#E7F8F1', text: '#0F855C' },
        warn: { DEFAULT: '#F5A623', soft: '#FEF4E3', text: '#B26B00' },
        bad: { DEFAULT: '#F0616D', soft: '#FDECEE', text: '#C4344A' },
        neutral: { DEFAULT: '#7C828D', soft: '#F4F5F7', text: '#565A63' },
        ink: '#292D34', // ClickUp dark text
        surface: '#ffffff',
        panel: '#F7F8FA', // soft app canvas
        line: '#EBEDF0', // hairline border
        'line-strong': '#DDE1E6',
        muted: '#7C828D', // secondary text
        // brand gradient stops (purple -> pink -> blue), for the logo mark.
        brand: { purple: '#7B68EE', pink: '#FD5FA6', blue: '#49CCF9' },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Inter', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '0.95rem' }], // 11px, dense table meta
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(41,45,52,0.04), 0 1px 3px rgba(41,45,52,0.06)',
        pop: '0 8px 24px rgba(41,45,52,0.12)',
      },
      fontVariantNumeric: {
        tabular: 'tabular-nums',
      },
    },
  },
  plugins: [],
};
