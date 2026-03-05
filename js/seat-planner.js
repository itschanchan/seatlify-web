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

let selectedChartGroup = null;
let chartSeatSlider = null;

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
export function initSeatPlanner() {
    console.log("initSeatPlanner() called");

    // Load stats whenever initialized/shown
    loadSwiperDependencies();
    loadCurrentEventStats();

    // Global listeners should only be bound once.
    if (!seatPlannerInitialized) {
        console.log("Binding global listeners for seat planner.");
        bindKeyboardShortcuts();
        // Expose the save function to the window scope and add listeners for auto-saving
        window.saveCurrentPlannerState = saveCurrentPlannerState;
        window.addEventListener('beforeunload', window.saveCurrentPlannerState);
    }

    seatPlannerInitialized = true;
    console.log("Seat planner DOM re-initialization");

    canvas = document.getElementById("canvasInner");
    container = document.querySelector(".seat-planner-container");

    if (!canvas || !container) {
        console.error("Seat Planner DOM not ready");
        return;
    }

    canvas.style.transformOrigin = "0 0";

    // Restore Chart Edit Mode State
    const currentEventId = localStorage.getItem('seatlify_current_event_id');
    if (currentEventId) {
        const savedMode = localStorage.getItem(`seatlify_chart_edit_mode_${currentEventId}`);
        isChartEditMode = savedMode === 'false' ? false : true;
    }
    if (currentEventId) {
        const savedLayoutMode = localStorage.getItem(`seatlify_chart_layout_mode_${currentEventId}`);
        if (savedLayoutMode) {
            chartLayoutMode = savedLayoutMode;
        }
    }

    updateChartGroupingButtonsUI();

    historyManager.clear();
    bindToolSelection();
    bindToolbarDragAndDrop();
    bindMouseEvents();
    bindGridToggle();
    bindZoomControls();
    bindClearButton();
    bindBulkAdd();
    bindSaveButton();
    bindAutoBuildButton();
    bindEditTotalSeats();
    bindClearChartButton();
    bindChartGroupingButtons();
    bindRowLabelToggle();
    initChartSortable();
    initSeatSlider();
    bindOverallSeatSlider();
    bindChartEditControls();
    bindTabSwitchers();
    refreshChartLayout();
}

function bindOverallSeatSlider() {
    const slider = document.getElementById('seat-slider');
    if (!slider) return;

    slider.addEventListener('input', (e) => {
        if (!isChartEditMode) {
            alert("Please enter edit mode to change seat counts.");
            const firstGroup = document.querySelector('#seatPlannerRowContainer .chart-group');
            if(firstGroup) {
                slider.value = firstGroup.querySelectorAll('.chart-seat').length;
            }
            return;
        }

        const newSeatCount = parseInt(e.target.value, 10);

        document.querySelectorAll('#seatPlannerRowContainer .chart-group').forEach(group => {
            updateSeatsInGroup(group, newSeatCount);
        });

        loadCurrentEventStats();
    });
}

