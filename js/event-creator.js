/* ==========================================================
   EVENT CREATOR
   Responsibility: Read and validate the completed Create Event
   form, build row / table layout payloads, and persist the new
   event via MockDB.addEvent.
   ─────────────────────────────────────────────────────────
   Reads from ctx:
     • ctx.modal                       — to hide after creation
     • ctx.btnCreate                   — set by event-wizard.js
     • ctx.validateTableSeatingCapacity — set by event-seat-config.js
========================================================== */
window.EventCreator = {

    /**
     * Bind the Create button.
     * Must be called AFTER EventWizard.init() so that ctx.btnCreate
     * holds the fresh clone.
     *
     * @param {Object} ctx - Shared modal context
     */
    bindCreateButton: function (ctx) {
        const { modal, btnCreate } = ctx;

        btnCreate.addEventListener('click', () => {

            // ── Read form fields ──────────────────────────────────────

            const title          = document.getElementById('eventName').value;
            const date           = document.getElementById('eventDate').value;
            const startTime      = document.getElementById('eventTime').value;
            const endTime        = document.getElementById('eventEndTime').value;
            const venueName      = document.getElementById('eventVenue').value;
            const attendees      = document.getElementById('eventAttendees').value;
            const desc           = document.getElementById('eventDescription').value;
            const seatingByTable = document.getElementById('seatingByTableSwitch').checked;

            // ── Validate seat configuration ───────────────────────────

            if (seatingByTable && !ctx.validateTableSeatingCapacity()) {
                alert('Calculated seats exceed total capacity. Please adjust your seating configuration.');
                return;
            }

            // ── Resolve seat numbers ──────────────────────────────────

            let totalSeats, totalTables, seatsPerTable;

            if (seatingByTable) {
                totalTables   = document.getElementById('eventTotalTables').value;
                seatsPerTable = document.getElementById('eventSeatsPerTable').value;
                totalSeats    = (parseInt(totalTables) || 0) * (parseInt(seatsPerTable) || 0);
            } else {
                totalSeats    = document.getElementById('eventTotalSeats').value;
                totalTables   = 0;
                seatsPerTable = 0;
            }

            if (parseInt(totalSeats) > (parseInt(attendees) || 0) && (parseInt(attendees) || 0) > 0) {
                alert('Total seats cannot exceed total capacity.');
                return;
            }

            // ── Build ticket tiers and row layout data ────────────────

            const isPaid       = document.getElementById('typePaid').checked;
            let tickets        = [];
            let rowLayoutData  = [];
            let tableLayoutData = [];

            if (isPaid) {
                document.querySelectorAll('.tier-row').forEach(row => {
                    const name  = row.querySelector('.tier-name').value;
                    const price = row.querySelector('.tier-price').value;
                    const qty   = row.querySelector('.tier-qty').value;
                    if (name) {
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

            // ── Pre-populate table_layout_data for the Seat Planner ──

            const numTables = parseInt(totalTables) || 0;
            if (numTables > 0) {
                for (let i = 1; i <= numTables; i++) {
                    tableLayoutData.push({
                        label: `Table ${i}`,
                        seats: parseInt(seatsPerTable) || 0
                    });
                }
            }

            // ── Resolve venue ID from name ────────────────────────────

            const venues  = MockDB.getVenues();
            const venue   = venues.find(v => v.name.toLowerCase() === venueName.toLowerCase());
            const venueId = venue ? venue.venue_id : null;

            // ── Persist event ─────────────────────────────────────────

            const createdEvent = MockDB.addEvent({
                title,
                venue_id:          venueId,
                venue_name:        venueName,
                description:       desc,
                start_datetime:    `${date}T${startTime}`,
                end_datetime:      endTime ? `${date}T${endTime}` : null,
                attendees,
                total_seats:       totalSeats,
                total_tables:      totalTables,
                seating_by_table:  seatingByTable,
                seats_per_table:   seatsPerTable,
                is_paid:           isPaid,
                tickets,
                row_layout_data:   rowLayoutData,
                table_layout_data: tableLayoutData
            });

            // Persist the preferred layout mode for the Seat Planner
            if (createdEvent) {
                localStorage.setItem(
                    `seatlify_chart_layout_mode_${createdEvent.event_id}`,
                    seatingByTable ? 'table' : 'row'
                );
            }

            // ── Teardown ──────────────────────────────────────────────

            modal.hide();
            document.querySelector('#createEventModal form').reset();
        });
    }
};
