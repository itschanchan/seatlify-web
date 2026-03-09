/* ==========================================================
   MOCK DATABASE  (LocalStorage)
   Responsibility: Data access and persistence ONLY.
   Schema: Venues, Events, Notifications, Reservations, Guests
   ─────────────────────────────────────────────────────────
   No UI, no form logic, no DOM manipulation.
========================================================== */
const MockDB = {
    _notifications: [],

    // ─── Internal helpers ────────────────────────────────

    /** Generates a unique 12-digit guest/transaction ID.
     *  Format: 9 timestamp digits (ms precision) + 3 random digits */
    _generateGuestId: () => {
        const ts   = (Date.now() % 1_000_000_000).toString().padStart(9, '0');
        const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        return parseInt(ts + rand);
    },

    // ─── Initialisation ──────────────────────────────────

    init: function () {
        // Seed venues if absent
        if (!localStorage.getItem('seatlify_venues')) {
            const venues = [
                { venue_id: 1, name: 'Grand Auditorium', address: '123 Main St',    city: 'Metropolis', province: 'Metro', capacity: 500  },
                { venue_id: 2, name: 'City Center Hall', address: '456 Center Ave', city: 'Metropolis', province: 'Metro', capacity: 200  },
                { venue_id: 3, name: 'Open Grounds',     address: '789 Park Ln',    city: 'Metropolis', province: 'Metro', capacity: 1000 }
            ];
            localStorage.setItem('seatlify_venues', JSON.stringify(venues));
        }

        // Seed events if absent
        if (!localStorage.getItem('seatlify_events')) {
            localStorage.setItem('seatlify_events', JSON.stringify([]));
        }

        // Cross-tab real-time sync
        window.addEventListener('storage', (e) => {
            if (e.key === 'seatlify_events')        window.dispatchEvent(new CustomEvent('db-events-updated'));
            if (e.key === 'seatlify_notifications') window.dispatchEvent(new CustomEvent('db-notifications-updated'));
        });
    },

    // ─── Venues ──────────────────────────────────────────

    getVenues: () => JSON.parse(localStorage.getItem('seatlify_venues') || '[]'),

    getVenueById: (id) => {
        return JSON.parse(localStorage.getItem('seatlify_venues') || '[]')
            .find(v => v.venue_id == id);
    },

    // ─── Events ──────────────────────────────────────────

    getEvents: () => {
        const events = JSON.parse(localStorage.getItem('seatlify_events') || '[]');
        const now    = new Date();
        let updated  = false;

        events.forEach(event => {
            const endDate = event.end_datetime
                ? new Date(event.end_datetime)
                : new Date(event.start_datetime);
            if (endDate < now && event.status !== 'completed' && event.status !== 'cancelled') {
                event.status = 'completed';
                updated = true;
            }
        });

        if (updated) localStorage.setItem('seatlify_events', JSON.stringify(events));
        return events;
    },

    addEvent: (eventData) => {
        const events   = MockDB.getEvents();
        const newEvent = {
            event_id:       Date.now(),
            organization_id: 1,
            created_by:     1,
            created_at:     new Date().toISOString(),
            updated_at:     new Date().toISOString(),
            status:         'draft',
            checked_in_count: 0,
            sold:           0,
            reservations:   [],
            ...eventData
        };
        events.push(newEvent);
        localStorage.setItem('seatlify_events', JSON.stringify(events));
        MockDB.addNotification({ message: `New event created: "${newEvent.title}"`, type: 'event_created', event_id: newEvent.event_id });
        window.dispatchEvent(new CustomEvent('db-events-updated'));
        return newEvent;
    },

    updateEvent: (id, data) => {
        const events = MockDB.getEvents();
        const index  = events.findIndex(e => e.event_id == id);
        if (index === -1) return;

        const oldStatus  = events[index].status;
        events[index]    = { ...events[index], ...data };
        const newStatus  = events[index].status;
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
    },

    deleteEvent: (id) => {
        let events        = MockDB.getEvents();
        const toDelete    = events.find(e => e.event_id == id);
        const initialLen  = events.length;
        events            = events.filter(e => e.event_id != id);

        if (events.length !== initialLen) {
            if (toDelete) {
                MockDB.addNotification({ message: `Event deleted: "${toDelete.title}"`, type: 'event_deleted' });
            }
            localStorage.setItem('seatlify_events', JSON.stringify(events));
            window.dispatchEvent(new CustomEvent('db-events-updated'));
        }
    },

    // ─── Guests & Check-in ───────────────────────────────

    checkInGuest: (eventId, guestId) => {
        const events     = MockDB.getEvents();
        const eventIndex = events.findIndex(e => e.event_id == eventId);
        if (eventIndex === -1) return { success: false, message: 'Event not found.' };

        const event = events[eventIndex];
        if (!event.guests || event.guests.length === 0)
            return { success: false, message: 'No guests found for this event.' };

        const guestIndex = event.guests.findIndex(g => g.id == guestId);
        if (guestIndex === -1) return { success: false, message: 'Guest not found.' };

        if (events[eventIndex].guests[guestIndex].checked_in)
            return { success: false, message: `Guest '${events[eventIndex].guests[guestIndex].name}' is already checked in.` };

        events[eventIndex].guests[guestIndex].checked_in           = true;
        events[eventIndex].guests[guestIndex].checked_in_timestamp = new Date().toISOString();
        events[eventIndex].checked_in_count = (events[eventIndex].checked_in_count || 0) + 1;

        localStorage.setItem('seatlify_events', JSON.stringify(events));
        window.dispatchEvent(new CustomEvent('db-events-updated'));
        return { success: true, message: `Guest '${events[eventIndex].guests[guestIndex].name}' checked in successfully.` };
    },

    checkInAttendee: (id) => {
        const events = MockDB.getEvents();
        const index  = events.findIndex(e => e.event_id == id);
        if (index === -1) return;

        const event    = events[index];
        const capacity = event.is_paid
            ? (event.tickets || []).reduce((sum, tier) => sum + parseInt(tier.qty || 0), 0)
            : parseInt(event.total_seats || 0);

        if ((event.checked_in_count || 0) < capacity) {
            events[index].checked_in_count = (events[index].checked_in_count || 0) + 1;
            localStorage.setItem('seatlify_events', JSON.stringify(events));
            window.dispatchEvent(new CustomEvent('db-events-updated'));
            return { success: true, checkedIn: events[index].checked_in_count };
        }
        return { success: false, message: 'All attendees have been checked in.' };
    },

    deleteGuest: (eventId, guestId) => {
        const events = MockDB.getEvents();
        const index  = events.findIndex(e => e.event_id == eventId);
        if (index !== -1) {
            const event = events[index];
            if (event.guests) {
                const guest = event.guests.find(g => g.id == guestId);
                if (guest) {
                    if (guest.checked_in) {
                        event.checked_in_count = Math.max(0, (event.checked_in_count || 0) - 1);
                    }
                    event.guests = event.guests.filter(g => g.id != guestId);
                    event.sold   = Math.max(0, (event.sold || 0) - 1);

                    if (guest.seat_row && guest.seat_col && event.reservations) {
                        event.reservations = event.reservations.filter(
                            r => !(r.row === guest.seat_row && r.column == guest.seat_col)
                        );
                    }

                    localStorage.setItem('seatlify_events', JSON.stringify(events));
                    window.dispatchEvent(new CustomEvent('db-events-updated'));
                }
            }
        }
    },

    bulkDeleteGuests: (eventId, guestIds) => {
        const events = MockDB.getEvents();
        const index  = events.findIndex(e => e.event_id == eventId);
        if (index === -1) return;

        const event = events[index];
        if (!event.guests) return;

        const guestIdSet       = new Set(guestIds);
        const guestsToDelete   = event.guests.filter(g => guestIdSet.has(g.id));
        if (guestsToDelete.length === 0) return;

        const numToDelete          = guestsToDelete.length;
        const numCheckedInToDelete = guestsToDelete.filter(g => g.checked_in).length;

        event.guests          = event.guests.filter(g => !guestIdSet.has(g.id));
        event.sold            = Math.max(0, (event.sold || 0) - numToDelete);
        event.checked_in_count = Math.max(0, (event.checked_in_count || 0) - numCheckedInToDelete);

        if (event.reservations?.length > 0) {
            const seatsOfDeleted = new Set(
                guestsToDelete
                    .filter(g => g.seat_row && g.seat_col)
                    .map(g => `${g.seat_row}::${g.seat_col}`)
            );
            if (seatsOfDeleted.size > 0) {
                event.reservations = event.reservations.filter(
                    r => !seatsOfDeleted.has(`${r.row}::${r.column}`)
                );
            }
        }

        localStorage.setItem('seatlify_events', JSON.stringify(events));
        window.dispatchEvent(new CustomEvent('db-events-updated'));
    },

    // ─── Tickets & Sales ─────────────────────────────────

    sellTicket: (id, quantity = 1) => {
        const events = MockDB.getEvents();
        const index  = events.findIndex(e => e.event_id == id);
        if (index === -1) return { success: false, message: 'Event not found.' };

        const event       = events[index];
        const currentSold = event.sold || 0;
        const totalCapacity = (event.is_paid && event.tickets?.length > 0)
            ? event.tickets.reduce((sum, tier) => sum + (parseInt(tier.qty || 0)), 0)
            : parseInt(event.total_seats) || 0;

        if (currentSold + quantity > totalCapacity)
            return { success: false, message: 'Not enough seats available.' };

        events[index].sold = currentSold + quantity;
        if (!events[index].guests) events[index].guests = [];

        for (let i = 0; i < quantity; i++) {
            const guestId = MockDB._generateGuestId();
            events[index].guests.push({
                id:          guestId,
                name:        `Guest ${guestId.toString().slice(-4)}`,
                email:       `guest${guestId}@example.com`,
                ticket_type: 'Standard',
                timestamp:   new Date().toISOString(),
                checked_in:  false
            });
        }

        try {
            localStorage.setItem('seatlify_events', JSON.stringify(events));
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                events[index].sold = currentSold;
                events[index].guests.splice(-quantity);
                alert("Storage Full: Could not simulate sale because the browser's local storage is full. Please use the \"Reset Sales\" button to clear data.");
                return { success: false, message: 'Local storage quota exceeded.' };
            }
            throw e;
        }

        const message = quantity > 1
            ? `${quantity} tickets were reserved for "${event.title}"`
            : `A ticket was reserved for "${event.title}"`;
        MockDB.addNotification({ message, type: 'ticket_sold', event_id: id });
        window.dispatchEvent(new CustomEvent('db-events-updated'));
        return { success: true, sold: events[index].sold };
    },

    resetSales: (eventId) => {
        const events = MockDB.getEvents();
        const index  = events.findIndex(e => e.event_id == eventId);
        if (index === -1) return { success: false, message: 'Event not found.' };

        events[index].sold            = 0;
        events[index].guests          = [];
        events[index].checked_in_count = 0;
        events[index].reservations    = [];

        try {
            localStorage.setItem('seatlify_events', JSON.stringify(events));
            MockDB.addNotification({
                message: `Sales and guest data have been reset for "${events[index].title}".`,
                type: 'event_deleted'
            });
            window.dispatchEvent(new CustomEvent('db-events-updated'));
            return { success: true, message: 'Sales and guest data reset successfully.' };
        } catch (e) {
            console.error('Failed to reset sales:', e);
            return { success: false, message: 'Failed to save reset data to storage.' };
        }
    },

    // ─── Seat Reservations ───────────────────────────────

    reserveSeat: (eventId, seatRow, seatColumn, guestInfo = {}) => {
        const events = MockDB.getEvents();
        const index  = events.findIndex(e => e.event_id == eventId);
        if (index === -1) return { success: false, message: 'Event not found.' };

        const event = events[index];
        if (!event.reservations) event.reservations = [];

        const alreadyReserved = event.reservations.some(
            r => r.row === seatRow && r.column == seatColumn
        );
        if (alreadyReserved) return { success: false, message: 'Seat already reserved.' };

        event.reservations.push({ row: seatRow, column: seatColumn, ...guestInfo });
        event.sold = (event.sold || 0) + 1;

        if (!event.guests) event.guests = [];
        event.guests.push({
            id:         MockDB._generateGuestId(),
            name:       guestInfo.name  || 'Guest',
            email:      guestInfo.email || '',
            seat_row:   seatRow,
            seat_col:   seatColumn,
            timestamp:  new Date().toISOString(),
            checked_in: false
        });

        localStorage.setItem('seatlify_events', JSON.stringify(events));
        window.dispatchEvent(new CustomEvent('db-events-updated'));
        return { success: true };
    },

    isSeatReserved: (eventId, seatRow, seatColumn) => {
        return MockDB.getEvents()
            .find(e => e.event_id == eventId)
            ?.reservations
            ?.some(r => r.row === seatRow && r.column == seatColumn) || false;
    },

    unreserveSeat: (eventId, seatRow, seatColumn) => {
        const events = MockDB.getEvents();
        const index  = events.findIndex(e => e.event_id == eventId);
        if (index === -1) return { success: false, message: 'Event or reservation not found.' };

        const event  = events[index];
        let changed  = false;

        if (event.reservations) {
            const before      = event.reservations.length;
            event.reservations = event.reservations.filter(
                r => !(r.row === seatRow && r.column == seatColumn)
            );
            if (event.reservations.length < before) changed = true;
        }

        if (event.guests) {
            const before   = event.guests.length;
            event.guests   = event.guests.filter(
                g => !(g.seat_row === seatRow && g.seat_col == seatColumn)
            );
            const removed  = before - event.guests.length;
            if (removed > 0) {
                changed    = true;
                event.sold = Math.max(0, event.sold - removed);
            }
        }

        if (changed) {
            localStorage.setItem('seatlify_events', JSON.stringify(events));
            window.dispatchEvent(new CustomEvent('db-events-updated'));
            return { success: true };
        }
        return { success: false, message: 'Event or reservation not found.' };
    },

    // ─── Notifications ───────────────────────────────────

    getNotifications: () => MockDB._notifications,

    getUnreadNotifications: () => {
        return MockDB.getNotifications()
            .filter(n => !n.read)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    },

    addNotification: (data) => {
        MockDB._notifications.push({
            id:        Date.now(),
            timestamp: new Date().toISOString(),
            read:      false,
            ...data
        });
        window.dispatchEvent(new CustomEvent('db-notifications-updated'));
    },

    markAllNotificationsAsRead: () => {
        MockDB.getNotifications().forEach(n => n.read = true);
        window.dispatchEvent(new CustomEvent('db-notifications-updated'));
    },

    // ─── Invitations ─────────────────────────────────────

    clearInvitationConfig: (eventId) => {
        const events = MockDB.getEvents();
        const index  = events.findIndex(e => e.event_id == eventId);
        if (index === -1) return { success: false, message: 'Event not found.' };

        events[index].invitation_config = null;
        localStorage.setItem('seatlify_events', JSON.stringify(events));
        window.dispatchEvent(new CustomEvent('db-events-updated'));
        return { success: true, message: 'Invitation config cleared successfully.' };
    },

    // ─── API Utilities ───────────────────────────────────

    /** Calls the backend endpoint to send a ticket confirmation email. */
    sendTicketEmail: (email, ticketData) => {
        return fetch('../backend/send_email.php', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ to: email, eventTitle: ticketData.event, eventDate: ticketData.date })
        }).then(res => res.json());
    },

    /** Generates a QR code image URL for the given data string. */
    generateQRCodeUrl: (data) =>
        `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(data)}`,
};

// Bootstrap the database on page load
MockDB.init();
