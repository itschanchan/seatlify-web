/* ==========================================================
   SIMULATE SALE
   Responsibility: Single global helper that triggers one
   simulated ticket sale for the currently selected event.
   ─────────────────────────────────────────────────────────
   Depends on: MockDB (mock-db.js)
========================================================== */

/**
 * window.simulateSale
 *
 * Sells one ticket for the event stored in
 * localStorage['seatlify_current_event_id'].
 * Alerts the user if no event is selected or if the sale fails.
 */
window.simulateSale = function () {
    const currentEventId = localStorage.getItem('seatlify_current_event_id');

    if (!currentEventId) {
        alert('Please select an event first to simulate a sale.');
        return;
    }

    const result = MockDB.sellTicket(currentEventId, 1);
    if (!result.success) {
        alert(result.message);
    }
};
