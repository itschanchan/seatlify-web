/* ==========================================================
   SEAT PLANNER TOOLS
   Handles: Chart view (rows/tables), group selection,
            chart history, edit mode UI, seat slider,
            add/remove rows, label editing, seat reservation
   (Previously: seat-mapper.js)
========================================================== */

import { loadCurrentEventStats } from './seat-planner.js';

/* ==========================
   STATE
========================== */
export let chartLayoutMode    = 'row'; // 'row' | 'table'
export let isChartEditMode    = true;
export let selectedChartGroup = null;

let chartSeatSlider = null;

/* ==========================
   CHART HISTORY MANAGER
========================== */
export const chartHistoryManager = {
    undoStack:  [],
    redoStack:  [],
    maxHistory: 50,

    getStorageKey() {
        const eventId = localStorage.getItem('seatlify_current_event_id');
        return eventId ? `seatlify_chart_history_${eventId}` : null;
    },

    loadHistory() {
        // History is now transient (in-memory only). Do not load from storage.
        return;
    },

    saveHistory() {
        // History is now transient (in-memory only). Do not save to storage.
        return;
    },

    saveState() {
        if (!isChartEditMode) return;
        const container = document.getElementById('seatPlannerRowContainer');
        if (!container) return;
        const currentState = container.innerHTML;
        if (this.undoStack.length > 0 &&
            this.undoStack[this.undoStack.length - 1] === currentState) return;

        this.redoStack = [];
        this.undoStack.push(currentState);
        if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
        this.saveHistory();
        this.updateButtons();
    },

    undo() {
        if (!isChartEditMode || this.undoStack.length <= 1) return;
        const container = document.getElementById('seatPlannerRowContainer');
        if (!container) return;
        this.redoStack.push(container.innerHTML);
        container.innerHTML = this.undoStack.pop();
        this.saveHistory();
        this._rebindChart();
        this.updateButtons();
    },

    redo() {
        if (!isChartEditMode || this.redoStack.length === 0) return;
        const container = document.getElementById('seatPlannerRowContainer');
        if (!container) return;
        this.undoStack.push(container.innerHTML);
        container.innerHTML = this.redoStack.pop();
        this.saveHistory();
        this._rebindChart();
        this.updateButtons();
    },

    _rebindChart() {
        initChartSortable();
        updateChartEditModeUI();
        loadCurrentEventStats();
        deselectAllChartGroups();
        updateOverallSliderMax();

        const slider     = document.getElementById('seat-slider');
        const firstGroup = document.querySelector('#seatPlannerRowContainer .chart-group');
        if (slider && firstGroup) {
            slider.value = firstGroup.querySelectorAll('.chart-seat').length;
        }
    },

    clear() {
        this.undoStack = [];
        this.redoStack = [];
        this.saveHistory();
        this.updateButtons();
    },

    updateButtons() {
        const btnUndo = document.getElementById('btnUndoChart');
        const btnRedo = document.getElementById('btnRedoChart');
        if (btnUndo) btnUndo.disabled = this.undoStack.length <= 1 || !isChartEditMode;
        if (btnRedo) btnRedo.disabled = this.redoStack.length === 0 || !isChartEditMode;
    }
};

/* ==========================
   INIT
========================== */
export function initSeatMapper() {
    const currentEventId = localStorage.getItem('seatlify_current_event_id');
    if (currentEventId) {
        const savedMode   = localStorage.getItem(`seatlify_chart_edit_mode_${currentEventId}`);
        isChartEditMode   = savedMode === 'false' ? false : true;

        const savedLayout = localStorage.getItem(`seatlify_chart_layout_mode_${currentEventId}`);
        if (savedLayout) chartLayoutMode = savedLayout;
    }

    updateChartGroupingButtonsUI();
    bindUndoRedoChartButtons();
    bindChartGroupingButtons();
    bindRowLabelToggle();
    bindOverallSeatSlider();
    bindChartEditControls();
    bindAutoBuildButton();
    bindClearChartButton();
    bindChartToolsAccordionState();
    initChartSortable();
    initSeatSlider();
    chartHistoryManager.loadHistory();
    refreshChartLayout();
}

/* ==========================
   UNDO / REDO BUTTONS
========================== */
function bindUndoRedoChartButtons() {
    document.getElementById('btnUndoChart')
        ?.addEventListener('click', () => chartHistoryManager.undo());
    document.getElementById('btnRedoChart')
        ?.addEventListener('click', () => chartHistoryManager.redo());
}

/* ==========================
   OVERALL SEAT SLIDER
========================== */
function bindOverallSeatSlider() {
    const slider = document.getElementById('seat-slider');
    if (!slider) return;

    slider.addEventListener('change', () => {
        if (isChartEditMode) chartHistoryManager.saveState();
    });

    slider.addEventListener('input', (e) => {
        if (!isChartEditMode) {
            alert('Please enter edit mode to change seat counts.');
            const firstGroup = document.querySelector('#seatPlannerRowContainer .chart-group');
            if (firstGroup) slider.value = firstGroup.querySelectorAll('.chart-seat').length;
            return;
        }
        const newSeatCount = parseInt(e.target.value, 10);
        document.querySelectorAll('#seatPlannerRowContainer .chart-group').forEach(group => {
            updateSeatsInGroup(group, newSeatCount);
        });
        loadCurrentEventStats();
    });
}

