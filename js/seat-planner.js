/* ==========================================================
   SEAT PLANNER MODULE (LAZY INIT)
========================================================== */

let seatPlannerInitialized = false;

/* ==========================
   CONFIG
========================== */
const gridSize = 25;
const CHAIR_SIZE = 25;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;

/* ==========================
   STATE
========================== */
let canvas, container;
let currentTool = "select";
let scale = 1;
let chartLayoutMode = 'row'; // 'row' or 'table'
let isChartEditMode = true;

let isPanning = false;
let isCreating = false;
let isDraggingShape = false;
let isResizing = false;

let startX = 0, startY = 0;
let scrollLeft = 0, scrollTop = 0;

let startDrawX = 0, startDrawY = 0;
let tempShape = null;

let seats = [];
let selectedShape = null;
let selectedSeats = [];

const historyManager = {
    undoStack: [],
    redoStack: [],
    maxHistory: 50,

    saveCurrentState: function() {
        const canvas = document.getElementById("canvasInner");
        if (!canvas) return;
        this.saveGivenState(canvas.innerHTML);
    },

    saveGivenState: function(state) {
        this.redoStack = [];
        this.undoStack.push(state);

        if (this.undoStack.length > this.maxHistory) {
            this.undoStack.shift();
        }
    },

    undo: function() {
        if (this.undoStack.length === 0) return;

        const canvas = document.getElementById("canvasInner");
        if (!canvas) return;

        this.redoStack.push(canvas.innerHTML);
        canvas.innerHTML = this.undoStack.pop();
        this.rebindAllEvents();
    },

    redo: function() {
        if (this.redoStack.length === 0) return;

        const canvas = document.getElementById("canvasInner");
        if (!canvas) return;

        this.undoStack.push(canvas.innerHTML);
        canvas.innerHTML = this.redoStack.pop();
        this.rebindAllEvents();
    },

    rebindAllEvents: function() {
        const canvas = document.getElementById("canvasInner");
        if (!canvas) return;
        canvas.querySelectorAll('.shape').forEach(el => {
            makeDraggable(el);
            addResizers(el); // This will re-add listeners to existing resizer divs
        });
        loadCurrentEventStats();
        deselectAll();
    },
    
    clear: function() {
        this.undoStack = [];
        this.redoStack = [];
    }
};

/* ==========================================================
   STATE PERSISTENCE
========================================================== */

/**
 * Checks which planner view is active and calls the appropriate silent save function.
 * This is exposed on the window object to be called from loaders.js and the beforeunload event.
 */
function saveCurrentPlannerState() {
    if (!document.getElementById('seatPlannerTabs')) return; // Don't run if planner isn't loaded
    console.log("Auto-saving planner state...");
    const chartTab = document.getElementById('pills-chart-tab');
    const isChartActive = chartTab ? chartTab.classList.contains('active') : true; // Default to chart if element not found
    if (isChartActive) saveChartState(true); else saveBlueprintState(true);
}

/* ==========================================================
   INIT (CALLED MANUALLY)
========================================================== */
function initSeatPlanner() {
  console.log("initSeatPlanner() called");

    // Load stats whenever initialized/shown
    loadCurrentEventStats();
    renderGuestList();

    seatPlannerInitialized = true;

    console.log("Seat planner initialized");

    canvas = document.getElementById("canvasInner");
    container = document.querySelector(".seat-planner-container");

    if (!canvas || !container) {
        console.error("Seat Planner DOM not ready");
        return;
    }

    canvas.style.transformOrigin = "0 0";

    historyManager.clear();
    bindKeyboardShortcuts();
    bindToolSelection();
    bindToolbarDragAndDrop();
    bindMouseEvents();
    bindGridToggle();
    bindZoomControls();
    bindClearButton();
    bindBulkAdd();
    bindSaveButton();
    bindAutoBuildButton();
    bindGuestListResizer();
    bindEditTotalSeats();
    bindClearChartButton();
    bindChartGroupingButtons();
    bindRowLabelToggle();
    initChartSortable();
    bindChartEditControls();
    bindTabSwitchers();
    refreshChartLayout();

    // Expose the save function to the window scope and add listeners for auto-saving
    window.saveCurrentPlannerState = saveCurrentPlannerState;
    window.addEventListener('beforeunload', window.saveCurrentPlannerState);
}

function addChartRowButton(container) {
    const addRowBtn = document.createElement('button');
    addRowBtn.id = 'chartAddRowBtn';
    addRowBtn.className = 'btn btn-outline-secondary mt-3 w-100';
    addRowBtn.style.borderStyle = 'dashed';
    const buttonText = chartLayoutMode === 'table' ? 'Add Table' : 'Add Row';
    addRowBtn.innerHTML = `<i class="bi bi-plus-lg"></i> ${buttonText}`;
    addRowBtn.addEventListener('click', addNewRowToChart);
    container.appendChild(addRowBtn);
}

/* ==========================
   TOOL SELECTION (UPDATED)
========================== */
function bindToolSelection() {
  const toolButtons = document.querySelectorAll(".tool-btn");
  const shapeOptions = document.querySelectorAll(".shape-option");
  const shapeMainBtn = document.getElementById("shapeMainBtn");
  const shapeMainIcon = document.getElementById("shapeMainIcon");

  function setActiveTool(tool) {
    currentTool = tool;

    toolButtons.forEach(btn => btn.classList.remove("active"));

    if (tool === "rect" || tool === "circle") {
      shapeMainBtn.classList.add("active");
    } else {
      document
        .querySelector(`.tool-btn[data-tool="${tool}"]`)
        ?.classList.add("active");
    }
  }

  toolButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      setActiveTool(btn.dataset.tool);
    });
  });

  shapeOptions.forEach(option => {
    option.addEventListener("click", () => {
      const tool = option.dataset.tool;
      const icon = option.dataset.icon;

      shapeMainBtn.dataset.tool = tool;
      shapeMainIcon.className = `bi ${icon}`;

      setActiveTool(tool);
    });
  });
}

