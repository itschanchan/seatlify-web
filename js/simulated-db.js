/* ==========================================================
   SIMULATED DATABASE (LOCALSTORAGE)
   Schema: Venues, Events
========================================================== */
const MockDB = {
    init: function() {
        // 📍 VENUES
        if (!localStorage.getItem('seatlify_venues')) {
            const venues = [
                { venue_id: 1, name: "Grand Auditorium", address: "123 Main St", city: "Metropolis", province: "Metro", capacity: 500 },
                { venue_id: 2, name: "City Center Hall", address: "456 Center Ave", city: "Metropolis", province: "Metro", capacity: 200 },
                { venue_id: 3, name: "Open Grounds", address: "789 Park Ln", city: "Metropolis", province: "Metro", capacity: 1000 }
            ];
            localStorage.setItem('seatlify_venues', JSON.stringify(venues));
        }

        // 🎉 EVENTS
        if (!localStorage.getItem('seatlify_events')) {
            const events = [];
            localStorage.setItem('seatlify_events', JSON.stringify(events));
        }
    },

    getVenues: () => JSON.parse(localStorage.getItem('seatlify_venues') || '[]'),
    
    getVenueById: (id) => {
        const venues = JSON.parse(localStorage.getItem('seatlify_venues') || '[]');
        return venues.find(v => v.venue_id == id);
    },

    getEvents: () => {
        const events = JSON.parse(localStorage.getItem('seatlify_events') || '[]');
        const now = new Date();
        let updated = false;

        events.forEach(event => {
            const endDate = event.end_datetime ? new Date(event.end_datetime) : new Date(event.start_datetime);
            if (endDate < now && event.status !== 'completed' && event.status !== 'cancelled') {
                event.status = 'completed';
                updated = true;
            }
        });

        if (updated) {
            localStorage.setItem('seatlify_events', JSON.stringify(events));
        }
        return events;
    },

    addEvent: (eventData) => {
        const events = MockDB.getEvents();
        const newEvent = {
            event_id: Date.now(), // Simulate Auto Increment
            organization_id: 1,   // Default
            created_by: 1,        // Default
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            status: 'draft',
            ...eventData
        };
        events.push(newEvent);
        localStorage.setItem('seatlify_events', JSON.stringify(events));
        
        // Dispatch event so other components can update
        window.dispatchEvent(new CustomEvent('db-events-updated'));
        return newEvent;
    },

    updateEvent: (id, data) => {
        const events = MockDB.getEvents();
        const index = events.findIndex(e => e.event_id == id);
        if (index !== -1) {
            events[index] = { ...events[index], ...data };
            localStorage.setItem('seatlify_events', JSON.stringify(events));
            window.dispatchEvent(new CustomEvent('db-events-updated'));
        }
    },

    deleteEvent: (id) => {
        let events = MockDB.getEvents();
        const initialLength = events.length;
        events = events.filter(e => e.event_id != id);
        if (events.length !== initialLength) {
            localStorage.setItem('seatlify_events', JSON.stringify(events));
            window.dispatchEvent(new CustomEvent('db-events-updated'));
        }
    }
};

// Initialize on load
MockDB.init();

