// ==========================================
// DASHBOARD — Main Coordinator
// ==========================================
import { initEventAnalytics, updateAnalytics } from './event-analytics.js';
import { initGuestList, updateGuestList }       from './guest-list.js';
import { initEventDetails, renderEventDetails, clearEventDetails } from './event-details.js';
import { initQuickStats,   renderQuickStats,   clearQuickStats }   from './quick-stats-row.js';
import { initAllEventsView, renderEventView }                      from './all-events-view.js';

let notificationsInitialized = false;
let dashboardInitialized     = false;
let dashboardFilter          = 'current'; // 'current' | 'past'

// -------------------------------------------------------
// Entry Point
// -------------------------------------------------------

export async function initDashboard() {
    // 1. Inject the three sub-component HTML fragments in parallel
    await Promise.all([
        injectFragment('event-details-container',   'event-details.html'),
        injectFragment('quick-stats-row-container', 'quick-stats-row.html'),
        injectFragment('all-events-view-container', 'all-events-view.html'),
    ]);

    // 2. Initialise each sub-module now that their DOM is in place
    initEventDetails();
    initQuickStats();
    initAllEventsView();

    // 3. Wire up the Current / Past filter tabs
    const tabCurrent = document.getElementById('tabCurrent');
    const tabPast    = document.getElementById('tabPast');
    if (tabCurrent) tabCurrent.addEventListener('click', e => { e.preventDefault(); setDashboardFilter('current'); });
    if (tabPast)    tabPast.addEventListener('click',    e => { e.preventDefault(); setDashboardFilter('past');    });

    // 4. EmailJS (optional SDK)
    if (typeof emailjs !== 'undefined') {
        emailjs.init('NPeF-dURRp7hqBu-y');
    }

    // 5. Sidebar utility buttons
    bindSimulateSaleButton();
    bindResetSaleButton();

    // 6. QR Scanner modal
    initQRScanner();

    // 7. Load sub-panels (analytics + guest list)
    loadAnalyticsModule();
    loadGuestListModule();

    // 8. Notifications
    initNotifications();

    // 9. Listen for DB changes (register only once)
    if (!dashboardInitialized) {
        window.addEventListener('db-events-updated', () => {
            updateDashboardVisibility();
            renderEventDropdown();

            const currentEventId = localStorage.getItem('seatlify_current_event_id');
            const events         = getFilteredEvents();
            const eventInList    = events.find(e => e.event_id == currentEventId);

            if (eventInList) {
                renderDashboardEvent(currentEventId);
            } else if (events.length > 0) {
                renderDashboardEvent(events[0].event_id);
            } else {
                clearDashboardView();
            }

            // Also refresh the All Events view
            renderEventView();
        });
        dashboardInitialized = true;
    }

    // 10. Determine initial filter & render
    updateDashboardVisibility();

    const lastEventId = localStorage.getItem('seatlify_current_event_id');
    let initialFilter = 'current';
    if (lastEventId && typeof MockDB !== 'undefined') {
        const lastEvent = MockDB.getEvents().find(e => e.event_id == lastEventId);
        if (lastEvent && (lastEvent.status === 'completed' || lastEvent.status === 'cancelled')) {
            initialFilter = 'past';
        }
    }
    setDashboardFilter(initialFilter);
}

// -------------------------------------------------------
// Fragment Injection Helper
// -------------------------------------------------------

async function injectFragment(containerId, htmlFile) {
    const container = document.getElementById(containerId);
    if (!container) return;
    try {
        const res = await fetch(htmlFile);
        if (!res.ok) throw new Error(`Failed to load ${htmlFile}`);
        container.innerHTML = await res.text();
    } catch (err) {
        console.error(err);
        container.innerHTML = `<p class="text-danger small">Error loading ${htmlFile}.</p>`;
    }
}

// -------------------------------------------------------
// Visibility
// -------------------------------------------------------

function updateDashboardVisibility() {
    const events      = MockDB.getEvents();
    const emptyState  = document.getElementById('dashboardEmptyState');
    const mainContent = document.getElementById('dashboardMainContent');

    if (events.length === 0) {
        if (emptyState)  emptyState.style.display  = 'block';
        if (mainContent) mainContent.style.display = 'none';
    } else {
        if (emptyState)  emptyState.style.display  = 'none';
        if (mainContent) mainContent.style.display = 'block';
    }
}

// -------------------------------------------------------
// Filter & Dropdown
// -------------------------------------------------------

