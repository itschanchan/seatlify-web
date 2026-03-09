/* ==========================================================
   CREATE EVENT CONTROLLER
   Responsibility: Orchestrate the Create Event modal.
   • Lazy-loads create-event-modal.html once.
   • Builds a shared context object on each modal open.
   • Delegates to each sub-module in dependency order.
   ─────────────────────────────────────────────────────────
   Depends on (must be loaded first in dashboard.html):
     event-seat-config.js   → window.SeatConfig
     event-date-pickers.js  → window.EventDatePickers
     event-ticket-tiers.js  → window.TicketTiers
     event-wizard.js        → window.EventWizard
     event-creator.js       → window.EventCreator
========================================================== */

/**
 * window.initCreateEventModal
 *
 * Called after create-event-modal.html is present in the DOM.
 * Builds the shared `ctx` object and initialises every sub-module
 * in the correct dependency order.
 *
 * Also called by all-events-view.js (our SPA loader) after it
 * injects the modal HTML.
 */
window.initCreateEventModal = function () {
    const modalEl = document.getElementById('createEventModal');
    if (!modalEl) return;

    // Convert the venue <select> to a free-text <input> if needed
    const venueSelect = document.getElementById('eventVenue');
    if (venueSelect && venueSelect.tagName === 'SELECT') {
        const input       = document.createElement('input');
        input.type        = 'text';
        input.id          = 'eventVenue';
        input.className   = 'form-control';
        input.placeholder = 'Enter venue name';
        venueSelect.parentNode.replaceChild(input, venueSelect);
    }

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

    // ── Shared context object ─────────────────────────────────────────
    // Each sub-module reads DOM refs and cross-module function pointers
    // from this single object, avoiding prop-drilling across files.

    const ctx = {
        // Bootstrap modal instance
        modal,

        // Wizard step containers
        step1:    document.getElementById('step1'),
        step2:    document.getElementById('step2'),
        step3:    document.getElementById('step3'),

        // Fixed navigation button (not cloned — only Next/Back/Create are)
        btnCancel: document.getElementById('btnCancel'),

        // Seat configuration DOM refs (used by SeatConfig + EventCreator)
        seatingSwitch:                  document.getElementById('seatingByTableSwitch'),
        totalSeatsContainer:            document.getElementById('totalSeatsContainer'),
        tableSeatingContainer:          document.getElementById('tableSeatingContainer'),
        eventAttendeesInput:            document.getElementById('eventAttendees'),
        eventTotalTablesInput:          document.getElementById('eventTotalTables'),
        eventSeatsPerTableInput:        document.getElementById('eventSeatsPerTable'),
        createTableCapacityWarning:     document.getElementById('createTableCapacityWarning'),
        eventTotalSeatsInput:           document.getElementById('eventTotalSeats'),
        createTotalSeatsCapacityWarning: document.getElementById('createTotalSeatsCapacityWarning'),
        seatCountIndicator:             document.getElementById('seatCountIndicator'),

        // Cross-module function pointers (populated by each sub-module's init)
        updateIndicator:               null, // ← set by SeatConfig.init
        validateTableSeatingCapacity:  null, // ← set by SeatConfig.init
        updateTierSeatCounter:         null, // ← set by TicketTiers.init
        updateStepper:                 null, // ← set by EventWizard.init

        // Fresh button clones (set by EventWizard.init; consumed by EventCreator)
        btnNext:   null,
        btnBack:   null,
        btnCreate: null
    };

    // ── Sub-module initialisation (ORDER MATTERS) ─────────────────────

    // 1. Seat config — must run first; sets ctx.updateIndicator &
    //    ctx.validateTableSeatingCapacity before the wizard needs them.
    SeatConfig.init(ctx);

    // 2. Date/time pickers — standalone, no ctx dependencies.
    EventDatePickers.init();

    // 3. Ticket tiers — must run before the wizard so
    //    ctx.updateTierSeatCounter is ready for the Step 2→3 transition.
    TicketTiers.init(ctx);

    // 4. Wizard navigation — clones buttons and sets ctx.btnCreate,
    //    which EventCreator requires.
    EventWizard.init(ctx);

    // 5. Event creator — binds the Create button using ctx.btnCreate.
    EventCreator.bindCreateButton(ctx);
};

/**
 * window.openCreateEventModal
 *
 * Lazy-loads create-event-modal.html into #createEventModalContainer,
 * then shows the modal and re-initialises the wizard on every call.
 *
 * Compatible with:
 *   • Inline onclick attributes in dashboard-content.html
 *   • The Speed Dial FAB in dashboard.html
 *   • all-events-view.js (loadCreateEventModal helper)
 */
window.openCreateEventModal = async function () {
    const container = document.getElementById('createEventModalContainer');
    if (!container) return;

    // Load the modal HTML fragment only once
    if (!document.getElementById('createEventModal')) {
        try {
            const res = await fetch('create-event-modal.html');
            if (!res.ok) throw new Error('Failed to load create-event-modal.html');
            container.innerHTML = await res.text();

            // innerHTML does not execute <script> tags — re-run them manually
            // so any IIFE inside the modal HTML registers itself on window.
            container.querySelectorAll('script').forEach(oldScript => {
                const newScript       = document.createElement('script');
                newScript.textContent = oldScript.textContent;
                document.body.appendChild(newScript);
                newScript.remove();
            });
        } catch (err) {
            console.error('openCreateEventModal: failed to load modal HTML', err);
            return;
        }
    }

    // Re-initialise the wizard state on every open so the form is fresh
    window.initCreateEventModal();

    const modalEl = document.getElementById('createEventModal');
    if (modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).show();
};