export function updateOverallSliderMax() {
    const slider   = document.getElementById('seat-slider');
    const maxInput = document.getElementById('seat-slider-max');
    if (!slider || !maxInput) return;

    const currentEventId = localStorage.getItem('seatlify_current_event_id');
    if (!currentEventId || typeof MockDB === 'undefined') return;

    const event = MockDB.getEvents().find(e => e.event_id == currentEventId);
    if (!event) return;

    const groups      = document.querySelectorAll('#seatPlannerRowContainer .chart-group');
    const numGroups   = groups.length;
    const maxCapacity = parseInt(event.total_seats) || 0;
    let newMax        = (maxCapacity > 0 && numGroups > 0)
        ? Math.floor(maxCapacity / numGroups) : 100;
    newMax = Math.max(newMax, 1);

    slider.max           = newMax;
    maxInput.textContent = newMax;

    if (parseInt(slider.value) > newMax) {
        slider.value = newMax;
        slider.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

/* ==========================
   SEAT SWIPER SLIDER
========================== */
function initSeatSlider() {
    if (typeof Swiper === 'undefined') {
        setTimeout(initSeatSlider, 100);
        return;
    }

    const sliderEl = document.getElementById('chartSeatSlider');
    if (!sliderEl) return;

    if (chartSeatSlider && !chartSeatSlider.destroyed) {
        chartSeatSlider.destroy(true, true);
        chartSeatSlider = null;
    }

    const maxInput  = document.getElementById('seatSliderMaxInput');
    const maxSeats  = maxInput ? parseInt(maxInput.value, 10) : 30;
    const wrapper   = sliderEl.querySelector('.swiper-wrapper');

    if (wrapper) {
        wrapper.innerHTML = '';
        for (let i = 1; i <= maxSeats; i++) {
            wrapper.innerHTML +=
                `<div class="swiper-slide text-center fs-5" style="color: var(--text-main);">${i}</div>`;
        }
    }

    const valueEl    = document.getElementById('currentSeatSliderValue');
    const currentVal = valueEl ? parseInt(valueEl.textContent, 10) : 12;
    const initialSlide = Math.min(Math.max(0, currentVal - 1), maxSeats - 1);

    chartSeatSlider = new Swiper(sliderEl, {
        slidesPerView: 'auto',
        centeredSlides: true,
        spaceBetween: 10,
        initialSlide,
    });

    chartSeatSlider.on('slideChange', () => {
        if (valueEl) {
            const newSeatCount = parseInt(
                chartSeatSlider.slides[chartSeatSlider.activeIndex].textContent
            );
            valueEl.textContent = newSeatCount;
            chartHistoryManager.saveState();
            if (selectedChartGroup) updateSeatsInSelectedGroup(newSeatCount);
        }
    });

    if (maxInput && !maxInput.hasAttribute('listener-added')) {
        maxInput.setAttribute('listener-added', 'true');
        maxInput.addEventListener('change', () => initSeatSlider());
    }
}

/* ==========================
   SEAT COUNT HELPERS
========================== */
export function updateSeatsInGroup(group, newSeatCount) {
    const seatsDiv = group.querySelector('.d-flex.flex-wrap.gap-2');
    if (!seatsDiv) return;

    const addBtn      = seatsDiv.querySelector('.btn-add-seat-chart');
    const currentCount = seatsDiv.querySelectorAll('.chart-seat').length;

    if (newSeatCount > currentCount) {
        for (let i = 0; i < newSeatCount - currentCount; i++) {
            const seatEl = createNewSeatElement(seatsDiv);
            addBtn ? seatsDiv.insertBefore(seatEl, addBtn) : seatsDiv.appendChild(seatEl);
        }
    } else if (newSeatCount < currentCount) {
        for (let i = 0; i < currentCount - newSeatCount; i++) {
            seatsDiv.querySelector('.chart-seat:last-of-type')?.remove();
        }
    }

    seatsDiv.querySelectorAll('.chart-seat').forEach((seat, i) => { seat.textContent = i + 1; });

    const finalCount = seatsDiv.querySelectorAll('.chart-seat').length;
    const badge      = group.querySelector('.badge');
    if (badge) badge.textContent = `${finalCount} seats`;
}

function updateSeatsInSelectedGroup(newSeatCount) {
    if (!selectedChartGroup) return;
    const seatsDiv = selectedChartGroup.querySelector('.d-flex.flex-wrap.gap-2');
    if (!seatsDiv) return;

    const addBtn       = seatsDiv.querySelector('.btn-add-seat-chart');
    const currentCount = seatsDiv.querySelectorAll('.chart-seat').length;

    if (newSeatCount > currentCount) {
        if (addBtn) for (let i = 0; i < newSeatCount - currentCount; i++) addBtn.click();
    } else {
        for (let i = 0; i < currentCount - newSeatCount; i++) {
            seatsDiv.querySelector('.chart-seat:last-of-type')?.remove();
        }
    }

    const badge = selectedChartGroup.querySelector('.badge');
    if (badge) badge.textContent = `${newSeatCount} seats`;
    loadCurrentEventStats();
}

function createNewSeatElement(seatsDiv) {
    const newSeatNumber = seatsDiv.querySelectorAll('.chart-seat').length + 1;
    const rowCard       = seatsDiv.closest('.chart-group');
    const label         = rowCard?.querySelector('.row-label')?.textContent || 'Row';

    const seatEl = document.createElement('div');
    seatEl.className = 'chart-seat d-flex align-items-center justify-content-center border rounded';
    if (chartLayoutMode === 'table') seatEl.classList.add('rounded-circle');
    seatEl.style.cssText =
        'width: 30px; height: 30px; font-size: 12px; cursor: pointer; background-color: var(--bg-muted); color: var(--text-main);';
    seatEl.textContent = newSeatNumber;

    Object.assign(seatEl.dataset, {
        bsToggle:    'popover',
        bsTrigger:   'hover',
        bsPlacement: 'top',
        bsTitle:     `${label}, Seat ${newSeatNumber}`,
        bsContent:   'Status: Available',
        bsContainer: 'body'
    });

    const popover = new bootstrap.Popover(seatEl, { container: 'body' });
    isChartEditMode ? popover.disable() : popover.enable();

    return seatEl;
}

/* ==========================
   GROUP SELECTION
========================== */
export function selectChartGroup(groupEl) {
    if (!isChartEditMode) return;

    if (selectedChartGroup && selectedChartGroup !== groupEl) {
        selectedChartGroup.classList.remove('selected');
    }

    if (selectedChartGroup === groupEl) {
        groupEl.classList.remove('selected');
        deselectAllChartGroups();
    } else {
        groupEl.classList.add('selected');
        selectedChartGroup = groupEl;

        const sliderContainer  = document.getElementById('seatSliderContainer');
        const valueEl          = document.getElementById('currentSeatSliderValue');
        const currentSeatCount = groupEl.querySelectorAll('.chart-seat').length;

        if (chartSeatSlider) chartSeatSlider.slideTo(Math.max(0, currentSeatCount - 1), 0);
        if (valueEl)         valueEl.textContent = currentSeatCount;
        if (sliderContainer) sliderContainer.style.display = 'block';
    }
}

export function deselectAllChartGroups() {
    if (selectedChartGroup) selectedChartGroup.classList.remove('selected');
    selectedChartGroup = null;
    const sliderContainer = document.getElementById('seatSliderContainer');
    if (sliderContainer) sliderContainer.style.display = 'none';
}

/* ==========================
   LABEL EDITING
========================== */
export function editChartLabel(e) {
    const button  = e.currentTarget;
    const labelEl = button.parentElement.querySelector('.row-label');
    if (!labelEl) return;

    const currentLabel = labelEl.textContent;
    const newLabel     = prompt('Enter new label:', currentLabel);
    if (newLabel && newLabel.trim() && newLabel.trim() !== currentLabel) {
        chartHistoryManager.saveState();
        labelEl.textContent = newLabel.trim();
    }
}

/* ==========================
   ADD / REMOVE ROWS
========================== */
function addChartRowButton(container) {
    const wrapper = document.createElement('div');
    wrapper.id        = 'chartBtnWrapper';
    wrapper.className = 'd-flex gap-2 mt-3 w-100';

    const addRowBtn = document.createElement('button');
    addRowBtn.id        = 'chartAddRowBtn';
    addRowBtn.className = 'btn btn-outline-secondary flex-grow-1';
    addRowBtn.style.borderStyle = 'dashed';
    addRowBtn.innerHTML = `<i class="bi bi-plus-lg"></i> ${chartLayoutMode === 'table' ? 'Add Table' : 'Add Row'}`;
    addRowBtn.addEventListener('click', addNewRowToChart);

    const reduceBtn = document.createElement('button');
    reduceBtn.id        = 'chartReduceBtn';
    reduceBtn.className = 'btn btn-outline-danger';
    reduceBtn.style.borderStyle = 'dashed';
    reduceBtn.innerHTML = '<i class="bi bi-dash-lg"></i>';
    reduceBtn.title     = chartLayoutMode === 'table' ? 'Remove Last Table' : 'Remove Last Row';
    reduceBtn.addEventListener('click', removeLastRowFromChart);

    wrapper.appendChild(addRowBtn);
    wrapper.appendChild(reduceBtn);
    container.appendChild(wrapper);
}

function addNewRowToChart() {
    const container  = document.getElementById('seatPlannerRowContainer');
    const btnWrapper = document.getElementById('chartBtnWrapper');
    if (!container || !btnWrapper) return;

    container.querySelector('.text-center.text-muted')?.remove();

    const existingRows = container.querySelectorAll('.p-3.border.rounded.shadow-sm').length;
    const labelText    = chartLayoutMode === 'row'
        ? `Row ${String.fromCharCode(65 + (existingRows % 26))}${Math.floor(existingRows / 26) > 0 ? Math.floor(existingRows / 26) : ''}`
        : `Table ${existingRows + 1}`;

    const groupDiv = document.createElement('div');
    groupDiv.className              = 'p-3 border rounded shadow-sm chart-group';
    groupDiv.style.backgroundColor  = 'var(--bg-panel)';
    groupDiv.style.borderColor      = 'var(--border-color)';
    groupDiv.style.cursor           = 'pointer';
    groupDiv.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-2">
            <div class="d-flex align-items-center gap-2">
                <strong class="row-label" style="color: var(--text-main);">${labelText}</strong>
                <button class="btn btn-sm btn-link p-0 btn-edit-label"
                        title="Edit Label"
                        style="color: var(--text-muted);">
                    <i class="bi bi-pencil-square"></i>
                </button>
            </div>
            <span class="badge bg-secondary">0 seats</span>
        </div>
        <div class="d-flex flex-wrap gap-2"></div>
    `;

    groupDiv.querySelector('.btn-edit-label').addEventListener('click', editChartLabel);
    groupDiv.addEventListener('click', () => selectChartGroup(groupDiv));

    const seatsDiv = groupDiv.querySelector('.d-flex.flex-wrap.gap-2');
    seatsDiv.appendChild(createChartAddSeatBtn());
    seatsDiv.appendChild(createChartReduceSeatBtn());

    chartHistoryManager.saveState();
    container.insertBefore(groupDiv, btnWrapper);
    updateOverallSliderMax();
}

function removeLastRowFromChart() {
    const container = document.getElementById('seatPlannerRowContainer');
    if (!container) return;

    const groups    = container.querySelectorAll('.chart-group');
    if (groups.length === 0) return;

    const lastGroup      = groups[groups.length - 1];
    const label          = lastGroup.querySelector('.row-label')?.textContent;
    const currentEventId = localStorage.getItem('seatlify_current_event_id');

    if (label && currentEventId && typeof MockDB !== 'undefined') {
        const event = MockDB.getEvents().find(e => e.event_id == currentEventId);
        if (event?.reservations?.some(r => r.row === label)) {
            if (!confirm(
                `The row "${label}" contains RESERVED seats. Deleting it will remove these seats from the layout. Continue?`
            )) return;
        }
    }

    chartHistoryManager.saveState();
    if (selectedChartGroup === lastGroup) deselectAllChartGroups();
    lastGroup.remove();
    loadCurrentEventStats();
    updateOverallSliderMax();
}

/* ==========================
   ADD / REDUCE SEAT BUTTONS
========================== */
export function createChartAddSeatBtn() {
    const btn       = document.createElement('button');
    btn.className   = 'btn btn-sm btn-outline-secondary border-dashed btn-add-seat-chart d-flex align-items-center justify-content-center';
    btn.style.cssText = `width: 30px; height: 30px; border-radius: ${chartLayoutMode === 'table' ? '50%' : '4px'};`;
    btn.innerHTML   = '<i class="bi bi-plus"></i>';
    btn.title       = 'Add Seat';

    btn.onclick = function (e) {
        e.stopPropagation();
        chartHistoryManager.saveState();

        const totalSeatsEl     = document.getElementById('plannerTotalSeats');
        const chartContainer   = document.getElementById('seatPlannerRowContainer');
        const currentSeats     = chartContainer.querySelectorAll('.chart-seat').length;
        const total            = parseInt(totalSeatsEl.dataset.total) || 0;

        if (total > 0 && currentSeats >= total) {
            alert('Seat limit reached. Increase event capacity to add more seats.');
            return;
        }

        const seatsDiv      = this.parentNode;
        const newSeatNumber = seatsDiv.querySelectorAll('.chart-seat').length + 1;

        const seatEl = document.createElement('div');
        seatEl.className = `chart-seat d-flex align-items-center justify-content-center border ${chartLayoutMode === 'table' ? 'rounded-circle' : 'rounded'}`;
        seatEl.style.cssText =
            'width: 30px; height: 30px; font-size: 12px; cursor: pointer; background-color: var(--bg-muted); color: var(--text-main);';
        seatEl.textContent = newSeatNumber;

        const rowCard = seatsDiv.closest('.p-3');
        let popoverTitle = `Seat ${newSeatNumber}`;
        let price        = 0;

        if (rowCard) {
            const label          = rowCard.querySelector('.row-label')?.textContent || '';
            const originalLabel  = rowCard.dataset.originalLabel;
            const currentEventId = localStorage.getItem('seatlify_current_event_id');
            if (currentEventId && typeof MockDB !== 'undefined') {
                const event  = MockDB.getEvents().find(ev => ev.event_id == currentEventId);
                const ticket = event?.tickets?.find(t =>
                    (originalLabel && t.original_name === originalLabel) || t.name === label
                );
                if (ticket) price = ticket.price;
            }
            popoverTitle   = `${label}, Seat ${newSeatNumber}`;
            const badge    = rowCard.querySelector('.badge');
            if (badge) badge.textContent = `${newSeatNumber} seats`;
        }

        Object.assign(seatEl.dataset, {
            bsToggle:    'popover',
            bsTrigger:   'hover',
            bsPlacement: 'top',
            bsHtml:      'true',
            bsTitle:     popoverTitle,
            bsContent:   `Price: ₱${price}<br>Status: Available`,
            bsContainer: 'body'
        });

        seatsDiv.insertBefore(seatEl, this);
        new bootstrap.Popover(seatEl, { container: 'body' }).disable();
        loadCurrentEventStats();
    };
    return btn;
}

export function createChartReduceSeatBtn() {
    const btn       = document.createElement('button');
    btn.className   = 'btn btn-sm btn-outline-danger border-dashed btn-reduce-seat-chart d-flex align-items-center justify-content-center';
    btn.style.cssText = `width: 30px; height: 30px; border-radius: ${chartLayoutMode === 'table' ? '50%' : '4px'};`;
    btn.innerHTML   = '<i class="bi bi-dash"></i>';
    btn.title       = 'Remove Seat';

    btn.onclick = function (e) {
        e.stopPropagation();
        const seatsDiv = this.parentNode;
        const seats    = seatsDiv.querySelectorAll('.chart-seat');
        if (seats.length === 0) return;

        const seatToRemove  = seats[seats.length - 1];
        const seatNum       = parseInt(seatToRemove.textContent);
        const rowCard       = seatsDiv.closest('.chart-group');
        const label         = rowCard?.querySelector('.row-label')?.textContent;
        const currentEventId = localStorage.getItem('seatlify_current_event_id');

        if (label && currentEventId && typeof MockDB !== 'undefined') {
            if (MockDB.isSeatReserved(currentEventId, label, seatNum)) {
                if (!confirm(
                    `Seat ${seatNum} in "${label}" is RESERVED. Deleting it will remove this seat from the layout. Continue?`
                )) return;
            }
        }

        chartHistoryManager.saveState();
        seatToRemove.remove();

        if (rowCard) {
            const badge = rowCard.querySelector('.badge');
            if (badge) badge.textContent = `${seats.length - 1} seats`;
        }
        loadCurrentEventStats();
    };
    return btn;
}

/* ==========================
   CHART GROUPING (ROW / TABLE)
========================== */
function bindChartGroupingButtons() {
    const btnRow   = document.getElementById('btnGroupRow');
    const btnTable = document.getElementById('btnGroupTable');

    const setMode = (mode) => {
        if (isChartEditMode && mode !== chartLayoutMode) saveChartState(true);
        chartLayoutMode = mode;
        updateChartGroupingButtonsUI();
        const currentEventId = localStorage.getItem('seatlify_current_event_id');
        if (currentEventId)
            localStorage.setItem(`seatlify_chart_layout_mode_${currentEventId}`, mode);
        deselectAllChartGroups();
        refreshChartLayout();
    };

    btnRow  ?.addEventListener('click', () => setMode('row'));
    btnTable?.addEventListener('click', () => setMode('table'));
}

export function updateChartGroupingButtonsUI() {
    const btnRow   = document.getElementById('btnGroupRow');
    const btnTable = document.getElementById('btnGroupTable');
    if (!btnRow || !btnTable) return;

    btnTable.classList.toggle('active', chartLayoutMode === 'table');
    btnRow.classList.toggle('active',   chartLayoutMode === 'row');
}

/* ==========================
   ROW LABEL TOGGLE
========================== */
function bindRowLabelToggle() {
    document.getElementById('toggleRowLabels')?.addEventListener('change', (e) => {
        document.querySelectorAll('.row-label').forEach(l => {
            l.style.display = e.target.checked ? 'block' : 'none';
        });
    });
}

/* ==========================
   SORTABLE
========================== */
export function initChartSortable() {
    const container = document.getElementById('seatPlannerRowContainer');
    if (container && typeof Sortable !== 'undefined') {
        new Sortable(container, {
            animation:  150,
            ghostClass: 'bg-light',
            draggable:  '.shadow-sm',
            onEnd: () => chartHistoryManager.saveState()
        });
    }
}

/* ==========================
   SAVE CHART
========================== */
export function saveChartState(silent = false) {
    const chartContainer = document.getElementById('seatPlannerRowContainer');
    const currentEventId = localStorage.getItem('seatlify_current_event_id');

    if (!currentEventId || typeof MockDB === 'undefined') {
        if (!silent) alert('Chart layout saved locally (No active event linked).');
        return;
    }

    const event = MockDB.getEvents().find(e => e.event_id == currentEventId);
    if (!event) {
        if (!silent) alert('Error: Could not find the current event to save to.');
        return;
    }

    const newLayoutData = [];
    let tickets = event.tickets ? JSON.parse(JSON.stringify(event.tickets)) : [];

    chartContainer.querySelectorAll('.p-3.border.rounded.shadow-sm').forEach(rowEl => {
        const currentDomLabel = rowEl.querySelector('.row-label')?.textContent.trim() || '';
        const originalLabel   = rowEl.dataset.originalLabel;
        const seats           = rowEl.querySelectorAll('.chart-seat').length;
        if (!currentDomLabel) return;

        if (originalLabel) {
            newLayoutData.push({ label: originalLabel, seats });
            const ticketIndex = tickets.findIndex(t => t.original_name === originalLabel);
            if (currentDomLabel !== originalLabel) {
                if (ticketIndex !== -1) {
                    tickets[ticketIndex].name = currentDomLabel;
                } else {
                    tickets.push({
                        name:          currentDomLabel,
                        original_name: originalLabel,
                        price: 0,
                        qty:   seats
                    });
                }
            } else {
                if (ticketIndex !== -1 && !tickets[ticketIndex].price) {
                    tickets.splice(ticketIndex, 1);
                }
            }
        } else {
            newLayoutData.push({ label: currentDomLabel, seats });
        }
    });

    const seatCount = newLayoutData.reduce((acc, g) => acc + g.seats, 0);
    
    // Calculate Map Seats from DB to add to total
    let mapSeats = 0;
    if (event.blueprint_layout) {
        if (typeof event.blueprint_layout === 'string') {
            const temp = document.createElement('div');
            temp.innerHTML = event.blueprint_layout;
            mapSeats = temp.querySelectorAll('.shape.chair').length;
        } else if (Array.isArray(event.blueprint_layout)) {
            mapSeats = event.blueprint_layout.filter(s => s.type === 'chair').length;
        }
    }

    const updatePayload = { tickets };
    updatePayload[`${chartLayoutMode}_layout_data`] = newLayoutData;
    updatePayload.designed_seats = seatCount + mapSeats;
    MockDB.updateEvent(currentEventId, updatePayload);

    if (!silent) {
        alert(`Chart layout saved! Total Seats: ${seatCount + mapSeats}`);
    }
    console.log('Chart state saved.');
    loadCurrentEventStats();
}

/* ==========================
   EDIT MODE CONTROLS
========================== */
function bindChartEditControls() {
    const btnSave = document.getElementById('btnSaveChart');
    const btnEdit = document.getElementById('btnEditChart');

    btnSave?.addEventListener('click', () => {
        saveChartState(false);
        isChartEditMode = false;
        const currentEventId = localStorage.getItem('seatlify_current_event_id');
        if (currentEventId)
            localStorage.setItem(`seatlify_chart_edit_mode_${currentEventId}`, 'false');
        updateChartEditModeUI();
    });

    btnEdit?.addEventListener('click', () => {
        isChartEditMode = true;
        const currentEventId = localStorage.getItem('seatlify_current_event_id');
        if (currentEventId)
            localStorage.setItem(`seatlify_chart_edit_mode_${currentEventId}`, 'true');
        updateChartEditModeUI();
    });
}

export function updateChartEditModeUI() {
    const container = document.getElementById('seatPlannerRowContainer');
    if (!container) return;

    const btnWrapper = document.getElementById('chartBtnWrapper');
    if (btnWrapper) {
        if (isChartEditMode) {
            btnWrapper.classList.add('d-flex');
            btnWrapper.style.display = '';
        } else {
            btnWrapper.classList.remove('d-flex');
            btnWrapper.style.display = 'none';
        }
    }

    const overallSliderContainer = document.getElementById('overallSeatSliderContainer');
    if (overallSliderContainer)
        overallSliderContainer.style.display = isChartEditMode ? 'block' : 'none';

    const btnAutoBuild  = document.getElementById('btnAutoBuild');
    if (btnAutoBuild)   btnAutoBuild.disabled = !isChartEditMode;

    const btnClearChart = document.getElementById('btnClearChart');
    if (btnClearChart)  btnClearChart.disabled = !isChartEditMode;

    const btnGroupRow = document.getElementById('btnGroupRow');
    if (btnGroupRow) btnGroupRow.disabled = !isChartEditMode;

    const btnGroupTable = document.getElementById('btnGroupTable');
    if (btnGroupTable) btnGroupTable.disabled = !isChartEditMode;

    const btnSave = document.getElementById('btnSaveChart');
    const btnEdit = document.getElementById('btnEditChart');
    if (btnSave && btnEdit) {
        btnSave.style.display = isChartEditMode ? 'inline-block' : 'none';
        btnEdit.style.display = isChartEditMode ? 'none' : 'inline-block';
    }

    const sortableInstance = typeof Sortable !== 'undefined'
        ? Sortable.get(container) : null;
    if (sortableInstance) sortableInstance.option('disabled', !isChartEditMode);

    container.querySelectorAll('.p-3.border.rounded.shadow-sm').forEach(row => {
        const editLabelBtn = row.querySelector('.btn-edit-label');
        if (editLabelBtn)
            editLabelBtn.style.display = isChartEditMode ? 'inline-block' : 'none';

        const seatsDiv = row.querySelector('.d-flex.flex-wrap.gap-2');
        if (seatsDiv) {
            const existingAdd    = seatsDiv.querySelector('.btn-add-seat-chart');
            const existingReduce = seatsDiv.querySelector('.btn-reduce-seat-chart');
            if (isChartEditMode) {
                if (!existingAdd)    seatsDiv.appendChild(createChartAddSeatBtn());
                if (!existingReduce) seatsDiv.appendChild(createChartReduceSeatBtn());
            } else {
                existingAdd?.remove();
                existingReduce?.remove();
            }
        }
    });

    container.querySelectorAll('.chart-seat').forEach(seat => {
        let popover = bootstrap.Popover.getInstance(seat);
        if (!popover) popover = new bootstrap.Popover(seat, { container: 'body' });
        isChartEditMode ? popover.disable() : popover.enable();
    });

    if (!isChartEditMode) deselectAllChartGroups();
    chartHistoryManager.updateButtons();
}

/* ==========================
   AUTO BUILD
========================== */
function bindAutoBuildButton() {
    document.getElementById('btnAutoBuild')?.addEventListener('click', () => {
        const currentEventId = localStorage.getItem('seatlify_current_event_id');
        let totalSeats = 0;

        if (currentEventId && typeof MockDB !== 'undefined') {
            const event = MockDB.getEvents().find(e => e.event_id == currentEventId);
            if (event) totalSeats = parseInt(event.total_seats) || 0;
        }

        if (totalSeats === 0) {
            const input = prompt('No seat count found. Enter total seats to generate:', '50');
            if (input) totalSeats = parseInt(input);
        }

        if (totalSeats > 0) {
            chartHistoryManager.saveState();
            generateChartLayout(totalSeats);
        } else {
            alert('Please set a total seat count for this event first.');
        }
    });
}

/* ==========================
   CLEAR CHART
========================== */
function bindClearChartButton() {
    document.getElementById('btnClearChart')?.addEventListener('click', () => {
        const currentEventId = localStorage.getItem('seatlify_current_event_id');
        let hasReserved = false;

        if (currentEventId && typeof MockDB !== 'undefined') {
            const event = MockDB.getEvents().find(e => e.event_id == currentEventId);
            if (event?.reservations) {
                const container = document.getElementById('seatPlannerRowContainer');
                if (container) {
                    const labels = Array.from(container.querySelectorAll('.row-label'))
                        .map(el => el.textContent);
                    hasReserved = event.reservations.some(r => labels.includes(r.row));
                }
            }
        }

        const msg = hasReserved
            ? 'Warning: There are RESERVED seats in this chart. Clearing it will remove these seats from the layout. Continue?'
            : 'Clear all rows in the chart view?';

        if (confirm(msg)) {
            chartHistoryManager.saveState();
            const container = document.getElementById('seatPlannerRowContainer');
            if (container) container.innerHTML = '';
            deselectAllChartGroups();
            if (isChartEditMode) addChartRowButton(container);
            loadCurrentEventStats();
        }
    });
}

/* ====================================
   CHART TOOLS ACCORDION STATE
==================================== */
function bindChartToolsAccordionState() {
    const accordionCollapseEl = document.getElementById('chartToolsCollapse');
    if (!accordionCollapseEl) return;

    const currentEventId = localStorage.getItem('seatlify_current_event_id');
    const storageKey = currentEventId ? `seatlify_chart_tools_collapsed_${currentEventId}` : null;

    // 1. Restore state on load
    if (storageKey) {
        const isCollapsed = localStorage.getItem(storageKey) === 'true';
        if (isCollapsed) {
            // It has 'show' by default, so we need to remove it.
            accordionCollapseEl.classList.remove('show');
            const button = document.querySelector('button[data-bs-target="#chartToolsCollapse"]');
            if (button) {
                button.classList.add('collapsed');
                button.setAttribute('aria-expanded', 'false');
            }
        }
    }

    // 2. Save state on change
    accordionCollapseEl.addEventListener('shown.bs.collapse', () => {
        if (storageKey) {
            localStorage.setItem(storageKey, 'false');
        }
    });

    accordionCollapseEl.addEventListener('hidden.bs.collapse', () => {
        if (storageKey) {
            localStorage.setItem(storageKey, 'true');
        }
    });
}

/* ==========================
   REFRESH / GENERATE LAYOUT
========================== */
export function refreshChartLayout() {
    const currentEventId = localStorage.getItem('seatlify_current_event_id');
    deselectAllChartGroups();
    if (currentEventId) generateChartLayout();
    chartHistoryManager.saveState();
}

export function generateChartLayout(totalSeats = 0) {
    const container = document.getElementById('seatPlannerRowContainer');
    if (!container) return;
    container.innerHTML = '';

    const currentEventId = localStorage.getItem('seatlify_current_event_id');
    let event = null;
    if (currentEventId && typeof MockDB !== 'undefined') {
        event = MockDB.getEvents().find(e => e.event_id == currentEventId);
    }
    const savedLayoutData = event?.[`${chartLayoutMode}_layout_data`];

    if (savedLayoutData?.length > 0) {
        console.log(`Rendering from saved '${chartLayoutMode}' layout data.`);
        container.className = chartLayoutMode === 'table'
            ? 'd-flex flex-wrap gap-4 justify-content-center'
            : 'd-flex flex-column gap-3';

        savedLayoutData.forEach(groupData => {
            const ticketTier  = event.tickets?.find(t => t.original_name === groupData.label);
            const displayName = ticketTier ? ticketTier.name : groupData.label;
            const price       = ticketTier ? ticketTier.price : 0;

            const groupDiv = _buildGroupDiv(groupData.label, displayName, chartLayoutMode === 'table');
            const seatsDiv = groupDiv.querySelector('.d-flex.flex-wrap.gap-2');

            for (let j = 0; j < groupData.seats; j++) {
                seatsDiv.appendChild(
                    _buildSeatEl(j + 1, groupData.label, displayName, price, currentEventId)
                );
            }
            container.appendChild(groupDiv);
        });

    } else if (totalSeats > 0) {
        console.log(`No saved layout for '${chartLayoutMode}'. Auto-building from total seats: ${totalSeats}.`);
        _autoGenerateLayout(container, totalSeats, event, currentEventId);

    } else {
        container.innerHTML =
            '<div class="text-center text-muted p-4">The chart is empty. Add a new row or use \'Auto Build\' to get started.</div>';
    }

    addChartRowButton(container);
    updateChartEditModeUI();
    loadCurrentEventStats();
    updateOverallSliderMax();
}

/* ── Private helpers ── */

function _buildGroupDiv(originalLabel, displayName, isTable) {
    const groupDiv       = document.createElement('div');
    groupDiv.className   = `p-3 border rounded shadow-sm chart-group${isTable ? ' text-center' : ''}`;
    groupDiv.dataset.originalLabel = originalLabel;
    groupDiv.style.cssText =
        `background-color: var(--bg-panel); border-color: var(--border-color); cursor: pointer;${isTable ? ' width: 200px;' : ''}`;

    groupDiv.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-2">
            <div class="d-flex align-items-center gap-2">
                <strong class="row-label" style="color: var(--text-main);">${displayName}</strong>
                <button class="btn btn-sm btn-link p-0 btn-edit-label"
                        title="Edit Label"
                        style="display: none; color: var(--text-muted);">
                    <i class="bi bi-pencil-square"></i>
                </button>
            </div>
            <span class="badge bg-secondary">0 seats</span>
        </div>
        <div class="d-flex flex-wrap gap-2${isTable ? ' justify-content-center' : ''}"></div>
    `;

    groupDiv.addEventListener('click', () => selectChartGroup(groupDiv));
    groupDiv.querySelector('.btn-edit-label').addEventListener('click', editChartLabel);
    return groupDiv;
}

function _buildSeatEl(seatNumber, label, displayName, price, currentEventId) {
    const seatEl       = document.createElement('div');
    seatEl.className   = `chart-seat d-flex align-items-center justify-content-center border ${chartLayoutMode === 'table' ? 'rounded-circle' : 'rounded'}`;
    seatEl.style.cssText = 'width: 30px; height: 30px; font-size: 12px; cursor: pointer;';
    seatEl.textContent = seatNumber;

    const isReserved     = typeof MockDB !== 'undefined' &&
        MockDB.isSeatReserved(currentEventId, label, seatNumber);
    let popoverStatus    = 'Available';

    if (isReserved) {
        seatEl.style.backgroundColor = 'var(--bs-danger)';
        seatEl.style.color           = 'white';
        popoverStatus = 'Reserved';
        seatEl.onclick = () => {
            const popover = bootstrap.Popover.getInstance(seatEl);
            if (popover) popover.hide();
            if (confirm(`Make seat ${displayName}-${seatNumber} available again? This will remove the guest reservation.`)) {
                MockDB.unreserveSeat(currentEventId, label, seatNumber);
                generateChartLayout();
            }
        };
    } else {
        seatEl.style.backgroundColor = 'var(--bg-muted)';
        seatEl.style.color           = 'var(--text-main)';
        seatEl.onclick = () => {
            if (isChartEditMode) { alert('Exit edit mode to reserve seats.'); return; }
            const popover = bootstrap.Popover.getInstance(seatEl);
            if (popover) popover.hide();
            const guestName = prompt(`Reserve seat ${displayName}-${seatNumber} for:`, 'Guest Name');
            if (guestName) {
                const guestEmail = prompt(
                    `Enter email for ${guestName}:`,
                    `${guestName.toLowerCase().replace(/\s/g, '.')}@example.com`
                );
                if (guestEmail) {
                    MockDB.reserveSeat(currentEventId, label, seatNumber, {
                        name: guestName, email: guestEmail
                    });
                    generateChartLayout();
                }
            }
        };
    }

    Object.assign(seatEl.dataset, {
        bsToggle:    'popover',
        bsTrigger:   'hover',
        bsPlacement: 'top',
        bsHtml:      'true',
        bsTitle:     `${displayName}, Seat ${seatNumber}`,
        bsContent:   `Price: ₱${price}<br>Status: ${popoverStatus}`,
        bsContainer: 'body'
    });
    return seatEl;
}

function _autoGenerateLayout(container, totalSeats, event, currentEventId) {
    if (chartLayoutMode === 'table') {
        container.className     = 'd-flex flex-wrap gap-4 justify-content-center';
        const seatsPerTable     = (event && parseInt(event.seats_per_table)) || 10;
        const numTables         = Math.ceil(totalSeats / seatsPerTable);
        let seatsRendered       = 0;

        for (let i = 0; i < numTables; i++) {
            const tableLabel    = `Table ${i + 1}`;
            const ticketTier    = event?.tickets?.find(t => t.name === tableLabel);
            const price         = ticketTier ? ticketTier.price : 0;
            const seatsInTable  = Math.min(seatsPerTable, totalSeats - seatsRendered);

            const tableEl  = _buildGroupDiv(tableLabel, tableLabel, true);
            const seatsDiv = tableEl.querySelector('.d-flex.flex-wrap.gap-2');
            const badge    = tableEl.querySelector('.badge');

            for (let j = 0; j < seatsInTable; j++) {
                seatsDiv.appendChild(_buildSeatEl(j + 1, tableLabel, tableLabel, price, currentEventId));
            }
            if (badge) badge.textContent = `${seatsInTable} seats`;
            seatsRendered += seatsInTable;
            container.appendChild(tableEl);
        }
    } else {
        container.className    = 'd-flex flex-column gap-3';
        const seatsPerGroup    = 10;
        const groupCount       = Math.ceil(totalSeats / seatsPerGroup);

        for (let i = 0; i < groupCount; i++) {
            const labelText = `Row ${String.fromCharCode(65 + (i % 26))}${Math.floor(i / 26) > 0 ? Math.floor(i / 26) : ''}`;
            const ticketTier = event?.tickets?.find(t => t.name === labelText);
            const price      = ticketTier ? ticketTier.price : 0;
            const seatsInGroup = Math.min(seatsPerGroup, totalSeats - i * seatsPerGroup);

            const groupDiv = _buildGroupDiv(labelText, labelText, false);
            const seatsDiv = groupDiv.querySelector('.d-flex.flex-wrap.gap-2');
            const badge    = groupDiv.querySelector('.badge');

            for (let j = 0; j < seatsInGroup; j++) {
                seatsDiv.appendChild(_buildSeatEl(j + 1, labelText, labelText, price, currentEventId));
            }
            if (badge) badge.textContent = `${seatsInGroup} seats`;
            container.appendChild(groupDiv);
        }
    }
}