function bindToolbarDragAndDrop() {
    const draggableTools = document.querySelectorAll('#seatPlannerToolbar [draggable="true"]');
    const dropZone = document.getElementById('canvas'); // This is the container with the background grid

    draggableTools.forEach(tool => {
        tool.addEventListener('dragstart', (e) => {
            // For the shape button, the tool is dynamic
            const toolType = e.currentTarget.id === 'shapeMainBtn' 
                ? e.currentTarget.dataset.tool 
                : tool.dataset.tool;
            e.dataTransfer.setData('text/plain', toolType);
            e.dataTransfer.effectAllowed = 'copy';
        });
    });

    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault(); // Necessary to allow dropping
            e.dataTransfer.dropEffect = 'copy';
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');

            const toolType = e.dataTransfer.getData('text/plain');
            if (!toolType) return;

            const rect = canvas.getBoundingClientRect(); // 'canvas' is canvasInner
            const x = Math.round(((e.clientX - rect.left) / scale) / gridSize) * gridSize;
            const y = Math.round(((e.clientY - rect.top) / scale) / gridSize) * gridSize;

            historyManager.saveCurrentState();
            createElementOnCanvas(toolType, x, y);
        });
    }
}

function createElementOnCanvas(toolType, x, y) {
    let el;
    switch (toolType) {
        case 'chair':
            const countEl = document.getElementById('plannerTotalSeats');
            const currentSeats = document.querySelectorAll('#canvasInner .shape.chair').length;
            const total = parseInt(countEl.dataset.total) || 0;
            if (total > 0 && currentSeats >= total) {
                alert("Seat limit reached. Increase event capacity to add more seats.");
                return null;
            }
            el = document.createElement("div");
            el.classList.add("shape", "chair", "seat");
            el.style.cssText = `width: ${CHAIR_SIZE}px; height: ${CHAIR_SIZE}px; left: ${x}px; top: ${y}px;`;
            break;
        case 'rect':
        case 'circle':
            el = document.createElement("div");
            el.classList.add("shape", toolType);
            const w = gridSize * 4, h = (toolType === 'circle') ? w : gridSize * 2;
            el.style.cssText = `width: ${w}px; height: ${h}px; left: ${x}px; top: ${y}px;`;
            break;
        case 'text':
        case 'comment':
            el = document.createElement("div");
            el.classList.add("shape", toolType);
            el.contentEditable = true;
            el.innerText = toolType === "text" ? "Text" : "Comment";
            el.style.cssText = `left: ${x}px; top: ${y}px; padding: 5px; min-width: ${gridSize * 2}px;`;
            break;
        default: return null;
    }
    makeDraggable(el);
    canvas.appendChild(el);
    addResizers(el);
    selectShape(el);
    if (toolType === 'chair') loadCurrentEventStats();
    return el;
}

function bindKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        const target = e.target;
        // Don't trigger shortcuts if user is typing in an input or editable element
        if (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
            return;
        }

        // Undo (Ctrl+Z)
        if (e.ctrlKey && e.key.toLowerCase() === 'z' && !e.shiftKey) {
            e.preventDefault();
            historyManager.undo();
        }
        // Redo (Ctrl+Shift+Z or Ctrl+Y)
        else if (e.ctrlKey && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
            e.preventDefault();
            historyManager.redo();
        }
        // Delete selected shape
        else if (e.key === 'Delete' || e.key === 'Backspace') {
            if (selectedShape) {
                e.preventDefault(); // Prevent browser back navigation on Backspace
                historyManager.saveCurrentState(); // Save state before deleting
                const wasChair = selectedShape.classList.contains('chair');
                selectedShape.remove();
                selectedShape = null;
                if (wasChair) {
                    loadCurrentEventStats();
                }
            }
        }
    });
}

/* ==========================
   MOUSE EVENTS
========================== */
function bindMouseEvents() {
  const surface = canvas.parentElement;

  surface.addEventListener("mousedown", onMouseDown);
  surface.addEventListener("mousemove", onMouseMove);
  surface.addEventListener("mouseup", onMouseUp);
  surface.addEventListener("click", onCanvasClick);
  surface.addEventListener("wheel", onWheelZoom, { passive: false });
}

