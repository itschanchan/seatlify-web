/* ==========================================================
   EVENT SEAT CONFIGURATION
   Responsibility: Seat-type toggle (row vs. table), live
   capacity indicator, and table seating capacity validation.
   ─────────────────────────────────────────────────────────
   Exposes onto ctx:
     • ctx.updateIndicator()
     • ctx.validateTableSeatingCapacity() → boolean
========================================================== */
window.SeatConfig = {

    /**
     * Initialise seat configuration logic for the Create Event modal.
     * Must be called after the modal HTML is in the DOM.
     *
     * @param {Object} ctx - Shared modal context assembled by create-event-controller.js
     */
    init: function (ctx) {
        const {
            seatingSwitch,
            totalSeatsContainer,
            tableSeatingContainer,
            eventAttendeesInput,
            eventTotalTablesInput,
            eventSeatsPerTableInput,
            createTableCapacityWarning,
            eventTotalSeatsInput,
            createTotalSeatsCapacityWarning,
            seatCountIndicator
        } = ctx;

        // ── Capacity indicator ────────────────────────────────────────────

        const updateIndicator = () => {
            if (!seatCountIndicator || !eventAttendeesInput) return;

            const capacity = parseInt(eventAttendeesInput.value) || 0;
            let currentSeats = 0;

            if (seatingSwitch.checked) {
                const tables   = parseInt(eventTotalTablesInput.value)   || 0;
                const seatsPer = parseInt(eventSeatsPerTableInput.value) || 0;
                currentSeats   = tables * seatsPer;
            } else {
                currentSeats = parseInt(eventTotalSeatsInput.value) || 0;
                if (createTotalSeatsCapacityWarning) {
                    createTotalSeatsCapacityWarning.style.display =
                        (capacity > 0 && currentSeats > capacity) ? 'block' : 'none';
                }
            }

            seatCountIndicator.textContent = `Current number of seats: ${currentSeats} / ${capacity}`;
        };

        // ── Table seating capacity validation ────────────────────────────

        const validateTableSeatingCapacity = () => {
            if (!seatingSwitch || !eventAttendeesInput || !eventTotalTablesInput ||
                !eventSeatsPerTableInput || !createTableCapacityWarning) {
                return true; // Can't validate if elements are missing
            }

            const totalCapacity   = parseInt(eventAttendeesInput.value)    || 0;
            const numTables       = parseInt(eventTotalTablesInput.value)   || 0;
            const seatsPerTable   = parseInt(eventSeatsPerTableInput.value) || 0;
            const calculatedSeats = numTables * seatsPerTable;

            if (!seatingSwitch.checked) return true;

            if (calculatedSeats > totalCapacity && totalCapacity > 0) {
                createTableCapacityWarning.textContent =
                    `Calculated seats (${calculatedSeats}) exceed total capacity (${totalCapacity})!`;
                createTableCapacityWarning.style.display = 'block';
                return false;
            }

            if (calculatedSeats > 0 && totalCapacity === 0) {
                createTableCapacityWarning.textContent =
                    `Calculated seats (${calculatedSeats}) require a total capacity greater than 0.`;
                createTableCapacityWarning.style.display = 'block';
                return false;
            }

            createTableCapacityWarning.style.display = 'none';
            return true;
        };

        // Publish functions onto ctx so other modules can call them
        ctx.updateIndicator              = updateIndicator;
        ctx.validateTableSeatingCapacity = validateTableSeatingCapacity;

        // ── Input listeners ──────────────────────────────────────────────

        // Strip commas from the attendees field
        eventAttendeesInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/,/g, '');
        });

        // Keep the seat indicator up to date
        eventAttendeesInput.addEventListener('input',    updateIndicator);
        eventTotalSeatsInput.addEventListener('input',   updateIndicator);
        eventTotalTablesInput.addEventListener('input',  updateIndicator);
        eventSeatsPerTableInput.addEventListener('input', updateIndicator);

        // ── Seat config toggle ───────────────────────────────────────────

        const toggleSeatConfig = () => {
            if (seatingSwitch.checked) {
                totalSeatsContainer.style.display   = 'none';
                tableSeatingContainer.style.display = 'block';
                if (createTotalSeatsCapacityWarning)
                    createTotalSeatsCapacityWarning.style.display = 'none';

                validateTableSeatingCapacity(); // Validate immediately on switch
                eventTotalTablesInput.addEventListener('input',   validateTableSeatingCapacity);
                eventSeatsPerTableInput.addEventListener('input', validateTableSeatingCapacity);
                eventAttendeesInput.addEventListener('input',     validateTableSeatingCapacity);
            } else {
                totalSeatsContainer.style.display   = 'block';
                tableSeatingContainer.style.display = 'none';
                createTableCapacityWarning.style.display = 'none';

                eventTotalTablesInput.removeEventListener('input',   validateTableSeatingCapacity);
                eventSeatsPerTableInput.removeEventListener('input', validateTableSeatingCapacity);
                eventAttendeesInput.removeEventListener('input',     validateTableSeatingCapacity);
            }
            updateIndicator();
        };

        if (seatingSwitch && totalSeatsContainer && tableSeatingContainer) {
            seatingSwitch.addEventListener('change', toggleSeatConfig);
            // Always reset to row-based seating on every modal open
            seatingSwitch.checked = false;
            toggleSeatConfig();
        }
    }
};
