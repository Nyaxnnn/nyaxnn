const routes = new Map();

export function registerRoute(path, renderFn) {
  routes.set(path, renderFn);
}

export function currentPath() {
  const hash = window.location.hash.replace(/^#/, '') || '/';
  return routes.has(hash) ? hash : '/';
}

export async function runRouter(root, onNavigate) {
  const path = currentPath();
  const renderFn = routes.get(path);
  root.setAttribute('aria-busy', 'true');
  try {
    await renderFn(root);
  } finally {
    root.removeAttribute('aria-busy');
  }
  if (onNavigate) onNavigate(path);
}

export function startRouter(root, onNavigate) {
  window.addEventListener('hashchange', () => runRouter(root, onNavigate));
  return runRouter(root, onNavigate);
}
