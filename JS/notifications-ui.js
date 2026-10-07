document.addEventListener('DOMContentLoaded', () => {
  const notificationPanel = document.querySelector('[data-notifications-panel]');
  if (!notificationPanel) return;

  const bellButton = document.querySelector('[data-notifications-toggle]');
  const closeButton = document.querySelector('[data-notifications-close]');
  const list = document.querySelector('[data-notifications-list]');
  const badge = document.querySelector('[data-notifications-badge]');

  if (!bellButton || !list) return;

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[character]);

  const showFallback = (message, icon = '🔔') => {
    list.innerHTML = `
      <div class="leasehub-empty-state">
        <div class="leasehub-empty-icon">${icon}</div>
        <p>${message}</p>
      </div>
    `;
  };

  const renderNotifications = (items) => {
    const unreadCount = items.filter((item) => !item.read).length;
    if (badge) {
      badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
      badge.hidden = unreadCount === 0;
    }

    if (!items.length) {
      showFallback('No notifications yet.', '🔔');
      return;
    }

    list.innerHTML = items.map(item => `
      <div class="leasehub-notification ${item.read ? 'is-read' : 'is-unread'}" data-id="${escapeHtml(item.id)}">
        <div class="leasehub-notification__icon ${item.type || 'info'}">${
          item.type === 'success' ? '✓' :
          item.type === 'warning' ? '!' :
          item.type === 'danger' ? '✕' : 'ℹ'
        }</div>
        <div class="leasehub-notification__body">
          <strong>${escapeHtml(item.title || 'Notification')}</strong>
          <p>${escapeHtml(item.message || '')}</p>
        </div>
        <button class="leasehub-notification__mark" type="button" data-mark-read="${escapeHtml(item.id)}" ${item.read ? 'disabled' : ''}>
          ${item.read ? 'Read' : 'Mark read'}
        </button>
      </div>
    `).join('');
  };

  const fetchNotifications = async () => {
    try {
      if (!window.LeaseHubApi) throw new Error('Notifications are not configured.');
      const token = await window.LeaseHubAuth?.getAccessToken();
      if (!token) {
        showFallback('Log in to view notifications.', '🔒');
        return;
      }
      const payload = await window.LeaseHubApi.request('/notifications');
      renderNotifications(payload.notifications || []);
    } catch (error) {
      showFallback(error.message || 'Backend is unavailable.', '⚠️');
    }
  };

  bellButton.addEventListener('click', () => {
    const isOpen = notificationPanel.classList.toggle('is-open');
    bellButton.setAttribute('aria-expanded', String(isOpen));
  });

  if (closeButton) {
    closeButton.addEventListener('click', () => {
      notificationPanel.classList.remove('is-open');
      bellButton.setAttribute('aria-expanded', 'false');
    });
  }

  notificationPanel.addEventListener('click', (event) => {
    if (event.target === notificationPanel) {
      notificationPanel.classList.remove('is-open');
      bellButton.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('click', (event) => {
    if (!notificationPanel.contains(event.target)) {
      notificationPanel.classList.remove('is-open');
      bellButton.setAttribute('aria-expanded', 'false');
    }
  });

  list.addEventListener('click', async (event) => {
    const markButton = event.target.closest('[data-mark-read]');
    if (!markButton) return;

    const id = markButton.getAttribute('data-mark-read');
    if (!id) return;

    markButton.disabled = true;
    try {
      await window.LeaseHubApi.request(`/notifications/${encodeURIComponent(id)}/read`, {
        method: 'PATCH'
      });
      await fetchNotifications();
    } catch (error) {
      markButton.disabled = false;
      showFallback(error.message || 'Unable to update this notification.', '⚠️');
    }
  });

  fetchNotifications();
});
