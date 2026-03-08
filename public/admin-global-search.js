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

  let toastTimeout;
  function showToast(message, type = 'success', duration = 5000) {
    let toast = document.getElementById('global-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'global-toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }

    // Clear existing
    if (toastTimeout) {
      clearTimeout(toastTimeout);
      toast.classList.remove('show');
    }

    // Icons for different types
    const icons = {
      success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
      error: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
      info: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
    };

    toast.className = `toast ${type}`;
    toast.innerHTML = `${icons[type] || icons.info} <span>${message}</span>`;

    // Force reflow
    void toast.offsetWidth;
    toast.classList.add('show');

    toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  }

  // ── Global Popups Factory ──
  function initGlobalPopups() {
    // 1. Event Selector Popup
    const evSelToggles = document.querySelectorAll('.ev-sel');
    if (evSelToggles.length > 0) {
      const eventPopover = document.createElement('div');
      eventPopover.className = 'global-popover';
      eventPopover.id = 'eventPopover';
      // Basic skeleton
      eventPopover.innerHTML = `
        <div class="popover-header">
          <span>Switch Event Workspace</span>
        </div>
        <div id="popoverEventList" style="padding-bottom: 8px;">
           <div style="padding: 24px; text-align: center; color: var(--ink-3); font-size: 13px;">Loading events...</div>
        </div>
      `;
      document.body.appendChild(eventPopover);

      const closeEventPopover = () => eventPopover.classList.remove('show');

      evSelToggles.forEach(toggle => {
        toggle.addEventListener('click', async (e) => {
          e.stopPropagation();
          const rect = toggle.getBoundingClientRect();
          eventPopover.style.top = (rect.bottom + 8) + 'px';
          eventPopover.style.left = Math.max(20, rect.left) + 'px';
          eventPopover.style.right = 'auto'; // Reset right bound since it is on the left

          const isShowing = eventPopover.classList.toggle('show');
          if (isShowing) {
            document.getElementById('notifPopover')?.classList.remove('show'); // close other

            // Fetch events to put in list
            try {
              const token = localStorage.getItem('token');
              const res = await fetch('/api/admin/events', { headers: { 'Authorization': 'Bearer ' + token } });
              const events = res.ok ? await res.json() : [];
              const eventsArr = Array.isArray(events) ? events : (events.events || []);

              const list = document.getElementById('popoverEventList');
              const currentId = localStorage.getItem('currentEventId');

              if (eventsArr.length === 0) {
                list.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--ink-3); font-size: 13px;">No events found.</div>`;
                return;
              }

              list.innerHTML = eventsArr.map(ev => `
                <div class="popover-item ${ev.id === currentId ? 'active' : ''}" data-id="${ev.id}">
                  <div class="popover-item-icon" style="color: ${ev.id === currentId ? 'var(--violet)' : 'var(--ink-3)'}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                  </div>
                  <div class="popover-item-content">
                    <div class="popover-item-title">${ev.title || 'Untitled Event'}</div>
                    <div class="popover-item-sub">${new Date(ev.startDate).toLocaleDateString()} · ${ev.venue || 'Virtual'}</div>
                  </div>
                </div>
              `).join('');

              list.querySelectorAll('.popover-item').forEach(item => {
                item.addEventListener('click', () => {
                  localStorage.setItem('currentEventId', item.dataset.id);
                  window.location.reload();
                });
              });
            } catch (err) { }
          }
        });
      });
      document.addEventListener('click', closeEventPopover);
    }

    // 2. Notifications Popup
    const notifToggles = document.querySelectorAll('.icon-btn[aria-label="Notifications"]');
    if (notifToggles.length > 0) {
      const notifPopover = document.createElement('div');
      notifPopover.className = 'global-popover';
      notifPopover.id = 'notifPopover';
      notifPopover.innerHTML = `
        <div class="popover-header">
          <span>Notifications</span>
          <span style="font-size: 11px; color: var(--violet); cursor: pointer;" onclick="document.getElementById('notifList').innerHTML='<div style=\\'padding:32px;text-align:center;color:var(--ink-4)\\'>All caught up.</div>'">Mark all read</span>
        </div>
        <div id="notifList" style="padding-bottom: 8px;">
          <div class="popover-item">
            <div class="popover-item-icon" style="background: rgba(34,197,94,0.1); color: var(--emerald);">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div class="popover-item-content">
              <div class="popover-item-title">Event Successfully Published</div>
              <div class="popover-item-sub">2 mins ago</div>
            </div>
          </div>
           <div class="popover-item">
            <div class="popover-item-icon" style="background: rgba(96,64,240,0.1); color: var(--violet);">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
            </div>
            <div class="popover-item-content">
              <div class="popover-item-title">New Team Member Joined</div>
              <div class="popover-item-sub">Jahnvi was added as Organizer.</div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(notifPopover);

      const closeNotifPopover = () => notifPopover.classList.remove('show');

      notifToggles.forEach(toggle => {
        toggle.addEventListener('click', (e) => {
          e.stopPropagation();
          const rect = toggle.getBoundingClientRect();
          notifPopover.style.top = (rect.bottom + 12) + 'px';
          notifPopover.style.right = (window.innerWidth - rect.right - 10) + 'px';
          notifPopover.style.left = 'auto'; // pin to right

          if (notifPopover.classList.toggle('show')) {
            document.getElementById('eventPopover')?.classList.remove('show');
          }
        });
      });
      document.addEventListener('click', closeNotifPopover);
      notifPopover.addEventListener('click', e => e.stopPropagation());
    }
  }

  // ── Theme Engine ──
  function initTheme() {
    const savedTheme = localStorage.getItem('circles-admin-theme') || 'dark';
    if (savedTheme === 'light') {
      document.body.classList.add('light-mode');
    }

    const target = document.querySelector('.tb-actions') || document.querySelector('.topbar-right');
    if (target && !document.getElementById('themeToggleBtn')) {
      const btn = document.createElement('button');
      btn.className = 'icon-btn';
      btn.id = 'themeToggleBtn';
      btn.title = 'Switch Appearance';
      btn.style.marginRight = '8px';

      const updateIcon = (isLight) => {
        btn.innerHTML = isLight
          ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`
          : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
      };

      updateIcon(document.body.classList.contains('light-mode'));

      btn.onclick = () => {
        const isL = document.body.classList.toggle('light-mode');
        localStorage.setItem('circles-admin-theme', isL ? 'light' : 'dark');
        updateIcon(isL);
      };

      target.prepend(btn);
    }
  }

  window.CirclesGlobalSearch = {
    attach,
    storeQuery,
    getInitialQuery,
    resolveRouteForQuery,
    normalizeRoute,
    showToast
  };

  document.addEventListener('DOMContentLoaded', () => {
    initGlobalPopups();
    initTheme();
  });
})();