function updateOverallSliderMax() {
    const slider = document.getElementById('seat-slider');
    const maxInput = document.getElementById('seat-slider-max');
    if (!slider || !maxInput) return;

    const currentEventId = localStorage.getItem('seatlify_current_event_id');
    if (currentEventId && typeof MockDB !== 'undefined') {
        const event = MockDB.getEvents().find(e => e.event_id == currentEventId);
        if (event) {
            const maxCapacity = parseInt(event.total_seats) || 0;
            const groups = document.querySelectorAll('#seatPlannerRowContainer .chart-group');
            const numGroups = groups.length;

            let newMax = 100; // Default
            if (maxCapacity > 0 && numGroups > 0) {
                newMax = Math.floor(maxCapacity / numGroups);
            }
            
            newMax = newMax > 0 ? newMax : 1;
            slider.max = newMax;
            maxInput.textContent = newMax;

            if (parseInt(slider.value) > newMax) {
                slider.value = newMax;
                slider.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    }
}

function updateSeatsInGroup(group, newSeatCount) {
    const seatsDiv = group.querySelector('.d-flex.flex-wrap.gap-2');
    if (!seatsDiv) return;

    const addBtn = seatsDiv.querySelector('.btn-add-seat-chart');
    const currentCount = seatsDiv.querySelectorAll('.chart-seat').length;

    if (newSeatCount > currentCount) {
        for (let i = 0; i < (newSeatCount - currentCount); i++) {
            const seatEl = createNewSeatElement(seatsDiv);
            if(addBtn) {
                seatsDiv.insertBefore(seatEl, addBtn);
            } else {
                seatsDiv.appendChild(seatEl);
            }
        }
    } else if (newSeatCount < currentCount) {
        for (let i = 0; i < (currentCount - newSeatCount); i++) {
            const seatToRemove = seatsDiv.querySelector('.chart-seat:last-of-type');
            if (seatToRemove) seatToRemove.remove();
        }
    }

    // Renumber seats
    seatsDiv.querySelectorAll('.chart-seat').forEach((seat, index) => {
        seat.textContent = index + 1;
    });

    const finalCount = seatsDiv.querySelectorAll('.chart-seat').length;
    const badge = group.querySelector('.badge');
    if (badge) badge.textContent = `${finalCount} seats`;
}

function createNewSeatElement(seatsDiv) {
    const newSeatNumber = seatsDiv.querySelectorAll('.chart-seat').length + 1;

    const seatEl = document.createElement('div');
    seatEl.className = 'chart-seat d-flex align-items-center justify-content-center border rounded';
    if (chartLayoutMode === 'table') {
        seatEl.classList.add('rounded-circle');
    }
    seatEl.style.cssText = 'width: 30px; height: 30px; font-size: 12px; cursor: pointer; background-color: var(--bg-muted); color: var(--text-main);';
    seatEl.textContent = newSeatNumber;

    // Simplified popover logic for this context
    const rowCard = seatsDiv.closest('.chart-group');
    const label = rowCard?.querySelector('.row-label')?.textContent || 'Row';
    seatEl.dataset.bsToggle = 'popover';
    seatEl.dataset.bsTrigger = 'hover';
    seatEl.dataset.bsPlacement = 'top';
    seatEl.dataset.bsTitle = `${label}, Seat ${newSeatNumber}`;
    seatEl.dataset.bsContent = `Status: Available`;
    seatEl.dataset.bsContainer = 'body';

    const popover = new bootstrap.Popover(seatEl, { container: 'body' });
    if (!isChartEditMode) {
        popover.enable();
    } else {
        popover.disable();
    }

    return seatEl;
}

function loadSwiperDependencies() {
    if (!document.querySelector('link[href*="swiper-bundle.min.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css';
        document.head.appendChild(link);
    }
    if (!document.querySelector('script[src*="swiper-bundle.min.js"]')) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js';
        document.body.appendChild(script);
    }
}

function initSeatSlider() {
    // Check if Swiper is loaded. If not, wait and retry.
    if (typeof Swiper === 'undefined') {
        setTimeout(initSeatSlider, 100);
        return;
    }

    const sliderEl = document.getElementById('chartSeatSlider');
    if (!sliderEl) return; // Element not found

    // Destroy existing instance if it exists
    if (chartSeatSlider && !chartSeatSlider.destroyed) {
        chartSeatSlider.destroy(true, true);
        chartSeatSlider = null;
    }

    const maxInput = document.getElementById('seatSliderMaxInput');
    const maxSeats = maxInput ? parseInt(maxInput.value, 10) : 30;

    const wrapper = sliderEl.querySelector('.swiper-wrapper');
    if (wrapper) {
        wrapper.innerHTML = '';
        for (let i = 1; i <= maxSeats; i++) { // Use dynamic max
            wrapper.innerHTML += `<div class="swiper-slide text-center fs-5" style="color: var(--text-main);">${i}</div>`;
        }
    }

    const valueEl = document.getElementById('currentSeatSliderValue');
    const currentVal = valueEl ? parseInt(valueEl.textContent, 10) : 12;
    const initialSlideIndex = Math.min(Math.max(0, currentVal - 1), maxSeats - 1);

    chartSeatSlider = new Swiper(sliderEl, {
        slidesPerView: 'auto',
        centeredSlides: true,
        spaceBetween: 10,
        initialSlide: initialSlideIndex,
    });

    chartSeatSlider.on('slideChange', function () {
        if (valueEl) {
            const newSeatCount = parseInt(chartSeatSlider.slides[chartSeatSlider.activeIndex].textContent);
            valueEl.textContent = newSeatCount;
            if (selectedChartGroup) {
                updateSeatsInSelectedGroup(newSeatCount);
            }
        }
    });

    // Add listener to the max input if not already added
    if (maxInput && !maxInput.hasAttribute('listener-added')) {
        maxInput.setAttribute('listener-added', 'true');
        maxInput.addEventListener('change', () => initSeatSlider());
    }
}

function updateSeatsInSelectedGroup(newSeatCount) {
    if (!selectedChartGroup) return;

    const seatsDiv = selectedChartGroup.querySelector('.d-flex.flex-wrap.gap-2');
    if (!seatsDiv) return;

    const addBtn = seatsDiv.querySelector('.btn-add-seat-chart');
    const currentCount = seatsDiv.querySelectorAll('.chart-seat').length;

    if (newSeatCount > currentCount) {
        // Add seats by simulating a click on the group's add button
        if (addBtn) {
            for (let i = 0; i < (newSeatCount - currentCount); i++) {
                addBtn.click();
            }
        }
    } else if (newSeatCount < currentCount) {
        // Remove seats from the end
        for (let i = 0; i < (currentCount - newSeatCount); i++) {
            const seatToRemove = seatsDiv.querySelector('.chart-seat:last-of-type');
            if (seatToRemove) seatToRemove.remove();
        }
    }

    // Update the badge on the row/table card
    const badge = selectedChartGroup.querySelector('.badge');
    if (badge) badge.textContent = `${newSeatCount} seats`;

    // Update the main total seats counter
    loadCurrentEventStats();
}

function deselectAllChartGroups() {
    if (selectedChartGroup) {
        selectedChartGroup.classList.remove('selected');
    }
    selectedChartGroup = null;
    const sliderContainer = document.getElementById('seatSliderContainer');
    if (sliderContainer) {
        sliderContainer.style.display = 'none';
    }
}

function addChartRowButton(container) {
    const wrapper = document.createElement('div');
    wrapper.id = 'chartBtnWrapper';
    wrapper.className = 'd-flex gap-2 mt-3 w-100';

    const addRowBtn = document.createElement('button');
    addRowBtn.id = 'chartAddRowBtn';
    addRowBtn.className = 'btn btn-outline-secondary flex-grow-1';
    addRowBtn.style.borderStyle = 'dashed';
    const buttonText = chartLayoutMode === 'table' ? 'Add Table' : 'Add Row';
    addRowBtn.innerHTML = `<i class="bi bi-plus-lg"></i> ${buttonText}`;
    addRowBtn.addEventListener('click', addNewRowToChart);
    
    const reduceBtn = document.createElement('button');
    reduceBtn.id = 'chartReduceBtn';
    reduceBtn.className = 'btn btn-outline-danger';
    reduceBtn.style.borderStyle = 'dashed';
    reduceBtn.innerHTML = `<i class="bi bi-dash-lg"></i>`;
    reduceBtn.title = chartLayoutMode === 'table' ? 'Remove Last Table' : 'Remove Last Row';
    reduceBtn.addEventListener('click', removeLastRowFromChart);

    wrapper.appendChild(addRowBtn);
    wrapper.appendChild(reduceBtn);
    container.appendChild(wrapper);
}

function removeLastRowFromChart() {
    const container = document.getElementById('seatPlannerRowContainer');
    if (!container) return;

    const groups = container.querySelectorAll('.chart-group');
    if (groups.length > 0) {
        const lastGroup = groups[groups.length - 1];
        if (selectedChartGroup === lastGroup) {
            deselectAllChartGroups();
        }
        lastGroup.remove();
        loadCurrentEventStats();
        updateOverallSliderMax();
    }
}

function setActiveTool(tool) {
    currentTool = tool;
    const toolButtons = document.querySelectorAll(".tool-btn");
    toolButtons.forEach(btn => btn.classList.remove("active"));

    const shapeMainBtn = document.getElementById("shapeMainBtn");

    if (tool === "rect" || tool === "circle") {
        if(shapeMainBtn) shapeMainBtn.classList.add("active");
    } else {
        const targetBtn = document.querySelector(`.tool-btn[data-tool="${tool}"]`);
        if (targetBtn) {
            targetBtn.classList.add("active");
        }
    }
}

/* ==========================
   TOOL SELECTION (UPDATED)
========================== */
function bindToolSelection() {
  const toolButtons = document.querySelectorAll(".tool-btn");
  const shapeOptions = document.querySelectorAll(".shape-option");
  const shapeMainBtn = document.getElementById("shapeMainBtn");
  const shapeMainIcon = document.getElementById("shapeMainIcon");

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
            
            // Switch to select tool after dropping an element
            setActiveTool('select');
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
                MockDB.updateEvent(currentEventId, { total_seats: parseInt(newTotal) });
                loadCurrentEventStats();
                updateOverallSliderMax();
            }
        });
    }
}