// Global Helper to handle the Create Event Modal logic
window.openCreateEventModal = async function() {
    const container = document.getElementById('createEventModalContainer');
    
    // Load HTML if not present
    if (!container.innerHTML.trim()) {
        const res = await fetch('create-new-event.html');
        container.innerHTML = await res.text();
    }

    const modalEl = document.getElementById('createEventModal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    // Populate Venues Dropdown
    const venueSelect = document.getElementById('eventVenue');
    if (venueSelect) {
        venueSelect.innerHTML = '<option selected disabled value="">Select Venue</option>';
        const venues = MockDB.getVenues();
        venues.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.venue_id;
            opt.textContent = v.name;
            venueSelect.appendChild(opt);
        });
    }

    // --- WIZARD LOGIC ---
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');
    const btnNext = document.getElementById('btnNext');
    const btnBack = document.getElementById('btnBack');
    const btnCreate = document.getElementById('btnCreate');
    const btnCancel = document.getElementById('btnCancel');

    // Reset State
    step1.style.display = 'block';
    step2.style.display = 'none';
    if(step3) step3.style.display = 'none';
    btnNext.style.display = 'inline-block';
    btnCreate.style.display = 'none';
    btnBack.style.display = 'none';
    btnCancel.style.display = 'inline-block';

    // Helper to replace node to strip old listeners
    const replaceBtn = (btn) => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        return newBtn;
    };

    const newBtnNext = replaceBtn(btnNext);
    const newBtnBack = replaceBtn(btnBack);
    const newBtnCreate = replaceBtn(btnCreate);

    // --- TICKET LOGIC ---
    // Replace elements to strip old listeners if modal is reused
    const replaceEl = (id) => {
        const el = document.getElementById(id);
        if(!el) return null;
        const newEl = el.cloneNode(true);
        el.parentNode.replaceChild(newEl, el);
        return newEl;
    };

    const newTypeFree = replaceEl('typeFree');
    const newTypePaid = replaceEl('typePaid');
    const newAddTierBtn = replaceEl('addTierBtn');
    const tiersContainer = document.getElementById('ticketTiersContainer');

    const toggleTiers = () => {
        if(newTypePaid && newTypePaid.checked) tiersContainer.style.display = 'block';
        else tiersContainer.style.display = 'none';
    };

    if(newTypeFree && newTypePaid) {
        newTypeFree.addEventListener('change', toggleTiers);
        newTypePaid.addEventListener('change', toggleTiers);
        toggleTiers(); // Init state
    }

    if(newAddTierBtn) {
        newAddTierBtn.addEventListener('click', () => {
            const list = document.getElementById('tiersList');
            const row = document.createElement('div');
            row.className = 'row g-2 mb-2 tier-row';
            row.innerHTML = `
                <div class="col-5">
                    <input type="text" class="form-control form-control-sm tier-name" placeholder="Tier Name" style="background-color: var(--bg-panel); border-color: var(--border-color); color: var(--text-main);">
                </div>
                <div class="col-3">
                    <input type="number" class="form-control form-control-sm tier-price" placeholder="Price" style="background-color: var(--bg-panel); border-color: var(--border-color); color: var(--text-main);">
                </div>
                <div class="col-4">
                    <input type="number" class="form-control form-control-sm tier-qty" placeholder="Qty" style="background-color: var(--bg-panel); border-color: var(--border-color); color: var(--text-main);">
                </div>
            `;
            list.appendChild(row);
        });
    }

    // Next Button Click
    newBtnNext.addEventListener('click', () => {
        if (step1.style.display !== 'none') {
            const title = document.getElementById('eventName').value;
            const date = document.getElementById('eventDate').value;
            const startTime = document.getElementById('eventTime').value;
            const venueId = document.getElementById('eventVenue').value;

            if(!title || !date || !startTime || !venueId) {
                alert("Please fill in required fields (Name, Date, Time, Venue).");
                return;
            }

            // Go to Step 2
            step1.style.display = 'none';
            step2.style.display = 'block';
            newBtnBack.style.display = 'inline-block';
            btnCancel.style.display = 'none';
        } else if (step2.style.display !== 'none') {
            // Go to Step 3
            step2.style.display = 'none';
            step3.style.display = 'block';
            newBtnNext.style.display = 'none';
            newBtnCreate.style.display = 'inline-block';
        }
    });

    // Back Button Click
    newBtnBack.addEventListener('click', () => {
        if (step2.style.display !== 'none') {
            step2.style.display = 'none';
            step1.style.display = 'block';
            newBtnBack.style.display = 'none';
            btnCancel.style.display = 'inline-block';
        } else if (step3.style.display !== 'none') {
            step3.style.display = 'none';
            step2.style.display = 'block';
            newBtnNext.style.display = 'inline-block';
            newBtnCreate.style.display = 'none';
        }
    });

    // Create Button Click
    newBtnCreate.addEventListener('click', () => {
        const title = document.getElementById('eventName').value;
        const date = document.getElementById('eventDate').value;
        const startTime = document.getElementById('eventTime').value;
        const endTime = document.getElementById('eventEndTime').value;
        const venueId = document.getElementById('eventVenue').value;
        const attendees = document.getElementById('eventAttendees').value;
        const desc = document.getElementById('eventDescription').value;
        const layout = document.getElementById('seatLayout').value;
        const totalSeats = document.getElementById('eventTotalSeats').value;
        const totalTables = document.getElementById('eventTotalTables').value;

        // Ticket Data
        const isPaid = document.getElementById('typePaid').checked;
        let tickets = [];
        if (isPaid) {
            document.querySelectorAll('.tier-row').forEach(row => {
                const name = row.querySelector('.tier-name').value;
                const price = row.querySelector('.tier-price').value;
                const qty = row.querySelector('.tier-qty').value;
                if(name) tickets.push({ name, price, qty });
            });
        }

        MockDB.addEvent({
            title: title,
            venue_id: venueId,
            description: desc,
            start_datetime: `${date}T${startTime}`,
            end_datetime: endTime ? `${date}T${endTime}` : null,
            attendees: attendees,
            layout_preference: layout,
            total_seats: totalSeats,
            total_tables: totalTables,
            is_paid: isPaid,
            tickets: tickets
        });

        modal.hide();
        
        // Reset form
        document.querySelector('#createEventModal form').reset();
    });
};