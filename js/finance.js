/* ==========================================================
   FINANCE MODULE
   Handles: Revenue reporting, refunds calculation, and payouts
========================================================== */

export function initFinance() {
    renderFinanceReport();

    const btnPayout = document.getElementById('btnPayout');
    if (btnPayout) {
        btnPayout.addEventListener('click', handlePayout);
    }
}

function renderFinanceReport() {
    const currentEventId = localStorage.getItem('seatlify_current_event_id');
    const noEventAlert = document.getElementById('financeNoEventAlert');
    const content = document.getElementById('financeContent');

    if (!currentEventId || typeof MockDB === 'undefined') {
        if (noEventAlert) noEventAlert.style.display = 'block';
        if (content) content.style.display = 'none';
        return;
    }

    const event = MockDB.getEvents().find(e => e.event_id == currentEventId);
    if (!event) {
        if (noEventAlert) {
            noEventAlert.textContent = 'Event not found.';
            noEventAlert.style.display = 'block';
        }
        if (content) content.style.display = 'none';
        return;
    }

    if (noEventAlert) noEventAlert.style.display = 'none';
    if (content) content.style.display = 'block';

    // --- Calculate Metrics ---
    const ticketsSold = event.sold || 0;
    let totalRevenue = 0;
    let averagePrice = 0;

    // Calculate revenue based on ticket tiers (approximation logic from dashboard.js)
    if (event.is_paid && event.tickets && event.tickets.length > 0) {
        const potentialRevenue = event.tickets.reduce((sum, tier) => sum + (parseFloat(tier.price || 0) * parseInt(tier.qty || 0)), 0);
        const ticketCapacity = event.tickets.reduce((sum, tier) => sum + parseInt(tier.qty || 0), 0);
        if (ticketCapacity > 0) {
            averagePrice = potentialRevenue / ticketCapacity;
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
                totalRevenue += price;
            });
        } else {
            totalRevenue = ticketsSold * averagePrice;
        }
    }

    // Mock Refunds (If event is cancelled, treat all as refunded, otherwise 0 for now)
    let refunds = 0;
    if (event.status === 'cancelled') {
        refunds = totalRevenue;
    }

    const netRevenue = Math.max(0, totalRevenue - refunds);

    // --- Update DOM ---
    const elTotal = document.getElementById('financeTotalRevenue');
    const elRefunds = document.getElementById('financeRefunds');
    const elNet = document.getElementById('financeNetRevenue');
    const elPayout = document.getElementById('financePayoutBalance');

    const fmt = (num) => `₱${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    if (elTotal) elTotal.textContent = fmt(totalRevenue);
    if (elRefunds) elRefunds.textContent = fmt(refunds);
    if (elNet) elNet.textContent = fmt(netRevenue);
    if (elPayout) elPayout.textContent = fmt(netRevenue);

    // --- Populate Transaction Table ---
    const tableBody = document.getElementById('financeTransactionTable');
    if (tableBody) {
        tableBody.innerHTML = '';
        if (event.guests && event.guests.length > 0) {
            // Sort by latest
            const sortedGuests = [...event.guests].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            sortedGuests.forEach(guest => {
                const date = new Date(guest.timestamp);
                const tr = document.createElement('tr');
                
                // Determine transaction status/color
                let amountClass = 'text-success';
                let amountPrefix = '+';
                let amount = 0;
                
                if (event.is_paid) {
                    if (guest.seat_row && event.tickets) {
                        const tier = event.tickets.find(t => t.name === guest.seat_row || t.original_name === guest.seat_row);
                        if (tier) amount = parseFloat(tier.price || 0);
                        else amount = averagePrice;
                    } else {
                        amount = averagePrice;
                    }
                }

                let type = 'Ticket Sale';

                if (event.status === 'cancelled') {
                    amountClass = 'text-danger';
                    amountPrefix = '-';
                    type = 'Refund';
                }

                tr.innerHTML = `
                    <td class="text-muted"><small>#TXN-${String(guest.id).padStart(12, '0')}</small></td>
                    <td>${date.toLocaleDateString()} <small class="text-muted">${date.toLocaleTimeString()}</small></td>
                    <td>${guest.name}</td>
                    <td><span class="badge bg-light text-dark border">${type}</span></td>
                    <td class="text-end fw-bold ${amountClass}">${amountPrefix}${fmt(amount)}</td>
                `;
                tableBody.appendChild(tr);
            });
        } else {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No transactions found.</td></tr>';
        }
    }

    // Disable payout if 0
    const btnPayout = document.getElementById('btnPayout');
    if (btnPayout) {
        btnPayout.disabled = netRevenue <= 0;
    }
}

function handlePayout() {
    const elNet = document.getElementById('financeNetRevenue');
    const amount = elNet ? elNet.textContent : '₱0.00';
    
    if (confirm(`Are you sure you want to payout ${amount} to your connected account?`)) {
        const btn = document.getElementById('btnPayout');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Processing...';

        // Simulate API delay
        setTimeout(() => {
            alert(`Payout of ${amount} successful! Funds will arrive in 1-3 business days.`);
            btn.innerHTML = '<i class="bi bi-check-circle me-2"></i>Payout Sent';
        }, 1500);
    }
}