function onMouseDown(e) {
  if (e.target.closest(".ribbon") || e.target.closest(".zoom-controls")) return;

  if (e.button === 1) {
    e.preventDefault();
    isPanning = true;
    startX = e.clientX;
    startY = e.clientY;
    scrollLeft = container.scrollLeft;
    scrollTop = container.scrollTop;
    container.style.cursor = "grabbing";
    return;
  }

  if (e.button !== 0) return;

  if (currentTool === "rect" || currentTool === "circle") {
    historyManager.saveCurrentState();
    const rect = canvas.getBoundingClientRect();
    startDrawX = (e.clientX - rect.left) / scale;
    startDrawY = (e.clientY - rect.top) / scale;

    tempShape = document.createElement("div");
    tempShape.classList.add("shape", currentTool);
    tempShape.style.left = `${startDrawX}px`;
    tempShape.style.top = `${startDrawY}px`;
    tempShape.style.width = "0px";
    tempShape.style.height = "0px";

    canvas.appendChild(tempShape);
    isCreating = true;
  }
}
function onMouseMove(e) {
  if (isPanning) {
    container.scrollLeft = scrollLeft - (e.clientX - startX);
    container.scrollTop = scrollTop - (e.clientY - startY);
    return;
  }

  if (!isCreating || !tempShape) return;

  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / scale;
  const y = (e.clientY - rect.top) / scale;

  let left = Math.min(startDrawX, x);
  let top = Math.min(startDrawY, y);
  let width = Math.abs(x - startDrawX);
  let height = Math.abs(y - startDrawY);

  left = Math.round(left / gridSize) * gridSize;
  top = Math.round(top / gridSize) * gridSize;
  width = Math.round(width / gridSize) * gridSize;
  height = Math.round(height / gridSize) * gridSize;

  tempShape.style.left = `${left}px`;
  tempShape.style.top = `${top}px`;
  tempShape.style.width = `${width}px`;
  tempShape.style.height = `${height}px`;
}

function onMouseUp(e) {
  if (e.button === 1) {
    isPanning = false;
    container.style.cursor = "default";
    return;
  }

  if (isCreating && tempShape) {
    makeDraggable(tempShape);
    addResizers(tempShape);
    selectShape(tempShape);
    tempShape = null;
    isCreating = false;
  }
}

function onCanvasClick(e) {
  if (isCreating || isDraggingShape || isResizing) return;
  if (e.target.closest(".shape")) return;

  // Only create elements on click for tools that are not for drawing (rect/circle)
  if (currentTool === 'rect' || currentTool === 'circle' || currentTool === 'select') return;

  const rect = canvas.getBoundingClientRect();
  const x =
    Math.round(((e.clientX - rect.left) / scale) / gridSize) * gridSize;
  const y =
    Math.round(((e.clientY - rect.top) / scale) / gridSize) * gridSize;

  deselectAll();

  historyManager.saveCurrentState();
  createElementOnCanvas(currentTool, x, y);
}

/* ==========================
   DRAGGING
========================== */
function makeDraggable(el) {
  let offsetX = 0,
      offsetY = 0;

  el.onmousedown = (e) => {
    if (e.target.classList.contains("resizer")) return;
    if (currentTool !== 'select') return;
    selectShape(el);

    e.stopPropagation();

    const initialState = canvas.innerHTML;
    let hasMoved = false;

    isDraggingShape = true;

    offsetX = e.offsetX;
    offsetY = e.offsetY;

    document.onmousemove = (ev) => {
      hasMoved = true;
      const rect = canvas.getBoundingClientRect();
      let left = (ev.clientX - rect.left - offsetX) / scale;
      let top = (ev.clientY - rect.top - offsetY) / scale;

      left = Math.round(left / gridSize) * gridSize;
      top = Math.round(top / gridSize) * gridSize;

      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
    };

    document.onmouseup = () => {
      document.onmousemove = null;
      isDraggingShape = false;
      if (hasMoved) {
        historyManager.saveGivenState(initialState);
      }
    };
  };
}

/* ==========================
   RESIZING & SELECTION
========================== */
function addResizers(el) {
  const positions = ["tl", "tr", "bl", "br"];
  positions.forEach(pos => {
    let resizer = el.querySelector(`.resizer.${pos}`);
    if (!resizer) {
        resizer = document.createElement("div");
        resizer.classList.add("resizer", pos);
        el.appendChild(resizer);
    }
    resizer.addEventListener("mousedown", (e) => onResizeStart(e, el, pos));
  });
}

function onResizeStart(e, el, pos) {
  e.stopPropagation();
  isResizing = true;

  const initialState = canvas.innerHTML;
  let hasResized = false;

  const startX = e.clientX;
  const startY = e.clientY;
  const startWidth = parseInt(document.defaultView.getComputedStyle(el).width, 10);
  const startHeight = parseInt(document.defaultView.getComputedStyle(el).height, 10);
  const startLeft = parseInt(el.style.left || 0, 10);
  const startTop = parseInt(el.style.top || 0, 10);

  const onMouseMove = (moveEvent) => {
        hasResized = true;
        const dx = (moveEvent.clientX - startX) / scale;
        const dy = (moveEvent.clientY - startY) / scale;

        if (pos.includes("r")) {
            let newWidth = startWidth + dx;
            newWidth = Math.round(newWidth / gridSize) * gridSize;
            el.style.width = `${Math.max(gridSize, newWidth)}px`;
        }
        if (pos.includes("b")) {
            let newHeight = startHeight + dy;
            newHeight = Math.round(newHeight / gridSize) * gridSize;
            el.style.height = `${Math.max(gridSize, newHeight)}px`;
        }
        if (pos.includes("l")) {
            const newLeft = startLeft + dx;
            const snappedLeft = Math.round(newLeft / gridSize) * gridSize;
            const snappedDx = snappedLeft - startLeft;
            const newWidth = startWidth - snappedDx;

            if (newWidth >= gridSize) {
                el.style.left = `${snappedLeft}px`;
                el.style.width = `${newWidth}px`;
            }
        }
        if (pos.includes("t")) {
            const newTop = startTop + dy;
            const snappedTop = Math.round(newTop / gridSize) * gridSize;
            const snappedDy = snappedTop - startTop;
            const newHeight = startHeight - snappedDy;

            if (newHeight >= gridSize) {
                el.style.top = `${snappedTop}px`;
                el.style.height = `${newHeight}px`;
            }
        }
  };

  const onMouseUp = () => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    setTimeout(() => isResizing = false, 0);
    if (hasResized) {
      historyManager.saveGivenState(initialState);
    }
  };

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
}

