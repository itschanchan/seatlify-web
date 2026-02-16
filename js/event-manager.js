let eventManagerInitialized = false;
let currentEventView = 'table';

function initEventManager() {
    console.log("Initializing Event Manager");

    // Reset view state on load to match HTML default
    currentEventView = 'table';
    renderEventView();

    // Bind Save Changes button for Edit Modal (Re-bind every time HTML is loaded)
    const btnSaveEdit = document.getElementById('btnSaveEdit');
    if (btnSaveEdit) {
        const newBtn = btnSaveEdit.cloneNode(true); // Remove old listeners
        btnSaveEdit.parentNode.replaceChild(newBtn, btnSaveEdit);
        newBtn.addEventListener('click', saveEventChanges);
    }

    // Bind Add Tier button in Edit Modal
    const btnAddTier = document.getElementById('btnEditAddTier');
    if (btnAddTier) {
        const newBtn = btnAddTier.cloneNode(true);
        btnAddTier.parentNode.replaceChild(newBtn, btnAddTier);
        newBtn.addEventListener('click', () => addEditTierRow());
    }

    // Bind Radio Buttons for Ticket Type
    const radioPaid = document.getElementById('editTypePaid');
    const radioFree = document.getElementById('editTypeFree');
    const tiersWrapper = document.getElementById('editTicketTiersWrapper');
    
    if(radioPaid && radioFree && tiersWrapper) {
        radioPaid.addEventListener('change', () => tiersWrapper.style.display = 'block');
        radioFree.addEventListener('change', () => tiersWrapper.style.display = 'none');
    }

    // Bind View Toggles
    const btnList = document.getElementById('btnViewList');
    const btnTable = document.getElementById('btnViewTable');
    const btnSimplified = document.getElementById('btnViewSimplified');
    if (btnList && btnTable && btnSimplified) {
        // Clone to strip old listeners
        const newBtnList = btnList.cloneNode(true);
        const newBtnTable = btnTable.cloneNode(true);
        const newBtnSimplified = btnSimplified.cloneNode(true);
        btnList.parentNode.replaceChild(newBtnList, btnList);
        btnTable.parentNode.replaceChild(newBtnTable, btnTable);
        btnSimplified.parentNode.replaceChild(newBtnSimplified, btnSimplified);

        newBtnList.addEventListener('click', () => setEventView('list'));
        newBtnTable.addEventListener('click', () => setEventView('table'));
        newBtnSimplified.addEventListener('click', () => setEventView('simplified'));
    }

    // Re-bind Sortable (DOM is fresh every time)
    const tbody = document.getElementById("eventTableBody");
    if (tbody && typeof Sortable !== 'undefined') {
        new Sortable(tbody, {
            animation: 150,
            handle: '.bi-grip-vertical',
            ghostClass: 'table-active'
        });
    }

    if (eventManagerInitialized) return;

    // Listen for DB updates (e.g. new event added) - Global listener, add once
    window.addEventListener('db-events-updated', renderEventView);

    eventManagerInitialized = true;
}

function setEventView(view) {
    currentEventView = view;
    const btnList = document.getElementById('btnViewList');
    const btnTable = document.getElementById('btnViewTable');
    const btnSimplified = document.getElementById('btnViewSimplified');

    if (view === 'list') {
        // Active List
        btnList.classList.add('active');
        btnList.style.backgroundColor = 'var(--primary)';
        btnList.style.color = '#fff';
        // Inactive Table
        btnTable.classList.remove('active');
        btnTable.style.backgroundColor = 'transparent';
        btnTable.style.color = 'var(--text-muted)';
        btnSimplified.classList.remove('active');
        btnSimplified.style.backgroundColor = 'transparent';
        btnSimplified.style.color = 'var(--text-muted)';
    } else if (view === 'simplified') {
        // Active Simplified
        btnSimplified.classList.add('active');
        btnSimplified.style.backgroundColor = 'var(--primary)';
        btnSimplified.style.color = '#fff';
        // Inactive others
        btnList.classList.remove('active');
        btnList.style.backgroundColor = 'transparent';
        btnList.style.color = 'var(--text-muted)';
        btnTable.classList.remove('active');
        btnTable.style.backgroundColor = 'transparent';
        btnTable.style.color = 'var(--text-muted)';
    } else {
        // Active Table
        btnTable.classList.add('active');
        btnTable.style.backgroundColor = 'var(--primary)';
        btnTable.style.color = '#fff';
        // Inactive List
        btnList.classList.remove('active');
        btnList.style.backgroundColor = 'transparent';
        btnList.style.color = 'var(--text-muted)';
        btnSimplified.classList.remove('active');
        btnSimplified.style.backgroundColor = 'transparent';
        btnSimplified.style.color = 'var(--text-muted)';
    }
    renderEventView();
}

