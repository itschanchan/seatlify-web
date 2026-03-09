/* ==========================================================
   SEAT MAPPER TOOLS
   Handles: Blueprint canvas tools, shapes, drag, resize,
            zoom, grid, bulk add, blueprint save/load
   (Previously: seat-tools.js)
========================================================== */

import { loadCurrentEventStats } from './seat-planner.js';

/* ==========================
   CONSTANTS
========================== */
export const gridSize   = 25;
export const CHAIR_SIZE = 25;
export const MIN_ZOOM   = 0.5;
export const MAX_ZOOM   = 2;

/* ==========================
   STATE
========================== */
let scrollContainer = null;
export let canvas      = null;
export let container   = null;
export let currentTool = 'select';
export let isBlueprintEditMode = true;
export let scale       = 1;

let isPanning      = false;
let hasPanned      = false;
let isCreating     = false;
let isDraggingShape = false;
let isResizing     = false;

let startX = 0, startY = 0;
let panX = 0, panY = 0;
let startDrawX = 0, startDrawY = 0;
let tempShape = null;

export let selectedShape = null;

/* ==========================
   HISTORY MANAGER (Blueprint)
========================== */
export const historyManager = {
    undoStack: [],
    redoStack: [],
    maxHistory: 50,

    getStorageKey() {
        const eventId = localStorage.getItem('seatlify_current_event_id');
        return eventId ? `seatlify_blueprint_history_${eventId}` : null;
    },

    loadHistory() {
        // History is now transient (in-memory only). Do not load from storage.
        return;
    },

    saveHistory() {
        // History is now transient (in-memory only). Do not save to storage.
        return;
    },

    saveCurrentState() {
        const canvasEl = document.getElementById('canvasInner');
        if (!canvasEl) return;
        this.saveGivenState(canvasEl.innerHTML);
    },

    saveGivenState(state) {
        this.redoStack = [];
        this.undoStack.push(state);
        if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
        this.saveHistory();
        this.updateButtons();
    },

    undo() {
        if (this.undoStack.length <= 1) return;
        const canvasEl = document.getElementById('canvasInner');
        if (!canvasEl) return;
        this.redoStack.push(canvasEl.innerHTML);
        canvasEl.innerHTML = this.undoStack.pop();
        this.saveHistory();
        this._rebindAll();
        this.updateButtons();
    },

    redo() {
        if (this.redoStack.length === 0) return;
        const canvasEl = document.getElementById('canvasInner');
        if (!canvasEl) return;
        this.undoStack.push(canvasEl.innerHTML);
        canvasEl.innerHTML = this.redoStack.pop();
        this.saveHistory();
        this._rebindAll();
        this.updateButtons();
    },

    _rebindAll() {
        const canvasEl = document.getElementById('canvasInner');
        if (!canvasEl) return;
        canvasEl.querySelectorAll('.shape').forEach(el => {
            makeDraggable(el);
            if (!el.classList.contains('chair')) {
                addResizers(el);
            }
        });
        loadCurrentEventStats();
        deselectAll();
    },

    clear() {
        this.undoStack = [];
        this.redoStack = [];
        this.saveHistory();
        this.updateButtons();
    },

    updateButtons() {
        const btnUndo = document.getElementById('btnUndoBlueprint');
        const btnRedo = document.getElementById('btnRedoBlueprint');
        if (btnUndo) btnUndo.disabled = this.undoStack.length <= 1;
        if (btnRedo) btnRedo.disabled = this.redoStack.length === 0;
    }
};

/* ==========================
   INIT
========================== */
export function initBlueprintTools(canvasEl, containerEl) {
    canvas    = canvasEl;
    container = containerEl;
    scrollContainer = container.parentElement;
    scrollContainer.style.overflow = 'hidden'; // Disable native scroll to use transform pan

    canvas.style.transformOrigin = '0 0';
    historyManager.loadHistory();

    bindUndoRedoBlueprintButtons();
    bindToolSelection();
    bindToolbarDragAndDrop();
    bindMouseEvents(scrollContainer);
    bindGridToggle();
    bindZoomControls();
    bindClearButton();
    bindBulkAdd();
    bindSaveButton();
    bindEditButton();
}

