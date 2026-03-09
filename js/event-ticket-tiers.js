/* ==========================================================
   EVENT TICKET TIERS
   Responsibility: Free / Paid event toggle, dynamic ticket
   tier row management, and the seat allocation counter.
   ─────────────────────────────────────────────────────────
   Exposes onto ctx:
     • ctx.updateTierSeatCounter()
========================================================== */
window.TicketTiers = {

    /**
     * Initialise ticket tier UI logic for the Create Event modal.
     * Elements are cloned to strip any stale listeners from a
     * previous modal open.
     *
     * @param {Object} ctx - Shared modal context
     */
    init: function (ctx) {

        // ── Helper: clone element to strip old listeners ──────────────

        const replaceEl = (id) => {
            const el = document.getElementById(id);
            if (!el) return null;
            const fresh = el.cloneNode(true);
            el.parentNode.replaceChild(fresh, el);
            return fresh;
        };

        const newTypeFree    = replaceEl('typeFree');
        const newTypePaid    = replaceEl('typePaid');
        const newAddTierBtn  = replaceEl('addTierBtn');
        const tiersContainer = document.getElementById('ticketTiersContainer');

        // ── Seat allocation counter ───────────────────────────────────

        const updateTierSeatCounter = () => {
            const totalSeatsInput = document.getElementById('eventAttendees');
            const counterEl       = document.getElementById('tierSeatCounter');
            if (!counterEl) return;

            const totalSeats     = parseInt(totalSeatsInput?.value) || 0;
            let   allocatedSeats = 0;
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

        // Publish onto ctx so the wizard can call it on step transition
        ctx.updateTierSeatCounter = updateTierSeatCounter;

        // Keep counter in sync when the total capacity changes
        const capacityInput = document.getElementById('eventAttendees');
        if (capacityInput) capacityInput.addEventListener('input', updateTierSeatCounter);

        // ── Free / Paid toggle ────────────────────────────────────────

        const toggleTiers = () => {
            if (newTypePaid?.checked) {
                tiersContainer.style.display = 'block';
                updateTierSeatCounter();
            } else {
                tiersContainer.style.display = 'none';
            }
        };

        if (newTypeFree && newTypePaid) {
            newTypeFree.addEventListener('change', toggleTiers);
            newTypePaid.addEventListener('change', toggleTiers);
            toggleTiers(); // Apply initial state
        }

        // ── Tier row management ───────────────────────────────────────

        if (!newAddTierBtn) return;

        const list = document.getElementById('tiersList');

        /** Returns the inner HTML for one tier row at the given 1-based index. */
        const getRowContent = (index) => `
            <div class="col-1 text-center">
                <span class="text-muted small fw-bold">#${index}</span>
            </div>
            <div class="col-4">
                <input type="text" class="form-control form-control-sm tier-name"
                       placeholder="Tier Name"
                       style="background-color: var(--bg-panel); border-color: var(--border-color); color: var(--text-main);">
            </div>
            <div class="col-3">
                <input type="number" class="form-control form-control-sm tier-price"
                       placeholder="Price"
                       style="background-color: var(--bg-panel); border-color: var(--border-color); color: var(--text-main);">
            </div>
            <div class="col-4">
                <input type="number" class="form-control form-control-sm tier-qty"
                       placeholder="Qty"
                       style="background-color: var(--bg-panel); border-color: var(--border-color); color: var(--text-main);">
            </div>
        `;

        // Normalise the initial static row if it's missing the index column
        const firstRow = list.querySelector('.tier-row');
        if (firstRow && !firstRow.querySelector('.col-1')) {
            firstRow.className = 'row g-2 mb-2 tier-row align-items-center';
            firstRow.innerHTML = getRowContent(1);
        }

        // Add a new tier row on button click
        newAddTierBtn.addEventListener('click', () => {
            const rowCount = list.querySelectorAll('.tier-row').length + 1;
            const row      = document.createElement('div');
            row.className  = 'row g-2 mb-2 tier-row align-items-center';
            row.innerHTML  = getRowContent(rowCount);
            list.appendChild(row);
        });

        // Update counter whenever a qty field changes (event delegation)
        list.addEventListener('input', (e) => {
            if (e.target.classList.contains('tier-qty')) {
                updateTierSeatCounter();
            }
        });
    }
};