function setDashboardFilter(filter) {
    dashboardFilter = filter;

    const tabCurrent = document.getElementById('tabCurrent');
    const tabPast    = document.getElementById('tabPast');

    if (tabCurrent && tabPast) {
        const [activeTab, inactiveTab] = filter === 'current'
            ? [tabCurrent, tabPast]
            : [tabPast, tabCurrent];

        activeTab.classList.add('active');
        activeTab.style.backgroundColor = 'var(--primary)';
        activeTab.style.color           = '#fff';

        inactiveTab.classList.remove('active');
        inactiveTab.style.backgroundColor = 'transparent';
        inactiveTab.style.color           = 'var(--text-muted)';
    }

    renderEventDropdown();

    const events         = getFilteredEvents();
    const currentEventId = localStorage.getItem('seatlify_current_event_id');
    const eventInList    = events.find(e => e.event_id == currentEventId);

    if (eventInList) {
        renderDashboardEvent(currentEventId);
    } else if (events.length > 0) {
        renderDashboardEvent(events[0].event_id);
    } else {
        clearDashboardView();
    }
}

function getFilteredEvents() {
    const allEvents = MockDB.getEvents();
    return dashboardFilter === 'current'
        ? allEvents.filter(e => e.status === 'draft' || e.status === 'published')
        : allEvents.filter(e => e.status === 'completed' || e.status === 'cancelled');
}

function renderEventDropdown() {
    const events = getFilteredEvents();
    const list   = document.getElementById('dashboardEventDropdownList');
    if (!list) return;

    list.innerHTML = '<li><h6 class="dropdown-header">Switch Event</h6></li>';

    if (events.length === 0) {
        list.innerHTML += '<li><span class="dropdown-item text-muted">No events found</span></li>';
        return;
    }

    events.forEach(evt => {
        const li = document.createElement('li');
        const a  = document.createElement('a');
        a.className   = 'dropdown-item';
        a.href        = '#';
        a.textContent = evt.title;
        a.onclick = e => { e.preventDefault(); renderDashboardEvent(evt.event_id); };
        li.appendChild(a);
        list.appendChild(li);
    });
}

// -------------------------------------------------------
// Per-Event Rendering (coordinator)
// -------------------------------------------------------

function renderDashboardEvent(id) {
    const event = MockDB.getEvents().find(e => e.event_id == id);
    if (!event) return;

    localStorage.setItem('seatlify_current_event_id', id);

    // Update dropdown label
    const dropdownBtn = document.getElementById('dashboardSelectedEvent');
    if (dropdownBtn) dropdownBtn.textContent = event.title;

    // Delegate to sub-modules
    renderEventDetails(event);
    renderQuickStats(event);
    updateAnalytics(event);
    updateGuestList(event);
}

function clearDashboardView() {
    const dropdownBtn = document.getElementById('dashboardSelectedEvent');
    if (dropdownBtn) dropdownBtn.textContent = 'No Events Found';

    clearEventDetails();
    clearQuickStats();
}

// -------------------------------------------------------
// Sub-Panel Loaders
// -------------------------------------------------------

async function loadAnalyticsModule() {
    const container = document.getElementById('event-analytics-container');
    if (!container) return;
    try {
        const res = await fetch('event-analytics.html');
        if (res.ok) {
            container.innerHTML = await res.text();
            initEventAnalytics();

            const currentEventId = localStorage.getItem('seatlify_current_event_id');
            if (currentEventId && typeof MockDB !== 'undefined') {
                const event = MockDB.getEvents().find(e => e.event_id == currentEventId);
                if (event) updateAnalytics(event);
            }
        }
    } catch (err) { console.error('Failed to load event analytics module:', err); }
}

async function loadGuestListModule() {
    const container = document.getElementById('guest-list-container');
    if (!container) return;
    try {
        const res = await fetch('guest-list.html');
        if (res.ok) {
            container.innerHTML = await res.text();
            initGuestList();

            const currentEventId = localStorage.getItem('seatlify_current_event_id');
            if (currentEventId && typeof MockDB !== 'undefined') {
                const event = MockDB.getEvents().find(e => e.event_id == currentEventId);
                if (event) updateGuestList(event);
            }
        }
    } catch (err) { console.error('Failed to load guest list module:', err); }
}

// -------------------------------------------------------
// Notifications
// -------------------------------------------------------

function initNotifications() {
    renderNotifications();
    if (notificationsInitialized) return;

    window.addEventListener('db-notifications-updated', renderNotifications);

    const dropdownMenu = document.getElementById('notificationDropdownMenu');
    if (dropdownMenu) {
        dropdownMenu.addEventListener('click', e => {
            if (e.target.closest('#markNotificationsAsRead')) {
                e.preventDefault();
                MockDB.markAllNotificationsAsRead();
            }
        });
    }
    notificationsInitialized = true;
}