function updateChartGroupingButtonsUI() {
    const btnRow = document.getElementById('btnGroupRow');
    const btnTable = document.getElementById('btnGroupTable');
    if (!btnRow || !btnTable) return;

    if (chartLayoutMode === 'table') {
        btnTable.classList.add('active');
        btnRow.classList.remove('active');
    } else {
        btnRow.classList.add('active');
        btnTable.classList.remove('active');
    }
}

/* ==========================
   CHART GROUPING
========================== */
function bindChartGroupingButtons() {
    const btnRow = document.getElementById('btnGroupRow');
    const btnTable = document.getElementById('btnGroupTable');

    const setMode = (mode) => {
        // If in edit mode and switching layouts, silently save the current state first to prevent losing progress.
        if (isChartEditMode && mode !== chartLayoutMode) {
            saveChartState(true);
        }

        chartLayoutMode = mode;
        updateChartGroupingButtonsUI();
        const currentEventId = localStorage.getItem('seatlify_current_event_id');
        if (currentEventId) {
            localStorage.setItem(`seatlify_chart_layout_mode_${currentEventId}`, mode);
        }
        deselectAllChartGroups();
        refreshChartLayout();
    };

    if (btnRow && btnTable) {
        btnRow.addEventListener('click', () => setMode('row'));
        btnTable.addEventListener('click', () => setMode('table'));
    }
}