/* ==========================
   UNDO / REDO BUTTONS
========================== */
function bindUndoRedoBlueprintButtons() {
    document.getElementById('btnUndoBlueprint')
        ?.addEventListener('click', () => historyManager.undo());
    document.getElementById('btnRedoBlueprint')
        ?.addEventListener('click', () => historyManager.redo());
}

/* ==========================
   TOOL SELECTION
========================== */
export function setActiveTool(tool) {
    currentTool = tool;
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    if (container) container.dataset.activeTool = tool;

    const shapeMainBtn = document.getElementById('shapeMainBtn');
    if (tool === 'rect' || tool === 'circle') {
        shapeMainBtn?.classList.add('active');
    } else {
        document.querySelector(`.tool-btn[data-tool="${tool}"]`)?.classList.add('active');
    }
}

function bindToolSelection() {
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', () => setActiveTool(btn.dataset.tool));
    });

    const shapeMainBtn  = document.getElementById('shapeMainBtn');
    const shapeMainIcon = document.getElementById('shapeMainIcon');

    document.querySelectorAll('.shape-option').forEach(option => {
        option.addEventListener('click', () => {
            shapeMainBtn.dataset.tool   = option.dataset.tool;
            shapeMainIcon.className     = `bi ${option.dataset.icon}`;
            setActiveTool(option.dataset.tool);
        });
    });
}

/* ==========================
   TOOLBAR DRAG & DROP
========================== */
function bindToolbarDragAndDrop() {
    const dropZone = document.getElementById('canvas');

    document.querySelectorAll('#seatPlannerToolbar [draggable="true"]').forEach(tool => {
        tool.addEventListener('dragstart', (e) => {
            if (!isBlueprintEditMode) return e.preventDefault();
            const toolType = e.currentTarget.id === 'shapeMainBtn'
                ? e.currentTarget.dataset.tool
                : tool.dataset.tool;
            e.dataTransfer.setData('text/plain', toolType);
            e.dataTransfer.effectAllowed = 'copy';
        });
    });

    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            if (!isBlueprintEditMode) return;
            dropZone.classList.remove('drag-over');
            const toolType = e.dataTransfer.getData('text/plain');
            if (!toolType) return;

            const rect = canvas.getBoundingClientRect();
            const x = Math.round(((e.clientX - rect.left) / scale) / gridSize) * gridSize;
            const y = Math.round(((e.clientY - rect.top)  / scale) / gridSize) * gridSize;

            historyManager.saveCurrentState();
            createElementOnCanvas(toolType, x, y);
            setActiveTool('select');
        });
    }
}

/* ==========================
   ELEMENT CREATION
========================== */
export function createElementOnCanvas(toolType, x, y) {
    let el;

    switch (toolType) {
        case 'chair': {
            const countEl      = document.getElementById('plannerTotalSeats');
            const currentSeats = document.querySelectorAll('#canvasInner .shape.chair').length;
            const total        = parseInt(countEl.dataset.total) || 0;
            if (total > 0 && currentSeats >= total) {
                alert('Seat limit reached. Increase event capacity to add more seats.');
                return null;
            }
            el = document.createElement('div');
            el.classList.add('shape', 'chair', 'seat');
            el.style.cssText = `width: ${CHAIR_SIZE}px; height: ${CHAIR_SIZE}px; left: ${x}px; top: ${y}px;`;
            break;
        }
        case 'rect':
        case 'circle': {
            el = document.createElement('div');
            el.classList.add('shape', toolType);
            const w = gridSize * 4;
            const h = toolType === 'circle' ? w : gridSize * 2;
            el.style.cssText = `width: ${w}px; height: ${h}px; left: ${x}px; top: ${y}px;`;
            break;
        }
        case 'text':
        case 'comment': {
            el = document.createElement('div');
            el.classList.add('shape', toolType);
            el.contentEditable = true;
            el.innerText       = toolType === 'text' ? 'Text' : 'Comment';
            el.style.cssText   = `left: ${x}px; top: ${y}px; padding: 5px; min-width: ${gridSize * 2}px;`;
            break;
        }
        default:
            return null;
    }

    makeDraggable(el);
    canvas.appendChild(el);
    if (toolType !== 'chair') {
        addResizers(el);
    }
    selectShape(el);
    if (toolType === 'chair') loadCurrentEventStats();
    return el;
}

