/* ==========================================================
   EVENT WIZARD NAVIGATION
   Responsibility: Multi-step wizard UI — stepper progress
   bar, step visibility, and Next / Back button logic.
   ─────────────────────────────────────────────────────────
   Reads from ctx (set by earlier modules):
     • ctx.updateIndicator()
     • ctx.validateTableSeatingCapacity()
     • ctx.updateTierSeatCounter()

   Exposes onto ctx:
     • ctx.updateStepper(step)
     • ctx.btnNext   (fresh clone)
     • ctx.btnBack   (fresh clone)
     • ctx.btnCreate (fresh clone) — consumed by event-creator.js
========================================================== */
window.EventWizard = {

    /**
     * Initialise the wizard navigation for the Create Event modal.
     * Clones Next / Back / Create buttons to remove stale listeners
     * from any previous modal open.
     *
     * @param {Object} ctx - Shared modal context
     */
    init: function (ctx) {
        const { step1, step2, step3, btnCancel } = ctx;

        // ── Stepper progress bar ──────────────────────────────────────

        const updateStepper = (step) => {
            const progress = document.getElementById('stepperProgress');
            const ind2     = document.getElementById('stepIndicator2')?.querySelector('.step-circle');
            const ind3     = document.getElementById('stepIndicator3')?.querySelector('.step-circle');
            if (!progress || !ind2 || !ind3) return;

            // Reset both circles to inactive
            ind2.classList.remove('bg-primary'); ind2.classList.add('bg-secondary');
            ind3.classList.remove('bg-primary'); ind3.classList.add('bg-secondary');

            if (step === 1) {
                progress.style.width = '0%';
            } else if (step === 2) {
                ind2.classList.replace('bg-secondary', 'bg-primary');
                progress.style.width = '50%';
            } else if (step === 3) {
                ind2.classList.replace('bg-secondary', 'bg-primary');
                ind3.classList.replace('bg-secondary', 'bg-primary');
                progress.style.width = '100%';
            }
        };

        ctx.updateStepper = updateStepper;

        // ── Clone buttons to strip old listeners ─────────────────────

        const replaceBtn = (btn) => {
            const fresh = btn.cloneNode(true);
            btn.parentNode.replaceChild(fresh, btn);
            return fresh;
        };

        const newBtnNext   = replaceBtn(document.getElementById('btnNext'));
        const newBtnBack   = replaceBtn(document.getElementById('btnBack'));
        const newBtnCreate = replaceBtn(document.getElementById('btnCreate'));

        // Publish fresh refs onto ctx for event-creator.js
        ctx.btnNext   = newBtnNext;
        ctx.btnBack   = newBtnBack;
        ctx.btnCreate = newBtnCreate;

        // ── Reset to initial state ───────────────────────────────────

        step1.style.display = 'block';
        step2.style.display = 'none';
        if (step3) step3.style.display = 'none';

        updateStepper(1);
        newBtnNext.style.display   = 'inline-block';
        newBtnCreate.style.display = 'none';
        newBtnBack.style.display   = 'none';
        btnCancel.style.display    = 'inline-block';

        // ── Next button ──────────────────────────────────────────────

        newBtnNext.addEventListener('click', () => {

            // ---- Step 1 → Step 2 ----
            if (step1.style.display !== 'none') {
                const title     = document.getElementById('eventName').value;
                const date      = document.getElementById('eventDate').value;
                const startTime = document.getElementById('eventTime').value;
                const venue     = document.getElementById('eventVenue').value;

                if (!title || !date || !startTime || !venue) {
                    alert('Please fill in required fields (Name, Date, Time, Venue).');
                    return;
                }

                step1.style.display = 'none';
                step2.style.display = 'block';
                updateStepper(2);
                ctx.updateIndicator();
                newBtnBack.style.display = 'inline-block';
                btnCancel.style.display  = 'none';

            // ---- Step 2 → Step 3 ----
            } else if (step2.style.display !== 'none') {
                const seatingByTable = document.getElementById('seatingByTableSwitch').checked;

                if (seatingByTable && !ctx.validateTableSeatingCapacity()) {
                    alert('Calculated seats exceed total capacity. Please adjust your seating configuration.');
                    return;
                }

                step2.style.display    = 'none';
                step3.style.display    = 'block';
                updateStepper(3);
                newBtnNext.style.display   = 'none';
                newBtnCreate.style.display = 'inline-block';
                ctx.updateTierSeatCounter();
            }
        });

        // ── Back button ──────────────────────────────────────────────

        newBtnBack.addEventListener('click', () => {

            // ---- Step 2 → Step 1 ----
            if (step2.style.display !== 'none') {
                step2.style.display     = 'none';
                step1.style.display     = 'block';
                updateStepper(1);
                newBtnBack.style.display = 'none';
                btnCancel.style.display  = 'inline-block';

            // ---- Step 3 → Step 2 ----
            } else if (step3 && step3.style.display !== 'none') {
                step3.style.display        = 'none';
                step2.style.display        = 'block';
                updateStepper(2);
                newBtnNext.style.display   = 'inline-block';
                newBtnCreate.style.display = 'none';
            }
        });
    }
};