function initChartSortable() {
    const container = document.getElementById('seatPlannerRowContainer');
    if (container && typeof Sortable !== 'undefined') {
        new Sortable(container, {
            animation: 150,
            ghostClass: 'bg-light',
            draggable: '.shadow-sm'
        });
    }
}

function saveChartState(silent = false) {
    const chartContainer = document.getElementById('seatPlannerRowContainer');
    const currentEventId = localStorage.getItem('seatlify_current_event_id');

    if (!currentEventId || typeof MockDB === 'undefined') {
        alert("Chart layout saved locally (No active event linked).");
        return;
    }
    
    const event = MockDB.getEvents().find(e => e.event_id == currentEventId);
    if (!event) {
        if (!silent) alert("Error: Could not find the current event to save to.");
        return;
    }

    const newLayoutData = [];
    let tickets = event.tickets ? JSON.parse(JSON.stringify(event.tickets)) : []; // Deep copy

    chartContainer.querySelectorAll('.p-3.border.rounded.shadow-sm').forEach(rowEl => {
        const currentDomLabel = rowEl.querySelector('.row-label')?.textContent.trim() || '';
        const originalLabel = rowEl.dataset.originalLabel;
        const seats = rowEl.querySelectorAll('.chart-seat').length;

        if (!currentDomLabel) return; // Don't save rows with no label

        if (originalLabel) {
            // This is an existing row. Its identity is `originalLabel`.
            newLayoutData.push({ label: originalLabel, seats: seats });

            const ticketIndex = tickets.findIndex(t => t.original_name === originalLabel);

            if (currentDomLabel !== originalLabel) {
                if (ticketIndex !== -1) {
                    tickets[ticketIndex].name = currentDomLabel;
                } else {
                    tickets.push({ name: currentDomLabel, original_name: originalLabel, price: 0, qty: seats });
                }
            } else {
                if (ticketIndex !== -1 && !tickets[ticketIndex].price) {
                    tickets.splice(ticketIndex, 1);
                }
            }
        } else {
            // This is a new row. Its current DOM label becomes its original label.
            newLayoutData.push({ label: currentDomLabel, seats: seats });
        }
    });

    const updatePayload = { tickets: tickets };
    updatePayload[`${chartLayoutMode}_layout_data`] = newLayoutData;
    MockDB.updateEvent(currentEventId, updatePayload);
    
    if (!silent) {
        const seatCount = newLayoutData.reduce((acc, group) => acc + group.seats, 0);
        alert(`Chart layout saved! Total Seats: ${seatCount}`);
    }
    console.log("Chart state saved.");
    loadCurrentEventStats();
}

