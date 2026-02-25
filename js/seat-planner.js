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
let canvas, container, grid;
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
    grid = document.querySelector(".grid");

    const chartContainer = document.getElementById('seatPlannerRowContainer');
    if (chartContainer) {
        // Clear placeholder and add the button
        chartContainer.innerHTML = '';
        addChartRowButton(chartContainer);
    }

    if (!canvas || !container || !grid) {
        console.error("Seat Planner DOM not ready");
        return;
    }

    canvas.style.transformOrigin = "0 0";

    bindToolSelection();
    bindMouseEvents();
    bindGridToggle();
    bindZoomControls();
    bindClearButton();
    bindBulkAdd();
    bindSaveButton();
    bindAutoBuildButton();
    bindGuestListResizer();
    bindClearChartButton();
    bindChartGroupingButtons();
    bindRowLabelToggle();
    initChartSortable();
    bindChartEditControls();
    bindTabSwitchers();
    refreshChartLayout();
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

  const rect = canvas.getBoundingClientRect();
  const x =
    Math.round(((e.clientX - rect.left) / scale) / gridSize) * gridSize;
  const y =
    Math.round(((e.clientY - rect.top) / scale) / gridSize) * gridSize;

  deselectAll();

  if (currentTool === "chair") {
    const chair = document.createElement("div");
    chair.classList.add("shape", "chair");
    chair.style.width = `${CHAIR_SIZE}px`;
    chair.style.height = `${CHAIR_SIZE}px`;
    chair.style.left = `${x}px`;
    chair.style.top = `${y}px`;

    makeDraggable(chair);
    canvas.appendChild(chair);
    addResizers(chair);
    selectShape(chair);
    updateBlueprintSeatCount();
  }

  if (currentTool === "text" || currentTool === "comment") {
    const el = document.createElement("div");
    el.classList.add("shape", currentTool);
    el.contentEditable = true;
    el.innerText = currentTool === "text" ? "Text" : "Comment";
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    makeDraggable(el);
    canvas.appendChild(el);
    addResizers(el);
    selectShape(el);
  }
}

/* ==========================
   DRAGGING
========================== */
function makeDraggable(el) {
  let offsetX = 0,
      offsetY = 0;

  el.onmousedown = (e) => {
    if (e.target.classList.contains("resizer")) return;
    selectShape(el);

    e.stopPropagation();
    isDraggingShape = true;

    offsetX = e.offsetX;
    offsetY = e.offsetY;

    document.onmousemove = (ev) => {
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
    };
  };
}

/* ==========================
   RESIZING & SELECTION
========================== */
function addResizers(el) {
  const positions = ["tl", "tr", "bl", "br"];
  positions.forEach(pos => {
    const resizer = document.createElement("div");
    resizer.classList.add("resizer", pos);
    resizer.addEventListener("mousedown", (e) => onResizeStart(e, el, pos));
    el.appendChild(resizer);
  });
}

function onResizeStart(e, el, pos) {
  e.stopPropagation();
  isResizing = true;

  const startX = e.clientX;
  const startY = e.clientY;
  const startWidth = parseInt(document.defaultView.getComputedStyle(el).width, 10);
  const startHeight = parseInt(document.defaultView.getComputedStyle(el).height, 10);
  const startLeft = parseInt(el.style.left || 0, 10);
  const startTop = parseInt(el.style.top || 0, 10);

  const onMouseMove = (moveEvent) => {
    const dx = (moveEvent.clientX - startX) / scale;
    const dy = (moveEvent.clientY - startY) / scale;

    if (pos.includes("r")) {
      el.style.width = `${Math.max(20, startWidth + dx)}px`;
    }
    if (pos.includes("b")) {
      el.style.height = `${Math.max(20, startHeight + dy)}px`;
    }
    if (pos.includes("l")) {
      const newWidth = Math.max(20, startWidth - dx);
      if (newWidth > 20) {
        el.style.left = `${startLeft + dx}px`;
        el.style.width = `${newWidth}px`;
      }
    }
    if (pos.includes("t")) {
      const newHeight = Math.max(20, startHeight - dy);
      if (newHeight > 20) {
        el.style.top = `${startTop + dy}px`;
        el.style.height = `${newHeight}px`;
      }
    }
  };

  const onMouseUp = () => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    setTimeout(() => isResizing = false, 0);
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
    grid.style.display =
      grid.style.display === "none" ? "block" : "none";
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
}

