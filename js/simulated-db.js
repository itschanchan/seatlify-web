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

        // 🔔 NOTIFICATIONS
        if (!localStorage.getItem('seatlify_notifications')) {
            localStorage.setItem('seatlify_notifications', JSON.stringify([]));
        }

        // Listen for cross-tab updates (Real-time sync)
        window.addEventListener('storage', (e) => {
            if (e.key === 'seatlify_events') {
                window.dispatchEvent(new CustomEvent('db-events-updated'));
            }
            if (e.key === 'seatlify_notifications') {
                window.dispatchEvent(new CustomEvent('db-notifications-updated'));
            }
        });
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
            checked_in_count: 0,
            sold: 0,
            reservations: [],
            ...eventData
        };
        events.push(newEvent);
        localStorage.setItem('seatlify_events', JSON.stringify(events));
        
        MockDB.addNotification({
            message: `New event created: "${newEvent.title}"`,
            type: 'event_created',
            event_id: newEvent.event_id
        });
        
        // Dispatch event so other components can update
        window.dispatchEvent(new CustomEvent('db-events-updated'));
        return newEvent;
    },

    updateEvent: (id, data) => {
        const events = MockDB.getEvents();
        const index = events.findIndex(e => e.event_id == id);
        if (index !== -1) {
            const oldStatus = events[index].status;
            events[index] = { ...events[index], ...data };
            const newStatus = events[index].status;
            const eventTitle = events[index].title;

            if (newStatus !== oldStatus) {
                if (newStatus === 'published') {
                    MockDB.addNotification({ message: `Event published: "${eventTitle}"`, type: 'event_published', event_id: id });
                } else if (newStatus === 'cancelled') {
                    MockDB.addNotification({ message: `Event cancelled: "${eventTitle}"`, type: 'event_cancelled', event_id: id });
                }
            }

            localStorage.setItem('seatlify_events', JSON.stringify(events));
            window.dispatchEvent(new CustomEvent('db-events-updated'));
        }
    },

    deleteEvent: (id) => {
        let events = MockDB.getEvents();
        const eventToDelete = events.find(e => e.event_id == id);
        const initialLength = events.length;
        events = events.filter(e => e.event_id != id);
        if (events.length !== initialLength) {
            if (eventToDelete) {
                MockDB.addNotification({
                    message: `Event deleted: "${eventToDelete.title}"`,
                    type: 'event_deleted'
                });
            }
            localStorage.setItem('seatlify_events', JSON.stringify(events));
            window.dispatchEvent(new CustomEvent('db-events-updated'));
        }
    },

    checkInAttendee: (id) => {
        const events = MockDB.getEvents();
        const index = events.findIndex(e => e.event_id == id);
        if (index !== -1) {
            const event = events[index];
            let capacity = 0;
            if (event.is_paid) {
                capacity = (event.tickets || []).reduce((sum, tier) => sum + parseInt(tier.qty || 0), 0);
            } else {
                capacity = parseInt(event.total_seats || 0);
            }
            
            if ((event.checked_in_count || 0) < capacity) {
                events[index].checked_in_count = (events[index].checked_in_count || 0) + 1;
                localStorage.setItem('seatlify_events', JSON.stringify(events));
                window.dispatchEvent(new CustomEvent('db-events-updated'));
                return { success: true, checkedIn: events[index].checked_in_count };
            } else {
                return { success: false, message: 'All attendees have been checked in.' };
            }
        }
    },

    // --- NOTIFICATION SYSTEM ---
    getNotifications: () => JSON.parse(localStorage.getItem('seatlify_notifications') || '[]'),

    getUnreadNotifications: () => {
        const notifications = MockDB.getNotifications();
        return notifications.filter(n => !n.read).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    },

    addNotification: (data) => {
        const notifications = MockDB.getNotifications();
        const newNotification = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            read: false,
            ...data
        };
        notifications.push(newNotification);
        localStorage.setItem('seatlify_notifications', JSON.stringify(notifications));
        window.dispatchEvent(new CustomEvent('db-notifications-updated'));
    },

    markAllNotificationsAsRead: () => {
        let notifications = MockDB.getNotifications();
        notifications.forEach(n => n.read = true);
        localStorage.setItem('seatlify_notifications', JSON.stringify(notifications));
        window.dispatchEvent(new CustomEvent('db-notifications-updated'));
    },

    sellTicket: (id, quantity = 1) => {
        const events = MockDB.getEvents();
        const index = events.findIndex(e => e.event_id == id);
        if (index !== -1) {
            const event = events[index];
            const totalCapacity = parseInt(event.total_seats) || 0;
            const currentSold = event.sold || 0;

            if (currentSold + quantity <= totalCapacity) {
                events[index].sold = currentSold + quantity;
                
                // Add Sample Guest(s)
                if (!events[index].guests) events[index].guests = [];
                for(let i=0; i<quantity; i++) {
                    const guestId = Date.now() + Math.floor(Math.random() * 1000) + i;
                    events[index].guests.push({
                        id: guestId,
                        name: `Guest ${guestId.toString().slice(-4)}`,
                        email: `guest${guestId}@example.com`,
                        ticket_type: 'Standard',
                        timestamp: new Date().toISOString()
                    });
                }

                localStorage.setItem('seatlify_events', JSON.stringify(events));
                
                const message = quantity > 1 
                    ? `${quantity} tickets were reserved for "${event.title}"`
                    : `A ticket was reserved for "${event.title}"`;

                MockDB.addNotification({ message: message, type: 'ticket_sold', event_id: id });
                window.dispatchEvent(new CustomEvent('db-events-updated'));
                return { success: true, sold: events[index].sold };
            } else {
                return { success: false, message: 'Not enough seats available.' };
            }
        }
        return { success: false, message: 'Event not found.' };
    },

    reserveSeat: (eventId, seatRow, seatColumn, guestInfo = {}) => {
        const events = MockDB.getEvents();
        const index = events.findIndex(e => e.event_id == eventId);
        if (index !== -1) {
            const event = events[index];
            if (!event.reservations) {
                event.reservations = [];
            }
            // Check if already reserved to prevent duplicates
            const alreadyReserved = event.reservations.some(
                r => r.row === seatRow && r.column == seatColumn
            );
            if (!alreadyReserved) {
                // 1. Add Reservation
                event.reservations.push({ row: seatRow, column: seatColumn, ...guestInfo });
                
                // 2. Update Stats (Sold & Checked-in per request)
                event.sold = (event.sold || 0) + 1;

                // 3. Add to Guest List
                if (!event.guests) event.guests = [];
                event.guests.push({
                    id: Date.now(),
                    name: guestInfo.name || 'Guest',
                    email: guestInfo.email || '',
                    seat_row: seatRow,
                    seat_col: seatColumn,
                    timestamp: new Date().toISOString()
                });

                localStorage.setItem('seatlify_events', JSON.stringify(events));
                window.dispatchEvent(new CustomEvent('db-events-updated'));
                return { success: true };
            } else {
                return { success: false, message: 'Seat already reserved.' };
            }
        }
        return { success: false, message: 'Event not found.' };
    },

    isSeatReserved: (eventId, seatRow, seatColumn) => {
        return MockDB.getEvents().find(e => e.event_id == eventId)?.reservations?.some(r => r.row === seatRow && r.column == seatColumn) || false;
    },

    unreserveSeat: (eventId, seatRow, seatColumn) => {
        const events = MockDB.getEvents();
        const index = events.findIndex(e => e.event_id == eventId);
        if (index !== -1) {
            const event = events[index];
            let changed = false;

            // 1. Remove from reservations array
            if (event.reservations) {
                const initialLen = event.reservations.length;
                event.reservations = event.reservations.filter(r => !(r.row === seatRow && r.column == seatColumn));
                if (event.reservations.length < initialLen) {
                    changed = true;
                }
            }

            // 2. Remove from guests array and update counts
            if (event.guests) {
                const initialLen = event.guests.length;
                event.guests = event.guests.filter(g => !(g.seat_row === seatRow && g.seat_col == seatColumn));
                const numRemoved = initialLen - event.guests.length;

                if (numRemoved > 0) {
                    changed = true;
                    event.sold = Math.max(0, event.sold - numRemoved);
                }
            }
            
            if (changed) {
                localStorage.setItem('seatlify_events', JSON.stringify(events));
                window.dispatchEvent(new CustomEvent('db-events-updated'));
                return { success: true };
            }
        }
        return { success: false, message: 'Event or reservation not found.' };
    },

    deleteGuest: (eventId, guestId) => {
        const events = MockDB.getEvents();
        const index = events.findIndex(e => e.event_id == eventId);
        if (index !== -1) {
            const event = events[index];
            if (event.guests) {
                const guest = event.guests.find(g => g.id == guestId);
                if (guest) {
                    event.guests = event.guests.filter(g => g.id != guestId);
                    event.sold = Math.max(0, (event.sold || 0) - 1);

                    // If guest had a reserved seat, remove reservation and decrement check-in
                    if (guest.seat_row && guest.seat_col) {
                        if (event.reservations) {
                            event.reservations = event.reservations.filter(r => !(r.row === guest.seat_row && r.column == guest.seat_col));
                        }
                    }

                    localStorage.setItem('seatlify_events', JSON.stringify(events));
                    window.dispatchEvent(new CustomEvent('db-events-updated'));
                }
            }
        }
    },

    resetSales: (eventId) => {
        const events = MockDB.getEvents();
        const index = events.findIndex(e => e.event_id == eventId);
        if (index !== -1) {
            events[index].sold = 0;
            events[index].guests = [];
            events[index].checked_in_count = 0;
            events[index].reservations = [];
            localStorage.setItem('seatlify_events', JSON.stringify(events));
            
            MockDB.addNotification({
                message: `Sales and guest data have been reset for "${events[index].title}".`,
                type: 'event_deleted' // using a generic icon
            });

            window.dispatchEvent(new CustomEvent('db-events-updated'));
        }
    },

    // --- API UTILITIES ---
    sendTicketEmail: (email, ticketData) => {
        // This now calls our backend endpoint to securely send the email
        return fetch('../backend/send_email.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                to: email,
                eventTitle: ticketData.event,
                eventDate: ticketData.date
            })
        }).then(response => response.json());
    },
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

        // Convert Venue Select to Text Input dynamically
        const venueSelect = document.getElementById('eventVenue');
        if (venueSelect && venueSelect.tagName === 'SELECT') {
            const input = document.createElement('input');
            input.type = 'text';
            input.id = 'eventVenue';
            input.className = 'form-control';
            input.placeholder = 'Enter venue name';
            venueSelect.parentNode.replaceChild(input, venueSelect);
        }
    }

    const modalEl = document.getElementById('createEventModal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    // Initialize Flatpickr for date/time inputs
    if (typeof flatpickr !== 'undefined') {
        flatpickr("#eventDate", {
            altInput: true,
            altFormat: "F j, Y",
            dateFormat: "Y-m-d",
        });
        flatpickr("#eventTime", {
            enableTime: true,
            noCalendar: true,
            dateFormat: "H:i",
            time_24hr: false
        });
        flatpickr("#eventEndTime", {
            enableTime: true,
            noCalendar: true,
            dateFormat: "H:i",
            time_24hr: false
        });
    }

    // Populate Venues Dropdown
    // This is no longer needed as the venue field is a text input.
    // The user must change the <select> to <input type="text"> in create-new-event.html.

    // --- WIZARD LOGIC ---
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');
    const btnNext = document.getElementById('btnNext');
    const btnBack = document.getElementById('btnBack');
    const btnCreate = document.getElementById('btnCreate');
    const btnCancel = document.getElementById('btnCancel');

    // --- SEAT COUNTER LOGIC ---
    const updateTierSeatCounter = () => {
        const totalSeatsInput = document.getElementById('eventTotalSeats');
        const counterEl = document.getElementById('tierSeatCounter');
        if (!totalSeatsInput || !counterEl) return;

        const totalSeats = parseInt(totalSeatsInput.value) || 0;
        let allocatedSeats = 0;
        document.querySelectorAll('#tiersList .tier-qty').forEach(input => {
            allocatedSeats += parseInt(input.value) || 0;
        });

        counterEl.textContent = `Allocated: ${allocatedSeats} / ${totalSeats}`;
        if (allocatedSeats > totalSeats) {
            counterEl.classList.add('text-danger');
            counterEl.classList.remove('text-muted');
        } else {
            counterEl.classList.remove('text-danger');
            counterEl.classList.add('text-muted');
        }
    };

    // Stepper Logic
    const updateStepper = (step) => {
        const progress = document.getElementById('stepperProgress');
        const ind2 = document.getElementById('stepIndicator2')?.querySelector('.step-circle');
        const ind3 = document.getElementById('stepIndicator3')?.querySelector('.step-circle');

        if (!progress || !ind2 || !ind3) return;

        // Reset
        ind2.classList.remove('bg-primary');
        ind2.classList.add('bg-secondary');
        ind3.classList.remove('bg-primary');
        ind3.classList.add('bg-secondary');

        if (step === 1) {
            progress.style.width = '0%';
        } else if (step === 2) {
            ind2.classList.remove('bg-secondary');
            ind2.classList.add('bg-primary');
            progress.style.width = '50%';
        } else if (step === 3) {
            ind2.classList.remove('bg-secondary');
            ind2.classList.add('bg-primary');
            ind3.classList.remove('bg-secondary');
            ind3.classList.add('bg-primary');
            progress.style.width = '100%';
        }
    };

    // Reset State
    step1.style.display = 'block';
    step2.style.display = 'none';
    if(step3) step3.style.display = 'none';
    updateStepper(1);
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

    // Add listener for seat total changes
    const totalSeatsInputForCounter = document.getElementById('eventTotalSeats');
    if (totalSeatsInputForCounter) {
        totalSeatsInputForCounter.addEventListener('input', updateTierSeatCounter);
    }

    const toggleTiers = () => {
        if(newTypePaid && newTypePaid.checked) {
            tiersContainer.style.display = 'block';
            updateTierSeatCounter(); // Update when shown
        } else {
            tiersContainer.style.display = 'none';
        }
    };

    if(newTypeFree && newTypePaid) {
        newTypeFree.addEventListener('change', toggleTiers);
        newTypePaid.addEventListener('change', toggleTiers);
        toggleTiers(); // Init state
    }

    if(newAddTierBtn) {
        const list = document.getElementById('tiersList');
        
        // Helper to generate row content
        const getRowContent = (index) => `
            <div class="col-1 text-center">
                <span class="text-muted small fw-bold">#${index}</span>
            </div>
            <div class="col-4">
                <input type="text" class="form-control form-control-sm tier-name" placeholder="Tier Name" style="background-color: var(--bg-panel); border-color: var(--border-color); color: var(--text-main);">
            </div>
            <div class="col-3">
                <input type="number" class="form-control form-control-sm tier-price" placeholder="Price" style="background-color: var(--bg-panel); border-color: var(--border-color); color: var(--text-main);">
            </div>
            <div class="col-4">
                <input type="number" class="form-control form-control-sm tier-qty" placeholder="Qty" style="background-color: var(--bg-panel); border-color: var(--border-color); color: var(--text-main);">
            </div>
        `;

        // Fix initial static row if it lacks the number
        const firstRow = list.querySelector('.tier-row');
        if (firstRow && !firstRow.querySelector('.col-1')) {
            firstRow.className = 'row g-2 mb-2 tier-row align-items-center';
            firstRow.innerHTML = getRowContent(1);
        }

        newAddTierBtn.addEventListener('click', () => {
            const rowCount = list.querySelectorAll('.tier-row').length + 1;
            const row = document.createElement('div');
            row.className = 'row g-2 mb-2 tier-row align-items-center';
            row.innerHTML = getRowContent(rowCount);
            list.appendChild(row);
        });

        // Add event listener for quantity changes using delegation
        list.addEventListener('input', (e) => {
            if (e.target.classList.contains('tier-qty')) {
                updateTierSeatCounter();
            }
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
            updateStepper(2);
            newBtnBack.style.display = 'inline-block';
            btnCancel.style.display = 'none';
        } else if (step2.style.display !== 'none') {
            // Go to Step 3
            step2.style.display = 'none';
            step3.style.display = 'block';
            updateStepper(3);
            newBtnNext.style.display = 'none';
            newBtnCreate.style.display = 'inline-block';
            updateTierSeatCounter();
        }
    });

    // Back Button Click
    newBtnBack.addEventListener('click', () => {
        if (step2.style.display !== 'none') {
            step2.style.display = 'none';
            step1.style.display = 'block';
            updateStepper(1);
            newBtnBack.style.display = 'none';
            btnCancel.style.display = 'inline-block';
        } else if (step3.style.display !== 'none') {
            step3.style.display = 'none';
            step2.style.display = 'block';
            updateStepper(2);
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
        const venueName = document.getElementById('eventVenue').value;
        const attendees = document.getElementById('eventAttendees').value;
        const desc = document.getElementById('eventDescription').value;
        const layout = document.getElementById('seatLayout').value;
        const totalSeats = document.getElementById('eventTotalSeats').value;
        const totalTables = document.getElementById('eventTotalTables').value;

        // Ticket Data
        const isPaid = document.getElementById('typePaid').checked;
        let tickets = [];
        let rowLayoutData = [];

        if (isPaid) {
            document.querySelectorAll('.tier-row').forEach(row => {
                const name = row.querySelector('.tier-name').value;
                const price = row.querySelector('.tier-price').value;
                const qty = row.querySelector('.tier-qty').value;
                if(name) {
                    tickets.push({ name, original_name: name, price, qty });
                    rowLayoutData.push({ label: name, seats: parseInt(qty) || 0 });
                }
            });

            const totalTicketQty = tickets.reduce((sum, t) => sum + parseInt(t.qty || 0), 0);
            if (parseInt(totalSeats) !== totalTicketQty) {
                alert(`Total ticket quantity (${totalTicketQty}) must equal Total Seats (${totalSeats}).`);
                return;
            }
        }

        // Find venue ID from name for compatibility
        const venues = MockDB.getVenues();
        const venue = venues.find(v => v.name.toLowerCase() === venueName.toLowerCase());
        const venueId = venue ? venue.venue_id : null;

        MockDB.addEvent({
            title: title,
            venue_id: venueId, // Save ID if found
            venue_name: venueName, // Always save the name
            description: desc,
            start_datetime: `${date}T${startTime}`,
            end_datetime: endTime ? `${date}T${endTime}` : null,
            attendees: attendees,
            layout_preference: layout,
            total_seats: totalSeats,
            total_tables: totalTables,
            is_paid: isPaid,
            tickets: tickets,
            row_layout_data: rowLayoutData
        });

        modal.hide();
        
        // Reset form
        document.querySelector('#createEventModal form').reset();
    });
};