function bindChartEditControls() {
    const btnSave = document.getElementById('btnSaveChart');
    const btnEdit = document.getElementById('btnEditChart');

    if (btnSave && btnEdit) {
        btnSave.addEventListener('click', () => {
            saveChartState(false);
            isChartEditMode = false;
            
            const currentEventId = localStorage.getItem('seatlify_current_event_id');
            if(currentEventId) localStorage.setItem(`seatlify_chart_edit_mode_${currentEventId}`, 'false');
            
            updateChartEditModeUI();
        });

        btnEdit.addEventListener('click', () => {
            isChartEditMode = true;
            
            const currentEventId = localStorage.getItem('seatlify_current_event_id');
            if(currentEventId) localStorage.setItem(`seatlify_chart_edit_mode_${currentEventId}`, 'true');
            
            updateChartEditModeUI();
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
            const totalCapacity = parseInt(event.total_seats) || 0;
            countEl.dataset.total = totalCapacity;

            // Determine active tab and count current seats in that view
            const chartTab = document.getElementById('pills-chart-tab');
            const isChartActive = chartTab && chartTab.classList.contains('active');
            let currentSeats = 0;
            if (isChartActive) {
                // Chart view is active
                currentSeats = document.querySelectorAll('#seatPlannerRowContainer .chart-seat').length;
            } else {
                // Blueprint view is active
                currentSeats = document.querySelectorAll('#canvasInner .shape.chair').length;
            }
            countEl.textContent = `${currentSeats} / ${totalCapacity}`;
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

function bindClearChartButton() {
    const btn = document.getElementById('btnClearChart');
    if (btn) {
        btn.addEventListener('click', () => {
            if(confirm("Clear all rows in the chart view?")) {
                const container = document.getElementById('seatPlannerRowContainer');
                if(container) container.innerHTML = '';
                deselectAllChartGroups();
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
    deselectAllChartGroups();
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
            groupDiv.className = 'p-3 border rounded shadow-sm chart-group';
            groupDiv.dataset.originalLabel = groupData.label;
            groupDiv.style.backgroundColor = 'var(--bg-panel)';
            groupDiv.style.borderColor = 'var(--border-color)';
            groupDiv.style.cursor = 'pointer';
            if (chartLayoutMode === 'table') {
                groupDiv.classList.add('text-center');
                groupDiv.style.width = '200px';
            }

            // Find if there's a custom ticket name for this group
            const ticketTier = event.tickets ? event.tickets.find(t => t.original_name === groupData.label) : null;
            const displayName = ticketTier ? ticketTier.name : groupData.label;
            const price = ticketTier ? ticketTier.price : 0;

            const header = document.createElement('div');
            header.className = 'd-flex justify-content-between align-items-center mb-2';
            header.innerHTML = `
                <div class="d-flex align-items-center gap-2">
                    <strong class="row-label" style="color: var(--text-main);">${displayName}</strong>
                    <button class="btn btn-sm btn-link p-0 btn-edit-label" title="Edit Label" style="display: none; color: var(--text-muted);">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                </div>
                <span class="badge bg-secondary">${groupData.seats} seats</span>`;
            groupDiv.appendChild(header);
            groupDiv.addEventListener('click', () => selectChartGroup(groupDiv));
            header.querySelector('.btn-edit-label').addEventListener('click', editChartLabel);

            const seatsDiv = document.createElement('div');
            seatsDiv.className = 'd-flex flex-wrap gap-2';
            if (chartLayoutMode === 'table') {
                seatsDiv.classList.add('justify-content-center');
            }

            for (let j = 0; j < groupData.seats; j++) {
                const seatEl = document.createElement('div');
                const seatNumber = j + 1;
                seatEl.className = 'chart-seat d-flex align-items-center justify-content-center border rounded';
                if (chartLayoutMode === 'table') {
                    seatEl.classList.add('rounded-circle');
                }
                seatEl.style.cssText = 'width: 30px; height: 30px; font-size: 12px; cursor: pointer;';
                seatEl.textContent = seatNumber;

                const isReserved = MockDB.isSeatReserved(currentEventId, groupData.label, seatNumber);
                let popoverStatus = 'Available';
                if (isReserved) {
                    seatEl.style.backgroundColor = 'var(--bs-danger)';
                    seatEl.style.color = 'white';
                    popoverStatus = 'Reserved';
                    seatEl.onclick = () => {
                        if (confirm(`Make seat ${displayName}-${seatNumber} available again? This will remove the guest reservation.`)) {
                            MockDB.unreserveSeat(currentEventId, groupData.label, seatNumber);
                            generateChartLayout(); // Re-render this view
                        }
                    };
                } else {
                    seatEl.style.backgroundColor = 'var(--bg-muted)';
                    seatEl.style.color = 'var(--text-main)';
                    seatEl.onclick = () => {
                        if (isChartEditMode) {
                            alert("Exit edit mode to reserve seats.");
                            return;
                        }
                        const guestName = prompt(`Reserve seat ${displayName}-${seatNumber} for:`, "Guest Name");
                        if (guestName) {
                            const guestEmail = prompt(`Enter email for ${guestName}:`, `${guestName.toLowerCase().replace(/\s/g, '.')}@example.com`);
                            if (guestEmail) {
                                MockDB.reserveSeat(currentEventId, groupData.label, seatNumber, {
                                    name: guestName,
                                    email: guestEmail
                                });
                                generateChartLayout(); // Re-render this view to show the seat as reserved
                            }
                        }
                    };
                }
                seatEl.dataset.bsToggle = 'popover';
                seatEl.dataset.bsTrigger = 'hover';
                seatEl.dataset.bsPlacement = 'top';
                seatEl.dataset.bsHtml = 'true';
                seatEl.dataset.bsTitle = `${displayName}, Seat ${seatNumber}`;
                seatEl.dataset.bsContent = `Price: ₱${price}<br>Status: ${popoverStatus}`;
                seatEl.dataset.bsContainer = 'body';
                seatsDiv.appendChild(seatEl);
            }
            groupDiv.appendChild(seatsDiv);
            container.appendChild(groupDiv);
        });
    } else if (totalSeats > 0) {
        console.log(`No saved layout for '${chartLayoutMode}'. Auto-building from total seats: ${totalSeats}.`);
        if (chartLayoutMode === 'table') {
            // TABLE LAYOUT
            const seatsPerTable = (event && parseInt(event.seats_per_table)) || 10;
            const numTables = Math.ceil(totalSeats / seatsPerTable);
            let seatsRendered = 0;

            container.className = 'd-flex flex-wrap gap-4 justify-content-center';

            for (let i = 0; i < numTables; i++) {
                const tableEl = document.createElement('div');
                const tableLabel = `Table ${i + 1}`;
                const ticketTier = event && event.tickets ? event.tickets.find(t => t.name === tableLabel) : null;
                const price = ticketTier ? ticketTier.price : 0;

                tableEl.className = 'border rounded p-3 text-center shadow-sm chart-group';
                tableEl.style.backgroundColor = 'var(--bg-panel)';
                tableEl.style.width = '200px';
                tableEl.style.borderColor = 'var(--border-color)';
                tableEl.style.cursor = 'pointer';

                const tableHeader = document.createElement('div');
                tableHeader.className = 'd-flex justify-content-center align-items-center gap-2 mb-2';
                tableHeader.innerHTML = `
                    <strong class="row-label fw-bold" style="color: var(--text-main);">${tableLabel}</strong>
                    <button class="btn btn-sm btn-link p-0 btn-edit-label" title="Edit Label" style="display: none; color: var(--text-muted);"><i class="bi bi-pencil-square"></i></button>
                `;
                tableEl.appendChild(tableHeader);
                tableEl.addEventListener('click', () => selectChartGroup(tableEl));
                tableHeader.querySelector('.btn-edit-label').addEventListener('click', editChartLabel);

                const seatsContainer = document.createElement('div');
                seatsContainer.className = 'd-flex flex-wrap justify-content-center gap-2';
                
                const seatsInThisTable = Math.min(seatsPerTable, totalSeats - seatsRendered);
                for (let j = 0; j < seatsInThisTable; j++) {
                    const seatNumber = j + 1;
                    const seatEl = document.createElement('div');
                    seatEl.className = 'chart-seat d-flex align-items-center justify-content-center border rounded-circle';
                    seatEl.style.cssText = 'width: 30px; height: 30px; font-size: 12px; cursor: pointer;';
                    seatEl.textContent = seatNumber;

                    const isReserved = MockDB.isSeatReserved(currentEventId, tableLabel, seatNumber);
                    let popoverStatus = 'Available';
                    if (isReserved) {
                        seatEl.style.backgroundColor = 'var(--bs-danger)';
                        seatEl.style.color = 'white';
                        popoverStatus = 'Reserved';
                        seatEl.onclick = () => {
                            if (confirm(`Make seat ${tableLabel}-${seatNumber} available again? This will remove the guest reservation.`)) {
                                MockDB.unreserveSeat(currentEventId, tableLabel, seatNumber);
                                generateChartLayout(); // Re-render this view
                            }
                        };
                    } else {
                        seatEl.style.backgroundColor = 'var(--bg-muted)';
                        seatEl.style.color = 'var(--text-main)';
                        seatEl.onclick = () => {
                            if (isChartEditMode) {
                                alert("Exit edit mode to reserve seats.");
                                return;
                            }
                            const guestName = prompt(`Reserve seat ${tableLabel}-${seatNumber} for:`, "Guest Name");
                            if (guestName) {
                                const guestEmail = prompt(`Enter email for ${guestName}:`, `${guestName.toLowerCase().replace(/\s/g, '.')}@example.com`);
                                if (guestEmail) {
                                    MockDB.reserveSeat(currentEventId, tableLabel, seatNumber, { name: guestName, email: guestEmail });
                                    generateChartLayout(); // Re-render this view to show the seat as reserved
                                }
                            }
                        };
                    }
                    seatEl.dataset.bsToggle = 'popover';
                    seatEl.dataset.bsTrigger = 'hover';
                    seatEl.dataset.bsPlacement = 'top';
                    seatEl.dataset.bsHtml = 'true';
                    seatEl.dataset.bsTitle = `${tableLabel}, Seat ${seatNumber}`;
                    seatEl.dataset.bsContent = `Price: ₱${price}<br>Status: ${popoverStatus}`;
                    seatEl.dataset.bsContainer = 'body';
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
                groupDiv.className = 'p-3 border rounded shadow-sm chart-group';
                groupDiv.style.backgroundColor = 'var(--bg-panel)';
                groupDiv.style.borderColor = 'var(--border-color)';
                groupDiv.style.cursor = 'pointer';

                const header = document.createElement('div');
                header.className = 'd-flex justify-content-between align-items-center mb-2';
                const labelText = `Row ${String.fromCharCode(65 + (i % 26))}${Math.floor(i/26) > 0 ? Math.floor(i/26) : ''}`;
                const ticketTier = event && event.tickets ? event.tickets.find(t => t.name === labelText) : null;
                const price = ticketTier ? ticketTier.price : 0;

                header.innerHTML = `
                    <div class="d-flex align-items-center gap-2">
                        <strong class="row-label" style="color: var(--text-main);">${labelText}</strong>
                        <button class="btn btn-sm btn-link p-0 btn-edit-label" title="Edit Label" style="display: none; color: var(--text-muted);"><i class="bi bi-pencil-square"></i></button>
                    </div>
                    <span class="badge bg-secondary">${Math.min(seatsPerGroup, totalSeats - (i * seatsPerGroup))} seats</span>
                `;
                groupDiv.appendChild(header);
                groupDiv.addEventListener('click', () => selectChartGroup(groupDiv));
                header.querySelector('.btn-edit-label').addEventListener('click', editChartLabel);

                const seatsDiv = document.createElement('div');
                seatsDiv.className = 'd-flex flex-wrap gap-2';
                const seatsInThisGroup = Math.min(seatsPerGroup, totalSeats - (i * seatsPerGroup));
                for (let j = 0; j < seatsInThisGroup; j++) {
                    const seatNumber = j + 1;
                    const seatEl = document.createElement('div');
                    seatEl.className = 'chart-seat d-flex align-items-center justify-content-center border rounded';
                    seatEl.style.cssText = 'width: 30px; height: 30px; font-size: 12px; cursor: pointer;';
                    seatEl.textContent = seatNumber;

                    const isReserved = MockDB.isSeatReserved(currentEventId, labelText, seatNumber);
                    let popoverStatus = 'Available';
                    if (isReserved) {
                        seatEl.style.backgroundColor = 'var(--bs-danger)';
                        seatEl.style.color = 'white';
                        popoverStatus = 'Reserved';
                        seatEl.onclick = () => {
                            if (confirm(`Make seat ${labelText}-${seatNumber} available again? This will remove the guest reservation.`)) {
                                MockDB.unreserveSeat(currentEventId, labelText, seatNumber);
                                generateChartLayout(); // Re-render this view
                            }
                        };
                    } else {
                        seatEl.style.backgroundColor = 'var(--bg-muted)';
                        seatEl.style.color = 'var(--text-main)';
                        seatEl.onclick = () => {
                            if (isChartEditMode) {
                                alert("Exit edit mode to reserve seats.");
                                return;
                            }
                            const guestName = prompt(`Reserve seat ${labelText}-${seatNumber} for:`, "Guest Name");
                            if (guestName) {
                                const guestEmail = prompt(`Enter email for ${guestName}:`, `${guestName.toLowerCase().replace(/\s/g, '.')}@example.com`);
                                if (guestEmail) {
                                    MockDB.reserveSeat(currentEventId, labelText, seatNumber, { name: guestName, email: guestEmail });
                                    generateChartLayout(); // Re-render this view to show the seat as reserved
                                }
                            }
                        };
                    }
                    seatEl.dataset.bsToggle = 'popover';
                    seatEl.dataset.bsTrigger = 'hover';
                    seatEl.dataset.bsPlacement = 'top';
                    seatEl.dataset.bsHtml = 'true';
                    seatEl.dataset.bsTitle = `${labelText}, Seat ${seatNumber}`;
                    seatEl.dataset.bsContent = `Price: ₱${price}<br>Status: ${popoverStatus}`;
                    seatEl.dataset.bsContainer = 'body';
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
    updateOverallSliderMax();
}

function addNewRowToChart() {
    const container = document.getElementById('seatPlannerRowContainer');
    const btnWrapper = document.getElementById('chartBtnWrapper');
    if (!container || !btnWrapper) return;

    // Remove placeholder if it exists
    const placeholder = container.querySelector('.text-center.text-muted');
    if (placeholder) {
        placeholder.remove();
    }

    const groupDiv = document.createElement('div');
    groupDiv.className = 'p-3 border rounded shadow-sm chart-group';
    groupDiv.style.backgroundColor = 'var(--bg-panel)';
    groupDiv.style.borderColor = 'var(--border-color)';
    groupDiv.style.cursor = 'pointer';

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
    groupDiv.addEventListener('click', () => selectChartGroup(groupDiv));

    const seatsDiv = groupDiv.querySelector('.d-flex.flex-wrap.gap-2');
    if (seatsDiv) {
        seatsDiv.appendChild(createChartAddSeatBtn());
        seatsDiv.appendChild(createChartReduceSeatBtn());
    }

    container.insertBefore(groupDiv, btnWrapper);
    updateOverallSliderMax();
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

function selectChartGroup(groupEl) {
    if (!isChartEditMode) return;

    // Deselect previous one if it's different
    if (selectedChartGroup && selectedChartGroup !== groupEl) {
        selectedChartGroup.classList.remove('selected');
    }

    // Toggle selection on the current element
    if (selectedChartGroup === groupEl) {
        // It was already selected, so deselect it
        groupEl.classList.remove('selected');
        deselectAllChartGroups(); // Use helper to hide slider etc.
    } else {
        // It's a new selection
        groupEl.classList.add('selected');
        selectedChartGroup = groupEl;

        // Show slider and set its value
        const sliderContainer = document.getElementById('seatSliderContainer');
        const valueEl = document.getElementById('currentSeatSliderValue');
        const currentSeatCount = groupEl.querySelectorAll('.chart-seat').length;

        if (chartSeatSlider) {
            // Slides are 1-30, so index is value-1
            const slideIndex = Math.max(0, currentSeatCount - 1);
            chartSeatSlider.slideTo(slideIndex, 0); // Slide to the number without animation
        }
        if (valueEl) valueEl.textContent = currentSeatCount;
        if (sliderContainer) {
            sliderContainer.style.display = 'block';
        }
    }
}

function updateChartEditModeUI() {
    const container = document.getElementById('seatPlannerRowContainer');
    if (!container) return;

    const btnWrapper = document.getElementById('chartBtnWrapper');
    if (btnWrapper) {
        btnWrapper.style.display = isChartEditMode ? 'flex' : 'none';
    }

    // Show/hide the overall seat slider based on edit mode
    const overallSliderContainer = document.getElementById('overallSeatSliderContainer');
    if (overallSliderContainer) {
        overallSliderContainer.style.display = isChartEditMode ? 'block' : 'none';
    }

    const btnAutoBuild = document.getElementById('btnAutoBuild');
    if (btnAutoBuild) {
        btnAutoBuild.disabled = !isChartEditMode;
    }

    const btnClearChart = document.getElementById('btnClearChart');
    if (btnClearChart) {
        btnClearChart.disabled = !isChartEditMode;
    }
    
    // Update Toolbar Buttons (Save/Edit)
    const btnSave = document.getElementById('btnSaveChart');
    const btnEdit = document.getElementById('btnEditChart');
    if (btnSave && btnEdit) {
        if (isChartEditMode) {
            btnSave.style.display = 'inline-block';
            btnEdit.style.display = 'none';
        } else {
            btnSave.style.display = 'none';
            btnEdit.style.display = 'inline-block';
        }
    }

    // Update Sortable (Drag & Drop) State
    const sortableInstance = Sortable.get(container);
    if (sortableInstance) {
        sortableInstance.option('disabled', !isChartEditMode);
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
            const existingReduceBtn = seatsDiv.querySelector('.btn-reduce-seat-chart');
            
            if (isChartEditMode) {
                if (!existingBtn) {
                    seatsDiv.appendChild(createChartAddSeatBtn());
                }
                if (!existingReduceBtn) {
                    seatsDiv.appendChild(createChartReduceSeatBtn());
                }
            } else {
                if (existingBtn) {
                    existingBtn.remove();
                }
                if (existingReduceBtn) {
                    existingReduceBtn.remove();
                }
            }
        }
    });

    // Manage Popovers: Disable in edit mode, enable in view mode.
    const seats = container.querySelectorAll('.chart-seat');
    seats.forEach(seat => {
        let popover = bootstrap.Popover.getInstance(seat);
        // Initialize if it doesn't exist
        if (!popover) {
            popover = new bootstrap.Popover(seat, { container: 'body' });
        }
        
        // Enable or disable based on the current mode
        if (isChartEditMode) {
            popover.disable();
        } else {
            popover.enable();
        }
    });

    if (!isChartEditMode) {
        deselectAllChartGroups();
    }
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
        let popoverTitle = `Seat ${newSeatNumber}`;
        let price = 0;

        if (rowCard) {
            const label = rowCard.querySelector('.row-label')?.textContent || '';
            const originalLabel = rowCard.dataset.originalLabel;
            
            const currentEventId = localStorage.getItem('seatlify_current_event_id');
            if (currentEventId && typeof MockDB !== 'undefined') {
                const event = MockDB.getEvents().find(e => e.event_id == currentEventId);
                if (event && event.tickets) {
                    const ticket = event.tickets.find(t => 
                        (originalLabel && t.original_name === originalLabel) || 
                        t.name === label
                    );
                    if (ticket) price = ticket.price;
                }
            }

            popoverTitle = `${label}, Seat ${newSeatNumber}`;
            const badge = rowCard.querySelector('.badge');
            if(badge) badge.textContent = `${newSeatNumber} seats`;
        }

        seatEl.dataset.bsToggle = 'popover';
        seatEl.dataset.bsTrigger = 'hover';
        seatEl.dataset.bsPlacement = 'top';
        seatEl.dataset.bsHtml = 'true';
        seatEl.dataset.bsTitle = popoverTitle;
        seatEl.dataset.bsContent = `Price: ₱${price}<br>Status: Available`;
        seatEl.dataset.bsContainer = 'body';

        seatsDiv.insertBefore(seatEl, this);
        const popover = new bootstrap.Popover(seatEl, { container: 'body' });
        // This button is only visible in edit mode, so disable the popover immediately.
        popover.disable();

        // Update main counter
        loadCurrentEventStats();
    };
    return btn;
}

function createChartReduceSeatBtn() {
    const btn = document.createElement('button');
    btn.className = 'btn btn-sm btn-outline-danger border-dashed btn-reduce-seat-chart d-flex align-items-center justify-content-center';
    btn.style.width = '30px';
    btn.style.height = '30px';
    btn.style.borderRadius = chartLayoutMode === 'table' ? '50%' : '4px';
    btn.innerHTML = '<i class="bi bi-dash"></i>';
    btn.title = 'Remove Seat';
    
    btn.onclick = function(e) {
        e.stopPropagation();
        const seatsDiv = this.parentNode;
        const seats = seatsDiv.querySelectorAll('.chart-seat');
        
        if (seats.length > 0) {
            seats[seats.length - 1].remove();
            
            const rowCard = seatsDiv.closest('.chart-group');
            if (rowCard) {
                const badge = rowCard.querySelector('.badge');
                if(badge) badge.textContent = `${seats.length - 1} seats`;
            }
            
            loadCurrentEventStats();
        }
    };
    return btn;
}