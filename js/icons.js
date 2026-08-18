// Minimal hand-authored inline SVG icon set (Phosphor-outline inspired), so
// the app never depends on an icon font or external asset request.

const attrs = 'width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"';

const ICONS = {
  menu: `<svg ${attrs}><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>`,
  close: `<svg ${attrs}><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>`,
  chevronLeft: `<svg ${attrs}><polyline points="15 6 9 12 15 18"/></svg>`,
  chevronRight: `<svg ${attrs}><polyline points="9 6 15 12 9 18"/></svg>`,
  repeat: `<svg ${attrs}><polyline points="17 2 21 6 17 10"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 22 3 18 7 14"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
  pause: `<svg ${attrs}><line x1="9" y1="5" x2="9" y2="19"/><line x1="15" y1="5" x2="15" y2="19"/></svg>`,
  play: `<svg ${attrs}><polygon points="6 4 20 12 6 20" fill="currentColor" stroke="none"/></svg>`,
  home: `<svg ${attrs}><path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9"/></svg>`,
  list: `<svg ${attrs}><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4.5" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.4" fill="currentColor" stroke="none"/></svg>`,
  wallet: `<svg ${attrs}><rect x="3" y="7" width="18" height="13" rx="2.2"/><path d="M3 10h18"/><path d="M7 7V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1"/><circle cx="16.5" cy="14.5" r="1.1" fill="currentColor" stroke="none"/></svg>`,
  chart: `<svg ${attrs}><line x1="4" y1="20" x2="20" y2="20"/><rect x="6" y="13" width="3" height="7" rx="0.6"/><rect x="12" y="9" width="3" height="11" rx="0.6"/><rect x="17" y="6" width="3" height="14" rx="0.6"/></svg>`,
  trendingUp: `<svg ${attrs}><polyline points="4 17 10 11 14 15 20 7"/><polyline points="14 7 20 7 20 13"/></svg>`,
  gear: `<svg ${attrs}><circle cx="12" cy="12" r="3"/><path d="M12 3v2.2M12 18.8V21M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M3 12h2.2M18.8 12H21M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6"/></svg>`,
  check: `<svg ${attrs}><polyline points="5 13 9.5 17.5 19 6"/></svg>`,
  chevronDown: `<svg ${attrs}><polyline points="6 9 12 15 18 9"/></svg>`,
};

export function icon(name) {
  return ICONS[name] || '';
}