/* ==========================
   CLEAR
========================== */
function bindClearButton() {
  document.getElementById("clearBtn").onclick = () => {
    canvas.querySelectorAll(".shape").forEach((el) => el.remove());
    selectedSeats = [];
    selectedShape = null;
    updateBlueprintSeatCount();
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
        
        if(qty > 0) {
            addItemsToBlueprint(qty, type);
            if (type === 'chair') {
                updateBlueprintSeatCount();
            }
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

function bindSaveButton() {
    const saveBtn = document.getElementById('savePlanBtn');
    if(!saveBtn) return;

    saveBtn.addEventListener('click', () => {
        // Count seats (chairs)
        const seatCount = document.querySelectorAll('.shape.chair').length;
        const currentEventId = localStorage.getItem('seatlify_current_event_id');

        if(currentEventId && typeof MockDB !== 'undefined') {
            MockDB.updateEvent(currentEventId, { total_seats: seatCount });
            alert(`Plan saved! Total Seats: ${seatCount}`);
            
            // Update Counter UI
            const countEl = document.getElementById('plannerTotalSeats');
            const total = countEl ? (countEl.dataset.total || '-') : '-';
            if(countEl) countEl.textContent = `${seatCount} / ${total}`;
        } else {
            alert("Saved locally (No active event linked).");
        }
    });
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

function bindChartEditControls() {
    const btnSave = document.getElementById('btnSaveChart');
    const btnEdit = document.getElementById('btnEditChart');

    if (btnSave && btnEdit) {
        btnSave.addEventListener('click', () => {
            // Here you would add logic to save the chart layout
            const chartContainer = document.getElementById('seatPlannerRowContainer');
            const seatCount = chartContainer.querySelectorAll('.chart-seat').length;
            const currentEventId = localStorage.getItem('seatlify_current_event_id');

            if(currentEventId && typeof MockDB !== 'undefined') {
                MockDB.updateEvent(currentEventId, { total_seats: seatCount });
                alert(`Chart layout saved! Total Seats: ${seatCount}`);
                
                // Ensure counter is synced
                loadCurrentEventStats();
            } else {
                alert("Chart layout saved locally (No active event linked).");
            }

            // Toggle button visibility
            btnSave.style.display = 'none';
            btnEdit.style.display = 'inline-block';
            isChartEditMode = false;
            updateChartEditModeUI();

            // Disable editing features
            const addBtn = document.getElementById('chartAddRowBtn');
            if (addBtn) addBtn.style.display = 'none';
            
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

            // Enable editing features
            const addBtn = document.getElementById('chartAddRowBtn');
            if (addBtn) addBtn.style.display = 'block';

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
            loadCurrentEventStats();
            const canvas = document.getElementById("canvasInner");
            if (canvas) {
                const gridDiv = canvas.querySelector('.grid');
                canvas.innerHTML = '';
                if(gridDiv) canvas.appendChild(gridDiv);
            }

            const currentEventId = localStorage.getItem('seatlify_current_event_id');
            if (currentEventId && typeof MockDB !== 'undefined') {
                const event = MockDB.getEvents().find(e => e.event_id == currentEventId);
                if (event && event.total_seats > 0) {
                    addItemsToBlueprint(event.total_seats, 'chair');
                }
            }
        });
    }
}

/* ==========================
   MISSING HELPER FUNCTIONS
========================== */
function loadCurrentEventStats() {
    const countEl = document.getElementById('plannerTotalSeats');
    const currentEventId = localStorage.getItem('seatlify_current_event_id');

    if (countEl && currentEventId && typeof MockDB !== 'undefined') {
        const event = MockDB.getEvents().find(e => e.event_id == currentEventId);
        if (event) {
            const current = event.total_seats || 0;
            const total = event.attendees || 0;
            countEl.dataset.total = total;
            countEl.textContent = `${current} / ${total}`;
        } else {
            // Event ID from storage is invalid
            countEl.textContent = '0 / 0';
            console.warn(`Event with ID ${currentEventId} not found.`);
        }
    } else if (countEl) {
        // Fallback if no event is selected, show canvas count
        const chairs = document.querySelectorAll('.shape.chair').length;
        countEl.dataset.total = '-';
        countEl.textContent = `${chairs} / -`;
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
                if (event) totalSeats = parseInt(event.total_seats) || 0;
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
                addChartRowButton(container);
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

function refreshChartLayout() {
    const currentEventId = localStorage.getItem('seatlify_current_event_id');
    if (currentEventId && typeof MockDB !== 'undefined') {
        const event = MockDB.getEvents().find(e => e.event_id == currentEventId);
        if (event && event.total_seats) {
            generateChartLayout(parseInt(event.total_seats));
        }
    }
}

function generateChartLayout(totalSeats) {
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
            header.innerHTML = `<strong class="row-label" style="color: var(--text-main);">${groupData.label}</strong><span class="badge bg-secondary">${groupData.seats} seats</span>`;
            groupDiv.appendChild(header);

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
    } else {
        // --- FALLBACK to original auto-build logic ---
        console.log(`No saved layout for '${chartLayoutMode}'. Auto-building from total seats.`);
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

                const tableLabel = document.createElement('div');
                tableLabel.className = 'fw-bold mb-2';
                tableLabel.style.color = 'var(--text-main)';
                tableLabel.textContent = `Table ${i + 1}`;
                tableEl.appendChild(tableLabel);

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
                header.innerHTML = `<strong class="row-label" style="color: var(--text-main);">${labelText}</strong><span class="badge bg-secondary">${Math.min(seatsPerGroup, totalSeats - (i * seatsPerGroup))} seats</span>`;
                groupDiv.appendChild(header);

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
    }

    addChartRowButton(container);
    updateChartEditModeUI();
}

function addNewRowToChart() {
    const container = document.getElementById('seatPlannerRowContainer');
    const addBtn = document.getElementById('chartAddRowBtn');
    if (!container || !addBtn) return;

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
            <strong class="row-label" style="color: var(--text-main);">${labelText}</strong>
            <span class="badge bg-secondary">0 seats</span>
        </div>
        <div class="d-flex flex-wrap gap-2">
            <!-- Add seats via Blueprint tab -->
        </div>
    `;

    const seatsDiv = groupDiv.querySelector('.d-flex.flex-wrap.gap-2');
    if (seatsDiv) {
        seatsDiv.appendChild(createChartAddSeatBtn());
    }

    container.insertBefore(groupDiv, addBtn);
}

function updateChartEditModeUI() {
    const container = document.getElementById('seatPlannerRowContainer');
    if (!container) return;

    const rows = container.querySelectorAll('.p-3.border.rounded.shadow-sm');
    rows.forEach(row => {
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
        const totalSeatsEl = document.getElementById('plannerTotalSeats');
        const chartContainer = document.getElementById('seatPlannerRowContainer');
        if (totalSeatsEl && chartContainer) {
            const totalSeats = chartContainer.querySelectorAll('.chart-seat').length;
            const total = totalSeatsEl.dataset.total || '-';
            totalSeatsEl.textContent = `${totalSeats} / ${total}`;

            // Update MockDB immediately so the new count is reflected when switching views
            const currentEventId = localStorage.getItem('seatlify_current_event_id');
            if (currentEventId && typeof MockDB !== 'undefined') {
                MockDB.updateEvent(currentEventId, { total_seats: totalSeats });
            }
        }
    };
    return btn;
}

function updateBlueprintSeatCount() {
    const countEl = document.getElementById('plannerTotalSeats');
    if (countEl) {
        const seatCount = document.querySelectorAll('#canvasInner .shape.chair').length;
        const total = countEl.dataset.total || '-';
        countEl.textContent = `${seatCount} / ${total}`;
    }
}