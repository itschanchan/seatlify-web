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
        // Update Ticket Configuration Total Seats
        const configTotalSeatsEl = document.getElementById('ticketConfigTotalSeats');
        if (configTotalSeatsEl) {
            configTotalSeatsEl.textContent = event.total_seats || 0;
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
            const venue = MockDB.getVenueById(event.venue_id);
            venueEl.textContent = venue ? venue.name : 'Unknown Venue';
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

function renderTicketTiersEditor(event) {
    const container = document.getElementById('ticketTierRowsContainer');
    const btnSave = document.getElementById('btnSaveTicketTiers');
    const btnEdit = document.getElementById('btnEditTicketTiers');
    const btnAddRow = document.getElementById('btnTicketAddRow');
    
    if (!container || !btnSave || !btnEdit || !btnAddRow) { return; }

    container.innerHTML = '';

    // Clone buttons at the start to avoid stale references
    const newBtnEdit = btnEdit.cloneNode(true);
    btnEdit.parentNode.replaceChild(newBtnEdit, btnEdit);
    const newBtnSave = btnSave.cloneNode(true);
    btnSave.parentNode.replaceChild(newBtnSave, btnSave);
    const newBtnAddRow = btnAddRow.cloneNode(true);
    btnAddRow.parentNode.replaceChild(newBtnAddRow, btnAddRow);

    // Set initial state on the new buttons
    newBtnSave.style.display = 'none';
    newBtnAddRow.style.display = 'none';
    newBtnEdit.style.display = 'inline-block';

    // Combine row and table data
    let layoutData = [];
    if (event.row_layout_data) layoutData = layoutData.concat(event.row_layout_data);
    if (event.table_layout_data) layoutData = layoutData.concat(event.table_layout_data);

    if (layoutData.length === 0) {
        container.innerHTML = '<div class="text-center text-muted-theme p-5 border rounded" style="background-color: var(--bg-muted);">No seat layout found. Please configure and save the Seat Planner Chart first.</div>';
        newBtnSave.disabled = true;
        newBtnAddRow.disabled = true;
        newBtnEdit.disabled = true;
    } else {
        const table = document.createElement('table');
        table.className = 'table table-hover align-middle w-auto';
        table.innerHTML = `
            <thead style="background-color: var(--bg-muted);">
                <tr>
                    <th class="text-main-theme" style="border-bottom-color: var(--border-color); padding-right: 2rem;">Row</th>
                    <th class="text-main-theme" style="border-bottom-color: var(--border-color);">Price</th>
                    <th class="text-main-theme" style="border-bottom-color: var(--border-color); width: 50px;"></th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        const tbody = table.querySelector('tbody');

        layoutData.forEach((group) => {
            // Check if a ticket tier already exists for this group
            const existingTier = event.tickets ? event.tickets.find(t => (t.original_name === group.label) || (t.name === group.label)) : null;
            const price = existingTier ? existingTier.price : '';
            const displayName = existingTier ? existingTier.name : group.label;

            const tr = document.createElement('tr');
            tr.className = 'tier-row-item';
            tr.innerHTML = `
                <td style="border-bottom-color: var(--border-color);">
                    <div class="d-flex flex-column">
                        <input type="text" class="form-control bg-panel-theme text-main-theme border-secondary tier-name-input fw-bold" 
                            value="${displayName}" placeholder="Tier Name" data-original-name="${group.label}" disabled>
                        <input type="number" class="form-control form-control-sm bg-panel-theme text-main-theme border-secondary tier-qty-input mt-1" 
                            value="${group.seats}" disabled placeholder="Seats">
                    </div>
                </td>
                <td style="border-bottom-color: var(--border-color);">
                    <div class="input-group" style="max-width: 140px;">
                        <span class="input-group-text bg-panel-theme text-muted-theme border-secondary">₱</span>
                        <input type="number" class="form-control bg-panel-theme text-main-theme border-secondary tier-price-input" 
                            placeholder="Price" value="${price}" disabled>
                    </div>
                </td>
                <td style="border-bottom-color: var(--border-color);">
                    <button class="btn btn-sm btn-outline-danger btn-delete-row" style="display: none;"><i class="bi bi-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        container.appendChild(table);
        newBtnSave.disabled = false;
        newBtnEdit.disabled = false;
        newBtnAddRow.disabled = false;
        
        // Bind Delete Buttons for existing rows
        container.querySelectorAll('.btn-delete-row').forEach(btn => {
            btn.addEventListener('click', (e) => e.target.closest('tr').remove());
        });

        // Initial validation
        validateTotalSeats(event.total_seats);
        container.addEventListener('input', (e) => { if(e.target.classList.contains('tier-qty-input')) validateTotalSeats(event.total_seats); });
    }

    // Bind Edit
    newBtnEdit.addEventListener('click', () => {
        container.querySelectorAll('input').forEach(input => input.disabled = false);
        container.querySelectorAll('.btn-delete-row').forEach(btn => btn.style.display = 'inline-block');
        newBtnEdit.style.display = 'none';
        newBtnSave.style.display = 'inline-block';
        newBtnAddRow.style.display = 'block';
    });

    // Bind Add Row
    newBtnAddRow.addEventListener('click', () => {
        const tbody = container.querySelector('tbody');
        const tr = document.createElement('tr');
        tr.className = 'tier-row-item';
        tr.innerHTML = `
            <td style="border-bottom-color: var(--border-color);">
                <div class="d-flex flex-column gap-1">
                    <input type="text" class="form-control bg-panel-theme text-main-theme border-secondary tier-name-input fw-bold" placeholder="Tier Name">
                    <input type="number" class="form-control form-control-sm bg-panel-theme text-main-theme border-secondary tier-qty-input" placeholder="Qty">
                </div>
            </td>
            <td style="border-bottom-color: var(--border-color);">
                <div class="input-group" style="max-width: 140px;">
                    <span class="input-group-text bg-panel-theme text-muted-theme border-secondary">₱</span>
                    <input type="number" class="form-control bg-panel-theme text-main-theme border-secondary tier-price-input" placeholder="Price">
                </div>
            </td>
            <td style="border-bottom-color: var(--border-color);"><button class="btn btn-sm btn-outline-danger btn-delete-row"><i class="bi bi-trash"></i></button></td>
        `;
        tr.querySelector('.btn-delete-row').addEventListener('click', () => tr.remove());
        tbody.appendChild(tr);
        validateTotalSeats(event.total_seats);
    });

    // Bind Save
    newBtnSave.addEventListener('click', () => {
        const rows = container.querySelectorAll('.tier-row-item');
        let newTickets = [];
        let newLayoutData = [];
        
        rows.forEach(row => {
            const nameInput = row.querySelector('.tier-name-input');
            const priceInput = row.querySelector('.tier-price-input');
            const qtyInput = row.querySelector('.tier-qty-input');
            
            if (nameInput && priceInput && nameInput.value) {
                const price = priceInput.value;
                const name = nameInput.value;
                const qty = qtyInput ? qtyInput.value : 0;
                const originalName = nameInput.dataset.originalName || name;

                if (price && price >= 0 && name) {
                    newTickets.push({
                        name: name,
                        original_name: originalName,
                        price: parseInt(price),
                        qty: parseInt(qty)
                    });
                    newLayoutData.push({
                        label: originalName,
                        seats: parseInt(qty)
                    });
                }
            }
        });

        // Update DB
        MockDB.updateEvent(event.event_id, { 
            tickets: newTickets, 
            is_paid: true,
            row_layout_data: newLayoutData,
            table_layout_data: newLayoutData
        });
        
        alert('Ticket prices saved successfully!');
        initTickets(); // Refresh UI
    });
}

function validateTotalSeats(capacity) {
    const inputs = document.querySelectorAll('.tier-qty-input');
    let total = 0;
    inputs.forEach(input => total += parseInt(input.value) || 0);
    
    const warningEl = document.getElementById('ticketCapacityWarning');
    if (warningEl) {
        if (total > capacity) {
            warningEl.style.display = 'inline-block';
            warningEl.innerHTML = `<i class="bi bi-exclamation-triangle-fill me-1"></i> Exceeds Capacity! (${total}/${capacity})`;
        } else {
            warningEl.style.display = 'none';
        }
    }
}