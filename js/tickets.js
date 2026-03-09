export function initTickets() {
    renderTicketDetails();
}

function renderTicketDetails() {
    const currentId = localStorage.getItem('seatlify_current_event_id');
    if (!currentId) {
        const container = document.getElementById('pills-set-tickets');
        const designContainer = document.getElementById('pills-design-ticket');
        if (container) {
            container.innerHTML = `<div class="alert alert-warning mx-3">Please select an event from the Dashboard to configure tickets.</div>`;
        }
        if (designContainer) {
            designContainer.innerHTML = `<div class="alert alert-warning mx-3">Please select an event from the Dashboard to view the ticket design.</div>`;
        }
        return;
    }

    const events = MockDB.getEvents();
    const event = events.find(e => e.event_id == currentId);
    
    if (event) {
        // Update capacity display dynamically
        updateTicketCapacityDisplay(event);

        // Add listeners to tabs to update capacity on switch
        const pillsRowsTab = document.getElementById('pills-rows-tab');
        const pillsTablesTab = document.getElementById('pills-tables-tab');
        if (pillsRowsTab) {
            pillsRowsTab.addEventListener('shown.bs.tab', () => {
                updateTicketCapacityDisplay(event);
            });
        }
        if (pillsTablesTab) {
            pillsTablesTab.addEventListener('shown.bs.tab', () => {
                updateTicketCapacityDisplay(event);
            });
        }
        const titleEl = document.getElementById('ticketEventTitle');
        const dateEl = document.getElementById('ticketEventDate');
        const timeEl = document.getElementById('ticketEventTime');
        const venueEl = document.getElementById('ticketEventVenue');
        const priceEl = document.getElementById('ticketEventPrice');

        if (titleEl) titleEl.textContent = event.title;
        
        const start = new Date(event.start_datetime);
        const end = event.end_datetime ? new Date(event.end_datetime) : null;
        
        if (dateEl) dateEl.textContent = start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        
        if (timeEl) {
            const timeStr = start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + 
                            (end ? ' - ' + end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '');
            timeEl.textContent = timeStr;
        }

        if (venueEl) {
            let venueName = 'Unknown Venue';
            if (event.venue_name) {
                venueName = event.venue_name;
            } else if (event.venue_id) {
                const venue = MockDB.getVenueById(event.venue_id);
                if (venue) venueName = venue.name;
            }
            venueEl.textContent = venueName;
        }

        if (priceEl) {
            if (event.is_paid && event.tickets && event.tickets.length > 0) {
                priceEl.textContent = `₱${event.tickets[0].price}`;
            } else {
                priceEl.textContent = 'Free';
            }
        }

        // --- QR Code API Integration ---
        const qrContainer = document.querySelector('.qr-code-container');
        if (qrContainer) {
            // Create a data string for the QR code
            const checkinUrlBase = 'https://seatlify.web.app/checkin';
            const guestId = 'PREVIEW_GUEST_001'; // Placeholder for design preview
            const qrData = `${checkinUrlBase}?event_id=${event.event_id}&guest_id=${guestId}`;
            const qrUrl = MockDB.generateQRCodeUrl(qrData); // Using the helper from simulated-db
            
            qrContainer.innerHTML = `<img src="${qrUrl}" alt="Ticket QR Code" class="img-fluid" style="border-radius: 8px; max-width: 100%;">`;
        }

        // --- Email API Integration ---
        const btnSendEmail = document.getElementById('btnSendTestEmail');
        if (btnSendEmail) {
            // Clone to remove old listeners
            const newBtn = btnSendEmail.cloneNode(true);
            btnSendEmail.parentNode.replaceChild(newBtn, btnSendEmail);
            
            newBtn.addEventListener('click', () => {
                const email = prompt("Enter guest email address:", "guest@example.com");
                if (email) {
                    const originalText = newBtn.innerHTML;
                    newBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Sending...';
                    newBtn.disabled = true;

                    MockDB.sendTicketEmail(email, { event: event.title, date: event.start_datetime })
                        .then(response => {
                            if (response && response.success) {
                                alert(`Ticket successfully emailed to ${email}!`);
                            } else {
                                alert(`Failed to send email. ${response ? response.message : 'Unknown error.'}`);
                            }
                        })
                        .catch(error => {
                            console.error('Email sending error:', error);
                            alert('An error occurred while trying to send the email.');
                        })
                        .finally(() => {
                            newBtn.innerHTML = originalText;
                            newBtn.disabled = false;
                        });
                }
            });
        }

        // Render Inline Ticket Editor
        renderTicketTiersEditor(event);
    }
}