function renderEventView() {
    const container = document.getElementById("event-view-container");
    if (!container) return;

    const events = MockDB.getEvents();
    container.innerHTML = '';

    if (currentEventView === 'simplified') {
        const grid = document.createElement('div');
        grid.className = 'row g-3';
        if (events.length === 0) {
            grid.innerHTML = '<p class="text-muted text-center w-100">No events found.</p>';
        }
        events.forEach(event => {
            const venue = MockDB.getVenueById(event.venue_id);
            const venueName = venue ? venue.name : 'Unknown Venue';
            const dateObj = new Date(event.start_datetime);
            const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
            const day = dateObj.getDate();
            const month = months[dateObj.getMonth()];
            const endObj = event.end_datetime ? new Date(event.end_datetime) : null;
            const timeStr = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + 
                            (endObj ? ' - ' + endObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '');
            let badgeClass = 'bg-secondary';
            if (event.status === 'published') badgeClass = 'bg-success';
            if (event.status === 'draft') badgeClass = 'bg-warning text-dark';
            if (event.status === 'cancelled') badgeClass = 'bg-danger';
            const statusText = event.status.charAt(0).toUpperCase() + event.status.slice(1);

            const cardCol = document.createElement('div');
            cardCol.className = 'col-12';
            cardCol.innerHTML = `
                <div class="card shadow-sm border-0" style="background-color: var(--bg-panel);">
                    <div class="card-body position-relative">
                        <div class="position-absolute top-0 end-0 p-2">
                            <button class="btn btn-sm btn-outline-secondary me-1 btn-edit" title="Edit"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-sm btn-outline-danger btn-delete" title="Delete"><i class="bi bi-trash"></i></button>
                        </div>
                        <div class="d-flex align-items-center">
                            <div class="rounded p-3 me-3 text-center" style="min-width: 80px; background-color: var(--bg-muted);">
                                <h3 class="mb-0" style="color: var(--primary);">${day}</h3>
                                <small class="fw-bold">${month}</small>
                            </div>
                            <div>
                                <div class="d-flex align-items-center gap-2 mb-1">
                                    <h5 class="mb-0" style="color: var(--text-main);">${event.title}</h5>
                                    <span class="badge ${badgeClass}">${statusText}</span>
                                </div>
                                <p class="mb-1 text-muted small">${event.description || ''}</p>
                                <p class="mb-0" style="color: var(--text-muted);"><i class="bi bi-geo-alt me-1"></i> ${venueName}</p>
                                <p class="mb-0" style="color: var(--text-muted);"><i class="bi bi-clock me-1"></i> ${timeStr}</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            cardCol.querySelector('.btn-edit').addEventListener('click', () => openEditModal(event.event_id));
            cardCol.querySelector('.btn-delete').addEventListener('click', () => {
                if (confirm(`Are you sure you want to delete "${event.title}"?`)) {
                    MockDB.deleteEvent(event.event_id);
                }
            });
            grid.appendChild(cardCol);
        });
        container.appendChild(grid);
    } else { // Table or List view
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'event-table table-responsive';
        
        const table = document.createElement('table');
        table.className = 'table table-hover align-middle';
        table.style.color = 'var(--text-main)';
        table.style.borderColor = 'var(--border-color)';

        const thead = document.createElement('thead');
        thead.style.backgroundColor = 'var(--bg-muted)';

        const tbody = document.createElement('tbody');
        tbody.id = 'eventTableBody';

        if (currentEventView === 'list') {
            table.classList.add('table-sm');
            thead.innerHTML = `
                <tr>
                    <th style="width: 40px; background-color: var(--bg-muted); color: var(--text-main); border-bottom-color: var(--border-color);"></th>
                    <th style="background-color: var(--bg-muted); color: var(--text-main); border-bottom-color: var(--border-color);">Event Name</th>
                    <th style="background-color: var(--bg-muted); color: var(--text-main); border-bottom-color: var(--border-color);">Date</th>
                    <th style="background-color: var(--bg-muted); color: var(--text-main); border-bottom-color: var(--border-color);">Status</th>
                    <th class="text-end" style="background-color: var(--bg-muted); color: var(--text-main); border-bottom-color: var(--border-color);">Actions</th>
                </tr>
            `;
        } else {
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
        }

        events.forEach(event => {
            const venue = MockDB.getVenueById(event.venue_id);
            const venueName = venue ? venue.name : 'Unknown Venue';
            const dateObj = new Date(event.start_datetime);
            const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const endObj = event.end_datetime ? new Date(event.end_datetime) : null;
            const timeStr = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + 
                            (endObj ? ' - ' + endObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '');
            let badgeClass = 'bg-secondary';
            if (event.status === 'published') badgeClass = 'bg-success';
            if (event.status === 'draft') badgeClass = 'bg-warning text-dark';
            if (event.status === 'cancelled') badgeClass = 'bg-danger';
            const statusText = event.status.charAt(0).toUpperCase() + event.status.slice(1);

            const tr = document.createElement('tr');
            
            if (currentEventView === 'list') {
                tr.innerHTML = `
                    <td class="cursor-move" style="color: var(--text-muted); border-bottom-color: var(--border-color);">
                        <i class="bi bi-grip-vertical"></i>
                    </td>
                    <td style="border-bottom-color: var(--border-color);">
                        <strong>${event.title}</strong>
                    </td>
                    <td style="border-bottom-color: var(--border-color);">${dateStr}</td>
                    <td style="border-bottom-color: var(--border-color);">
                        <span class="badge ${badgeClass}">${statusText}</span>
                    </td>
                    <td class="text-end" style="border-bottom-color: var(--border-color);">
                        <button class="btn btn-sm btn-outline-secondary me-1 btn-edit"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger btn-delete"><i class="bi bi-trash"></i></button>
                    </td>
                `;
            } else {
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
                    <td class="text-end" style="border-bottom-color: var(--border-color);">
                        <button class="btn btn-sm btn-outline-secondary me-1 btn-edit" style="border-color: var(--border-color); color: var(--text-muted);">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger btn-delete">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                `;
            }

            tr.querySelector('.btn-edit').addEventListener('click', () => openEditModal(event.event_id));
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
}

function openEditModal(eventId) {
    const event = MockDB.getEvents().find(e => e.event_id == eventId);
    if (!event) return;

    // Populate Venues
    const venueSelect = document.getElementById('editEventVenue');
    if (venueSelect) {
        venueSelect.innerHTML = '<option selected disabled value="">Select Venue</option>';
        const venues = MockDB.getVenues();
        venues.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.venue_id;
            opt.textContent = v.name;
            if (v.venue_id == event.venue_id) opt.selected = true;
            venueSelect.appendChild(opt);
        });
    }

    // Populate Fields
    document.getElementById('editEventId').value = event.event_id;
    document.getElementById('editEventName').value = event.title;
    
    // Date/Time parsing
    // event.start_datetime is "YYYY-MM-DDTHH:MM"
    const startParts = event.start_datetime.split('T');
    document.getElementById('editEventDate').value = startParts[0];
    document.getElementById('editEventTime').value = startParts[1];

    if (event.end_datetime) {
        const endParts = event.end_datetime.split('T');
        document.getElementById('editEventEndTime').value = endParts[1];
    } else {
        document.getElementById('editEventEndTime').value = '';
    }

    document.getElementById('editEventStatus').value = event.status;
    document.getElementById('editEventDescription').value = event.description || '';

    // Seat Config
    document.getElementById('editEventTotalSeats').value = event.total_seats || '';
    document.getElementById('editEventTotalTables').value = event.total_tables || '';
    document.getElementById('editSeatLayout').value = event.layout_preference || 'empty';

    // Ticket Config
    const isPaid = event.is_paid || false;
    if (isPaid) {
        document.getElementById('editTypePaid').checked = true;
        document.getElementById('editTicketTiersWrapper').style.display = 'block';
    } else {
        document.getElementById('editTypeFree').checked = true;
        document.getElementById('editTicketTiersWrapper').style.display = 'none';
    }

    // Populate Tiers
    const tiersList = document.getElementById('editTiersList');
    tiersList.innerHTML = '';
    const tickets = event.tickets || [];
    tickets.forEach(t => addEditTierRow(t));

    // Show Modal
    const modalEl = document.getElementById('editEventModal');
    let modal = bootstrap.Modal.getInstance(modalEl);
    if (!modal) {
        modal = new bootstrap.Modal(modalEl);
    }
    modal.show();
}

