export function navigate(path, { replace = false } = {}) {
  const target = `#${path.startsWith('/') ? path : `/${path}`}`;
  if (window.location.hash === target) return;
  if (replace) {
    const url = `${window.location.pathname}${window.location.search}${target}`;
    window.history.replaceState(null, '', url);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = target;
  }
}

export function currentHash() {
  return window.location.hash || '#/login';
}

export function parseRoute() {
  const raw = currentHash().replace(/^#/, '') || '/login';
  const [pathPart, queryPart = ''] = raw.split('?');
  const parts = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
  const query = new URLSearchParams(queryPart);
  return { parts, query, path: pathPart };
}

export function fullPath(path) {
  return `#${path.startsWith('/') ? path : `/${path}`}`;
}

export function refreshRoute() {
  window.dispatchEvent(new CustomEvent('app:refresh'));
}