function updateTicketCapacityDisplay(event) {
    const configTotalSeatsEl = document.getElementById('ticketConfigTotalSeats');
    if (!configTotalSeatsEl || !event) return;

    const pillsRowsTab = document.getElementById('pills-rows-tab');
    const isRowTiersActive = pillsRowsTab && pillsRowsTab.classList.contains('active');

    let capacity = 0;
    if (isRowTiersActive) {
        capacity = (event.row_layout_data || []).reduce((sum, group) => sum + (parseInt(group.seats) || 0), 0);
    } else { // Table tiers tab is active
        capacity = (event.table_layout_data || []).reduce((sum, group) => sum + (parseInt(group.seats) || 0), 0);
    }

    const displayCapacity = capacity > 0 ? capacity : (event.total_seats || 0);
    configTotalSeatsEl.textContent = displayCapacity;
}

/**
 * Creates a single tier row for the ticket editor tables.
 * @param {object} group - The layout group data { label, seats }.
 * @param {object} event - The full event object.
 * @param {string} layoutType - 'row' or 'table'.
 * @param {boolean} isNew - If true, renders an empty, editable row.
 * @returns {HTMLTableRowElement}
 */
function createTierRow(group, event, layoutType, isNew = false) {
    const existingTier = !isNew && event.tickets ? event.tickets.find(t => (t.original_name === group.label) || (t.name === group.label)) : null;
    const price = existingTier ? existingTier.price : '';
    const seats = group.seats || 0;

    // Rule 1: Tier name = row/table label + quantity per row/table
    const seatSuffix = `(${seats} seat${seats !== 1 ? 's' : ''})`;
    let displayName;
    if (existingTier && existingTier.name) {
        // If a custom name was saved, keep it but ensure seat count suffix is present
        const hasCount = /\(\d+ seats?\)$/.test(existingTier.name);
        displayName = hasCount ? existingTier.name : `${existingTier.name} ${seatSuffix}`;
    } else {
        displayName = `${group.label} ${seatSuffix}`;
    }

    const tr = document.createElement('tr');
    tr.className = 'tier-row-item';
    tr.dataset.layoutType = layoutType; // Crucial for saving

    tr.innerHTML = `
        <td style="border-bottom-color: var(--border-color);">
            <div class="d-flex flex-column">
                <input type="text" class="form-control bg-panel-theme text-main-theme border-secondary tier-name-input fw-bold"
                    value="${displayName}" placeholder="Tier Name e.g. Row A (10 seats)"
                    data-original-name="${group.label}" data-seats="${seats}" disabled>
                <small class="text-muted mt-1">
                    <span class="badge bg-secondary me-1">${layoutType === 'table' ? 'Table' : 'Row'}</span>
                    ${group.label}
                </small>
            </div>
        </td>
        <td style="border-bottom-color: var(--border-color);">
            <div class="input-group" style="max-width: 140px;">
                <span class="input-group-text bg-panel-theme text-muted-theme border-secondary">₱</span>
                <input type="number" class="form-control bg-panel-theme text-main-theme border-secondary tier-price-input"
                    placeholder="Price" value="${price}" disabled>
            </div>
        </td>
        <td style="border-bottom-color: var(--border-color); width: 50px;"></td>
    `;

    return tr;
}

