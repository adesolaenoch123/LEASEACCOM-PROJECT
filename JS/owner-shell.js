/**
 * Shared Owner Lounge shell: sidebar, mobile toggle, notifications.
 * Include on owner pages with: <body class="owner-lounge-body" data-owner-page="...">
 * and a <div id="ownerShellRoot"></div> OR existing .owner-lounge structure.
 */
(function () {
  const STORE_KEY = 'leaseaccom_owner_store_v1';
  const NOTIF_KEY = 'leaseaccom_owner_notifs_v1';
  let backendNotifications = null;

  function currentUser() {
    try {
      return JSON.parse(localStorage.getItem('leaseaccomCurrentUser') || localStorage.getItem('leaseaccomCurrentUser') || localStorage.getItem('currentUser') || 'null');
    } catch {
      return null;
    }
  }

  function loadNotifs() {
    try {
      return JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]') || [];
    } catch {
      return [];
    }
  }

  function saveNotifs(list) {
    localStorage.setItem(NOTIF_KEY, JSON.stringify(list.slice(0, 50)));
  }

  function seedNotifsFromData() {
    const user = currentUser();
    if (!user) return;
    const list = loadNotifs();
    if (list.length) return;
    const seeded = [
      { id: 'tip1', type: 'tip', title: 'Welcome to Owner Lounge', body: 'Add a property and complete Property Page appearance.', read: false, at: Date.now() },
      { id: 'tip2', type: 'tip', title: 'Respond fast', body: 'Quick replies to viewings improve conversion.', read: false, at: Date.now() - 1000 }
    ];
    saveNotifs(seeded);
  }

  function unreadCount() {
    return loadNotifs().filter((n) => !n.read).length;
  }

  function sidebarHTML(active) {
    const user = currentUser();
    const name = user?.name || 'Owner';
    const initial = name.trim().charAt(0).toUpperCase() || 'O';
    const item = (href, key, icon, label) =>
      `<a href="${href}" class="owner-nav-item${active === key ? ' is-active' : ''}"><i class="bx ${icon}"></i><span>${label}</span></a>`;
    return `
<aside class="owner-sidebar" id="ownerSidebar">
  <div class="owner-sidebar-top">
    <a href="index.html" class="owner-sidebar-brand">
      <img src="IMAGES/leaseaccom-logo-full.png" alt="LeaseAccom">
      <div><strong>LeaseAccom</strong><span>Owner Lounge</span></div>
    </a>
    <button type="button" class="owner-sidebar-hide" id="ownerSidebarHide" aria-label="Hide menu"><i class="bx bx-chevron-left"></i></button>
  </div>
  <nav class="owner-sidebar-nav">
    ${item('owner-dashboard.html', 'dashboard', 'bx-grid-alt', 'Dashboard')}
    ${item('owner-dashboard.html#myProperties', 'properties', 'bx-building-house', 'Properties')}
    ${item('owner-verification.html', 'verification', 'bx-badge-check', 'Verification')}
    ${item('add-property.html', 'add', 'bx-plus-circle', 'Add property')}
    ${item('owner-dashboard.html#ownerViewings', 'viewings', 'bx-calendar', 'Viewings')}
    ${item('owner-dashboard.html#ownerApplications', 'applications', 'bx-file', 'Applications')}
    ${item('owner-messages.html', 'messages', 'bx-message-dots', 'Messages')}
    ${item('owner-dashboard.html#ownerStore', 'propertypage', 'bx-buildings', 'Property page appearance')}
    ${item('owner-storefront.html', 'public-propertypage', 'bx-store-alt', 'Public property page')}
    ${item('owner-payments.html', 'payments', 'bx-wallet', 'Payments')}
    ${item('owner-dashboard.html#ownerPlan', 'plan', 'bx-diamond', 'Plan')}
  </nav>
  <div class="owner-sidebar-foot">
    <div class="owner-sidebar-user">
      <span class="owner-avatar">${initial}</span>
      <div><strong>${name}</strong><small>Property owner</small></div>
    </div>
    <button type="button" class="owner-exit-link" id="ownerRefreshSidebar" onclick="location.reload()"><i class="bx bx-refresh"></i> Refresh</button>
    <a href="properties.html" class="owner-exit-link"><i class="bx bx-log-out"></i> Exit to Marketplace</a>
  </div>
</aside>
<div class="owner-sidebar-overlay" id="ownerSidebarOverlay"></div>`;
  }

  function topbarHTML(title) {
    const count = unreadCount();
    return `
<header class="owner-topbar">
  <button type="button" class="owner-menu-toggle" id="ownerMenuToggle" aria-label="Open menu"><i class="bx bx-menu"></i></button>
  <a href="owner-dashboard.html" class="owner-brand-text" aria-label="LeaseAccom">
    <span class="lh-lease">Lease</span><span class="lh-accom">Accom</span>
  </a>
  <div class="owner-topbar-title owner-topbar-title--desktop">
    <span class="owner-eyebrow">OWNER LOUNGE</span>
    <h1>${title}</h1>
  </div>
  <div class="owner-topbar-actions">
    <div class="owner-notif-wrap">
      <button type="button" class="owner-ghost-btn owner-notif-btn" id="ownerNotifBtn" aria-label="Notifications">
        <i class="bx bx-bell"></i>
        <span class="owner-notif-badge" id="ownerNotifBadge" ${count ? '' : 'hidden'}>${count}</span>
      </button>
      <div class="owner-notif-panel" id="ownerNotifPanel" hidden>
        <div class="owner-notif-head">
          <strong>Notifications</strong>
          <button type="button" id="ownerNotifReadAll">Mark all read</button>
        </div>
        <div id="ownerNotifList" class="owner-notif-list"></div>
      </div>
    </div>
    <button type="button" class="owner-ghost-btn owner-desktop-only" id="ownerRefreshBtn"><i class="bx bx-refresh"></i> Refresh</button>
    <a href="properties.html" class="owner-ghost-btn owner-desktop-only">Exit to Marketplace</a>
  </div>
</header>`;
  }

  function renderNotifList(items = backendNotifications || loadNotifs()) {
    const list = document.getElementById('ownerNotifList');
    if (!list) return;
    if (!items.length) {
      list.innerHTML = '<p class="owner-muted">No notifications yet.</p>';
      return;
    }
    list.innerHTML = items
      .map(
        (n) => `<article class="owner-notif-item ${n.read ? '' : 'is-unread'}">
        <strong>${escapeHtml(n.title || 'Update')}</strong>
        <p>${escapeHtml(n.message || n.body || '')}</p>
      </article>`
      )
      .join('');
  }

  async function loadBackendNotifications() {
    if (!window.LeaseAccomApi || !window.LeaseAccomAuth) return;
    try {
      const token = await window.LeaseAccomAuth.getAccessToken();
      if (!token) return;
      const payload = await window.LeaseAccomApi.request('/notifications');
      backendNotifications = payload.notifications || [];
      renderNotifList(backendNotifications);
      const badge = document.getElementById('ownerNotifBadge');
      const unreadCount = backendNotifications.filter((item) => !item.read).length;
      if (badge) {
        badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
        badge.hidden = unreadCount === 0;
      }
    } catch (error) {
      console.warn('Backend owner notifications could not be loaded.', error);
    }
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function setupChrome() {
    const lounge = document.querySelector('.owner-lounge');
    if (!lounge) return;
    const openBtn = document.getElementById('ownerMenuToggle');
    const closeBtn = document.getElementById('ownerSidebarHide');
    const overlay = document.getElementById('ownerSidebarOverlay');
    openBtn?.addEventListener('click', () => lounge.classList.add('sidebar-open'));
    closeBtn?.addEventListener('click', () => lounge.classList.remove('sidebar-open'));
    overlay?.addEventListener('click', () => lounge.classList.remove('sidebar-open'));

    seedNotifsFromData();
    renderNotifList();
    loadBackendNotifications();
    const badge = document.getElementById('ownerNotifBadge');
    const panel = document.getElementById('ownerNotifPanel');
    document.getElementById('ownerNotifBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!panel) return;
      panel.hidden = !panel.hidden;
    });
    document.getElementById('ownerNotifReadAll')?.addEventListener('click', async () => {
      if (backendNotifications && window.LeaseAccomApi) {
        try {
          await Promise.all(backendNotifications
            .filter((item) => !item.read)
            .map((item) => window.LeaseAccomApi.request(
              `/notifications/${encodeURIComponent(item.id)}/read`,
              { method: 'PATCH' }
            )));
          await loadBackendNotifications();
          return;
        } catch (error) {
          console.warn('Owner notifications could not be marked read.', error);
        }
      }
      const items = loadNotifs().map((n) => ({ ...n, read: true }));
      saveNotifs(items);
      renderNotifList();
      if (badge) {
        badge.hidden = true;
        badge.textContent = '0';
      }
    });
    document.addEventListener('click', () => {
      if (panel) panel.hidden = true;
    });
    panel?.addEventListener('click', (e) => e.stopPropagation());
  }

  /** Wrap page content if only #ownerShellMount exists */
  function maybeBuildShell() {
    const mount = document.getElementById('ownerShellMount');
    if (!mount) {
      setupChrome();
      return;
    }
    const page = document.body.getAttribute('data-owner-page') || 'dashboard';
    const title = document.body.getAttribute('data-owner-title') || 'Owner Lounge';
    const activeMap = {
      dashboard: 'dashboard',
      messages: 'messages',
      add: 'add',
      propertypage: 'public-propertypage',
      payments: 'payments'
    };
    const active = activeMap[page] || page;
    const content = mount.innerHTML;
    mount.outerHTML = `
<div class="owner-lounge">
  ${sidebarHTML(active)}
  <div class="owner-main">
    ${topbarHTML(title)}
    <main class="owner-content">${content}</main>
  </div>
</div>`;
    setupChrome();
  }

  window.LeaseAccomOwnerShell = {
    loadNotifs,
    saveNotifs,
    pushNotif(title, body, type = 'info') {
      const items = loadNotifs();
      items.unshift({ id: String(Date.now()), type, title, body, read: false, at: Date.now() });
      saveNotifs(items);
    }
  };

  document.addEventListener('DOMContentLoaded', maybeBuildShell);
})();


  // Verification banner on owner pages
  document.addEventListener('DOMContentLoaded', function () {
    try {
      var user = currentUser();
      if (!user) return;
      var st = String(user.verificationStatus || user.ownerVerificationStatus || 'unverified').toLowerCase();
      if (st === 'verified') return;
      var main = document.querySelector('.owner-main, #ownerShellMount, .owner-lounge-main');
      if (!main) return;
      if (document.getElementById('ownerVerifyBanner')) return;
      var bar = document.createElement('div');
      bar.id = 'ownerVerifyBanner';
      bar.setAttribute('style', 'margin:0 0 16px;padding:14px 16px;border-radius:14px;background:#fff8e8;border:1px solid #f0e0b0;display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;');
      var msg = st === 'pending'
        ? '<strong>Verification pending</strong><span style="display:block;font-size:13px;color:#6b5a20;margin-top:4px">You cannot publish listings until LeaseAccom approves your details.</span>'
        : '<strong>Verify your owner account</strong><span style="display:block;font-size:13px;color:#6b5a20;margin-top:4px">Landlords must complete verification before listing a property.</span>';
      bar.innerHTML = '<div>' + msg + '</div><a href="owner-verification.html" class="primary-btn" style="text-decoration:none;white-space:nowrap">Verify now</a>';
      main.insertBefore(bar, main.firstChild);
    } catch (e) {}
  });