function selectShape(el) {
  deselectAll();
  el.classList.add("selected");
  selectedShape = el;
}

function deselectAll() {
  if (selectedShape) {
    selectedShape.classList.remove("selected");
    selectedShape = null;
  }
  // Ensure all are cleaned up
  document.querySelectorAll(".shape.selected").forEach(el => el.classList.remove("selected"));
}

/* ==========================
   GRID
========================== */
function bindGridToggle() {
  document.getElementById("toggleGrid").onclick = () => {
    container.classList.toggle("grid-background");
  };
}

/* ==========================
   ZOOM
========================== */
function bindZoomControls() {
  document.getElementById("zoomIn").onclick = () => {
    scale = Math.min(scale + 0.1, MAX_ZOOM);
    applyZoom();
  };

  document.getElementById("zoomOut").onclick = () => {
    scale = Math.max(scale - 0.1, MIN_ZOOM);
    applyZoom();
  };
}

function onWheelZoom(e) {
  e.preventDefault();
  scale += e.deltaY < 0 ? 0.05 : -0.05;
  scale = Math.min(Math.max(scale, MIN_ZOOM), MAX_ZOOM);
  applyZoom();
}

function applyZoom() {
    canvas.style.transform = `scale(${scale})`;
    if (container) {
        container.style.backgroundSize = `${gridSize * scale}px ${gridSize * scale}px`;
    }
}

/* ==========================
   CLEAR
========================== */
function bindClearButton() {
  document.getElementById("clearBtn").onclick = () => {
    if (confirm("Are you sure you want to clear the canvas?")) {
        historyManager.saveCurrentState();
        canvas.querySelectorAll(".shape").forEach((el) => el.remove());
        selectedShape = null;
        loadCurrentEventStats();
    }
  };
}

/* ==========================
   BULK ADD & SAVE
========================== */
function bindBulkAdd() {
    const confirmBtn = document.getElementById('confirmBulkAdd');
    if(!confirmBtn) return;

    confirmBtn.addEventListener('click', () => {
        const type = document.getElementById('bulkType').value;
        const qty = parseInt(document.getElementById('bulkQty').value) || 0;
        
        if (type === 'chair') {
            const countEl = document.getElementById('plannerTotalSeats');
            const currentSeats = document.querySelectorAll('#canvasInner .shape.chair').length;
            const total = parseInt(countEl.dataset.total) || 0;
            const availableSlots = total - currentSeats;

            if (total > 0 && availableSlots <= 0) {
                alert("Seat limit reached. Cannot add more chairs.");
                return;
            }

            if (total > 0 && qty > availableSlots) {
                alert(`You can only add ${availableSlots} more chairs. Adjusting quantity.`);
                qty = availableSlots;
            }
        }
        if(qty > 0) {
            historyManager.saveCurrentState();
            addItemsToBlueprint(qty, type);
            loadCurrentEventStats();
        }
    });
}

function addItemsToBlueprint(qty, type) {
    const canvas = document.getElementById("canvasInner");
    if (!canvas) return;

    const startX = 50;
    const startY = 50;
    const gap = 10;
    const cols = 10; // Items per row
    const itemSize = type === 'chair' ? CHAIR_SIZE : 50;

    for(let i=0; i<qty; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);

        const x = startX + (col * (itemSize + gap));
        const y = startY + (row * (itemSize + gap));

        const el = document.createElement("div");
        el.classList.add("shape", type);
        if(type === 'chair') el.classList.add('seat');
        
        el.style.width = `${itemSize}px`;
        el.style.height = `${itemSize}px`;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;

        makeDraggable(el);
        canvas.appendChild(el);
        addResizers(el);
    }
}

function saveBlueprintState(silent = false) {
    const blueprintShapes = [];
    document.querySelectorAll('#canvasInner .shape').forEach(el => {
        const shapeData = {
            type: Array.from(el.classList).find(c => c !== 'shape' && c !== 'selected' && c !== 'seat'),
            left: el.style.left,
            top: el.style.top,
            width: el.style.width,
            height: el.style.height,
            text: el.isContentEditable ? el.innerText : null
        };
        blueprintShapes.push(shapeData);
    });

    const currentEventId = localStorage.getItem('seatlify_current_event_id');

    if(currentEventId && typeof MockDB !== 'undefined') {
        MockDB.updateEvent(currentEventId, { 
            blueprint_layout: blueprintShapes
        });
        if (!silent) {
            const seatCount = blueprintShapes.filter(s => s.type === 'chair').length;
            alert(`Blueprint saved! Total Seats: ${seatCount}`);
        }
        console.log("Blueprint state saved.");
        loadCurrentEventStats();
    } else if (!silent) {
        alert("Blueprint saved locally (No active event linked).");
    }
}

function bindSaveButton() {
    const saveBtn = document.getElementById('savePlanBtn');
    if(!saveBtn) return;

    saveBtn.addEventListener('click', () => {
        saveBlueprintState(false);
    });
}