function renderNotifications() {
    const notifications = MockDB.getUnreadNotifications();
    const dropdown = document.getElementById('notificationDropdownMenu');
    const badge    = document.getElementById('notificationBadge');
    if (!dropdown || !badge) return;

    if (notifications.length > 0) {
        badge.style.display = 'block';
        badge.textContent   = notifications.length > 9 ? '9+' : notifications.length;
    } else {
        badge.style.display = 'none';
    }

    dropdown.innerHTML = '<li><h6 class="dropdown-header">Notifications</h6></li>';
    if (notifications.length === 0) {
        dropdown.innerHTML += '<li><a class="dropdown-item text-muted" href="#">No new notifications</a></li>';
    } else {
        notifications.forEach(notif => {
            const icon = getNotificationIcon(notif.type);
            dropdown.innerHTML += `
                <li>
                    <a class="dropdown-item d-flex align-items-start gap-3 p-2" href="#">
                        <i class="${icon} mt-1"></i>
                        <div>
                            <p class="mb-0 small" style="white-space: normal;">${notif.message}</p>
                            <small class="text-muted">${new Date(notif.timestamp).toLocaleDateString()}</small>
                        </div>
                    </a>
                </li>
            `;
        });
    }

    dropdown.innerHTML += '<li><hr class="dropdown-divider my-1"></li>';
    dropdown.innerHTML += '<li><a class="dropdown-item small text-center text-muted" href="#" id="markNotificationsAsRead">Mark all as read</a></li>';
}

function getNotificationIcon(type) {
    switch (type) {
        case 'ticket_sold':     return 'bi bi-ticket-perforated-fill text-success';
        case 'event_created':   return 'bi bi-calendar-plus text-primary';
        case 'event_published': return 'bi bi-megaphone-fill text-info';
        case 'event_cancelled': return 'bi bi-x-circle-fill text-danger';
        case 'event_deleted':   return 'bi bi-trash-fill text-muted';
        default:                return 'bi bi-bell';
    }
}

// -------------------------------------------------------
// Utility Buttons
// -------------------------------------------------------

function bindSimulateSaleButton() {
    const btn = document.getElementById('btnSimulateSale');
    if (btn) btn.addEventListener('click', () => window.simulateSale());
}

function bindResetSaleButton() {
    const btn = document.getElementById('btnResetSale');
    if (!btn) return;
    btn.addEventListener('click', () => {
        const currentEventId = localStorage.getItem('seatlify_current_event_id');
        if (!currentEventId) {
            alert('Please select an event first to reset sales.');
            return;
        }
        if (confirm('Are you sure you want to reset all simulated sales and guest data for this event? This cannot be undone.')) {
            const result = MockDB.resetSales(currentEventId);
            if (result?.message) alert(result.message);
        }
    });
}

// -------------------------------------------------------
// QR Scanner
// -------------------------------------------------------

function initQRScanner() {
    const modalEl = document.getElementById('qrScannerModal');
    if (!modalEl) return;

    let html5QrCode;

    const onScanSuccess = (decodedText) => {
        const currentEventId = localStorage.getItem('seatlify_current_event_id');
        if (!currentEventId) { alert('No event selected to check-in to.'); return; }

        let eventId, guestId;
        try {
            const url = new URL(decodedText);
            if (url.hostname === 'seatlify.web.app' && url.pathname === '/checkin') {
                eventId = url.searchParams.get('event_id');
                guestId = url.searchParams.get('guest_id');
            }
        } catch (_) { /* Not a valid URL */ }

        if (!eventId || !guestId) {
            alert(`Invalid QR code format. Scanned data: ${decodedText}`);
            return;
        }

        if (eventId !== currentEventId) {
            const event     = MockDB.getEvents().find(e => e.event_id == eventId);
            const eventName = event ? event.title : `another event (ID: ${eventId})`;
            alert(`This ticket is for ${eventName}. Please switch to the correct event to check-in.`);
            return;
        }

        const result = MockDB.checkInGuest(eventId, guestId);
        alert(result.message);

        const modal = bootstrap.Modal.getInstance(document.getElementById('qrScannerModal'));
        if (modal) modal.hide();
    };

    modalEl.addEventListener('shown.bs.modal', () => {
        if (typeof Html5Qrcode === 'undefined' || typeof navigator.mediaDevices === 'undefined') {
            const readerEl = document.getElementById('qr-reader');
            if (readerEl) readerEl.innerHTML = `<div class="alert alert-warning">QR Scanner not supported on this browser.</div>`;
            return;
        }

        html5QrCode = new Html5Qrcode('qr-reader');
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        html5QrCode.start(
            () => navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }),
            config,
            onScanSuccess,
            () => { /* silent failure — keep scanning */ }
        ).catch(err => {
            console.error('Unable to start QR scanner', err);
            const readerEl = document.getElementById('qr-reader');
            if (readerEl) readerEl.innerHTML = `<div class="alert alert-danger">Error: Could not start camera. Please grant camera permissions.</div>`;
        });
    });

    modalEl.addEventListener('hidden.bs.modal', () => {
        if (html5QrCode?.isScanning) {
            html5QrCode.stop().catch(err => console.error('Failed to stop QR scanner.', err));
        }
    });
}

// -------------------------------------------------------
// Global Expose (used by Speed Dial and other inline calls)
// -------------------------------------------------------

window.openCreateEventModal = () => {
    if (typeof window.initCreateEventModal === 'function') {
        const modal = document.getElementById('createEventModal');
        if (modal) bootstrap.Modal.getOrCreateInstance(modal).show();
    }
};
