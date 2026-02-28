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
                        .then(() => {
                            alert(`Ticket successfully emailed to ${email}!`);
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
    
    if (!container || !btnSave || !btnEdit) { return; }

    container.innerHTML = '';

    // Clone buttons at the start to avoid stale references
    const newBtnEdit = btnEdit.cloneNode(true);
    btnEdit.parentNode.replaceChild(newBtnEdit, btnEdit);
    const newBtnSave = btnSave.cloneNode(true);
    btnSave.parentNode.replaceChild(newBtnSave, btnSave);

    // Set initial state on the new buttons
    newBtnSave.style.display = 'none';
    newBtnEdit.style.display = 'inline-block';

    // Combine row and table data
    let layoutData = [];
    if (event.row_layout_data) layoutData = layoutData.concat(event.row_layout_data);
    if (event.table_layout_data) layoutData = layoutData.concat(event.table_layout_data);

    if (layoutData.length === 0) {
        container.innerHTML = '<div class="text-center text-muted-theme p-5 border rounded" style="background-color: var(--bg-muted);">No seat layout found. Please configure and save the Seat Planner Chart first.</div>';
        newBtnSave.disabled = true;
        newBtnEdit.disabled = true;
    } else {
        const table = document.createElement('table');
        table.className = 'table table-hover align-middle';
        table.innerHTML = `
            <thead style="background-color: var(--bg-muted);">
                <tr>
                    <th class="text-main-theme" style="border-bottom-color: var(--border-color);">Row</th>
                    <th class="text-main-theme" style="width: 200px; border-bottom-color: var(--border-color);">Price</th>
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
                        <small class="text-muted-theme">${group.seats} Seats</small>
                    </div>
                </td>
                <td style="border-bottom-color: var(--border-color);">
                    <div class="input-group" style="max-width: 180px;">
                        <span class="input-group-text bg-panel-theme text-muted-theme border-secondary">₱</span>
                        <input type="number" class="form-control bg-panel-theme text-main-theme border-secondary tier-price-input" 
                            placeholder="Price" value="${price}" data-seats="${group.seats}" disabled>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
        container.appendChild(table);
        newBtnSave.disabled = false;
        newBtnEdit.disabled = false;
    }

    // Bind Edit
    newBtnEdit.addEventListener('click', () => {
        container.querySelectorAll('input').forEach(input => input.disabled = false);
        newBtnEdit.style.display = 'none';
        newBtnSave.style.display = 'inline-block';
    });

    // Bind Save
    newBtnSave.addEventListener('click', () => {
        const rows = container.querySelectorAll('.tier-row-item');
        let newTickets = [];
        
        rows.forEach(row => {
            const nameInput = row.querySelector('.tier-name-input');
            const priceInput = row.querySelector('.tier-price-input');
            
            if (nameInput && priceInput && nameInput.value) {
                const price = priceInput.value;
                const name = nameInput.value;
                if (price && price > 0 && name) {
                    newTickets.push({
                        name: name,
                        original_name: nameInput.dataset.originalName,
                        price: parseInt(price),
                        qty: parseInt(priceInput.dataset.seats)
                    });
                }
            }
        });

        // Update DB
        MockDB.updateEvent(event.event_id, { tickets: newTickets, is_paid: true });
        
        alert('Ticket prices saved successfully!');
        initTickets(); // Refresh UI
    });
}