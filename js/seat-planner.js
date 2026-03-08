/* ==========================================================
   SEAT PLANNER — MAIN ENTRY POINT
   Handles: Init, shared utilities, keyboard shortcuts,
            tab switching, event stats, Swiper dependency
   Imports: seat-mapper-tools.js  (blueprint / map view)
            seat-planner-tools.js (chart view)
========================================================== */

import {
    initBlueprintTools,
    historyManager,
    saveBlueprintState,
    loadBlueprintLayout,
    setActiveTool,
    deselectAll,
    selectedShape,
} from './seat-mapper-tools.js';

import {
    initSeatMapper,
    chartHistoryManager,
    isChartEditMode,
    saveChartState,
    refreshChartLayout,
    updateChartGroupingButtonsUI,
} from './seat-planner-tools.js';

/* ==========================
   STATE
========================== */
let seatPlannerInitialized = false;

/* ==========================
   INIT
========================== */
export function initSeatPlanner() {
    console.log('initSeatPlanner() called');

    loadSwiperDependencies();
    loadCurrentEventStats();

    if (!seatPlannerInitialized) {
        console.log('Binding global listeners for seat planner.');
        bindKeyboardShortcuts();
        window.saveCurrentPlannerState = saveCurrentPlannerState;
        window.addEventListener('beforeunload', saveCurrentPlannerState);
        window.addEventListener('pagehide',     saveCurrentPlannerState);
    }

    seatPlannerInitialized = true;
    console.log('Seat planner DOM re-initialization');

    const canvas    = document.getElementById('canvasInner');
    const container = document.querySelector('.seat-planner-container');

    if (!canvas || !container) {
        console.error('Seat Planner DOM not ready');
        return;
    }

    // Init sub-modules
    initBlueprintTools(canvas, container);
    initSeatMapper();

    bindTabSwitchers();
    bindEditTotalSeats();
}

/* ==========================
   SHARED STATS
========================== */
export function loadCurrentEventStats() {
    const countEl        = document.getElementById('plannerTotalSeats');
    const currentEventId = localStorage.getItem('seatlify_current_event_id');

    if (!countEl) return;

    if (currentEventId && typeof MockDB !== 'undefined') {
        const event = MockDB.getEvents().find(e => e.event_id == currentEventId);
        if (event) {
            const totalCapacity = parseInt(event.total_seats) || 0;
            countEl.dataset.total = totalCapacity;

            const chartTab      = document.getElementById('pills-chart-tab');
            const isChartActive = chartTab?.classList.contains('active');
            const currentSeats  = isChartActive
                ? document.querySelectorAll('#seatPlannerRowContainer .chart-seat').length
                : document.querySelectorAll('#canvasInner .shape.chair').length;

            countEl.textContent = `${currentSeats} / ${totalCapacity}`;
        } else {
            countEl.textContent   = '0 / 0';
            countEl.dataset.total = 0;
            console.warn(`Event with ID ${currentEventId} not found.`);
        }
    } else {
        countEl.dataset.total = '0';
        countEl.textContent   = '0 / 0';
    }
}

/* ==========================
   EDIT TOTAL SEATS
========================== */
function bindEditTotalSeats() {
    document.getElementById('btnEditTotalSeats')?.addEventListener('click', () => {
        const currentEventId = localStorage.getItem('seatlify_current_event_id');
        if (!currentEventId) {
            alert('No active event selected.');
            return;
        }
        const countEl    = document.getElementById('plannerTotalSeats');
        const currentTotal = countEl?.dataset.total || 0;
        const newTotal   = prompt('Enter total expected capacity:', currentTotal);
        if (newTotal !== null && !isNaN(newTotal) && newTotal.trim() !== '') {
            MockDB.updateEvent(currentEventId, { total_seats: parseInt(newTotal) });
            loadCurrentEventStats();
            // Notify chart tools to update the slider max
            import('./seat-planner-tools.js').then(m => m.updateOverallSliderMax());
        }
    });
}

/* ==========================
   TAB SWITCHING
========================== */
function bindTabSwitchers() {
    const chartTab     = document.getElementById('pills-chart-tab');
    const blueprintTab = document.getElementById('pills-blueprint-tab');

    chartTab?.addEventListener('shown.bs.tab', () => {
        saveBlueprintState(true);
        loadCurrentEventStats();
        refreshChartLayout();
    });

    blueprintTab?.addEventListener('shown.bs.tab', () => {
        saveChartState(true);
        loadBlueprintLayout();
        loadCurrentEventStats();
        historyManager.saveCurrentState();
    });
}

/* ==========================
   KEYBOARD SHORTCUTS
========================== */
function bindKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        const target = e.target;
        if (target.isContentEditable ||
            ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

        const isChartActive =
            document.getElementById('pills-chart-tab')?.classList.contains('active');

        // Undo — Ctrl+Z
        if (e.ctrlKey && e.key.toLowerCase() === 'z' && !e.shiftKey) {
            e.preventDefault();
            if (isChartActive) { if (isChartEditMode) chartHistoryManager.undo(); }
            else historyManager.undo();
        }
        // Redo — Ctrl+Shift+Z or Ctrl+Y
        else if (e.ctrlKey && (e.key.toLowerCase() === 'y' ||
                 (e.key.toLowerCase() === 'z' && e.shiftKey))) {
            e.preventDefault();
            if (isChartActive) { if (isChartEditMode) chartHistoryManager.redo(); }
            else historyManager.redo();
        }
        // Delete — blueprint only
        else if ((e.key === 'Delete' || e.key === 'Backspace') && !isChartActive) {
            const sel = document.querySelector('#canvasInner .shape.selected');
            if (sel) {
                e.preventDefault();
                historyManager.saveCurrentState();
                const wasChair = sel.classList.contains('chair');
                sel.remove();
                deselectAll();
                if (wasChair) loadCurrentEventStats();
            }
        }
    });
}

/* ==========================
   STATE PERSISTENCE
========================== */
export function saveCurrentPlannerState() {
    if (!document.getElementById('seatPlannerTabs')) return;
    console.log('Auto-saving planner state...');
    const chartTab      = document.getElementById('pills-chart-tab');
    const isChartActive = chartTab?.classList.contains('active') ?? true;
    if (isChartActive) saveChartState(true); else saveBlueprintState(true);
}

/* ==========================
   SWIPER DEPENDENCY LOADER
========================== */
function loadSwiperDependencies() {
    if (!document.querySelector('link[href*="swiper-bundle.min.css"]')) {
        const link  = document.createElement('link');
        link.rel    = 'stylesheet';
        link.href   = 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css';
        document.head.appendChild(link);
    }
    if (!document.querySelector('script[src*="swiper-bundle.min.js"]')) {
        const script = document.createElement('script');
        script.src   = 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js';
        document.body.appendChild(script);
    }
}
