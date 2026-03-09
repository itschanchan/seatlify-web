// ==========================================
// ALL EVENTS VIEW MODULE
// ==========================================

let currentEventView = 'table';
let calendarDate     = new Date();

// -------------------------------------------------------
// Public API
// -------------------------------------------------------

/**
 * initAllEventsView
 * Called once after all-events-view.html has been injected into the DOM.
 * Binds the three view-toggle buttons, renders the default (table) view,
 * and pre-loads the Create Event modal fragment.
 */
export function initAllEventsView() {
    const btnTable      = document.getElementById('btnViewTable');
    const btnCalendar   = document.getElementById('btnViewCalendar');
    const btnSimplified = document.getElementById('btnViewSimplified');

    if (btnTable)      btnTable.addEventListener('click',      () => setEventView('table'));
    if (btnCalendar)   btnCalendar.addEventListener('click',   () => setEventView('calendar'));
    if (btnSimplified) btnSimplified.addEventListener('click', () => setEventView('simplified'));

    // Reset to table view on every fresh load
    currentEventView = 'table';
    renderEventView();

    // Pre-load the Create Event modal so it's ready on first click
    loadCreateEventModal();
}

/**
 * renderEventView
 * Re-renders the currently active view (table / calendar / simplified).
 * Called externally whenever the event list changes.
 */
export function renderEventView() {
    const container = document.getElementById('event-view-container');
    if (!container) return;

    const events = MockDB.getEvents();
    container.innerHTML = '';

    if (currentEventView === 'simplified') {
        renderSimplifiedView(container, events);
    } else if (currentEventView === 'calendar') {
        renderCalendar(container, events);
    } else {
        renderTableView(container, events);
    }
}

/**
 * openEditModal
 * Lazy-loads edit-event-modal.html once, then delegates population and
 * display to the modal's own controller (window.populateEditEventModal).
 * Exposed on window so dynamically-rendered rows and calendar badges can call it.
 *
 * @param {string|number} eventId
 */
export async function openEditModal(eventId) {
    const container = document.getElementById('editEventModalContainer');
    if (!container) {
        console.error('editEventModalContainer not found!');
        return;
    }

    if (!document.getElementById('editEventModal')) {
        try {
            const res = await fetch('edit-event-modal.html');
            if (!res.ok) throw new Error('Failed to load edit-event-modal.html');
            container.innerHTML = await res.text();

            // innerHTML does not execute <script> tags — re-run them manually
            container.querySelectorAll('script').forEach(oldScript => {
                const newScript = document.createElement('script');
                newScript.textContent = oldScript.textContent;
                document.body.appendChild(newScript);
                newScript.remove();
            });
        } catch (err) {
            console.error(err);
            container.innerHTML = `<p class="text-danger">Error loading edit modal.</p>`;
            return;
        }
    }

    if (typeof window.populateEditEventModal === 'function') {
        window.populateEditEventModal(eventId);
    }
}

// Expose globally so dynamically-rendered rows and calendar badges can call it
window.openEditModal = openEditModal;

// -------------------------------------------------------
// Private: View Switching
// -------------------------------------------------------

function setEventView(view) {
    currentEventView = view;

    const btnTable      = document.getElementById('btnViewTable');
    const btnCalendar   = document.getElementById('btnViewCalendar');
    const btnSimplified = document.getElementById('btnViewSimplified');

    // Reset all buttons to inactive
    [btnTable, btnCalendar, btnSimplified].forEach(btn => {
        if (!btn) return;
        btn.classList.remove('active');
        btn.style.backgroundColor = 'transparent';
        btn.style.color = 'var(--text-muted)';
    });

    // Activate the selected button
    const activeBtn = view === 'calendar' ? btnCalendar
                    : view === 'simplified' ? btnSimplified
                    : btnTable;
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.style.backgroundColor = 'var(--primary)';
        activeBtn.style.color = '#fff';
    }

    renderEventView();
}

// -------------------------------------------------------
// Private: Render Helpers
// -------------------------------------------------------