function bindEditTotalSeats() {
    const btn = document.getElementById('btnEditTotalSeats');
    if (btn) {
        btn.addEventListener('click', () => {
            const currentEventId = localStorage.getItem('seatlify_current_event_id');
            if (!currentEventId) {
                alert("No active event selected.");
                return;
            }
            
            const countEl = document.getElementById('plannerTotalSeats');
            const currentTotal = countEl ? (countEl.dataset.total || 0) : 0;
            
            const newTotal = prompt("Enter total expected capacity:", currentTotal);
            if (newTotal !== null && !isNaN(newTotal) && newTotal.trim() !== "") {
                MockDB.updateEvent(currentEventId, { attendees: parseInt(newTotal) });
                loadCurrentEventStats();
            }
        });
    }
}

/* ==========================
   CHART GROUPING
========================== */
function bindChartGroupingButtons() {
    const btnRow = document.getElementById('btnGroupRow');
    const btnTable = document.getElementById('btnGroupTable');
    
    if(btnRow && btnTable) {
        btnRow.addEventListener('click', () => {
            chartLayoutMode = 'row';
            btnRow.classList.add('active');
            btnTable.classList.remove('active');
            refreshChartLayout();
        });

        btnTable.addEventListener('click', () => {
            chartLayoutMode = 'table';
            btnTable.classList.add('active');
            btnRow.classList.remove('active');
            refreshChartLayout();
        });
    }
}

function initChartSortable() {
    const container = document.getElementById('seatPlannerRowContainer');
    if (container && typeof Sortable !== 'undefined') {
        new Sortable(container, {
            animation: 150,
            ghostClass: 'bg-light'
        });
    }
}

function saveChartState(silent = false) {
    const layoutData = [];
    const chartContainer = document.getElementById('seatPlannerRowContainer');
    chartContainer.querySelectorAll('.p-3.border.rounded.shadow-sm').forEach(rowEl => {
        const label = rowEl.querySelector('.row-label')?.textContent || '';
        const seats = rowEl.querySelectorAll('.chart-seat').length;
        if (label) { // If a row/table has a label, it's a valid group to save.
            layoutData.push({ label: label, seats: seats });
        }
    });

    const currentEventId = localStorage.getItem('seatlify_current_event_id');

    if(currentEventId && typeof MockDB !== 'undefined') {
        const updatePayload = {};
        updatePayload[`${chartLayoutMode}_layout_data`] = layoutData;
        MockDB.updateEvent(currentEventId, updatePayload);
        
        if (!silent) {
            const seatCount = layoutData.reduce((acc, group) => acc + group.seats, 0);
            alert(`Chart layout saved! Total Seats: ${seatCount}`);
        }
        console.log("Chart state saved.");
        loadCurrentEventStats();
    } else if (!silent) {
        alert("Chart layout saved locally (No active event linked).");
    }
}

function bindChartEditControls() {
    const btnSave = document.getElementById('btnSaveChart');
    const btnEdit = document.getElementById('btnEditChart');

    if (btnSave && btnEdit) {
        btnSave.addEventListener('click', () => {
            saveChartState(false);

            // Toggle button visibility
            btnSave.style.display = 'none';
            btnEdit.style.display = 'inline-block';
            isChartEditMode = false;
            updateChartEditModeUI();

            const sortableContainer = document.getElementById('seatPlannerRowContainer');
            const sortableInstance = Sortable.get(sortableContainer);
            if (sortableInstance) {
                sortableInstance.option('disabled', true);
            }
        });

        btnEdit.addEventListener('click', () => {
            // Toggle button visibility
            btnEdit.style.display = 'none';
            btnSave.style.display = 'inline-block';
            isChartEditMode = true;
            updateChartEditModeUI();

            const sortableContainer = document.getElementById('seatPlannerRowContainer');
            const sortableInstance = Sortable.get(sortableContainer);
            if (sortableInstance) {
                sortableInstance.option('disabled', false);
            }
        });
    }
}

function bindTabSwitchers() {
    const chartTab = document.getElementById('pills-chart-tab');
    const blueprintTab = document.getElementById('pills-blueprint-tab');

    if (chartTab) {
        chartTab.addEventListener('shown.bs.tab', () => {
            loadCurrentEventStats();
            refreshChartLayout();
        });
    }

    if (blueprintTab) {
        blueprintTab.addEventListener('shown.bs.tab', () => {
            loadBlueprintLayout();
            loadCurrentEventStats();
        });
    }
}

function loadCurrentEventStats() {
    const countEl = document.getElementById('plannerTotalSeats');
    const currentEventId = localStorage.getItem('seatlify_current_event_id');

    if (countEl && currentEventId && typeof MockDB !== 'undefined') {
        const event = MockDB.getEvents().find(e => e.event_id == currentEventId);
        if (event) {
            const total = event.attendees || 0;
            countEl.dataset.total = total;

            // Determine active tab
            const chartTab = document.getElementById('pills-chart-tab');
            let currentSeats = 0;
            if (chartTab && chartTab.classList.contains('active')) {
                // Chart view is active
                currentSeats = document.querySelectorAll('#seatPlannerRowContainer .chart-seat').length;
            } else {
                // Blueprint view is active
                currentSeats = document.querySelectorAll('#canvasInner .shape.chair').length;
            }
            
            countEl.textContent = `${currentSeats} / ${total}`;
        } else {
            // Event ID from storage is invalid
            countEl.textContent = '0 / 0';
            countEl.dataset.total = 0;
            console.warn(`Event with ID ${currentEventId} not found.`);
        }
    } else if (countEl) {
        // Fallback if no event is selected
        countEl.dataset.total = '0';
        countEl.textContent = `0 / 0`;
    }
}

