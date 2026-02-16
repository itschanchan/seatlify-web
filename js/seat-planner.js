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

    if (seatPlannerInitialized) return;
    seatPlannerInitialized = true;

    console.log("Seat planner initialized (lazy)");

    canvas = document.getElementById("canvasInner");
    container = document.querySelector(".seat-planner-container");
    grid = document.querySelector(".grid");

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
        
        if(qty <= 0) return;

        const startX = 50;
        const startY = 50;
        const gap = 10;
        const cols = 10; // Items per row
        const itemSize = type === 'chair' ? CHAIR_SIZE : 50; // Larger for tables

        for(let i=0; i<qty; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);

            const x = startX + (col * (itemSize + gap));
            const y = startY + (row * (itemSize + gap));

            const el = document.createElement("div");
            el.classList.add("shape", type);
            if(type === 'chair') el.classList.add('seat'); // Mark as seat for counting
            
            el.style.width = `${itemSize}px`;
            el.style.height = `${itemSize}px`;
            el.style.left = `${x}px`;
            el.style.top = `${y}px`;

            makeDraggable(el);
            canvas.appendChild(el);
            addResizers(el);
        }
    });
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
        } else {
            alert("Saved locally (No active event linked).");
        }
    });
}

/* ==========================
   SEAT LOGIC (EXAMPLE)
========================== */
function generateSeats() {
  const rows = ["A", "B", "C", "D"];
  let list = [];
  let id = 1;

  rows.forEach((row) => {
    for (let i = 1; i <= 8; i++) {
      list.push({ id: id++, row, number: i });
    }
  });

  return list;
}

function renderSeats() {
  seats.forEach((_, index) => {
    const el = document.createElement("div");
    el.classList.add("shape", "chair", "seat");
    el.style.width = `${CHAIR_SIZE}px`;
    el.style.height = `${CHAIR_SIZE}px`;
    el.style.left = `${(index % 8) * gridSize}px`;
    el.style.top = `${Math.floor(index / 8) * gridSize}px`;
    canvas.appendChild(el);
  });
}

function renderSelectedSeats() {}