/* ==========================
   MOUSE EVENTS
========================== */
function bindMouseEvents(surface) {
    surface.addEventListener('mousedown', onMouseDown);
    surface.addEventListener('mousemove', onMouseMove);
    surface.addEventListener('mouseup',   onMouseUp);
    surface.addEventListener('click',     onCanvasClick);
    surface.addEventListener('wheel',     onWheelZoom, { passive: false });
}

function onMouseDown(e) {
    if (e.target.closest('.ribbon') || e.target.closest('.zoom-controls')) return;

    // Pan: Middle-button OR Left-click on empty space (Select tool)
    const isMiddlePan = e.button === 1;
    const isLeftPan   = e.button === 0 && currentTool === 'select' && !e.target.closest('.shape');

    if (isMiddlePan || isLeftPan) {
        e.preventDefault();
        isPanning  = true;
        hasPanned  = false;
        startX     = e.clientX;
        startY     = e.clientY;
        scrollContainer.style.cursor = 'grabbing';
        return;
    }

    if (e.button !== 0) return;

    if (!isBlueprintEditMode) return;

    if (currentTool === 'rect' || currentTool === 'circle') {
        historyManager.saveCurrentState();
        const rect  = canvas.getBoundingClientRect();
        startDrawX  = (e.clientX - rect.left) / scale;
        startDrawY  = (e.clientY - rect.top)  / scale;

        tempShape = document.createElement('div');
        tempShape.classList.add('shape', currentTool);
        tempShape.style.left   = `${startDrawX}px`;
        tempShape.style.top    = `${startDrawY}px`;
        tempShape.style.width  = '0px';
        tempShape.style.height = '0px';
        canvas.appendChild(tempShape);
        isCreating = true;
    }
}

function onMouseMove(e) {
    if (isPanning) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasPanned = true;

        panX += dx;
        panY += dy;
        startX = e.clientX;
        startY = e.clientY;
        applyZoom(); // Re-apply transform with new pan
        return;
    }
    if (!isCreating || !tempShape) return;

    const rect   = canvas.getBoundingClientRect();
    const x      = (e.clientX - rect.left) / scale;
    const y      = (e.clientY - rect.top)  / scale;

    const left   = Math.round(Math.min(startDrawX, x) / gridSize) * gridSize;
    const top    = Math.round(Math.min(startDrawY, y) / gridSize) * gridSize;
    const width  = Math.round(Math.abs(x - startDrawX) / gridSize) * gridSize;
    const height = Math.round(Math.abs(y - startDrawY) / gridSize) * gridSize;

    tempShape.style.left   = `${left}px`;
    tempShape.style.top    = `${top}px`;
    tempShape.style.width  = `${width}px`;
    tempShape.style.height = `${height}px`;
}

function onMouseUp(e) {
    if (isPanning) {
        isPanning = false;
        scrollContainer.style.cursor = 'default';
        return;
    }
    if (isCreating && tempShape) {
        makeDraggable(tempShape);
        addResizers(tempShape);
        selectShape(tempShape);
        tempShape  = null;
        isCreating = false;
    }
}

function onCanvasClick(e) {
    if (!isBlueprintEditMode) return;
    if (isCreating || isDraggingShape || isResizing) return;
    if (hasPanned) {
        hasPanned = false;
        return;
    }
    if (e.target.closest('.shape')) return;

    if (currentTool === 'select') {
        deselectAll();
        return;
    }

    if (currentTool === 'rect' || currentTool === 'circle') return;

    const rect = canvas.getBoundingClientRect();
    const x    = Math.round(((e.clientX - rect.left) / scale) / gridSize) * gridSize;
    const y    = Math.round(((e.clientY - rect.top)  / scale) / gridSize) * gridSize;

    historyManager.saveCurrentState();
    createElementOnCanvas(currentTool, x, y);
}

