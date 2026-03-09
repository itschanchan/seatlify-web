// ==========================================
// EVENT DETAILS & COUNTDOWN MODULE
// ==========================================
import { openEditModal } from './all-events-view.js';

/**
 * initEventDetails
 * Called once after event-details.html has been injected into the DOM.
 * No persistent bindings are needed at init time — all bindings are
 * applied per-event inside renderEventDetails().
 */
export function initEventDetails() {
    // Intentionally left minimal — event-specific bindings live in renderEventDetails.
}

/**
 * renderEventDetails
 * Populates every field in the Event Details card and the Countdown card
 * for the given event object. Also re-binds the Edit, Delete, and
 * Publish Now buttons so stale handlers are never left behind.
 *
 * @param {Object} event - A MockDB event record.
 */
export function renderEventDetails(event) {
    // --- Title ---
    const titleEl = document.getElementById('dashboardTitle');
    if (titleEl) titleEl.textContent = event.title;

    // --- Status Badge ---
    const statusBadge = document.getElementById('dashboardStatusBadge');
    if (statusBadge) {
        const label = event.status.charAt(0).toUpperCase() + event.status.slice(1);
        let badgeClass = 'bg-secondary';
        if (event.status === 'published') badgeClass = 'bg-success';
        else if (event.status === 'draft')  badgeClass = 'bg-warning text-dark';
        else if (event.status === 'cancelled') badgeClass = 'bg-danger';
        statusBadge.textContent = label;
        statusBadge.className = `badge ${badgeClass}`;
    }

    // --- Description ---
    const descEl = document.getElementById('dashboardDescription');
    if (descEl) descEl.textContent = event.description || '';

    // --- Venue ---
    let venueName = 'Unknown Venue';
    if (event.venue_name) {
        venueName = event.venue_name;
    } else if (event.venue_id && typeof MockDB !== 'undefined') {
        const venue = MockDB.getVenueById(event.venue_id);
        if (venue) venueName = venue.name;
    }
    const venueEl = document.getElementById('dashboardVenue');
    if (venueEl) venueEl.innerHTML = `<i class="bi bi-geo-alt me-1"></i> ${venueName}`;

    // --- Date & Time ---
    const start = new Date(event.start_datetime);
    const end   = event.end_datetime ? new Date(event.end_datetime) : null;

    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const dayEl = document.getElementById('dashboardDateDay');
    if (dayEl) dayEl.textContent = start.getDate();

    const monthEl = document.getElementById('dashboardDateMonth');
    if (monthEl) monthEl.textContent = months[start.getMonth()];

    const timeStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) +
        (end ? ' - ' + end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '');
    const timeEl = document.getElementById('dashboardTime');
    if (timeEl) timeEl.innerHTML = `<i class="bi bi-clock me-1"></i> ${timeStr}`;

    // --- Countdown ---
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const eventDate = new Date(start);
    eventDate.setHours(0, 0, 0, 0);

    const diffDays = Math.round((eventDate - now) / (1000 * 60 * 60 * 24));

    const countVal   = document.getElementById('dashboardCountdownValue');
    const countTitle = document.getElementById('dashboardCountdownTitle');
    const countSub   = document.getElementById('dashboardCountdownSubtext');

    if (countVal) {
        if (diffDays > 0) {
            countVal.textContent = diffDays;
            if (countTitle) countTitle.textContent = 'Days Until Event';
            if (countSub)   countSub.textContent   = 'Prepare your checklist!';
        } else if (diffDays === 0) {
            countVal.textContent = 'Today';
            if (countTitle) countTitle.textContent = 'Event is Happening';
            if (countSub)   countSub.textContent   = 'Good luck!';
        } else {
            countVal.textContent = Math.abs(diffDays);
            if (countTitle) countTitle.textContent = 'Days Since Event';
            if (countSub)   countSub.textContent   = 'Event completed.';
        }
    }

    // --- Draft Action Banner ---
    const draftAction = document.getElementById('dashboardDraftAction');
    if (draftAction) {
        if (event.status === 'draft') {
            draftAction.style.display = 'block';
            const btnPublish = document.getElementById('btnPublishNow');
            if (btnPublish) {
                // Replace node to strip any stale listeners
                const freshBtn = btnPublish.cloneNode(true);
                btnPublish.parentNode.replaceChild(freshBtn, btnPublish);
                freshBtn.addEventListener('click', () => {
                    if (confirm(`Publish "${event.title}" now?`)) {
                        MockDB.updateEvent(event.event_id, { status: 'published' });
                        renderEventDetails({ ...event, status: 'published' });
                    }
                });
            }
        } else {
            draftAction.style.display = 'none';
        }
    }

    // --- Edit / Delete Buttons ---
    const btnEdit = document.getElementById('btnDashboardEditEvent');
    if (btnEdit) {
        const freshEdit = btnEdit.cloneNode(true);
        btnEdit.parentNode.replaceChild(freshEdit, btnEdit);
        freshEdit.addEventListener('click', () => openEditModal(event.event_id));
    }

    const btnDelete = document.getElementById('btnDashboardDeleteEvent');
    if (btnDelete) {
        const freshDelete = btnDelete.cloneNode(true);
        btnDelete.parentNode.replaceChild(freshDelete, btnDelete);
        freshDelete.addEventListener('click', () => {
            if (confirm(`Are you sure you want to delete "${event.title}"?`)) {
                MockDB.deleteEvent(event.event_id);
            }
        });
    }
}

/**
 * clearEventDetails
 * Resets the Event Details and Countdown cards to their empty/default state.
 */
export function clearEventDetails() {
    const safe = (id, prop, val) => {
        const el = document.getElementById(id);
        if (el) el[prop] = val;
    };
    const safeHTML = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = val;
    };

    safe('dashboardTitle',          'textContent', '-');
    safe('dashboardDescription',    'textContent', 'No events in this category.');
    safe('dashboardDateDay',        'textContent', '-');
    safe('dashboardDateMonth',      'textContent', '-');
    safe('dashboardCountdownValue', 'textContent', '-');
    safe('dashboardCountdownSubtext','textContent', '-');

    safeHTML('dashboardVenue', '<i class="bi bi-geo-alt me-1"></i> -');
    safeHTML('dashboardTime',  '<i class="bi bi-clock me-1"></i> -');

    const statusBadge = document.getElementById('dashboardStatusBadge');
    if (statusBadge) { statusBadge.textContent = ''; statusBadge.className = 'badge'; }

    const draftAction = document.getElementById('dashboardDraftAction');
    if (draftAction) draftAction.style.display = 'none';
}