function saveEventChanges() {
    const id = document.getElementById('editEventId').value;
    const title = document.getElementById('editEventName').value;
    const date = document.getElementById('editEventDate').value;
    const startTime = document.getElementById('editEventTime').value;
    const endTime = document.getElementById('editEventEndTime').value;
    const venueId = document.getElementById('editEventVenue').value;
    const status = document.getElementById('editEventStatus').value;
    const desc = document.getElementById('editEventDescription').value;
    
    const totalSeats = document.getElementById('editEventTotalSeats').value;
    const totalTables = document.getElementById('editEventTotalTables').value;
    const layout = document.getElementById('editSeatLayout').value;

    if (!title || !date || !startTime || !venueId) {
        alert("Please fill in required fields.");
        return;
    }

    MockDB.updateEvent(id, {
        title: title,
        venue_id: venueId,
        description: desc,
        start_datetime: `${date}T${startTime}`,
        end_datetime: endTime ? `${date}T${endTime}` : null,
        status: status,
        total_seats: totalSeats,
        total_tables: totalTables,
        layout_preference: layout,
        is_paid: document.getElementById('editTypePaid').checked,
        tickets: getEditTiersData()
    });

    // Hide Modal
    const modalEl = document.getElementById('editEventModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if(modal) modal.hide();
}

function addEditTierRow(data = null) {
    const list = document.getElementById('editTiersList');
    const row = document.createElement('div');
    row.className = 'row g-2 mb-2 edit-tier-row';
    row.innerHTML = `
        <div class="col-5">
            <input type="text" class="form-control form-control-sm tier-name" placeholder="Tier Name" value="${data ? data.name : ''}" style="background-color: var(--bg-panel); border-color: var(--border-color); color: var(--text-main);">
        </div>
        <div class="col-3">
            <input type="number" class="form-control form-control-sm tier-price" placeholder="Price" value="${data ? data.price : ''}" style="background-color: var(--bg-panel); border-color: var(--border-color); color: var(--text-main);">
        </div>
        <div class="col-4">
            <input type="number" class="form-control form-control-sm tier-qty" placeholder="Qty" value="${data ? data.qty : ''}" style="background-color: var(--bg-panel); border-color: var(--border-color); color: var(--text-main);">
        </div>
    `;
    list.appendChild(row);
}

function getEditTiersData() {
    const tickets = [];
    document.querySelectorAll('.edit-tier-row').forEach(row => {
        const name = row.querySelector('.tier-name').value;
        const price = row.querySelector('.tier-price').value;
        const qty = row.querySelector('.tier-qty').value;
        if(name) tickets.push({ name, price, qty });
    });
    return tickets;
}