/* ==========================
   DRAGGING
========================== */
export function makeDraggable(el) {
    el.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('resizer')) return;
        if (!isBlueprintEditMode) return;
        if (currentTool !== 'select') return;

        if (!el.isContentEditable) e.preventDefault();
        e.stopPropagation();

        selectShape(el);

        const initialState = canvas.innerHTML;
        let hasMoved       = false;
        isDraggingShape    = true;

        const startMouseX = e.clientX;
        const startMouseY = e.clientY;
        const startLeft   = parseFloat(el.style.left || 0);
        const startTop    = parseFloat(el.style.top  || 0);

        const onMove = (ev) => {
            hasMoved      = true;
            const dx      = (ev.clientX - startMouseX) / scale;
            const dy      = (ev.clientY - startMouseY) / scale;
            el.style.left = `${Math.round((startLeft + dx) / gridSize) * gridSize}px`;
            el.style.top  = `${Math.round((startTop  + dy) / gridSize) * gridSize}px`;
        };

        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup',   onUp);
            isDraggingShape = false;
            if (hasMoved) historyManager.saveGivenState(initialState);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup',   onUp);
    });
}

/* ==========================
   RESIZING
========================== */
export function addResizers(el) {
    ['tl', 'tr', 'bl', 'br', 't', 'b', 'l', 'r'].forEach(pos => {
        let resizer = el.querySelector(`.resizer.${pos}`);
        if (!resizer) {
            resizer = document.createElement('div');
            resizer.classList.add('resizer', pos);
            el.appendChild(resizer);
        }
        resizer.addEventListener('mousedown', (e) => onResizeStart(e, el, pos));
    });
}

function onResizeStart(e, el, pos) {
    if (!isBlueprintEditMode) return;
    e.stopPropagation();
    e.preventDefault();
    isResizing = true;

    const initialState = canvas.innerHTML;
    let hasResized     = false;

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startWidth  = parseInt(getComputedStyle(el).width,  10);
    const startHeight = parseInt(getComputedStyle(el).height, 10);
    const startLeft   = parseInt(el.style.left || 0, 10);
    const startTop    = parseInt(el.style.top  || 0, 10);

    const onMove = (ev) => {
        hasResized = true;
        const dx   = (ev.clientX - startMouseX) / scale;
        const dy   = (ev.clientY - startMouseY) / scale;

        if (pos.includes('r')) {
            el.style.width  = `${Math.max(gridSize, Math.round((startWidth  + dx) / gridSize) * gridSize)}px`;
        }
        if (pos.includes('b')) {
            el.style.height = `${Math.max(gridSize, Math.round((startHeight + dy) / gridSize) * gridSize)}px`;
        }
        if (pos.includes('l')) {
            const snappedLeft = Math.round((startLeft + dx) / gridSize) * gridSize;
            const newWidth    = startWidth - (snappedLeft - startLeft);
            if (newWidth >= gridSize) {
                el.style.left  = `${snappedLeft}px`;
                el.style.width = `${newWidth}px`;
            }
        }
        if (pos.includes('t')) {
            const snappedTop = Math.round((startTop + dy) / gridSize) * gridSize;
            const newHeight  = startHeight - (snappedTop - startTop);
            if (newHeight >= gridSize) {
                el.style.top    = `${snappedTop}px`;
                el.style.height = `${newHeight}px`;
            }
        }
    };

    const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
        setTimeout(() => { isResizing = false; }, 0);
        if (hasResized) historyManager.saveGivenState(initialState);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
}

/* ==========================
   SELECTION
========================== */
export function selectShape(el) {
    deselectAll();
    if (!isBlueprintEditMode) return;
    el.classList.add('selected');
    selectedShape = el;
}

export function deselectAll() {
    if (selectedShape) selectedShape.classList.remove('selected');
    selectedShape = null;
    document.querySelectorAll('.shape.selected').forEach(el => el.classList.remove('selected'));
}

/* ==========================
   GRID TOGGLE
========================== */
function bindGridToggle() {
    document.getElementById('toggleGrid')?.addEventListener('click', () => {
        container.classList.toggle('grid-background');
    });
}

/* ==========================
   ZOOM
========================== */
function bindZoomControls() {
    document.getElementById('zoomIn')?.addEventListener('click', () => {
        scale = Math.min(scale + 0.1, MAX_ZOOM);
        applyZoom();
    });
    document.getElementById('zoomOut')?.addEventListener('click', () => {
        scale = Math.max(scale - 0.1, MIN_ZOOM);
        applyZoom();
    });
}

