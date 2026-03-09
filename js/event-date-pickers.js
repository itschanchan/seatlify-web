/* ==========================================================
   EVENT DATE / TIME PICKERS
   Responsibility: Initialize Vanilla Calendar Pro for the
   date field and Flatpickr for the start/end time fields
   inside the Create Event modal.
   ─────────────────────────────────────────────────────────
   No ctx dependency — operates directly on known element IDs.
========================================================== */
window.EventDatePickers = {

    /**
     * Attach date and time picker widgets to the Create Event form.
     * Safe to call on every modal open; Flatpickr instances replace
     * any existing ones on the same input.
     */
    init: function () {
        if (typeof flatpickr === 'undefined') return; // Guard: library not loaded

        // ── Date picker (Vanilla Calendar Pro preferred) ──────────────

        if (typeof VanillaCalendar !== 'undefined') {
            const calendarOptions = {
                input: true,
                type:  'default',
                actions: {
                    changeToInput (e, calendar, self) {
                        if (!self.selectedDates[0]) {
                            calendar.HTMLInputElement.value = '';
                            return;
                        }
                        const date  = new Date(self.selectedDates[0]);
                        const year  = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day   = String(date.getDate()).padStart(2, '0');
                        calendar.HTMLInputElement.value = `${year}-${month}-${day}`;
                        calendar.hide();
                    }
                },
                settings: {
                    visibility: {
                        theme: document.body.classList.contains('dark-theme') ? 'dark' : 'light'
                    }
                }
            };

            const calendar  = new VanillaCalendar('#eventDate', calendarOptions);
            calendar.init();

            // Sync calendar state when the user types a date manually
            const dateInput = document.getElementById('eventDate');
            if (dateInput && !dateInput.hasAttribute('vcal-listener')) {
                dateInput.setAttribute('vcal-listener', 'true');
                dateInput.addEventListener('change', () => {
                    const parsed = new Date(dateInput.value);
                    if (parsed && !isNaN(parsed.getTime())) {
                        calendar.set({
                            selectedDates: [dateInput.value],
                            selectedMonth: parsed.getMonth(),
                            selectedYear:  parsed.getFullYear()
                        });
                    }
                });
            }
        } else {
            // Fallback: use Flatpickr for the date field too
            flatpickr('#eventDate', {
                altInput:  true,
                altFormat: 'F j, Y',
                dateFormat: 'Y-m-d'
            });
        }

        // ── Time pickers (always Flatpickr) ──────────────────────────

        const timeOptions = {
            allowInput:  true,
            enableTime:  true,
            noCalendar:  true,
            dateFormat:  'H:i',   // backend / storage format
            altInput:    true,    // display a human-friendly input
            altFormat:   'h:i K', // 12-hour display
            time_24hr:   false
        };

        flatpickr('#eventTime',    timeOptions);
        flatpickr('#eventEndTime', timeOptions);
    }
};
