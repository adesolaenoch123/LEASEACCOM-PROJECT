document.addEventListener('DOMContentLoaded', () => {
  const notificationPanel = document.querySelector('[data-notifications-panel]');
  if (!notificationPanel) return;

  const bellButton = document.querySelector('[data-notifications-toggle]');
  const closeButton = document.querySelector('[data-notifications-close]');
  const list = document.querySelector('[data-notifications-list]');
  const badge = document.querySelector('[data-notifications-badge]');

  if (!bellButton || !list) return;

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
      <div class="leasehub-notification ${item.read ? 'is-read' : 'is-unread'}" data-id="${item.id || ''}">
        <div class="leasehub-notification__icon ${item.type || 'info'}">${
          item.type === 'success' ? '✓' :
          item.type === 'warning' ? '!' :
          item.type === 'danger' ? '✕' : 'ℹ'
        }</div>
        <div class="leasehub-notification__body">
          <strong>${(item.title || 'Notification').replace(/</g, '&lt;')}</strong>
          <p>${(item.message || '').replace(/</g, '&lt;')}</p>
        </div>
        <button class="leasehub-notification__mark" type="button" data-mark-read="${item.id || ''}">
          ${item.read ? 'Read' : 'Mark read'}
        </button>
      </div>
    `).join('');
  };

  const fetchNotifications = async () => {
    try {
      if (!window.LeaseHubApi) throw new Error('Notifications are not configured.');
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

    try {
      await window.LeaseHubApi.request(`/notifications/${encodeURIComponent(id)}/read`, {
        method: 'PATCH'
      });
      await fetchNotifications();
    } catch (error) {
      showFallback(error.message || 'Unable to update this notification.', '⚠️');
    }
  });

  fetchNotifications();
});
