let eventManagerInitialized = false;
let currentEventView = 'table';
let calendarDate = new Date();

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
    const btnCalendar = document.getElementById('btnViewCalendar');
    const btnTable = document.getElementById('btnViewTable');
    const btnSimplified = document.getElementById('btnViewSimplified');
    if (btnCalendar && btnTable && btnSimplified) {
        // Clone to strip old listeners
        const newBtnCalendar = btnCalendar.cloneNode(true);
        const newBtnTable = btnTable.cloneNode(true);
        const newBtnSimplified = btnSimplified.cloneNode(true);
        btnCalendar.parentNode.replaceChild(newBtnCalendar, btnCalendar);
        btnTable.parentNode.replaceChild(newBtnTable, btnTable);
        btnSimplified.parentNode.replaceChild(newBtnSimplified, btnSimplified);

        newBtnCalendar.addEventListener('click', () => setEventView('calendar'));
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
    const btnCalendar = document.getElementById('btnViewCalendar');
    const btnTable = document.getElementById('btnViewTable');
    const btnSimplified = document.getElementById('btnViewSimplified');

    if (view === 'calendar') {
        // Active Calendar
        btnCalendar.classList.add('active');
        btnCalendar.style.backgroundColor = 'var(--primary)';
        btnCalendar.style.color = '#fff';
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
        btnCalendar.classList.remove('active');
        btnCalendar.style.backgroundColor = 'transparent';
        btnCalendar.style.color = 'var(--text-muted)';
        btnTable.classList.remove('active');
        btnTable.style.backgroundColor = 'transparent';
        btnTable.style.color = 'var(--text-muted)';
    } else {
        // Active Table
        btnTable.classList.add('active');
        btnTable.style.backgroundColor = 'var(--primary)';
        btnTable.style.color = '#fff';
        // Inactive Calendar
        btnCalendar.classList.remove('active');
        btnCalendar.style.backgroundColor = 'transparent';
        btnCalendar.style.color = 'var(--text-muted)';
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
    } else if (currentEventView === 'calendar') {
        renderCalendar(container, events);
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

function renderCalendar(container, events) {
    const wrapper = document.createElement('div');
    wrapper.className = 'calendar-wrapper p-3 bg-white rounded shadow-sm border';
    
    // Header
    const header = document.createElement('div');
    header.className = 'd-flex justify-content-between align-items-center mb-3';
    
    const btnPrev = document.createElement('button');
    btnPrev.className = 'btn btn-outline-secondary btn-sm';
    btnPrev.innerHTML = '<i class="bi bi-chevron-left"></i>';
    btnPrev.onclick = () => {
        calendarDate.setMonth(calendarDate.getMonth() - 1);
        renderEventView();
    };

    const title = document.createElement('h4');
    title.className = 'mb-0 fw-bold';
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
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

    // Days Header
    const daysHeader = document.createElement('div');
    daysHeader.className = 'row g-0 text-center mb-2';
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
        const col = document.createElement('div');
        col.className = 'col fw-bold text-muted';
        col.textContent = day;
        daysHeader.appendChild(col);
    });
    wrapper.appendChild(daysHeader);

    // Grid
    const grid = document.createElement('div');
    grid.className = 'calendar-grid';
    
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    let row = document.createElement('div');
    row.className = 'row g-0';
    
    // Empty cells
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
        cell.appendChild(dayNum);

        const currentDayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        events.forEach(evt => {
            const evtDate = evt.start_datetime.split('T')[0];
            if (evtDate === currentDayStr) {
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

    const remainingCells = (7 - (firstDay + daysInMonth) % 7) % 7;
    for (let i = 0; i < remainingCells; i++) {
        const cell = document.createElement('div');
        cell.className = 'col p-2 border bg-light';
        cell.style.minHeight = '100px';
        row.appendChild(cell);
    }
    if (row.children.length > 0) {
        grid.appendChild(row);
    }

    wrapper.appendChild(grid);
    container.appendChild(wrapper);
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