function renderGuestList() {
    const list = document.getElementById('chartGuestList');
    if (!list) return;
    
    // Placeholder for guest list rendering
    list.innerHTML = '<div class="text-center text-muted small mt-3">No guests loaded.</div>';
}

function bindAutoBuildButton() {
    const btn = document.getElementById('btnAutoBuild');
    if (btn) {
        btn.addEventListener('click', () => {
            const currentEventId = localStorage.getItem('seatlify_current_event_id');
            let totalSeats = 0;

            if (currentEventId && typeof MockDB !== 'undefined') {
                const event = MockDB.getEvents().find(e => e.event_id == currentEventId);
                if (event) totalSeats = parseInt(event.attendees) || 0;
            }

            if (totalSeats === 0) {
                const input = prompt("No seat count found. Enter total seats to generate:", "50");
                if (input) totalSeats = parseInt(input);
            }

            if (totalSeats > 0) {
                generateChartLayout(totalSeats);
            } else {
                alert("Please set a total seat count for this event first.");
            }
        });
    }
}

function bindGuestListResizer() {
    const resizer = document.getElementById('guestListResizer');
    const sidebar = document.getElementById('guestListSidebar');
    if (!resizer || !sidebar) return;

    // Simple drag logic could go here, or leave empty to prevent error
}

function bindClearChartButton() {
    const btn = document.getElementById('btnClearChart');
    if (btn) {
        btn.addEventListener('click', () => {
            if(confirm("Clear all rows in the chart view?")) {
                const container = document.getElementById('seatPlannerRowContainer');
                if(container) container.innerHTML = '';
                if (isChartEditMode) addChartRowButton(container);
                loadCurrentEventStats();
            }
        });
    }
}

function bindRowLabelToggle() {
    const toggle = document.getElementById('toggleRowLabels');
    if (toggle) {
        toggle.addEventListener('change', (e) => {
            const labels = document.querySelectorAll('.row-label');
            labels.forEach(l => l.style.display = e.target.checked ? 'block' : 'none');
        });
    }
}

function loadBlueprintLayout() {
    const canvas = document.getElementById("canvasInner");
    if (!canvas) return;
    // Clear existing shapes. The grid is a background on the parent, so it remains.
    canvas.innerHTML = '';
    historyManager.clear();

    const currentEventId = localStorage.getItem('seatlify_current_event_id');
    if (currentEventId && typeof MockDB !== 'undefined') {
        const event = MockDB.getEvents().find(e => e.event_id == currentEventId);

        if (event && event.blueprint_layout && event.blueprint_layout.length > 0) {
            console.log("Loading from saved blueprint layout.");
            event.blueprint_layout.forEach(shapeData => {
                const el = document.createElement("div");
                el.classList.add("shape", shapeData.type);
                if (shapeData.type === 'chair') el.classList.add('seat');

                el.style.left = shapeData.left;
                el.style.top = shapeData.top;
                el.style.width = shapeData.width;
                el.style.height = shapeData.height;

                if (shapeData.text) {
                    el.contentEditable = true;
                    el.innerText = shapeData.text;
                }

                makeDraggable(el);
                canvas.appendChild(el);
                addResizers(el);
            });
        }
    }
}

function refreshChartLayout() {
    const currentEventId = localStorage.getItem('seatlify_current_event_id');
    if (currentEventId) {
        generateChartLayout();
    }
}

