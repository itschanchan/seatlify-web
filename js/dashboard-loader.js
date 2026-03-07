document.addEventListener("DOMContentLoaded", () => {
    // Initialize SPA Layout & Navigation
    initDashboardLayout();
    
    // Initialize Speed Dial (FAB)
    initSpeedDial();
});

function initDashboardLayout() {
    // Load Sidebar
    const sidebarPromise = fetch("side-bar-dashboard.html")
        .then(res => res.text())
        .then(html => {
            const container = document.getElementById("sidebar-container");
            if(container) container.innerHTML = html;
        });

    // Load Bottom Nav (Mobile)
    const bottomNavPromise = fetch("bottom-nav-bar-dashboard.html")
        .then(res => res.text())
        .then(html => {
            const container = document.getElementById("bottom-nav-container");
            if(container) container.innerHTML = html;
        });

    Promise.all([sidebarPromise, bottomNavPromise]).then(() => {
        setupNavigationEvents();
    }).catch(err => console.error("Navigation UI load failed:", err));
}

function setupNavigationEvents() {
    const sidebar = document.getElementById("sidebar");
    const mainContent = document.getElementById("mainContent");
    const toggleBtn = document.getElementById("sidebarToggle");

    // Restore Sidebar State (Default to collapsed if not set)
    const savedState = localStorage.getItem('seatlify_sidebar_collapsed');
    const isCollapsed = savedState === null ? true : savedState === 'true';

    if (sidebar && mainContent) {
        if (isCollapsed) {
            sidebar.classList.add("collapsed");
            mainContent.classList.add("expanded");
        } else {
            sidebar.classList.remove("collapsed");
            mainContent.classList.remove("expanded");
        }
    }

    if (toggleBtn && sidebar && mainContent) {
        toggleBtn.addEventListener("click", () => {
            sidebar.classList.toggle("collapsed");
            mainContent.classList.toggle("expanded");
            localStorage.setItem('seatlify_sidebar_collapsed', sidebar.classList.contains("collapsed"));
        });
    }

    // Handle Nav Clicks
    const navLinks = document.querySelectorAll('.sidebar-nav .nav-link, .bottom-nav-bar .nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => handleNavClick(e, link));
    });

    // Restore active tab or default to Dashboard
    const lastActiveTab = localStorage.getItem('seatlify_active_dashboard_tab');
    let linkToClick = null;
    if (lastActiveTab) {
        linkToClick = document.querySelector(`.sidebar-nav .nav-link[data-target="${lastActiveTab}"]`);
    }
    if (!linkToClick) {
        linkToClick = document.querySelector('.sidebar-nav .nav-link[data-target="dashboard"]');
    }
    if (linkToClick) linkToClick.click();
}

async function handleNavClick(e, link) {
    e.preventDefault();
    const target = link.dataset.target;
    const currentActiveTab = localStorage.getItem('seatlify_active_dashboard_tab');

    // If navigating away from the seat-planner, trigger a silent save to prevent data loss.
    if (currentActiveTab === 'seat-planner' && target !== 'seat-planner') {
        if (typeof window.saveCurrentPlannerState === 'function') {
            console.log('Navigating away from seat planner, auto-saving state.');
            window.saveCurrentPlannerState();
        }
    }

    // Update Active State in both Sidebar and Bottom Nav
    document.querySelectorAll('.sidebar-nav .nav-link, .bottom-nav-bar .nav-link').forEach(l => l.classList.remove('active'));
    document.querySelectorAll(`.sidebar-nav .nav-link[data-target="${target}"], .bottom-nav-bar .nav-link[data-target="${target}"]`).forEach(l => l.classList.add('active'));

    localStorage.setItem('seatlify_active_dashboard_tab', target);
    const container = document.getElementById("dashboard-content");

    // Route Logic
    if (target === "dashboard") {
        await loadLazyModule(container, "dashboard", "dashboard-content.html", "../js/dashboard.js", "initDashboard");
    }
    else if (target === "seat-planner") {
        await loadLazyModule(container, "seat-planner", "seat-planner/seat-planner.html", "../js/seat-planner.js", "initSeatPlanner", true);
    }
    else if (target === "tickets") {
        await loadLazyModule(container, "tickets", "ticket.html", "../js/tickets.js", "initTickets");
    }
    else if (target === "analytics") {
        loadSimpleContent(container, "analytics.html", "Analytics");
    }
    else if (target === "finance") {
        loadSimpleContent(container, "finance.html", "Finance");
    }
    else if (target === "invitations") {
        // MODIFIED: Load HTML, then the mock service script, then execute the inline logic.
        // This ensures the mock service is used, avoiding CORS errors with the PHP backend.
        container.innerHTML = `<div class="demo-panel p-3">Loading Invitations...</div>`;
        try {
            const res = await fetch("invitations/invitations.html");
            if (!res.ok) throw new Error('Failed to load invitations.html');
            
            container.innerHTML = await res.text();

            // Find the original inline script but don't run it yet.
            const inlineScript = container.querySelector('script');
            const inlineScriptContent = inlineScript ? inlineScript.textContent : '';
            if (inlineScript) {
                inlineScript.remove(); // Prevent original from executing
            }

            // Now, load the external mock service script. This will set up window.InvitationService.
            await import('../js/invitations.js');

            // After the mock service is on the window, execute the original inline script's logic.
            if (inlineScriptContent) {
                const script = document.createElement('script');
                script.textContent = inlineScriptContent;
                document.body.appendChild(script).remove(); // Append, run, and immediately remove.
            }
        } catch (err) { console.error(err); container.innerHTML = `<p class="text-danger">Error loading Invitations.</p>`; }
    }
}

// Helper for simple HTML loads
async function loadSimpleContent(container, file, name) {
    container.innerHTML = `<div class="demo-panel p-3">Loading ${name}...</div>`;
    try {
        const res = await fetch(file);
        if (res.ok) container.innerHTML = await res.text();
        else container.innerHTML = `<p class="text-danger">Failed to load ${name}.</p>`;
    } catch (err) { container.innerHTML = `<p class="text-danger">Error loading ${name}.</p>`; }
}

// Helper for complex modules (HTML + JS + Init)
async function loadLazyModule(container, id, htmlFile, jsFile, initFunc, initDropdowns = false) {
    container.innerHTML = `<div id="${id}" class="demo-panel p-3">Loading...</div>`;
    try {
        const res = await fetch(htmlFile);
        if (!res.ok) throw new Error(`Failed to load ${htmlFile}`);
        container.innerHTML = await res.text();

        if (initDropdowns) {
            container.querySelectorAll(".dropdown-toggle").forEach(el => new bootstrap.Dropdown(el));
        }

        // Dynamically import the module
        const module = await import(jsFile);
        if (module && typeof module[initFunc] === "function") {
            module[initFunc]();
        } else {
            console.error(`${initFunc} not found in ${jsFile}`);
        }
    } catch (err) {
        console.error(err);
        container.innerHTML = `<p class="text-danger">Failed to load module.</p>`;
    }
}

function initSpeedDial() {
    const speedDialContainer = document.getElementById('speedDial');
    if (speedDialContainer) {
        const speedDialToggle = speedDialContainer.querySelector('.speed-dial-toggle');
        speedDialToggle.addEventListener('click', () => speedDialContainer.classList.toggle('active'));
        document.addEventListener('click', (e) => {
            if (!speedDialContainer.contains(e.target) && speedDialContainer.classList.contains('active')) {
                speedDialContainer.classList.remove('active');
            }
        });
    }
}