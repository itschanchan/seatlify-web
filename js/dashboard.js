// ==========================================
// DASHBOARD LOGIC (Simulated Data Binding)
// ==========================================
let dashboardFilter = 'current'; // 'current' or 'past'

export function initDashboard() {
    // Bind Tabs
    const tabCurrent = document.getElementById('tabCurrent');
    const tabPast = document.getElementById('tabPast');

    if (tabCurrent && tabPast) {
        tabCurrent.addEventListener('click', (e) => {
            e.preventDefault();
            setDashboardFilter('current');
        });
        tabPast.addEventListener('click', (e) => {
            e.preventDefault();
            setDashboardFilter('past');
        });
    }

    // Initial Load
    setDashboardFilter('current');

    // Listen for DB updates to refresh dropdown
    window.addEventListener('db-events-updated', () => setDashboardFilter(dashboardFilter));

    // Initialize the event manager views (table, calendar, etc.) for the "All Events" section
    initEventManager();

    // --- Analytics Initialization ---
    // Chart 1: Ticket Sales (Bar Chart)
    const salesCtx = document.getElementById('ticketSalesChart');
    if (salesCtx) {
        // Destroy existing chart if any (to prevent canvas reuse issues)
        if (window.dashboardSalesChart) window.dashboardSalesChart.destroy();
        
        window.dashboardSalesChart = new Chart(salesCtx, {
            type: 'bar',
            data: {
                labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'],
                datasets: [{
                    label: 'Tickets Sold',
                    data: [65, 59, 80, 81, 56, 55],
                    backgroundColor: 'rgba(220, 53, 69, 0.6)', // Primary color with opacity
                    borderColor: 'rgba(220, 53, 69, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // Chart 2: Attendee Demographics (Doughnut Chart)
    const demoCtx = document.getElementById('attendeeDemographicsChart');
    if (demoCtx) {
        if (window.dashboardDemoChart) window.dashboardDemoChart.destroy();

        window.dashboardDemoChart = new Chart(demoCtx, {
            type: 'doughnut',
            data: {
                labels: ['18-24', '25-34', '35-44', '45+'],
                datasets: [{
                    label: 'Attendee Age Group',
                    data: [300, 50, 100, 80],
                    backgroundColor: [
                        'rgba(220, 53, 69, 0.8)',
                        'rgba(255, 193, 7, 0.8)',
                        'rgba(13, 110, 253, 0.8)',
                        'rgba(25, 135, 84, 0.8)'
                    ],
                    hoverOffset: 4
                }]
            }
        });
    }

    // Render Guest List (Placeholder)
    const guestListContainer = document.getElementById('analyticsGuestList');
    if (guestListContainer) {
        // Placeholder for guest list rendering
        guestListContainer.innerHTML = '<div class="text-center text-muted small mt-3">No guests loaded.</div>';
    }
}

function setDashboardFilter(filter) {
    dashboardFilter = filter;
    
    // Update UI Tabs
    const tabCurrent = document.getElementById('tabCurrent');
    const tabPast = document.getElementById('tabPast');
    if (tabCurrent && tabPast) {
        if (filter === 'current') {
            tabCurrent.classList.add('active');
            tabCurrent.style.backgroundColor = 'var(--primary)';
            tabCurrent.style.color = '#fff';
            
            tabPast.classList.remove('active');
            tabPast.style.backgroundColor = 'transparent';
            tabPast.style.color = 'var(--text-muted)';
        } else {
            tabPast.classList.add('active');
            tabPast.style.backgroundColor = 'var(--primary)';
            tabPast.style.color = '#fff';

            tabCurrent.classList.remove('active');
            tabCurrent.style.backgroundColor = 'transparent';
            tabCurrent.style.color = 'var(--text-muted)';
        }
    }

    renderEventDropdown();
    
    // Select first event of the filtered list
    const events = getFilteredEvents();
    if (events.length > 0) {
        renderDashboardEvent(events[0].event_id);
    } else {
        clearDashboardView();
    }
}

function getFilteredEvents() {
    const allEvents = MockDB.getEvents();
    if (dashboardFilter === 'current') {
        return allEvents.filter(e => e.status === 'draft' || e.status === 'published');
    } else {
        return allEvents.filter(e => e.status === 'completed' || e.status === 'cancelled');
    }
}

function renderEventDropdown() {
    const events = getFilteredEvents();
    const list = document.getElementById('dashboardEventDropdownList');
    if (!list) return;

    list.innerHTML = '<li><h6 class="dropdown-header">Switch Event</h6></li>';
    if (events.length === 0) {
        list.innerHTML += '<li><span class="dropdown-item text-muted">No events found</span></li>';
        return;
    }

    events.forEach(evt => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.className = 'dropdown-item';
        a.href = '#';
        a.textContent = evt.title;
        a.onclick = (e) => {
            e.preventDefault();
            renderDashboardEvent(evt.event_id);
        };
        li.appendChild(a);
        list.appendChild(li);
    });
}

function renderDashboardEvent(id) {
    const events = MockDB.getEvents();
    const event = events.find(e => e.event_id == id);
    if(!event) return;
    
    // Store current ID for other modules (like Seat Planner)
    localStorage.setItem('seatlify_current_event_id', id);

    // Update Dropdown Label
    const dropdownBtn = document.getElementById('dashboardSelectedEvent');
    if(dropdownBtn) dropdownBtn.textContent = event.title;

    // Update Details
    document.getElementById('dashboardTitle').textContent = event.title;
    
    // Status Badge
    const statusBadge = document.getElementById('dashboardStatusBadge');
    if (statusBadge) {
        statusBadge.textContent = event.status.charAt(0).toUpperCase() + event.status.slice(1);
        let badgeClass = 'bg-secondary';
        if (event.status === 'published') badgeClass = 'bg-success';
        if (event.status === 'draft') badgeClass = 'bg-warning text-dark';
        if (event.status === 'cancelled') badgeClass = 'bg-danger';
        statusBadge.className = `badge ${badgeClass}`;
    }

    document.getElementById('dashboardDescription').textContent = event.description || '';

    const venue = MockDB.getVenueById(event.venue_id);
    document.getElementById('dashboardVenue').innerHTML = `<i class="bi bi-geo-alt me-1"></i> ${venue ? venue.name : 'Unknown Venue'}`;

    // Update Seats Available
    const seatsEl = document.getElementById('dashboardSeatsAvailable');
    if (seatsEl) seatsEl.textContent = event.total_seats || 0;

    // Update Attendees
    const attendeesEl = document.getElementById('dashboardAttendees');
    if (attendeesEl) attendeesEl.textContent = event.attendees || 0;

    // Update Tickets Sold
    const ticketsEl = document.getElementById('dashboardTicketsSold');
    if (ticketsEl) {
        if (event.is_paid) {
            ticketsEl.textContent = "0"; // Placeholder for actual sales
        } else {
            ticketsEl.textContent = "Free";
        }
    }

    // Update Revenue
    const revenueEl = document.getElementById('dashboardRevenue');
    if (revenueEl) {
        if (event.is_paid) {
            revenueEl.textContent = "₱0"; // Placeholder for actual revenue
        } else {
            revenueEl.textContent = "No Revenue";
        }
    }

    // Date & Time
    const start = new Date(event.start_datetime);
    const end = event.end_datetime ? new Date(event.end_datetime) : null;
    
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    document.getElementById('dashboardDateDay').textContent = start.getDate();
    document.getElementById('dashboardDateMonth').textContent = months[start.getMonth()];

    const timeStr = start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + 
                    (end ? ' - ' + end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '');
    document.getElementById('dashboardTime').innerHTML = `<i class="bi bi-clock me-1"></i> ${timeStr}`;

    // Countdown Logic
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Normalize to midnight for accurate day calculation
    const eventDate = new Date(start);
    eventDate.setHours(0, 0, 0, 0);

    const diffTime = eventDate - now;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    const countVal = document.getElementById('dashboardCountdownValue');
    const countTitle = document.getElementById('dashboardCountdownTitle');
    const countSub = document.getElementById('dashboardCountdownSubtext');

    if (countVal) {
        if (diffDays > 0) {
            countVal.textContent = diffDays;
            if (countTitle) countTitle.textContent = "Days Until Event";
            if (countSub) countSub.textContent = "Prepare your checklist!";
        } else if (diffDays === 0) {
            countVal.textContent = "Today";
            if (countTitle) countTitle.textContent = "Event is Happening";
            if (countSub) countSub.textContent = "Good luck!";
        } else {
            countVal.textContent = Math.abs(diffDays);
            if (countTitle) countTitle.textContent = "Days Since Event";
            if (countSub) countSub.textContent = "Event completed.";
        }
    }

    // Draft Action Logic
    const draftAction = document.getElementById('dashboardDraftAction');
    if (draftAction) {
        if (event.status === 'draft') {
            draftAction.style.display = 'block';
            const btnPublish = document.getElementById('btnPublishNow');
            if (btnPublish) {
                // Clone to strip old listeners
                const newBtn = btnPublish.cloneNode(true);
                btnPublish.parentNode.replaceChild(newBtn, btnPublish);
                
                newBtn.addEventListener('click', () => {
                    if (confirm(`Publish "${event.title}" now?`)) {
                        MockDB.updateEvent(event.event_id, { status: 'published' });
                        renderDashboardEvent(event.event_id); // Refresh view
                    }
                });
            }
        } else {
            draftAction.style.display = 'none';
        }
    }

    // Bind Edit/Delete Buttons (Dashboard Card)
    const btnEdit = document.getElementById('btnDashboardEditEvent');
    const btnDelete = document.getElementById('btnDashboardDeleteEvent');
    
    if (btnEdit) {
        const newBtnEdit = btnEdit.cloneNode(true);
        btnEdit.parentNode.replaceChild(newBtnEdit, btnEdit);
        newBtnEdit.addEventListener('click', () => openEditModal(event.event_id));
    }

    if (btnDelete) {
        const newBtnDelete = btnDelete.cloneNode(true);
        btnDelete.parentNode.replaceChild(newBtnDelete, btnDelete);
        newBtnDelete.addEventListener('click', () => {
            if (confirm(`Are you sure you want to delete "${event.title}"?`)) {
                MockDB.deleteEvent(event.event_id);
            }
        });
    }
}

function clearDashboardView() {
    const dropdownBtn = document.getElementById('dashboardSelectedEvent');
    if(dropdownBtn) dropdownBtn.textContent = "No Events Found";

    document.getElementById('dashboardTitle').textContent = "-";
    const statusBadge = document.getElementById('dashboardStatusBadge');
    if(statusBadge) { statusBadge.textContent = ""; statusBadge.className = "badge"; }
    
    document.getElementById('dashboardDescription').textContent = "No events in this category.";
    document.getElementById('dashboardVenue').innerHTML = `<i class="bi bi-geo-alt me-1"></i> -`;
    document.getElementById('dashboardTime').innerHTML = `<i class="bi bi-clock me-1"></i> -`;
    document.getElementById('dashboardDateDay').textContent = "-";
    document.getElementById('dashboardDateMonth').textContent = "-";
    
    document.getElementById('dashboardSeatsAvailable').textContent = "0";
    document.getElementById('dashboardAttendees').textContent = "0";
    document.getElementById('dashboardTicketsSold').textContent = "0";
    document.getElementById('dashboardRevenue').textContent = "₱0";
    
    document.getElementById('dashboardCountdownValue').textContent = "-";
    document.getElementById('dashboardCountdownSubtext').textContent = "-";

    const draftAction = document.getElementById('dashboardDraftAction');
    if(draftAction) draftAction.style.display = 'none';
}

window.simulateScanSuccess = function() {
    const modalEl = document.getElementById('qrScannerModal');
    if(modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if(modal) modal.hide();
    }
    alert("Ticket Scanned Successfully!\nAttendee: John Doe\nSeat: A-12\nStatus: Checked In");
};

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
        // Clone to remove old listeners to prevent stacking
        const newRadioPaid = radioPaid.cloneNode(true);
        const newRadioFree = radioFree.cloneNode(true);
        radioPaid.parentNode.replaceChild(newRadioPaid, radioPaid);
        radioFree.parentNode.replaceChild(newRadioFree, radioFree);

        newRadioPaid.addEventListener('change', () => tiersWrapper.style.display = 'block');
        newRadioFree.addEventListener('change', () => tiersWrapper.style.display = 'none');
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
                    <td class="text-end table-actions" style="border-bottom-color: var(--border-color);">
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

    const today = new Date();
    
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

        // Check if it's today
        const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
        if (isToday) {
            dayNum.style.backgroundColor = 'var(--primary)';
            dayNum.style.color = 'white';
            dayNum.style.width = '28px';
            dayNum.style.height = '28px';
            dayNum.style.borderRadius = '50%';
            dayNum.style.display = 'flex';
            dayNum.style.alignItems = 'center';
            dayNum.style.justifyContent = 'center';
        }

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
    // Set as the globally active event for other modules like seat planner
    localStorage.setItem('seatlify_current_event_id', eventId);

    const event = MockDB.getEvents().find(e => e.event_id == eventId);
    if (!event) return;

    // Initialize Flatpickr for date/time inputs
    if (typeof flatpickr !== 'undefined') {
        flatpickr("#editEventDate", {
            altInput: true,
            altFormat: "F j, Y",
            dateFormat: "Y-m-d",
        });
        flatpickr("#editEventTime", {
            enableTime: true,
            noCalendar: true,
            dateFormat: "H:i",
            time_24hr: false
        });
        flatpickr("#editEventEndTime", {
            enableTime: true,
            noCalendar: true,
            dateFormat: "H:i",
            time_24hr: false
        });
    }

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

    const statusSelect = document.getElementById('editEventStatus');
    if (statusSelect) {
        statusSelect.value = event.status;
    }
    
    document.getElementById('editEventDescription').value = event.description || '';
    document.getElementById('editEventTotalSeats').value = event.total_seats || '';
    document.getElementById('editEventTotalTables').value = event.total_tables || '';
    document.getElementById('editSeatLayout').value = event.layout_preference || 'empty';

    // Ticket Config
    const radioFree = document.getElementById('editTypeFree');
    const radioPaid = document.getElementById('editTypePaid');
    const tiersWrapper = document.getElementById('editTicketTiersWrapper');
    const tiersList = document.getElementById('editTiersList');

    if (event.is_paid) {
        radioPaid.checked = true;
        tiersWrapper.style.display = 'block';
    } else {
        radioFree.checked = true;
        tiersWrapper.style.display = 'none';
    }

    // Populate Tiers
    tiersList.innerHTML = '';
    if (event.tickets && event.tickets.length > 0) {
        event.tickets.forEach(ticket => {
            addEditTierRow(ticket);
        });
    }

    // Show Modal
    const modalEl = document.getElementById('editEventModal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

function addEditTierRow(ticket = null) {
    const list = document.getElementById('editTiersList');
    const row = document.createElement('div');
    row.className = 'row g-2 mb-2 tier-row';
    
    const nameVal = ticket ? ticket.name : '';
    const priceVal = ticket ? ticket.price : '';
    const qtyVal = ticket ? ticket.qty : '';

    row.innerHTML = `
        <div class="col-5">
            <input type="text" class="form-control form-control-sm tier-name" placeholder="Tier Name" value="${nameVal}" style="background-color: var(--bg-panel); border-color: var(--border-color); color: var(--text-main);">
        </div>
        <div class="col-3">
            <input type="number" class="form-control form-control-sm tier-price" placeholder="Price" value="${priceVal}" style="background-color: var(--bg-panel); border-color: var(--border-color); color: var(--text-main);">
        </div>
        <div class="col-4">
            <div class="input-group input-group-sm">
                <input type="number" class="form-control tier-qty" placeholder="Qty" value="${qtyVal}" style="background-color: var(--bg-panel); border-color: var(--border-color); color: var(--text-main);">
                <button type="button" class="btn btn-outline-danger btn-remove-tier"><i class="bi bi-x"></i></button>
            </div>
        </div>
    `;

    row.querySelector('.btn-remove-tier').addEventListener('click', () => row.remove());
    list.appendChild(row);
}

function saveEventChanges() {
    const id = document.getElementById('editEventId').value;
    const name = document.getElementById('editEventName').value;
    const date = document.getElementById('editEventDate').value;
    const time = document.getElementById('editEventTime').value;
    const endTime = document.getElementById('editEventEndTime').value;
    const venueId = document.getElementById('editEventVenue').value;
    const statusSelect = document.getElementById('editEventStatus');
    const desc = document.getElementById('editEventDescription').value;
    const totalSeats = document.getElementById('editEventTotalSeats').value;
    const totalTables = document.getElementById('editEventTotalTables').value;
    const layout = document.getElementById('editSeatLayout').value;
    
    const isPaid = document.getElementById('editTypePaid').checked;
    let tickets = [];
    if (isPaid) {
        document.querySelectorAll('#editTiersList .tier-row').forEach(row => {
            const tName = row.querySelector('.tier-name').value;
            const tPrice = row.querySelector('.tier-price').value;
            const tQty = row.querySelector('.tier-qty').value;
            if (tName) tickets.push({ name: tName, price: tPrice, qty: tQty });
        });
    }

    const updateData = {
        title: name,
        start_datetime: `${date}T${time}`,
        end_datetime: endTime ? `${date}T${endTime}` : null,
        venue_id: venueId,
        description: desc,
        total_seats: totalSeats,
        total_tables: totalTables,
        layout_preference: layout,
        is_paid: isPaid,
        tickets: tickets
    };

    if (statusSelect) {
        updateData.status = statusSelect.value;
    }

    MockDB.updateEvent(id, updateData);
    
    // Hide Modal
    const modalEl = document.getElementById('editEventModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();
    renderEventView();
}

// Expose functions globally for Dashboard usage
window.openEditModal = openEditModal;
window.saveEventChanges = saveEventChanges;