function generateChartLayout(totalSeats = 0) {
    const container = document.getElementById('seatPlannerRowContainer');
    if (!container) return;

    container.innerHTML = '';

    // --- Get event and saved layout data ---
    const currentEventId = localStorage.getItem('seatlify_current_event_id');
    let event = null;
    if (currentEventId && typeof MockDB !== 'undefined') {
        event = MockDB.getEvents().find(e => e.event_id == currentEventId);
    }
    const savedLayoutData = event ? event[`${chartLayoutMode}_layout_data`] : null;

    // --- Check if we should render from saved data ---
    if (savedLayoutData && savedLayoutData.length > 0) {
        console.log(`Rendering from saved '${chartLayoutMode}' layout data.`);
        
        // Set container style based on mode
        container.className = chartLayoutMode === 'table' 
            ? 'd-flex flex-wrap gap-4 justify-content-center' 
            : 'd-flex flex-column gap-3';

        // Iterate over saved groups and render them
        savedLayoutData.forEach(groupData => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'p-3 border rounded shadow-sm';
            groupDiv.style.backgroundColor = 'var(--bg-panel)';
            groupDiv.style.borderColor = 'var(--border-color)';
            if (chartLayoutMode === 'table') {
                groupDiv.classList.add('text-center');
                groupDiv.style.width = '200px';
            }

            const header = document.createElement('div');
            header.className = 'd-flex justify-content-between align-items-center mb-2';
            header.innerHTML = `
                <div class="d-flex align-items-center gap-2">
                    <strong class="row-label" style="color: var(--text-main);">${groupData.label}</strong>
                    <button class="btn btn-sm btn-link p-0 btn-edit-label" title="Edit Label" style="display: none; color: var(--text-muted);">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                </div>
                <span class="badge bg-secondary">${groupData.seats} seats</span>`;
            groupDiv.appendChild(header);
            header.querySelector('.btn-edit-label').addEventListener('click', editChartLabel);

            const seatsDiv = document.createElement('div');
            seatsDiv.className = 'd-flex flex-wrap gap-2';
            if (chartLayoutMode === 'table') {
                seatsDiv.classList.add('justify-content-center');
            }

            for (let j = 0; j < groupData.seats; j++) {
                const seatEl = document.createElement('div');
                seatEl.className = 'chart-seat d-flex align-items-center justify-content-center border rounded';
                if (chartLayoutMode === 'table') {
                    seatEl.classList.add('rounded-circle');
                }
                seatEl.style.cssText = 'width: 30px; height: 30px; font-size: 12px; cursor: pointer; background-color: var(--bg-muted); color: var(--text-main);';
                seatEl.textContent = j + 1;
                seatEl.title = `${groupData.label}, Seat ${j + 1}`;
                seatsDiv.appendChild(seatEl);
            }
            groupDiv.appendChild(seatsDiv);
            container.appendChild(groupDiv);
        });
    } else if (totalSeats > 0) {
        console.log(`No saved layout for '${chartLayoutMode}'. Auto-building from total seats: ${totalSeats}.`);
        if (chartLayoutMode === 'table') {
            // TABLE LAYOUT
            const seatsPerTable = 10;
            const numTables = Math.ceil(totalSeats / seatsPerTable);
            let seatsRendered = 0;

            container.className = 'd-flex flex-wrap gap-4 justify-content-center';

            for (let i = 0; i < numTables; i++) {
                const tableEl = document.createElement('div');
                tableEl.className = 'border rounded p-3 text-center shadow-sm';
                tableEl.style.backgroundColor = 'var(--bg-panel)';
                tableEl.style.width = '200px';
                tableEl.style.borderColor = 'var(--border-color)';

                const tableHeader = document.createElement('div');
                tableHeader.className = 'd-flex justify-content-center align-items-center gap-2 mb-2';
                tableHeader.innerHTML = `
                    <strong class="row-label fw-bold" style="color: var(--text-main);">Table ${i + 1}</strong>
                    <button class="btn btn-sm btn-link p-0 btn-edit-label" title="Edit Label" style="display: none; color: var(--text-muted);"><i class="bi bi-pencil-square"></i></button>
                `;
                tableEl.appendChild(tableHeader);
                tableHeader.querySelector('.btn-edit-label').addEventListener('click', editChartLabel);

                const seatsContainer = document.createElement('div');
                seatsContainer.className = 'd-flex flex-wrap justify-content-center gap-2';
                
                const seatsInThisTable = Math.min(seatsPerTable, totalSeats - seatsRendered);
                for (let j = 0; j < seatsInThisTable; j++) {
                    const seatEl = document.createElement('div');
                    seatEl.className = 'chart-seat d-flex align-items-center justify-content-center border rounded-circle';
                    seatEl.style.cssText = 'width: 30px; height: 30px; font-size: 12px; cursor: pointer; background-color: var(--bg-muted); color: var(--text-main);';
                    seatEl.textContent = j + 1;
                    seatEl.title = `Table ${i + 1}, Seat ${j + 1}`;
                    seatsContainer.appendChild(seatEl);
                }
                seatsRendered += seatsInThisTable;
                tableEl.appendChild(seatsContainer);
                container.appendChild(tableEl);
            }
        } else { // ROW LAYOUT
            container.className = 'd-flex flex-column gap-3';
            const seatsPerGroup = 10;
            const groupCount = Math.ceil(totalSeats / seatsPerGroup);
            
            for (let i = 0; i < groupCount; i++) {
                const groupDiv = document.createElement('div');
                groupDiv.className = 'p-3 border rounded shadow-sm';
                groupDiv.style.backgroundColor = 'var(--bg-panel)';
                groupDiv.style.borderColor = 'var(--border-color)';
                
                const header = document.createElement('div');
                header.className = 'd-flex justify-content-between align-items-center mb-2';
                const labelText = `Row ${String.fromCharCode(65 + (i % 26))}${Math.floor(i/26) > 0 ? Math.floor(i/26) : ''}`;
                header.innerHTML = `
                    <div class="d-flex align-items-center gap-2">
                        <strong class="row-label" style="color: var(--text-main);">${labelText}</strong>
                        <button class="btn btn-sm btn-link p-0 btn-edit-label" title="Edit Label" style="display: none; color: var(--text-muted);"><i class="bi bi-pencil-square"></i></button>
                    </div>
                    <span class="badge bg-secondary">${Math.min(seatsPerGroup, totalSeats - (i * seatsPerGroup))} seats</span>
                `;
                groupDiv.appendChild(header);
                header.querySelector('.btn-edit-label').addEventListener('click', editChartLabel);

                const seatsDiv = document.createElement('div');
                seatsDiv.className = 'd-flex flex-wrap gap-2';
                const seatsInThisGroup = Math.min(seatsPerGroup, totalSeats - (i * seatsPerGroup));
                for (let j = 0; j < seatsInThisGroup; j++) {
                    const seatEl = document.createElement('div');
                    seatEl.className = 'chart-seat d-flex align-items-center justify-content-center border rounded';
                    seatEl.style.cssText = 'width: 30px; height: 30px; font-size: 12px; cursor: pointer; background-color: var(--bg-muted); color: var(--text-main);';
                    seatEl.textContent = j + 1;
                    seatsDiv.appendChild(seatEl);
                }
                groupDiv.appendChild(seatsDiv);
                container.appendChild(groupDiv);
            }
        }
    } else {
        // If no saved data and no seats to generate, show empty state.
        container.innerHTML = '<div class="text-center text-muted p-4">The chart is empty. Add a new row or use \'Auto Build\' to get started.</div>';
    }

    addChartRowButton(container);
    updateChartEditModeUI();
    loadCurrentEventStats();
}

