// Line-icon set in a consistent rounded style (Lucide-like), mirroring
// ClickUp's iconography. Every icon takes a className for sizing/color and
// inherits the current text color via `currentColor`.

interface IconProps {
  className?: string;
}

const base = (className?: string) => ({
  className: className ?? 'h-5 w-5',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

export const IconPortfolio = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M4 6h10M4 12h10M4 18h7" />
    <path d="M17.5 13.5l2 2 3-3.5" />
  </svg>
);

export const IconAnalysis = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M4 20V4" />
    <rect x="6.5" y="12" width="3" height="6" rx="1" />
    <rect x="11.5" y="8" width="3" height="10" rx="1" />
    <rect x="16.5" y="5" width="3" height="13" rx="1" />
  </svg>
);

export const IconBenchmarking = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M3 17l6-6 4 4 7-8" />
    <path d="M20 7h-4M20 7v4" />
  </svg>
);

export const IconCarriers = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
    <path d="M9.5 12l1.8 1.8L15 10" />
  </svg>
);

export const IconRollup = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M12 3l9 5-9 5-9-5 9-5z" />
    <path d="M3 13l9 5 9-5" />
  </svg>
);

export const IconAlerts = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M18 8a6 6 0 1 0-12 0c0 6-2.5 7-2.5 7h17S18 14 18 8z" />
    <path d="M10.5 20a2 2 0 0 0 3 0" />
  </svg>
);

export const IconStore = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M4 9l1-4h14l1 4" />
    <path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" />
    <path d="M4 9a2.5 2.5 0 0 0 4 0 2.5 2.5 0 0 0 4 0 2.5 2.5 0 0 0 4 0 2.5 2.5 0 0 0 4 0" />
  </svg>
);

export const IconChevronDown = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const IconPlus = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconCheck = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M5 12l5 5L20 7" />
  </svg>
);

export const IconUser = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" />
  </svg>
);

export const IconCalendar = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
    <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
  </svg>
);

export const IconEdit = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M4 20h4l10-10-4-4L4 16v4z" />
    <path d="M13.5 6.5l4 4" />
  </svg>
);

export const IconTrash = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

export const IconRefresh = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M20 11a8 8 0 0 0-14-4.5L4 8" />
    <path d="M4 4v4h4" />
    <path d="M4 13a8 8 0 0 0 14 4.5L20 16" />
    <path d="M20 20v-4h-4" />
  </svg>
);