function onWheelZoom(e) {
    e.preventDefault();
    scale = Math.min(Math.max(scale + (e.deltaY < 0 ? 0.05 : -0.05), MIN_ZOOM), MAX_ZOOM);
    applyZoom();
}

function applyZoom() {
    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    if (container) {
        container.style.backgroundSize     = `${gridSize * scale}px ${gridSize * scale}px`;
        container.style.backgroundPosition = `${panX}px ${panY}px`;
    }
}

/* ==========================
   CLEAR CANVAS
========================== */
function bindClearButton() {
    document.getElementById('clearBtn')?.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear the canvas?')) {
            historyManager.saveCurrentState();
            canvas.querySelectorAll('.shape').forEach(el => el.remove());
            selectedShape = null;
            loadCurrentEventStats();
        }
    });
}

/* ==========================
   BULK ADD
========================== */
function bindBulkAdd() {
    document.getElementById('confirmBulkAdd')?.addEventListener('click', () => {
        const type = document.getElementById('bulkType').value;
        let qty    = parseInt(document.getElementById('bulkQty').value) || 0;

        if (type === 'chair') {
            const countEl     = document.getElementById('plannerTotalSeats');
            const currentSeats = document.querySelectorAll('#canvasInner .shape.chair').length;
            const total       = parseInt(countEl.dataset.total) || 0;
            const available   = total - currentSeats;

            if (total > 0 && available <= 0) {
                alert('Seat limit reached. Cannot add more chairs.');
                return;
            }
            if (total > 0 && qty > available) {
                alert(`You can only add ${available} more chairs. Adjusting quantity.`);
                qty = available;
            }
        }

        if (qty > 0) {
            historyManager.saveCurrentState();
            addItemsToBlueprint(qty, type);
            loadCurrentEventStats();
        }
    });
}

function addItemsToBlueprint(qty, type) {
    const canvasEl = document.getElementById('canvasInner');
    if (!canvasEl) return;

    const gap      = 10;
    const cols     = 10;
    const itemSize = type === 'chair' ? CHAIR_SIZE : 50;

    for (let i = 0; i < qty; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const el  = document.createElement('div');
        el.classList.add('shape', type);
        if (type === 'chair') el.classList.add('seat');
        el.style.width  = `${itemSize}px`;
        el.style.height = `${itemSize}px`;
        el.style.left   = `${50 + col * (itemSize + gap)}px`;
        el.style.top    = `${50 + row * (itemSize + gap)}px`;
        makeDraggable(el);
        canvasEl.appendChild(el);
        if (type !== 'chair') {
            addResizers(el);
        }
    }
}

function updateBlueprintSeatsStatus() {
    const chairs = document.querySelectorAll('#canvasInner .shape.chair');
    chairs.forEach((chair, index) => {
        // Visual update
        chair.classList.add('available');
        
        // Dispose old popover if exists to prevent duplication
        const oldPopover = bootstrap.Popover.getInstance(chair);
        if (oldPopover) oldPopover.dispose();

        // Add Popover attributes
        chair.setAttribute('data-bs-toggle', 'popover');
        chair.setAttribute('data-bs-trigger', 'hover');
        chair.setAttribute('data-bs-placement', 'top');
        chair.setAttribute('data-bs-html', 'true');
        chair.setAttribute('title', `Seat ${index + 1}`);
        chair.setAttribute('data-bs-content', 'Status: <span class="text-success fw-bold">Available</span>');
        
        new bootstrap.Popover(chair);
    });
}