function addNewRowToChart() {
    const container = document.getElementById('seatPlannerRowContainer');
    const addBtn = document.getElementById('chartAddRowBtn');
    if (!container || !addBtn) return;

    // Remove placeholder if it exists
    const placeholder = container.querySelector('.text-center.text-muted');
    if (placeholder) {
        placeholder.remove();
    }

    const groupDiv = document.createElement('div');
    groupDiv.className = 'p-3 border rounded shadow-sm';
    groupDiv.style.backgroundColor = 'var(--bg-panel)';
    groupDiv.style.borderColor = 'var(--border-color)';

    const existingRows = container.querySelectorAll('.p-3.border.rounded.shadow-sm').length;
    let labelText;
    if (chartLayoutMode === 'row') {
        labelText = `Row ${String.fromCharCode(65 + (existingRows % 26))}${Math.floor(existingRows/26) > 0 ? Math.floor(existingRows/26) : ''}`;
    } else {
        labelText = `Table ${existingRows + 1}`;
    }

    groupDiv.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-2">
            <div class="d-flex align-items-center gap-2">
                <strong class="row-label" style="color: var(--text-main);">${labelText}</strong>
                <button class="btn btn-sm btn-link p-0 btn-edit-label" title="Edit Label" style="color: var(--text-muted);">
                    <i class="bi bi-pencil-square"></i>
                </button>
            </div>
            <span class="badge bg-secondary">0 seats</span>
        </div>
        <div class="d-flex flex-wrap gap-2">
            <!-- Seats will be added here -->
        </div>
    `;

    groupDiv.querySelector('.btn-edit-label').addEventListener('click', editChartLabel);

    const seatsDiv = groupDiv.querySelector('.d-flex.flex-wrap.gap-2');
    if (seatsDiv) {
        seatsDiv.appendChild(createChartAddSeatBtn());
    }

    container.insertBefore(groupDiv, addBtn);
}

function editChartLabel(e) {
    const button = e.currentTarget;
    const container = button.parentElement;
    const labelEl = container.querySelector('.row-label');
    
    if (labelEl) {
        const currentLabel = labelEl.textContent;
        const newLabel = prompt("Enter new label:", currentLabel);
        if (newLabel && newLabel.trim() !== "") {
            labelEl.textContent = newLabel.trim();
        }
    }
}

function updateChartEditModeUI() {
    const container = document.getElementById('seatPlannerRowContainer');
    if (!container) return;

    const addBtn = document.getElementById('chartAddRowBtn');
    if (addBtn) {
        addBtn.style.display = isChartEditMode ? 'block' : 'none';
    }

    const rows = container.querySelectorAll('.p-3.border.rounded.shadow-sm');
    rows.forEach(row => {
        const editLabelBtn = row.querySelector('.btn-edit-label');
        if (editLabelBtn) {
            editLabelBtn.style.display = isChartEditMode ? 'inline-block' : 'none';
        }

        const seatsDiv = row.querySelector('.d-flex.flex-wrap.gap-2');
        if (seatsDiv) {
            const existingBtn = seatsDiv.querySelector('.btn-add-seat-chart');
            
            if (isChartEditMode) {
                if (!existingBtn) {
                    seatsDiv.appendChild(createChartAddSeatBtn());
                }
            } else {
                if (existingBtn) {
                    existingBtn.remove();
                }
            }
        }
    });
}

function createChartAddSeatBtn() {
    const btn = document.createElement('button');
    btn.className = 'btn btn-sm btn-outline-secondary border-dashed btn-add-seat-chart d-flex align-items-center justify-content-center';
    btn.style.width = '30px';
    btn.style.height = '30px';
    btn.style.borderRadius = chartLayoutMode === 'table' ? '50%' : '4px';
    btn.innerHTML = '<i class="bi bi-plus"></i>';
    btn.title = 'Add Seat';
    
    btn.onclick = function(e) {
        e.stopPropagation();

        const totalSeatsEl = document.getElementById('plannerTotalSeats');
        const chartContainer = document.getElementById('seatPlannerRowContainer');
        const currentSeats = chartContainer.querySelectorAll('.chart-seat').length;
        const total = parseInt(totalSeatsEl.dataset.total) || 0;

        if (total > 0 && currentSeats >= total) {
            alert("Seat limit reached. Increase event capacity to add more seats.");
            return;
        }

        const seatsDiv = this.parentNode;
        const currentSeatCount = seatsDiv.querySelectorAll('.chart-seat').length; 
        const newSeatNumber = currentSeatCount + 1;
        
        const seatEl = document.createElement('div');
        seatEl.className = 'chart-seat ' + (chartLayoutMode === 'table' 
            ? 'd-flex align-items-center justify-content-center border rounded-circle' 
            : 'd-flex align-items-center justify-content-center border rounded');
        seatEl.style.cssText = 'width: 30px; height: 30px; font-size: 12px; cursor: pointer; background-color: var(--bg-muted); color: var(--text-main);';
        seatEl.textContent = newSeatNumber;
        
        const rowCard = seatsDiv.closest('.p-3');
        if (rowCard) {
            const label = rowCard.querySelector('.row-label')?.textContent || '';
            seatEl.title = `${label}, Seat ${newSeatNumber}`;
            const badge = rowCard.querySelector('.badge');
            if(badge) badge.textContent = `${newSeatNumber} seats`;
        }
        
        seatsDiv.insertBefore(seatEl, this);

        // Update main counter
        loadCurrentEventStats();
    };
    return btn;
}