function renderTableView(container, events) {
    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'event-table table-responsive';

    const table = document.createElement('table');
    table.className = 'table table-hover align-middle';
    table.style.color = 'var(--text-main)';
    table.style.borderColor = 'var(--border-color)';

    const thead = document.createElement('thead');
    thead.style.backgroundColor = 'var(--bg-muted)';
    thead.innerHTML = `
        <tr>
            <th style="width: 40px; background-color: var(--bg-muted); color: var(--text-main); border-bottom-color: var(--border-color);"></th>
            <th style="background-color: var(--bg-muted); color: var(--text-main); border-bottom-color: var(--border-color);">Event Name</th>
            <th style="background-color: var(--bg-muted); color: var(--text-main); border-bottom-color: var(--border-color);">Date</th>
            <th style="background-color: var(--bg-muted); color: var(--text-main); border-bottom-color: var(--border-color);">Time</th>
            <th style="background-color: var(--bg-muted); color: var(--text-main); border-bottom-color: var(--border-color);">Location</th>
            <th style="background-color: var(--bg-muted); color: var(--text-main); border-bottom-color: var(--border-color);">Status</th>
            <th class="text-end" style="background-color: var(--bg-muted); color: var(--text-main); border-bottom-color: var(--border-color);">Actions</th>
        </tr>
    `;

    const tbody = document.createElement('tbody');
    tbody.id = 'eventTableBody';

    events.forEach(event => {
        const { venueName, dateStr, timeStr, badgeClass, statusText } = buildEventMeta(event);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="cursor-move" style="color: var(--text-muted); border-bottom-color: var(--border-color);">
                <i class="bi bi-grip-vertical"></i>
            </td>
            <td style="border-bottom-color: var(--border-color);">
                <strong>${event.title}</strong>
                <div class="small text-muted">${event.description || ''}</div>
            </td>
            <td style="border-bottom-color: var(--border-color);">${dateStr}</td>
            <td style="border-bottom-color: var(--border-color);">${timeStr}</td>
            <td style="border-bottom-color: var(--border-color);">${venueName}</td>
            <td style="border-bottom-color: var(--border-color);">
                <span class="badge ${badgeClass}">${statusText}</span>
            </td>
            <td class="text-end table-actions" style="border-bottom-color: var(--border-color);">
                <button class="btn btn-sm btn-outline-secondary me-1 btn-edit"
                        style="border-color: var(--border-color); color: var(--text-muted);">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger btn-delete">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;

        tr.querySelector('.btn-edit').addEventListener('click',   () => openEditModal(event.event_id));
        tr.querySelector('.btn-delete').addEventListener('click', () => {
            if (confirm(`Are you sure you want to delete "${event.title}"?`)) {
                MockDB.deleteEvent(event.event_id);
            }
        });

        tbody.appendChild(tr);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    container.appendChild(tableWrapper);
}

function renderSimplifiedView(container, events) {
    const grid = document.createElement('div');
    grid.className = 'row g-3';

    if (events.length === 0) {
        grid.innerHTML = '<p class="text-muted text-center w-100">No events found.</p>';
    }

    events.forEach(event => {
        const { venueName, timeStr, badgeClass, statusText } = buildEventMeta(event);
        const dateObj = new Date(event.start_datetime);
        const months  = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
        const day   = dateObj.getDate();
        const month = months[dateObj.getMonth()];

        const cardCol = document.createElement('div');
        cardCol.className = 'col-12';
        cardCol.innerHTML = `
            <div class="card shadow-sm border-0" style="background-color: var(--bg-panel);">
                <div class="card-body">
                    <div class="d-flex align-items-center">
                        <div class="rounded p-3 me-3 text-center" style="min-width: 80px; background-color: var(--bg-muted);">
                            <h3 class="mb-0" style="color: var(--primary);">${day}</h3>
                            <small class="fw-bold">${month}</small>
                        </div>
                        <div class="flex-grow-1">
                            <div class="d-flex align-items-center gap-2 mb-1">
                                <h5 class="mb-0" style="color: var(--text-main);">${event.title}</h5>
                                <span class="badge ${badgeClass}">${statusText}</span>
                            </div>
                            <p class="mb-1 text-muted small">${event.description || ''}</p>
                            <p class="mb-0" style="color: var(--text-muted);"><i class="bi bi-geo-alt me-1"></i> ${venueName}</p>
                            <p class="mb-0" style="color: var(--text-muted);"><i class="bi bi-clock me-1"></i> ${timeStr}</p>
                        </div>
                        <div class="d-flex flex-column gap-2 ms-3">
                            <button class="btn btn-sm btn-outline-secondary btn-edit" title="Edit"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-sm btn-outline-danger btn-delete" title="Delete"><i class="bi bi-trash"></i></button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        cardCol.querySelector('.btn-edit').addEventListener('click',   () => openEditModal(event.event_id));
        cardCol.querySelector('.btn-delete').addEventListener('click', () => {
            if (confirm(`Are you sure you want to delete "${event.title}"?`)) {
                MockDB.deleteEvent(event.event_id);
            }
        });

        grid.appendChild(cardCol);
    });

    container.appendChild(grid);
}

function renderCalendar(container, events) {
    const wrapper = document.createElement('div');
    wrapper.className = 'calendar-wrapper p-3 bg-white rounded shadow-sm border';

    // --- Header (month navigation) ---
    const header   = document.createElement('div');
    header.className = 'd-flex justify-content-between align-items-center mb-3';

    const btnPrev = document.createElement('button');
    btnPrev.className = 'btn btn-outline-secondary btn-sm';
    btnPrev.innerHTML = '<i class="bi bi-chevron-left"></i>';
    btnPrev.onclick = () => {
        calendarDate.setMonth(calendarDate.getMonth() - 1);
        renderEventView();
    };

    const monthNames = ['January','February','March','April','May','June',
                        'July','August','September','October','November','December'];
    const title = document.createElement('h4');
    title.className = 'mb-0 fw-bold';
    title.textContent = `${monthNames[calendarDate.getMonth()]} ${calendarDate.getFullYear()}`;

    const btnNext = document.createElement('button');
    btnNext.className = 'btn btn-outline-secondary btn-sm';
    btnNext.innerHTML = '<i class="bi bi-chevron-right"></i>';
    btnNext.onclick = () => {
        calendarDate.setMonth(calendarDate.getMonth() + 1);
        renderEventView();
    };

    header.appendChild(btnPrev);
    header.appendChild(title);
    header.appendChild(btnNext);
    wrapper.appendChild(header);

    // --- Day-of-week labels ---
    const daysHeader = document.createElement('div');
    daysHeader.className = 'row g-0 text-center mb-2';
    ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(day => {
        const col = document.createElement('div');
        col.className = 'col fw-bold text-muted';
        col.textContent = day;
        daysHeader.appendChild(col);
    });
    wrapper.appendChild(daysHeader);

    // --- Calendar grid ---
    const grid = document.createElement('div');
    grid.className = 'calendar-grid';

    const year  = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay    = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    let row = document.createElement('div');
    row.className = 'row g-0';

    // Leading empty cells
    for (let i = 0; i < firstDay; i++) {
        const cell = document.createElement('div');
        cell.className = 'col p-2 border bg-light';
        cell.style.minHeight = '100px';
        row.appendChild(cell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const cell = document.createElement('div');
        cell.className = 'col p-2 border position-relative';
        cell.style.minHeight = '100px';
        cell.style.backgroundColor = 'var(--bg-panel)';

        const dayNum = document.createElement('div');
        dayNum.className = 'fw-bold mb-1';
        dayNum.textContent = day;

        const isToday = today.getFullYear() === year &&
                        today.getMonth()    === month &&
                        today.getDate()     === day;
        if (isToday) {
            Object.assign(dayNum.style, {
                backgroundColor: 'var(--primary)',
                color: 'white',
                width: '28px', height: '28px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            });
        }
        cell.appendChild(dayNum);

        const currentDayStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        events.forEach(evt => {
            if (evt.start_datetime.split('T')[0] === currentDayStr) {
                const badge = document.createElement('div');
                badge.className = 'badge bg-primary text-wrap text-start w-100 mb-1';
                badge.style.cursor = 'pointer';
                badge.textContent = evt.title;
                badge.onclick = () => openEditModal(evt.event_id);
                cell.appendChild(badge);
            }
        });

        row.appendChild(cell);

        if ((firstDay + day) % 7 === 0) {
            grid.appendChild(row);
            row = document.createElement('div');
            row.className = 'row g-0';
        }
    }

    // Trailing empty cells
    const remainingCells = (7 - (firstDay + daysInMonth) % 7) % 7;
    for (let i = 0; i < remainingCells; i++) {
        const cell = document.createElement('div');
        cell.className = 'col p-2 border bg-light';
        cell.style.minHeight = '100px';
        row.appendChild(cell);
    }
    if (row.children.length > 0) grid.appendChild(row);

    wrapper.appendChild(grid);
    container.appendChild(wrapper);
}

// -------------------------------------------------------
// Private: Modal Loaders
// -------------------------------------------------------

async function loadCreateEventModal() {
    const container = document.getElementById('createEventModalContainer');
    if (!container || document.getElementById('createEventModal')) return;

    try {
        const res = await fetch('create-event-modal.html');
        if (!res.ok) throw new Error('Failed to load create-event-modal.html');
        container.innerHTML = await res.text();

        // Re-execute embedded scripts so the modal's IIFE registers window.initCreateEventModal
        container.querySelectorAll('script').forEach(oldScript => {
            const newScript = document.createElement('script');
            newScript.textContent = oldScript.textContent;
            document.body.appendChild(newScript);
            newScript.remove();
        });

        if (typeof window.initCreateEventModal === 'function') {
            window.initCreateEventModal();
        }
    } catch (err) {
        console.error('Failed to load create event modal:', err);
    }
}

// -------------------------------------------------------
// Private: Shared Utility
// -------------------------------------------------------

/**
 * buildEventMeta
 * Derives display-ready strings and badge classes from a raw event record.
 *
 * @param {Object} event
 * @returns {{ venueName, dateStr, timeStr, badgeClass, statusText }}
 */
function buildEventMeta(event) {
    const venueName = event.venue_name ||
        (event.venue_id && typeof MockDB !== 'undefined'
            ? (MockDB.getVenueById(event.venue_id)?.name ?? 'Unknown Venue')
            : 'Unknown Venue');

    const dateObj = new Date(event.start_datetime);
    const endObj  = event.end_datetime ? new Date(event.end_datetime) : null;

    const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
        (endObj ? ' - ' + endObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');

    let badgeClass = 'bg-secondary';
    if (event.status === 'published') badgeClass = 'bg-success';
    else if (event.status === 'draft')     badgeClass = 'bg-warning text-dark';
    else if (event.status === 'cancelled') badgeClass = 'bg-danger';

    const statusText = event.status.charAt(0).toUpperCase() + event.status.slice(1);

    return { venueName, dateStr, timeStr, badgeClass, statusText };
}
