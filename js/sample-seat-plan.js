function initSampleSeatPlan() {
    const ROW_PRICES = { A: 12000, B: 5000, C: 2500, D: 450 };
    let seats = [];
    let selectedSeats = [];

    const seatContainer = document.getElementById('seatContainer');
    const selectedSeatsContainer = document.getElementById('selectedSeatsContainer');
    const availableCountEl = document.getElementById('availableCount');
    const bookedCountEl = document.getElementById('bookedCount');
    const totalPriceEl = document.getElementById('totalPrice');
    const resetBtn = document.getElementById('resetBtn');

    if (!seatContainer) return;

    function generateSeats() {
        const rows = ['A','B','C','D'];
        let id = 1;
        return rows.flatMap(row => Array.from({length:8}, (_,i) => ({
            id: id++,
            row_label: row,
            seat_number: i+1,
            price: ROW_PRICES[row],
            is_booked: Math.random() < 0.25,
            booked_by: null
        })));
    }

    function renderSeats() {
        seatContainer.innerHTML = '';

        const grouped = seats.reduce((acc, seat) => {
            acc[seat.row_label] ||= [];
            acc[seat.row_label].push(seat);
            return acc;
        }, {});

        Object.keys(grouped).forEach(row => {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'seat-row';

            const label = document.createElement('span');
            label.className = 'row-label';
            label.textContent = row;
            rowDiv.appendChild(label);

            const buttonsDiv = document.createElement('div');
            buttonsDiv.className = 'seat-buttons';

            grouped[row].forEach(seat => {
                const btn = document.createElement('button');
                btn.className = 'seat-btn ' + (seat.is_booked ? 'booked' : selectedSeats.some(s=>s.id===seat.id)?'selected':'available');
                btn.textContent = seat.seat_number;

                btn.disabled = seat.is_booked;
                
                let tooltipText = `Seat ${seat.row_label}${seat.seat_number}\n₱${seat.price}\nAvailable`;
                if (seat.is_booked) {
                    tooltipText = `Seat ${seat.row_label}${seat.seat_number}\n₱${seat.price}\nBooked`;
                } else if (selectedSeats.some(s=>s.id===seat.id)) {
                    tooltipText = `Seat ${seat.row_label}${seat.seat_number}\n₱${seat.price}\nSelected`;
                }
                
                btn.dataset.tooltip = tooltipText;

                btn.addEventListener('click', () => selectSeat(seat));
                buttonsDiv.appendChild(btn);
            });

            rowDiv.appendChild(buttonsDiv);

            const priceSpan = document.createElement('span');
            priceSpan.className = 'row-price';
            priceSpan.textContent = '₱'+ROW_PRICES[row];
            rowDiv.appendChild(priceSpan);

            seatContainer.appendChild(rowDiv);
        });

        if(availableCountEl) availableCountEl.textContent = seats.filter(s=>!s.is_booked).length;
        if(bookedCountEl) bookedCountEl.textContent = seats.filter(s=>s.is_booked).length;
    }

    function renderSelectedSeats() {
        selectedSeatsContainer.innerHTML = '';

        if(selectedSeats.length===0){
            selectedSeatsContainer.textContent = 'No seats selected yet';
        } else {
            selectedSeats.forEach(seat=>{
                const div = document.createElement('div');
                div.className='selected-seat-item';
                div.innerHTML = `<span>${seat.row_label}${seat.seat_number} — ₱${seat.price}</span>`;
                const btn = document.createElement('button');
                btn.className='modal-btn confirm';
                btn.textContent='Confirm';
                btn.addEventListener('click', ()=>confirmCheckout(seat));
                div.appendChild(btn);
                selectedSeatsContainer.appendChild(div);
            });
        }

        if(totalPriceEl) totalPriceEl.textContent = selectedSeats.length>0 ? 'Total: ₱'+selectedSeats.reduce((sum,s)=>sum+s.price,0) : '';
    }

    function selectSeat(seat){
        if(seat.is_booked) return;
        const index = selectedSeats.findIndex(s => s.id === seat.id);
        if (index > -1) selectedSeats.splice(index, 1);
        else selectedSeats.push({...seat});
        renderSeats();
        renderSelectedSeats();
    }

    function confirmCheckout(seat){
        const mainSeat = seats.find(s => s.id === seat.id);
        if(mainSeat) mainSeat.is_booked = true;
        selectedSeats = selectedSeats.filter(s=>s.id!==seat.id);
        alert(`Seat ${seat.row_label}${seat.seat_number} successfully booked!`);
        renderSeats();
        renderSelectedSeats();
    }

    function resetSeats(){
        seats = generateSeats();
        selectedSeats = [];
        renderSeats();
        renderSelectedSeats();
    }

    seats = generateSeats();
    renderSeats();
    renderSelectedSeats();
    if(resetBtn) resetBtn.addEventListener('click', resetSeats);
}