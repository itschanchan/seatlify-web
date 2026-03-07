let isGuestSelectionMode = false;
let selectedGuestIds = new Set();

export function initGuestList() {
    // Bulk Guest Actions
    const btnBulkDelete = document.getElementById('btnBulkDeleteGuests');
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
                // Select all visible guests
                visibleGuests.forEach(guest => selectedGuestIds.add(guest.id));
            } else {
                // Deselect all guests
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
                // Call the new bulk delete function
                MockDB.bulkDeleteGuests(currentEventId, selectedGuestIds);

                isGuestSelectionMode = false;
                selectedGuestIds.clear();
                // The db-events-updated event is triggered inside bulkDeleteGuests
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
    // Reset guest selection mode whenever a new event is rendered via the main dashboard update
    isGuestSelectionMode = false;
    selectedGuestIds.clear();
    renderGuestList(event);
}

function renderGuestList(event) {
    const container = document.getElementById('analyticsGuestList');
    if (!container) return;

    const bulkActions = document.getElementById('guestBulkActions');
    const searchInputGroup = document.getElementById('guestSearchInputGroup');
    
    if (isGuestSelectionMode) {
        if(bulkActions) bulkActions.style.display = 'flex';
        if(searchInputGroup) searchInputGroup.style.display = 'none';
        updateGuestSelectionUI();
    } else {
        if(bulkActions) bulkActions.style.display = 'none';
        if(searchInputGroup) searchInputGroup.style.display = 'flex';
    }

    container.innerHTML = '';
    const guests = getVisibleGuests(event);

    // Update "Select All" checkbox state
    const guestSelectAllCheckbox = document.getElementById('guestSelectAllCheckbox');
    if (guestSelectAllCheckbox) {
        const visibleGuestIds = new Set(guests.map(g => g.id));
        const selectedVisibleGuests = [...selectedGuestIds].filter(id => visibleGuestIds.has(id));

        if (guests.length > 0 && selectedVisibleGuests.length === guests.length) {
            guestSelectAllCheckbox.checked = true;
            guestSelectAllCheckbox.indeterminate = false;
        } else if (selectedVisibleGuests.length > 0) {
            guestSelectAllCheckbox.checked = false;
            guestSelectAllCheckbox.indeterminate = true;
        } else {
            guestSelectAllCheckbox.checked = false;
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
        item.style.borderColor = 'var(--border-color)';
        item.style.color = 'var(--text-main)';
        item.style.cursor = 'pointer';
        
        const creationTime = guest.timestamp 
            ? new Date(guest.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) 
            : 'N/A';

        // Determine Status Badge
        const status = getGuestStatus(guest, event);
        let statusBadgeHtml = '';

        if (status === 'checked-in') {
            statusBadgeHtml = `<div class="mt-2 text-end">
                <span class="badge bg-success"><i class="bi bi-check-circle-fill me-1"></i>Checked-in</span>
                <small class="d-block text-muted" style="font-size: 0.75em;">at ${new Date(guest.checked_in_timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</small>
            </div>`;
        } else if (status === 'no-show') {
            statusBadgeHtml = `<div class="mt-2 text-end"><span class="badge bg-danger"><i class="bi bi-x-circle me-1"></i>No Show</span></div>`;
        } else {
            statusBadgeHtml = `<div class="mt-2 text-end"><span class="badge bg-warning text-dark"><i class="bi bi-ticket-fill me-1"></i>Reserved</span></div>`;
        }

        const checkboxHtml = isGuestSelectionMode ? 
            `<div class="me-3">
                <input type="checkbox" class="form-check-input guest-checkbox" style="transform: scale(1.2);" ${selectedGuestIds.has(guest.id) ? 'checked' : ''}>
             </div>` : '';

        const deleteBtnDisplay = isGuestSelectionMode ? 'none' : 'block';

        item.innerHTML = `
            ${checkboxHtml}
            <div class="w-100">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <div class="fw-bold">${guest.name} ${seatInfo}</div>
                        <small class="text-muted">${guest.email}</small>
                        <small class="text-muted d-block mt-1" style="font-size: 0.8em;">Added: ${creationTime}</small>
                    </div>
                    <button class="btn btn-sm btn-outline-danger btn-delete-guest" title="Remove Guest" style="display: ${deleteBtnDisplay};"><i class="bi bi-trash"></i></button>
                </div>
                ${statusBadgeHtml}
            </div>
        `;
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
            let pressTimer;
            const startPress = () => {
                pressTimer = setTimeout(() => {
                    isGuestSelectionMode = true;
                    selectedGuestIds.add(guest.id);
                    renderGuestList(event);
                }, 800);
            };
            const cancelPress = () => clearTimeout(pressTimer);
            
            item.addEventListener('mousedown', startPress);
            item.addEventListener('touchstart', startPress);
            item.addEventListener('mouseup', cancelPress);
            item.addEventListener('mouseleave', cancelPress);
            item.addEventListener('touchend', cancelPress);
            item.addEventListener('touchmove', cancelPress);
        } else {
            item.addEventListener('click', (e) => {
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

function updateGuestSelectionUI() {
    const countEl = document.getElementById('guestSelectedCount');
    if (countEl) countEl.textContent = `${selectedGuestIds.size} selected`;
    
    const btnDelete = document.getElementById('btnBulkDeleteGuests');
    if (btnDelete) btnDelete.disabled = selectedGuestIds.size === 0;
}

function getVisibleGuests(event) {
    const searchInput = document.getElementById('guestListSearch');
    const filter = searchInput ? searchInput.value.toLowerCase() : '';
    const statusFilterEl = document.getElementById('guestListFilterStatus');
    const statusFilter = statusFilterEl ? statusFilterEl.value : 'all';

    let guests = event.guests || [];

    // Filter by Search Text
    if (filter) {
        guests = guests.filter(g => g.name.toLowerCase().includes(filter) || g.email.toLowerCase().includes(filter));
    }

    // Filter by Status
    if (statusFilter !== 'all') {
        guests = guests.filter(g => {
            const status = getGuestStatus(g, event);
            return status === statusFilter;
        });
    }
    return guests;
}

function getGuestStatus(guest, event) {
    if (guest.checked_in) return 'checked-in';
    
    const now = new Date();
    const endDate = event.end_datetime ? new Date(event.end_datetime) : new Date(event.start_datetime);
    
    if (event.status === 'completed' || event.status === 'cancelled' || now > endDate) {
        return 'no-show';
    }
    
    return 'reserved';
}