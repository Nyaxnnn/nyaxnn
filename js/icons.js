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
};

export function icon(name) {
  return ICONS[name] || '';
}
