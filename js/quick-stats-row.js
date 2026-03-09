// ==========================================
// QUICK STATS ROW MODULE
// ==========================================

/**
 * initQuickStats
 * Called once after quick-stats-row.html has been injected.
 * The stat cards are purely data-driven; click handlers are inline onclick
 * attributes in the HTML, so no JS bindings are required at init time.
 */
export function initQuickStats() {
    // No dynamic bindings required — onclick attributes handle navigation.
}

/**
 * renderQuickStats
 * Calculates and updates all four stat cards (Seats, Check-ins, Tickets, Revenue)
 * for the supplied event object.
 *
 * @param {Object} event - A MockDB event record.
 */
export function renderQuickStats(event) {
    const totalCapacity   = parseInt(event.total_seats) || 0;
    const ticketsSold     = event.sold || 0;
    const checkedIn       = event.checked_in_count || 0;
    const eventStatus = event.status;
     const overallCapacity = parseInt(event.attendees) || 0;

    // --- Designed Seats ---
    // Respect the layout mode stored in localStorage (table vs row).
    const storedMode  = localStorage.getItem(`seatlify_chart_layout_mode_${event.event_id}`);
    const effectiveMode = storedMode || (event.seating_by_table ? 'table' : 'row');

    let designedSeats = 0;
    if (effectiveMode === 'table') {
        designedSeats = (event.table_layout_data || [])
            .reduce((sum, group) => sum + (parseInt(group.seats) || 0), 0);
    } else {
        designedSeats = (event.row_layout_data || [])
            .reduce((sum, group) => sum + (parseInt(group.seats) || 0), 0);
    }
    // Fallback to event-level designed_seats if layout arrays are empty
    if (designedSeats === 0 && event.designed_seats) {
        designedSeats = parseInt(event.designed_seats) || 0;
    }

     let averagePrice = 0;


     // --- Reserved Seats Calculation ---
    const totalReservations = event.reservations ? event.reservations.length : 0;

    // --- Revenue Estimate ---
    let revenue = 0;
    if (event.is_paid && event.tickets?.length > 0) {
        const potentialRevenue = event.tickets.reduce(

            (sum, tier) => sum + (parseInt(tier.price || 0) * parseInt(tier.qty || 0)), 0
        );
        const ticketCapacity = event.tickets.reduce(
            (sum, tier) => sum + parseInt(tier.qty || 0), 0
        );

        if (ticketCapacity > 0) {

            averagePrice = potentialRevenue / ticketCapacity;
            revenue = (potentialRevenue / ticketCapacity) * ticketsSold;
        }
    }
     // Calculate Exact Revenue from Guests

    if (event.is_paid) {

        if (event.guests && event.guests.length > 0) {
            event.guests.forEach(guest => {
                let price = 0;
                if (guest.seat_row && event.tickets) {
                    const tier = event.tickets.find(t => t.name === guest.seat_row || t.original_name === guest.seat_row);
                    if (tier) price = parseFloat(tier.price || 0);
                    else price = averagePrice;
                } else {
                    price = averagePrice;
                }
                revenue += price;
            });
        } else {
            revenue = ticketsSold * averagePrice;
        }
    }


    // Mock Refunds (If event is cancelled, treat all as refunded, otherwise 0 for now)
    let refunds = 0;
    if (eventStatus === 'cancelled') {
        refunds = revenue;
    }

    // Ensure that netRevenue isn't negative
    let netRevenue = Math.max(0, revenue - refunds);

    // Format the revenue string (ensure that netRevenue is correctly used here)
    let revenueStr = 'N/A';
    if (event.is_paid) {
        revenueStr = `₱${netRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    // --- Update: Seats / Capacity ---
    const seatsEl = document.getElementById('dashboardSeatsAvailable');
    if (seatsEl) {
         const displayCapacity = overallCapacity > 0 ? overallCapacity : totalCapacity;
        seatsEl.textContent = `${designedSeats} / ${displayCapacity}`;

        // Calculate reservation percentage based on total capacity
        const reservationPercentage = displayCapacity > 0
            ? Math.round((totalReservations / displayCapacity) * 100)
            : 0;

        const smallEl = seatsEl.nextElementSibling;
        if (smallEl) { //Show reservationPercentage instead of designedSeats
             smallEl.innerHTML  = `<i class="bi bi-bar-chart-fill"></i> ${reservationPercentage}% reserved`;
            smallEl.className  = percentage > 80 ? 'text-warning' : 'text-success';
        }
    }

    // --- Update: Checked-in Guests ---
    const attendeesEl = document.getElementById('dashboardAttendees');
    if (attendeesEl) {
        attendeesEl.textContent = checkedIn;

        const percentageEl = document.getElementById('dashboardAttendeesPercentage');
        if (percentageEl) {
            const pct = ticketsSold > 0 ? Math.round((checkedIn / ticketsSold) * 100) : 0;
            percentageEl.textContent = `${pct}% of sold`;
        }
    }

    // --- Update: Tickets Sold ---
    const ticketsEl = document.getElementById('dashboardTicketsSold');
    if (ticketsEl) {
        ticketsEl.textContent = ticketsSold;

        const targetEl = document.getElementById('dashboardTicketsTarget');
        if (targetEl) {
            const displayTarget = overallCapacity > 0 ? overallCapacity : totalCapacity;
            targetEl.textContent = `Target: ${displayTarget}`;
        }
    }

    // --- Update: Revenue ---
    const revenueEl = document.getElementById('dashboardRevenue');
    if (revenueEl) {
        revenueEl.textContent = revenueStr;
    }
}

/**
 * clearQuickStats
 * Resets all four stat cards to their empty/zero state.
 */
export function clearQuickStats() {
    const safe = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    safe('dashboardSeatsAvailable', '0 / 0');
    safe('dashboardAttendees',      '0');
    safe('dashboardTicketsSold',    '0');
    safe('dashboardRevenue',        '₱0');

    const percentageEl = document.getElementById('dashboardAttendeesPercentage');
    if (percentageEl) percentageEl.textContent = '0% of total';
}