function renderTicketTiersEditor(event) {
    const rowsContainer = document.getElementById('ticketTierRowsContainer');
    const tablesContainer = document.getElementById('ticketTierTablesContainer');
    const allTiersContainer = document.getElementById('tier-layout-tabs-content');
    const btnSave = document.getElementById('btnSaveTicketTiers');
    const btnEdit = document.getElementById('btnEditTicketTiers');
    
    const rowActions = document.getElementById('rowTiersActions');
    const tableActions = document.getElementById('tableTiersActions');


    if (!rowsContainer || !tablesContainer || !allTiersContainer || !btnSave || !btnEdit) {
        return;
    }

    rowsContainer.innerHTML = '';
    tablesContainer.innerHTML = '';

    // Clone buttons at the start to avoid stale references
    const newBtnEdit = btnEdit.cloneNode(true);
    btnEdit.parentNode.replaceChild(newBtnEdit, btnEdit);
    const newBtnSave = btnSave.cloneNode(true);
    btnSave.parentNode.replaceChild(newBtnSave, btnSave);

    // Set initial state on the new buttons
    newBtnSave.style.display = 'none';
    newBtnEdit.style.display = 'inline-block';

    const createTierGroup = (title, data, type) => {
        const wrapper = document.createElement('div');
        const table = document.createElement('table');
        table.className = 'table table-hover align-middle w-auto';
        table.innerHTML = `
            <thead style="background-color: var(--bg-muted);">
                <tr><th colspan="3" class="text-main-theme header-title" style="border-bottom-color: var(--border-color);">${title}</th></tr>
                <tr>
                    <th class="text-main-theme" style="border-bottom-color: var(--border-color); padding-right: 2rem;">Tier / Seats</th>
                    <th class="text-main-theme" style="border-bottom-color: var(--border-color);">Price per ticket</th>
                    <th class="text-main-theme" style="border-bottom-color: var(--border-color); width: 50px;"></th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        const tbody = table.querySelector('tbody');
        data.forEach(group => tbody.appendChild(createTierRow(group, event, type)));
        wrapper.appendChild(table);

        // "Add Tier" button removed as tiers are now managed in the Seat Planner.
        return wrapper;
    };

    const hasRowData = event.row_layout_data && event.row_layout_data.length > 0;
    const hasTableData = event.table_layout_data && event.table_layout_data.length > 0;

    if (hasRowData) {
        rowsContainer.appendChild(createTierGroup('Row-based Tiers', event.row_layout_data, 'row'));
    } else {
        rowsContainer.innerHTML = '<div class="text-center text-muted-theme p-4 border rounded" style="background-color: var(--bg-muted);">No row layout found. Configure rows in the Seat Planner Chart.</div>';
    }

    if (hasTableData) {
        tablesContainer.appendChild(createTierGroup('Table-based Tiers', event.table_layout_data, 'table'));
    } else {
        tablesContainer.innerHTML = '<div class="text-center text-muted-theme p-4 border rounded" style="background-color: var(--bg-muted);">No table layout found. Configure tables in the Seat Planner Chart.</div>';
    }

    const pillsRowsTab = document.getElementById('pills-rows-tab');
    const pillsTablesTab = document.getElementById('pills-tables-tab');

    // Hide actions initially
    if (rowActions) rowActions.style.display = 'none';
    if (tableActions) tableActions.style.display = 'none';

    if (!hasRowData && !hasTableData) {
        newBtnSave.disabled = true;
        newBtnEdit.disabled = true;
        if (pillsRowsTab) pillsRowsTab.classList.add('disabled');
        if (pillsTablesTab) pillsTablesTab.classList.add('disabled');
    } else {
        newBtnSave.disabled = false;
        newBtnEdit.disabled = false;

        if (pillsRowsTab) pillsRowsTab.classList.toggle('disabled', !hasRowData);
        if (pillsTablesTab) pillsTablesTab.classList.toggle('disabled', !hasTableData);

        // Rule 2: If seating_by_table is enabled OR only table data exists, show Table Tiers tab
        if ((event.seating_by_table && hasTableData) || (!hasRowData && hasTableData)) {
            new bootstrap.Tab(pillsTablesTab).show();
        } else if (hasRowData && !hasTableData) {
            new bootstrap.Tab(pillsRowsTab).show();
        }
    }

    // Rule 3: Live sync — when seat planner saves its chart state, refresh ticket tiers
    if (window._ticketTierRefreshHandler) {
        window.removeEventListener('db-events-updated', window._ticketTierRefreshHandler);
    }
    window._ticketTierRefreshHandler = () => {
        const latestEvent = MockDB.getEvents().find(e => e.event_id == event.event_id);
        if (latestEvent && document.getElementById('ticketTierRowsContainer')) {
            renderTicketTiersEditor(latestEvent);
        }
    };
    window.addEventListener('db-events-updated', window._ticketTierRefreshHandler);

    // --- Bind Add/Remove Buttons ---
    const bindActionButtons = (addBtnId, removeBtnId, container, type, title) => {
        const btnAdd = document.getElementById(addBtnId);
        const btnRemove = document.getElementById(removeBtnId);
        
        if (btnAdd) {
            const newBtnAdd = btnAdd.cloneNode(true);
            btnAdd.parentNode.replaceChild(newBtnAdd, btnAdd);
            
            newBtnAdd.addEventListener('click', () => {
                let tbody = container.querySelector('tbody');
                if (!tbody) {
                    // Container is empty (showing "No layout found"), create table structure
                    container.innerHTML = '';
                    const wrapper = createTierGroup(title, [], type);
                    container.appendChild(wrapper);
                    tbody = container.querySelector('tbody');
                }

                // Generate Label
                let nextLabel = '';
                const existingRows = tbody.querySelectorAll('tr.tier-row-item');
                if (type === 'row') {
                    // Simple logic: Row A, B, C... 
                    // Find max char used
                    let maxChar = 64; // @
                    existingRows.forEach(r => {
                        const input = r.querySelector('.tier-name-input');
                        if (input) {
                            const name = input.dataset.originalName || '';
                            if (name.startsWith('Row ')) {
                                const charCode = name.replace('Row ', '').charCodeAt(0);
                                if (charCode > maxChar) maxChar = charCode;
                            }
                        }
                    });
                    nextLabel = `Row ${String.fromCharCode(maxChar + 1)}`;
                } else {
                    // Table 1, Table 2...
                    let maxNum = 0;
                    existingRows.forEach(r => {
                        const input = r.querySelector('.tier-name-input');
                        if (input) {
                            const name = input.dataset.originalName || '';
                            if (name.startsWith('Table ')) {
                                const num = parseInt(name.replace('Table ', ''));
                                if (num > maxNum) maxNum = num;
                            }
                        }
                    });
                    nextLabel = `Table ${maxNum + 1}`;
                }

                const newGroup = { label: nextLabel, seats: 10 }; // Default 10 seats
                const tr = createTierRow(newGroup, event, type, true);
                
                // Enable inputs immediately since we are in edit mode
                tr.querySelectorAll('input').forEach(i => i.disabled = false);
                tbody.appendChild(tr);
            });
        }

        if (btnRemove) {
            const newBtnRemove = btnRemove.cloneNode(true);
            btnRemove.parentNode.replaceChild(newBtnRemove, btnRemove);

            newBtnRemove.addEventListener('click', () => {
                const tbody = container.querySelector('tbody');
                if (tbody) {
                    const rows = tbody.querySelectorAll('tr.tier-row-item');
                    if (rows.length > 0) {
                        rows[rows.length - 1].remove();
                    }
                    // If empty, maybe show the "No layout" message again? 
                    // For now, leaving an empty table is fine or we can check:
                    if (tbody.querySelectorAll('tr').length === 0) {
                        container.innerHTML = `<div class="text-center text-muted-theme p-4 border rounded" style="background-color: var(--bg-muted);">No ${type} layout found. Configure ${type}s in the Seat Planner Chart.</div>`;
                    }
                }
            });
        }
    };

    bindActionButtons('btnTicketAddRowTier', 'btnTicketRemoveRowTier', rowsContainer, 'row', 'Row-based Tiers');
    bindActionButtons('btnTicketAddTableTier', 'btnTicketRemoveTableTier', tablesContainer, 'table', 'Table-based Tiers');

    newBtnEdit.addEventListener('click', () => {
        allTiersContainer.querySelectorAll('input').forEach(input => input.disabled = false);
        
        // Show Action Buttons
        if (rowActions) rowActions.style.display = 'block';
        if (tableActions) tableActions.style.display = 'block';

        newBtnEdit.style.display = 'none';
        newBtnSave.style.display = 'inline-block';
    });

    newBtnSave.addEventListener('click', () => {
        const rows = allTiersContainer.querySelectorAll('.tier-row-item');
        
        let newRowLayout = [];
        let newTableLayout = [];
        let newTickets = [];

        rows.forEach(row => {
            const nameInput = row.querySelector('.tier-name-input');
            const priceInput = row.querySelector('.tier-price-input');

            if (nameInput && priceInput) {
                const price = priceInput.value;
                const name = nameInput.value;
                const originalName = nameInput.dataset.originalName || name;
                const seats = parseInt(nameInput.dataset.seats) || 10;
                const layoutType = row.dataset.layoutType;

                if (name) {
                    // Rebuild Layout Data (always use originalName for layout key)
                    if (layoutType === 'row') {
                        newRowLayout.push({ label: originalName, seats: seats });
                    } else if (layoutType === 'table') {
                        newTableLayout.push({ label: originalName, seats: seats });
                    }

                    // Ensure tier name includes seat count suffix (Rule 1)
                    const seatSuffix = `(${seats} seat${seats !== 1 ? 's' : ''})`;
                    const hasCount = /\(\d+ seats?\)$/.test(name);
                    const tierName = hasCount ? name : `${name} ${seatSuffix}`;

                    // Rebuild Tickets
                    newTickets.push({
                        name: tierName,
                        original_name: originalName,
                        price: parseInt(price) || 0,
                        qty: seats
                    });
                }
            }
        });

        MockDB.updateEvent(event.event_id, {
            // We must update layout data too, as rows might have been added/removed
            row_layout_data: newRowLayout,
            table_layout_data: newTableLayout,
            // Update tickets
            tickets: newTickets,
        });

        alert('Ticket prices saved successfully!');
        initTickets(); // Refresh UI
    });
}