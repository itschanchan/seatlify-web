// Sidebar Loader
function loadSidebar() {
  fetch("side-bar-dashboard.html")
    .then(res => res.text())
    .then(html => {
      const container = document.getElementById("sidebar-container");
      if (!container) return;
      container.innerHTML = html;

      // Sidebar toggle logic
      const sidebar = document.getElementById("sidebar");
      const mainContent = document.getElementById("mainContent");
      const toggleBtn = document.getElementById("sidebarToggle");

      if (toggleBtn && sidebar && mainContent) {
        toggleBtn.addEventListener("click", () => {
          sidebar.classList.toggle("collapsed");
          mainContent.classList.toggle("expanded");
        });
      }
    })
    .catch(err => console.error("Sidebar load failed:", err));
}

// Header Loader
function loadHeader() {
  fetch("includes/header.html")
    .then(res => res.text())
    .then(html => {
      document.getElementById("header").innerHTML = html;
      
      // Initialize Header Scroll Logic & Dropdowns
      initHeaderBehavior();

      // Load Login Modal (since the container is now in the DOM)
      loadLoginModal();
    });
}

// Login Modal Loader
function loadLoginModal() {
  const target = document.getElementById("loginModalContainer");
  if (!target) return; // 👈 IMPORTANT

  fetch("includes/login-modal.html")
    .then(res => res.text())
    .then(html => {
      target.innerHTML = html;
    });
}

// Header Scroll Behavior
function initHeaderBehavior() {
  const navbar = document.querySelector('#header .navbar');
  if (!navbar) return;

  let lastScrollTop = 0;
  const delta = 5;

  window.addEventListener('scroll', () => {
    const currentScroll = window.scrollY || document.documentElement.scrollTop;

    // 1. Static at the very top
    if (currentScroll <= 0) {
      navbar.classList.remove('fixed-header', 'hidden-header');
      return;
    }

    // Ignore small scroll movements
    if (Math.abs(lastScrollTop - currentScroll) <= delta) return;

    // 2. Scroll Down -> Appear (Fixed & Black)
    if (currentScroll > lastScrollTop) {
      navbar.classList.add('fixed-header');
      navbar.classList.remove('hidden-header');
    } 
    // 3. Scroll Up -> Hide
    else {
      navbar.classList.add('hidden-header');
    }

    lastScrollTop = currentScroll;
  });

  // Re-initialize Dropdown Hover for Desktop
  if (window.innerWidth >= 768) {
    const dropdowns = document.querySelectorAll('.navbar .dropdown');
    dropdowns.forEach(dropdown => {
      const toggle = dropdown.querySelector('.dropdown-toggle');
      const menu = dropdown.querySelector('.dropdown-menu');
      if (toggle && menu) {
        dropdown.addEventListener('mouseenter', () => {
          menu.classList.add('show');
          toggle.setAttribute('aria-expanded', 'true');
        });
        dropdown.addEventListener('mouseleave', () => {
          menu.classList.remove('show');
          toggle.setAttribute('aria-expanded', 'false');
        });
      }
    });
  }
}

// Scroll to Top Button Behavior
function initScrollTop() {
  const btn = document.getElementById('scrollTopBtn');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    // Show button after scrolling down 300px
    if (window.scrollY > 300) {
      btn.style.display = 'flex';
    } else {
      btn.style.display = 'none';
    }
  });

  btn.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadLoginModal();
  initScrollTop();
});


// Display Features Loader
function loadDisplayFeatures() {
  fetch("includes/display-features.html")
    .then(res => res.text())
    .then(html => {
      document.getElementById("display-features").innerHTML = html;
      loadSeatDemo();
    });
}

// Load Seat Demo
function loadSeatDemo() {
  const container = document.getElementById("sample-seat-plan-container");
  if (!container) return;

  fetch("includes/sample-seat-plan.html")
    .then(res => res.text())
    .then(html => {
      container.innerHTML = html;
      if (typeof initSampleSeatPlan === 'function') {
        initSampleSeatPlan();
      }
    });
}

// Footer Loader
function loadFooter() {
  fetch("includes/footer.html")
    .then(res => res.text())
    .then(html => {
      document.getElementById("footer").innerHTML = html;
    });
}


/* ==========================
   SEAT PLANNER LAZY LOADER
========================== */

let seatPlannerLoaded = false;

async function loadSeatPlanner() {

  console.log("Seat Plan tab activated → loading planner");

    if (seatPlannerLoaded) return;

    const container = document.getElementById("seat-planner");
    if (!container) return;

    try {
        console.log("Loading seat planner HTML…");

        const res = await fetch("../dashboard/seat-planner.html");
        if (!res.ok) throw new Error("Seat planner HTML not found");

        container.innerHTML = await res.text();

        // Bootstrap dropdowns (REQUIRED after injection)
        container.querySelectorAll(".dropdown-toggle")
            .forEach(el => new bootstrap.Dropdown(el));

        await loadSeatPlannerScript("../js/seat-planner.js");

        if (typeof initSeatPlanner === "function") {
            initSeatPlanner();
            seatPlannerLoaded = true;
        }

    } catch (err) {
        console.error(err);
        container.innerHTML = `<p class="text-danger">Failed to load seat planner.</p>`;
    }
}

function loadSeatPlannerScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) return resolve();
        const s = document.createElement("script");
        s.src = src;
        s.onload = resolve;
        s.onerror = reject;
        document.body.appendChild(s);
    });
}

/* ==========================
   BOOTSTRAP TAB TRIGGER
========================== */
document.addEventListener("DOMContentLoaded", () => {
    const tab = document.getElementById("seatplan-tab");
    if (!tab) return;

    tab.addEventListener("shown.bs.tab", loadSeatPlanner);
});


/* ==========================
   EVENT MANAGER LAZY LOADER
========================== */

let eventManagerLoaded = false;

async function loadEventManager() {

    console.log("Website tab activated → loading event manager");

    if (eventManagerLoaded) return;

    const container = document.getElementById("event-manager");
    if (!container) return;

    try {
        console.log("Loading event manager HTML…");

        const res = await fetch("../dashboard/event-manager.html");
        if (!res.ok) throw new Error("Event manager HTML not found");

        container.innerHTML = await res.text();

        await loadScriptOnce("../js/event-manager.js");

        if (typeof initEventManager === "function") {
            initEventManager();
            eventManagerLoaded = true;
        }

    } catch (err) {
        console.error(err);
        container.innerHTML = `<p class="text-danger">Failed to load event manager.</p>`;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const tab = document.getElementById("website-tab");
    if (!tab) return;

    tab.addEventListener("shown.bs.tab", loadEventManager);
});


function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) return resolve();
        const s = document.createElement("script");
        s.src = src;
        s.onload = resolve;
        s.onerror = reject;
        document.body.appendChild(s);
    });
}
