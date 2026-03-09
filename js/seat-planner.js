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
export async function initSeatPlanner() {
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

    // Inject Map View HTML
    const mapTab = document.getElementById('pills-blueprint');
    if (mapTab && !mapTab.querySelector('.seat-planner-container')) {
        try {
            const res = await fetch('seat-planner/seat-mapper.html');
            if (res.ok) {
                mapTab.innerHTML = await res.text();
                // Initialize dropdowns
                mapTab.querySelectorAll('.dropdown-toggle').forEach(el => new bootstrap.Dropdown(el));
            } else {
                console.error('Failed to load seat-mapper.html');
            }
        } catch (e) {
            console.error('Error loading seat-mapper.html', e);
        }
    }

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

            // 1. Calculate Chart Seats
            let chartSeats = 0;
            const chartTab = document.getElementById('pills-chart-tab');
            if (chartTab?.classList.contains('active')) {
                // If Chart tab is active, count from DOM
                chartSeats = document.querySelectorAll('#seatPlannerRowContainer .chart-seat').length;
            } else {
                // Else count from DB based on preferred mode
                const mode = localStorage.getItem(`seatlify_chart_layout_mode_${currentEventId}`) || (event.seating_by_table ? 'table' : 'row');
                const data = mode === 'table' ? event.table_layout_data : event.row_layout_data;
                chartSeats = (data || []).reduce((sum, g) => sum + (parseInt(g.seats) || 0), 0);
            }

            // 2. Calculate Map Seats
            let mapSeats = 0;
            const blueprintTab = document.getElementById('pills-blueprint-tab');
            if (blueprintTab?.classList.contains('active')) {
                // If Map tab is active, count from DOM
                mapSeats = document.querySelectorAll('#canvasInner .shape.chair').length;
            } else if (event.blueprint_layout) {
                // Else count from DB
                if (typeof event.blueprint_layout === 'string') {
                    const temp = document.createElement('div');
                    temp.innerHTML = event.blueprint_layout;
                    mapSeats = temp.querySelectorAll('.shape.chair').length;
                } else if (Array.isArray(event.blueprint_layout)) {
                    mapSeats = event.blueprint_layout.filter(s => s.type === 'chair').length;
                }
            }

            countEl.textContent = `${chartSeats + mapSeats} / ${totalCapacity}`;
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
        const newTotal   = prompt('Enter total number of seats:', currentTotal);
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