/* ==========================
   SAVE / LOAD BLUEPRINT
========================== */
export function saveBlueprintState(silent = false) {
    const canvasEl = document.getElementById('canvasInner');
    if (!canvasEl) return;

    // Ensure a clean state before "capturing"
    deselectAll();

    const blueprintHTML = canvasEl.innerHTML;
    const chairCount = canvasEl.querySelectorAll('.shape.chair').length;

    const currentEventId = localStorage.getItem('seatlify_current_event_id');
    if (currentEventId && typeof MockDB !== 'undefined') {
        // Get event to check Chart seats
        const event = MockDB.getEvents().find(e => e.event_id == currentEventId);
        let chartSeats = 0;
        if (event) {
            const mode = localStorage.getItem(`seatlify_chart_layout_mode_${currentEventId}`) || (event.seating_by_table ? 'table' : 'row');
            const data = mode === 'table' ? event.table_layout_data : event.row_layout_data;
            chartSeats = (data || []).reduce((sum, g) => sum + (parseInt(g.seats) || 0), 0);
        }

        MockDB.updateEvent(currentEventId, {
            blueprint_layout: blueprintHTML, // Save the raw HTML
            designed_seats: chairCount + chartSeats
        });
        if (!silent) alert(`Blueprint saved! Total Seats: ${chairCount + chartSeats}`);
        console.log('Blueprint state saved as HTML.');
        loadCurrentEventStats();
        updateBlueprintSeatsStatus();
        if (!silent) {
            isBlueprintEditMode = false;
            updateBlueprintEditModeUI();
        }
    } else if (!silent) {
        alert('Blueprint saved locally (No active event linked).');
    }
}

export function loadBlueprintLayout() {
    const canvasEl = document.getElementById('canvasInner');
    if (!canvasEl) return;

    canvasEl.innerHTML = '';

    const currentEventId = localStorage.getItem('seatlify_current_event_id');
    if (!currentEventId || typeof MockDB === 'undefined') return;

    const event = MockDB.getEvents().find(e => e.event_id == currentEventId);
    if (!event?.blueprint_layout) return;

    // Check if saved layout is HTML (new format) or JSON (old format)
    if (typeof event.blueprint_layout === 'string') {
        console.log('Loading from saved blueprint HTML.');
        canvasEl.innerHTML = event.blueprint_layout;

        // Re-bind all events to the newly injected elements
        canvasEl.querySelectorAll('.shape').forEach(el => {
            makeDraggable(el);
            // Chairs should not have resizers.
            if (!el.classList.contains('chair')) {
                addResizers(el);
            }
        });

    } else if (Array.isArray(event.blueprint_layout) && event.blueprint_layout.length > 0) {
        // --- Fallback for old JSON format ---
        console.log('Loading from saved blueprint layout (legacy JSON format).');
        event.blueprint_layout.forEach(shapeData => {
            const el = document.createElement('div');
            el.classList.add('shape', shapeData.type);
            if (shapeData.type === 'chair') el.classList.add('seat');
            el.style.left   = shapeData.left;
            el.style.top    = shapeData.top;
            el.style.width  = shapeData.width;
            el.style.height = shapeData.height;
            if (shapeData.text) {
                el.contentEditable = true;
                el.innerText       = shapeData.text;
            }
            makeDraggable(el);
            canvasEl.appendChild(el);
            if (shapeData.type !== 'chair') {
                addResizers(el);
            }
        });
    }

    updateBlueprintSeatsStatus();
    // After loading, ensure UI reflects the current edit mode
    updateBlueprintEditModeUI();
}

function bindSaveButton() {
    document.getElementById('savePlanBtn')
        ?.addEventListener('click', () => saveBlueprintState(false));
}

function bindEditButton() {
    document.getElementById('editPlanBtn')?.addEventListener('click', () => {
        isBlueprintEditMode = true;
        updateBlueprintEditModeUI();
    });
}

function updateBlueprintEditModeUI() {
    const saveBtn = document.getElementById('savePlanBtn');
    const editBtn = document.getElementById('editPlanBtn');
    const toolbar = document.getElementById('seatPlannerToolbar');

    if (saveBtn) saveBtn.style.display = isBlueprintEditMode ? 'inline-block' : 'none';
    if (editBtn) editBtn.style.display = isBlueprintEditMode ? 'none' : 'inline-block';

    if (toolbar) {
        const tools = toolbar.querySelectorAll('.tool-btn, #toggleGrid, #clearBtn, [data-bs-target="#bulkAddModal"], #btnUndoBlueprint, #btnRedoBlueprint, .dropdown-toggle');
        tools.forEach(btn => btn.disabled = !isBlueprintEditMode);
        
        // Also disable draggable on shape buttons
        toolbar.querySelectorAll('[draggable]').forEach(el => {
            el.setAttribute('draggable', isBlueprintEditMode);
        });
    }

    if (!isBlueprintEditMode) {
        deselectAll();
    }
}
