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

        // --- QR Code API Integration ---
        const qrContainer = document.querySelector('.qr-code-container');
        if (qrContainer) {
            // Create a data string for the QR code
            const qrData = `EVENT:${event.event_id}|TICKET:GUEST-001|SEAT:A-12`;
            const qrUrl = MockDB.generateQRCodeUrl(qrData);
            
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
    const displayName = existingTier ? existingTier.name : group.label;
    const seats = isNew ? '' : group.seats;

    const tr = document.createElement('tr');
    tr.className = 'tier-row-item';
    tr.dataset.layoutType = layoutType; // Crucial for saving

    tr.innerHTML = `
        <td style="border-bottom-color: var(--border-color);">
            <div class="d-flex flex-column">
                <input type="text" class="form-control bg-panel-theme text-main-theme border-secondary tier-name-input fw-bold"
                    value="${displayName}" placeholder="Tier Name" data-original-name="${group.label}" disabled>
                <small class="text-muted mt-1">${seats} seats</small>
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
    const btnAddRow = document.getElementById('btnTicketAddRow');

    if (!rowsContainer || !tablesContainer || !allTiersContainer || !btnSave || !btnEdit || !btnAddRow) {
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
    btnAddRow.style.display = 'none'; // Hide global button, we'll use local ones
    newBtnEdit.style.display = 'inline-block';

    const createTierGroup = (title, data, type) => {
        const wrapper = document.createElement('div');
        const table = document.createElement('table');
        table.className = 'table table-hover align-middle w-auto';
        table.innerHTML = `
            <thead style="background-color: var(--bg-muted);">
                <tr><th colspan="3" class="text-main-theme" style="border-bottom-color: var(--border-color);">${title}</th></tr>
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

        // If only one type of data exists, or if the previously active tab is now disabled, switch to a valid one.
        if (hasRowData && !hasTableData) {
            new bootstrap.Tab(pillsRowsTab).show();
        } else if (!hasRowData && hasTableData) {
            new bootstrap.Tab(pillsTablesTab).show();
        }
    }

    newBtnEdit.addEventListener('click', () => {
        allTiersContainer.querySelectorAll('input').forEach(input => input.disabled = false);
        // Tier management (add/delete) is now in Seat Planner.
        newBtnEdit.style.display = 'none';
        newBtnSave.style.display = 'inline-block';
    });

    newBtnSave.addEventListener('click', () => {
        const rows = allTiersContainer.querySelectorAll('.tier-row-item');
        let newTickets = [];

        rows.forEach(row => {
            const nameInput = row.querySelector('.tier-name-input');
            const priceInput = row.querySelector('.tier-price-input');

            if (nameInput && priceInput) {
                const price = priceInput.value;
                const name = nameInput.value;
                const originalName = nameInput.dataset.originalName || name;
                const layoutType = row.dataset.layoutType;

                if (name && originalName) { // Only save tiers that correspond to a layout
                    // Find the original seat count from the layout data
                    const layoutData = (layoutType === 'row' ? event.row_layout_data : event.table_layout_data) || [];
                    const groupData = layoutData.find(g => g.label === originalName);
                    const qty = groupData ? groupData.seats : 0;

                    newTickets.push({
                        name: name,
                        original_name: originalName,
                        price: parseInt(price) || 0,
                        qty: parseInt(qty) || 0
                    });
                }
            }
        });

        MockDB.updateEvent(event.event_id, {
            tickets: newTickets,
        });

        alert('Ticket prices saved successfully!');
        initTickets(); // Refresh UI
    });
}