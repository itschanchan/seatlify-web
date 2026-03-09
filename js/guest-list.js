let isGuestSelectionMode = false;
let selectedGuestIds = new Set();

// -------------------------------------------------------
// Modal Injection
// -------------------------------------------------------

async function injectGuestInfoModal() {
    if (document.getElementById('guestInfoModal')) return; // already injected
    try {
        const res = await fetch('guest-info-modal.html');
        if (!res.ok) throw new Error('Failed to load guest-info-modal.html');
        const wrapper = document.createElement('div');
        wrapper.innerHTML = await res.text();
        document.body.appendChild(wrapper);
    } catch (err) {
        console.error(err);
    }
}

// -------------------------------------------------------
// Open Guest Info Modal
// -------------------------------------------------------

function openGuestInfoModal(guest, event) {
    const modal = document.getElementById('guestInfoModal');
    if (!modal) return;

    const status = getGuestStatus(guest, event);

    // --- Avatar (initials) ---
    const avatar = document.getElementById('guestInfoAvatar');
    if (avatar) {
        const initials = guest.name
            .split(' ')
            .map(w => w[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
        avatar.textContent = initials;
    }

    // --- Title / subtitle ---
    const titleEl = document.getElementById('guestInfoModalLabel');
    if (titleEl) titleEl.textContent = guest.name;

    const subtitleEl = document.getElementById('guestInfoSubtitle');
    if (subtitleEl) subtitleEl.textContent = event.title || '';

    // --- Status banner ---
    const bannerEl   = document.getElementById('guestInfoStatusBanner');
    const iconEl     = document.getElementById('guestInfoStatusIcon');
    const labelEl    = document.getElementById('guestInfoStatusLabel');
    const subEl      = document.getElementById('guestInfoStatusSub');

    const statusConfig = {
        'checked-in': {
            bg:    'rgba(25,135,84,0.15)',
            icon:  'bi bi-check-circle-fill text-success',
            label: 'Checked In',
            sub:   guest.checked_in_timestamp
                ? `at ${new Date(guest.checked_in_timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`
                : '',
        },
        'no-show': {
            bg:    'rgba(220,53,69,0.15)',
            icon:  'bi bi-x-circle-fill text-danger',
            label: 'No Show',
            sub:   'Guest did not check in before the event ended.',
        },
        'reserved': {
            bg:    'rgba(255,193,7,0.15)',
            icon:  'bi bi-ticket-fill text-warning',
            label: 'Reserved',
            sub:   'Awaiting check-in.',
        },
    };

    const cfg = statusConfig[status] || statusConfig['reserved'];
    if (bannerEl) bannerEl.style.backgroundColor = cfg.bg;
    if (iconEl)   iconEl.className = `${cfg.icon} fs-4`;
    if (labelEl)  labelEl.textContent = cfg.label;
    if (subEl)    subEl.textContent   = cfg.sub;

    // --- Email ---
    const emailEl = document.getElementById('guestInfoEmail');
    if (emailEl) emailEl.textContent = guest.email || '—';

    // --- Seat ---
    const seatRowEl = document.getElementById('guestInfoSeatRow');
    const seatEl    = document.getElementById('guestInfoSeat');
    if (guest.seat_row) {
        const seatLabel = guest.seat_col
            ? `Row ${guest.seat_row}, Seat ${guest.seat_col}`
            : `Row ${guest.seat_row}`;
        if (seatEl)    seatEl.textContent  = seatLabel;
        if (seatRowEl) seatRowEl.style.display = '';
    } else {
        if (seatEl)    seatEl.textContent  = 'No seat assigned';
        if (seatRowEl) seatRowEl.style.display = '';
    }

    // --- Added on ---
    const addedEl = document.getElementById('guestInfoAdded');
    if (addedEl) {
        addedEl.textContent = guest.timestamp
            ? new Date(guest.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
            : '—';
    }

    // --- Check-in time row ---
    const checkinRowEl  = document.getElementById('guestInfoCheckinRow');
    const checkinTimeEl = document.getElementById('guestInfoCheckinTime');
    if (status === 'checked-in' && guest.checked_in_timestamp) {
        if (checkinRowEl)  checkinRowEl.style.setProperty('display', '', 'important');
        if (checkinTimeEl) checkinTimeEl.textContent =
            new Date(guest.checked_in_timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    } else {
        if (checkinRowEl) checkinRowEl.style.setProperty('display', 'none', 'important');
    }

    // --- Guest ID ---
    const idEl = document.getElementById('guestInfoId');
    if (idEl) idEl.textContent = guest.id || '—';

    // --- Delete button ---
    const deleteBtn = document.getElementById('guestInfoDeleteBtn');
    if (deleteBtn) {
        // Remove previous listener by cloning
        const freshBtn = deleteBtn.cloneNode(true);
        deleteBtn.replaceWith(freshBtn);
        freshBtn.addEventListener('click', () => {
            if (confirm(`Remove ${guest.name} from the guest list?`)) {
                MockDB.deleteGuest(event.event_id, guest.id);
                bootstrap.Modal.getInstance(modal)?.hide();
            }
        });
    }

    bootstrap.Modal.getOrCreateInstance(modal).show();
}

// -------------------------------------------------------
// Init
// -------------------------------------------------------

export function initGuestList() {
    // Inject the modal into <body> once
    injectGuestInfoModal();

    // Bulk Guest Actions
    const btnBulkDelete     = document.getElementById('btnBulkDeleteGuests');
    const btnCancelSelection = document.getElementById('btnCancelGuestSelection');

    const guestSelectAllCheckbox = document.getElementById('guestSelectAllCheckbox');
    if (guestSelectAllCheckbox) {
        guestSelectAllCheckbox.addEventListener('change', (e) => {
            const currentEventId = localStorage.getItem('seatlify_current_event_id');
            if (!currentEventId) return;
            const event = MockDB.getEvents().find(ev => ev.event_id == currentEventId);
            if (!event) return;

            const visibleGuests = getVisibleGuests(event);

            if (e.target.checked) {
                visibleGuests.forEach(guest => selectedGuestIds.add(guest.id));
            } else {
                selectedGuestIds.clear();
            }
            renderGuestList(event);
        });
    }

    if (btnBulkDelete) {
        btnBulkDelete.addEventListener('click', () => {
            if (selectedGuestIds.size === 0) return;
            if (confirm(`Delete ${selectedGuestIds.size} selected guests?`)) {
                const currentEventId = localStorage.getItem('seatlify_current_event_id');
                MockDB.bulkDeleteGuests(currentEventId, selectedGuestIds);
                isGuestSelectionMode = false;
                selectedGuestIds.clear();
            }
        });
    }

    if (btnCancelSelection) {
        btnCancelSelection.addEventListener('click', () => {
            isGuestSelectionMode = false;
            selectedGuestIds.clear();
            const currentEventId = localStorage.getItem('seatlify_current_event_id');
            if (currentEventId) {
                const event = MockDB.getEvents().find(e => e.event_id == currentEventId);
                renderGuestList(event);
            }
        });
    }

    const guestListSearch = document.getElementById('guestListSearch');
    if (guestListSearch) {
        guestListSearch.addEventListener('input', () => {
            const currentEventId = localStorage.getItem('seatlify_current_event_id');
            if (currentEventId) {
                const event = MockDB.getEvents().find(e => e.event_id == currentEventId);
                if (event) renderGuestList(event);
            }
        });
    }

    const guestListFilter = document.getElementById('guestListFilterStatus');
    if (guestListFilter) {
        guestListFilter.addEventListener('change', () => {
            const currentEventId = localStorage.getItem('seatlify_current_event_id');
            if (currentEventId) {
                const event = MockDB.getEvents().find(e => e.event_id == currentEventId);
                if (event) renderGuestList(event);
            }
        });
    }
}

export function updateGuestList(event) {
    isGuestSelectionMode = false;
    selectedGuestIds.clear();
    renderGuestList(event);
}

// -------------------------------------------------------
// Render
// -------------------------------------------------------

function renderGuestList(event) {
    const container = document.getElementById('analyticsGuestList');
    if (!container) return;

    const bulkActions      = document.getElementById('guestBulkActions');
    const searchInputGroup = document.getElementById('guestSearchInputGroup');

    if (isGuestSelectionMode) {
        if (bulkActions)      bulkActions.style.display      = 'flex';
        if (searchInputGroup) searchInputGroup.style.display = 'none';
        updateGuestSelectionUI();
    } else {
        if (bulkActions)      bulkActions.style.display      = 'none';
        if (searchInputGroup) searchInputGroup.style.display = 'flex';
    }

    container.innerHTML = '';
    const guests = getVisibleGuests(event);

    // Update "Select All" checkbox state
    const guestSelectAllCheckbox = document.getElementById('guestSelectAllCheckbox');
    if (guestSelectAllCheckbox) {
        const visibleGuestIds        = new Set(guests.map(g => g.id));
        const selectedVisibleGuests  = [...selectedGuestIds].filter(id => visibleGuestIds.has(id));

        if (guests.length > 0 && selectedVisibleGuests.length === guests.length) {
            guestSelectAllCheckbox.checked       = true;
            guestSelectAllCheckbox.indeterminate = false;
        } else if (selectedVisibleGuests.length > 0) {
            guestSelectAllCheckbox.checked       = false;
            guestSelectAllCheckbox.indeterminate = true;
        } else {
            guestSelectAllCheckbox.checked       = false;
            guestSelectAllCheckbox.indeterminate = false;
        }
    }

    if (guests.length === 0) {
        container.innerHTML = '<div class="text-center text-muted small mt-3">No guests found.</div>';
        return;
    }

    guests.forEach(guest => {
        let seatInfo = '';
        if (guest.seat_row) {
            seatInfo = `<span class="badge bg-secondary ms-2" style="font-size: 0.7em;">${guest.seat_row}${guest.seat_col ? '-' + guest.seat_col : ''}</span>`;
        }

        const item = document.createElement('div');
        item.className = 'list-group-item d-flex justify-content-between align-items-center list-group-item-action';
        item.style.backgroundColor = 'var(--bg-panel)';
        item.style.borderColor     = 'var(--border-color)';
        item.style.color           = 'var(--text-main)';
        item.style.cursor          = 'pointer';

        const creationTime = guest.timestamp
            ? new Date(guest.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
            : 'N/A';

        const status = getGuestStatus(guest, event);
        let statusBadgeHtml = '';

        if (status === 'checked-in') {
            statusBadgeHtml = `<div class="mt-2 text-end">
                <span class="badge bg-success"><i class="bi bi-check-circle-fill me-1"></i>Checked-in</span>
                <small class="d-block text-muted" style="font-size: 0.75em;">at ${new Date(guest.checked_in_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
            </div>`;
        } else if (status === 'no-show') {
            statusBadgeHtml = `<div class="mt-2 text-end"><span class="badge bg-danger"><i class="bi bi-x-circle me-1"></i>No Show</span></div>`;
        } else {
            statusBadgeHtml = `<div class="mt-2 text-end"><span class="badge bg-warning text-dark"><i class="bi bi-ticket-fill me-1"></i>Reserved</span></div>`;
        }

        const checkboxHtml = isGuestSelectionMode
            ? `<div class="me-3">
                <input type="checkbox" class="form-check-input guest-checkbox" style="transform: scale(1.2);" ${selectedGuestIds.has(guest.id) ? 'checked' : ''}>
               </div>`
            : '';

        const deleteBtnDisplay = isGuestSelectionMode ? 'none' : 'block';

        // Hint chevron (only in normal mode)
        const chevronHtml = !isGuestSelectionMode
            ? `<i class="bi bi-chevron-right text-muted ms-2" style="font-size:0.8rem;flex-shrink:0;"></i>`
            : '';

        item.innerHTML = `
            ${checkboxHtml}
            <div class="w-100">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <div class="fw-bold">${guest.name} ${seatInfo}</div>
                        <small class="text-muted">${guest.email}</small>
                        <small class="text-muted d-block mt-1" style="font-size: 0.8em;">Added: ${creationTime}</small>
                    </div>
                    <div class="d-flex align-items-center">
                        <button class="btn btn-sm btn-outline-danger btn-delete-guest" title="Remove Guest" style="display: ${deleteBtnDisplay};"><i class="bi bi-trash"></i></button>
                        ${chevronHtml}
                    </div>
                </div>
                ${statusBadgeHtml}
            </div>
        `;

        // Delete button (inline, only visible outside selection mode)
        const deleteBtn = item.querySelector('.btn-delete-guest');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Remove ${guest.name}?`)) {
                    MockDB.deleteGuest(event.event_id, guest.id);
                }
            });
        }

        if (!isGuestSelectionMode) {
            // Long-press → enter selection mode
            let pressTimer;
            const startPress = () => {
                pressTimer = setTimeout(() => {
                    isGuestSelectionMode = true;
                    selectedGuestIds.add(guest.id);
                    renderGuestList(event);
                }, 800);
            };
            const cancelPress = () => clearTimeout(pressTimer);

            item.addEventListener('mousedown',  startPress);
            item.addEventListener('touchstart', startPress, { passive: true });
            item.addEventListener('mouseup',    cancelPress);
            item.addEventListener('mouseleave', cancelPress);
            item.addEventListener('touchend',   cancelPress);
            item.addEventListener('touchmove',  cancelPress);

            // Regular click → open info modal
            item.addEventListener('click', (e) => {
                // Ignore if click came from the delete button
                if (e.target.closest('.btn-delete-guest')) return;
                openGuestInfoModal(guest, event);
            });

        } else {
            // Selection mode → toggle checkbox
            item.addEventListener('click', () => {
                if (selectedGuestIds.has(guest.id)) {
                    selectedGuestIds.delete(guest.id);
                } else {
                    selectedGuestIds.add(guest.id);
                }
                renderGuestList(event);
            });
        }

        container.appendChild(item);
    });
}

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

function updateGuestSelectionUI() {
    const countEl = document.getElementById('guestSelectedCount');
    if (countEl) countEl.textContent = `${selectedGuestIds.size} selected`;

    const btnDelete = document.getElementById('btnBulkDeleteGuests');
    if (btnDelete) btnDelete.disabled = selectedGuestIds.size === 0;
}

function getVisibleGuests(event) {
    const searchInput  = document.getElementById('guestListSearch');
    const filter       = searchInput ? searchInput.value.toLowerCase() : '';
    const statusFilterEl = document.getElementById('guestListFilterStatus');
    const statusFilter = statusFilterEl ? statusFilterEl.value : 'all';

    let guests = event.guests || [];

    if (filter) {
        guests = guests.filter(g =>
            g.name.toLowerCase().includes(filter) ||
            g.email.toLowerCase().includes(filter)
        );
    }

    if (statusFilter !== 'all') {
        guests = guests.filter(g => getGuestStatus(g, event) === statusFilter);
    }

    return guests;
}

function getGuestStatus(guest, event) {
    if (guest.checked_in) return 'checked-in';

    const now     = new Date();
    const endDate = event.end_datetime
        ? new Date(event.end_datetime)
        : new Date(event.start_datetime);

    if (event.status === 'completed' || event.status === 'cancelled' || now > endDate) {
        return 'no-show';
    }

    return 'reserved';
}
