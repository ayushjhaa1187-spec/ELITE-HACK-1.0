(() => {
  'use strict';

  const STORAGE_KEY = 'circlesAdminGlobalSearchQuery';
  const STORAGE_TS_KEY = 'circlesAdminGlobalSearchTs';
  const QUERY_PARAM = 'q';
  const TTL_MS = 30 * 60 * 1000;

  const ROUTE_RULES = [
    { route: '/attendees', words: ['attendee', 'attendees', 'registration', 'registrations', 'checkin', 'check-in', 'ticket', 'tickets', 'email'] },
    { route: '/analytics', words: ['analytics', 'insight', 'insights', 'metric', 'metrics', 'trend', 'trends', 'conversion', 'funnel', 'rate', 'performance'] },
    { route: '/settings', words: ['setting', 'settings', 'config', 'configuration', 'permission', 'permissions', 'team', 'notification', 'notifications', 'qr'] },
    { route: '/events', words: ['event', 'events', 'venue', 'schedule', 'upcoming', 'completed', 'live event'] },
    { route: '/dashboard', words: ['dashboard', 'overview', 'home'] },
  ];

  function normalizeRoute(pathname) {
    const path = String(pathname || '').toLowerCase();
    if (path === '/' || path.startsWith('/dashboard')) return '/dashboard';
    if (path.startsWith('/events')) return '/events';
    if (path.startsWith('/attendees')) return '/attendees';
    if (path.startsWith('/analytics')) return '/analytics';
    if (path.startsWith('/settings')) return '/settings';
    if (path.startsWith('/profile') || path === '/profile.html') return '/profile';
    return path || '/dashboard';
  }

  function storeQuery(query) {
    const value = String(query || '').trim();
    if (!value) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_TS_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, value);
    localStorage.setItem(STORAGE_TS_KEY, String(Date.now()));
  }

  function getStoredQuery() {
    const value = localStorage.getItem(STORAGE_KEY) || '';
    const ts = Number(localStorage.getItem(STORAGE_TS_KEY) || 0);
    if (!value || !ts || Number.isNaN(ts) || Date.now() - ts > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_TS_KEY);
      return '';
    }
    return value;
  }

  function getInitialQuery() {
    const params = new URLSearchParams(window.location.search || '');
    const fromUrl = (params.get(QUERY_PARAM) || '').trim();
    if (fromUrl) {
      storeQuery(fromUrl);
      return fromUrl;
    }
    return getStoredQuery();
  }

  function resolveRouteForQuery(query, fallbackRoute) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return fallbackRoute;

    for (const rule of ROUTE_RULES) {
      if (rule.words.some(word => q.includes(word))) {
        return rule.route;
      }
    }

    return fallbackRoute;
  }

  function buildRouteWithQuery(route, query) {
    if (!query) return route;
    return `${route}?${QUERY_PARAM}=${encodeURIComponent(query)}`;
  }

  function attach(inputOrSelector, options = {}) {
    const input = typeof inputOrSelector === 'string'
      ? document.querySelector(inputOrSelector)
      : inputOrSelector;

    if (!input) return;

    const applyLocalSearch = typeof options.applyLocalSearch === 'function'
      ? options.applyLocalSearch
      : null;

    const getTargetRoute = typeof options.getTargetRoute === 'function'
      ? options.getTargetRoute
      : null;

    const currentRoute = normalizeRoute(window.location.pathname);
    const initialQuery = getInitialQuery();

    if (initialQuery) {
      input.value = initialQuery;
      if (applyLocalSearch) applyLocalSearch(initialQuery, { source: 'initial' });
    }

    function runSubmit() {
      const query = input.value.trim();
      storeQuery(query);

      if (applyLocalSearch) applyLocalSearch(query, { source: 'submit' });

      const explicitTarget = getTargetRoute ? getTargetRoute(query, currentRoute) : '';
      const targetRoute = explicitTarget || resolveRouteForQuery(query, currentRoute);
      const normalizedTarget = normalizeRoute(targetRoute);

      if (query && normalizedTarget && normalizedTarget !== currentRoute && targetRoute !== '/profile') {
        window.location.href = buildRouteWithQuery(targetRoute, query);
      }
    }

    input.addEventListener('input', () => {
      const query = input.value.trim();
      storeQuery(query);
      if (applyLocalSearch) applyLocalSearch(query, { source: 'input' });
    });

    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        runSubmit();
      }
    });
  }

  window.CirclesGlobalSearch = {
    attach,
    storeQuery,
    getInitialQuery,
    resolveRouteForQuery,
    normalizeRoute,
  };
})();
