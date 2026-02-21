import { state, loadWorkbook, computeMatches, searchNearMe } from './data.js';
import { setStatus, renderRows } from './ui.js';
import { GOOGLE_SCRIPT_URL } from './config.js';

let openTickets = [];
let userLocationForSorting = null;

// --- DOM ELEMENTS ---
const tabSubmit = document.getElementById("tab-submit");
const tabView = document.getElementById("tab-view");
const viewSubmit = document.getElementById("view-submit");
const viewTickets = document.getElementById("view-tickets");
const searchControls = document.getElementById("search-controls");

const searchCard = document.getElementById("search-card");
const formCard = document.getElementById("form-card");
const tbody = document.getElementById("tbody");
const btnMore = document.getElementById("btnMore");
const shownNote = document.getElementById("shownNote");
const qInput = document.getElementById("q");

// Form elements
const formProblemType = document.getElementById("reportProblemType");
const lightDetails = document.getElementById("lightDetails");
const otherDetails = document.getElementById("otherDetails");
const btnSubmitReport = document.getElementById("btnSubmitReport");
const btnCancelForm = document.getElementById("btnCancelForm");

// ==========================================
// 1. TAB SWITCHING LOGIC
// ==========================================

function switchTab(tab) {
    if (tab === "submit") {
        tabSubmit.classList.add("active");
        tabView.classList.remove("active");
        viewSubmit.classList.add("active");
        viewTickets.classList.remove("active");

        // Show search controls
        searchControls.style.display = "flex";

        // Reset to empty state if search is empty
        if (qInput.value.length < 2 && !state.nearMode) {
            document.getElementById("report-header").classList.add("empty-state");
        } else {
            document.getElementById("report-header").classList.remove("empty-state");
        }
    } else {
        tabView.classList.add("active");
        tabSubmit.classList.remove("active");
        viewTickets.classList.add("active");
        viewSubmit.classList.remove("active");

        // Hide search controls and header centering
        searchControls.style.display = "none";
        document.getElementById("report-header").classList.remove("empty-state");

        // Auto-fetch tickets when tab opens
        fetchTickets();
    }
}

tabSubmit.addEventListener("click", () => switchTab("submit"));
tabView.addEventListener("click", () => switchTab("view"));


// ==========================================
// 2. SEARCH AND TABLE LOGIC
// ==========================================

function localRenderNext(isNewSearch) {
    if (isNewSearch) state.shown = 0;
    const batchSize = 100;
    const toShow = state.matches.slice(state.shown, state.shown + batchSize);
    renderRows(toShow, state.shown > 0);
    state.shown += toShow.length;

    if (state.shown >= state.matches.length) {
        btnMore.disabled = true;
        shownNote.textContent = `Showing all ${state.matches.length} matches`;
    } else {
        btnMore.disabled = false;
        shownNote.textContent = `Showing ${state.shown} of ${state.matches.length}`;
    }
}

function localRenderNextNear() {
    const batchSize = 10;
    const toShow = state.nearSorted.slice(state.nearIndex, state.nearIndex + batchSize).map(x => x.r);
    renderRows(toShow, state.nearIndex > 0);
    state.nearIndex += toShow.length;

    if (state.nearIndex >= state.nearSorted.length) {
        btnMore.disabled = true;
        shownNote.textContent = `Showing all ${state.nearSorted.length} nearby locations`;
    } else {
        btnMore.disabled = false;
        shownNote.textContent = `Showing ${state.nearIndex} of ${state.nearSorted.length} nearby locations`;
    }
}

qInput.addEventListener("input", (e) => {
    state.query = e.target.value || "";
    state.userPos = null;
    setStatus("", "");
    computeMatches();

    if (state.query.trim().length < 2) {
        tbody.innerHTML = "";
        searchCard.style.display = "none";
        document.getElementById("report-header").classList.add("empty-state");
    } else {
        searchCard.style.display = "block";
        document.getElementById("report-header").classList.remove("empty-state");
        localRenderNext(true);
    }
});

document.getElementById("btnNear").addEventListener("click", () => {
    searchNearMe(setStatus, () => {
        searchCard.style.display = "block";
        document.getElementById("report-header").classList.remove("empty-state");

        // Save user location so we can sort open tickets by distance
        userLocationForSorting = state.userPos;

        tbody.innerHTML = "";
        localRenderNextNear();
    });
});

btnMore.addEventListener("click", () => {
    if (state.nearMode) localRenderNextNear();
    else localRenderNext(false);
});


// ==========================================
// 3. SELECTION AND SUBMISSION FORM
// ==========================================

// Click on a table row -> Open Form
tbody.addEventListener("click", (e) => {
    const tr = e.target.closest("tr.data-row");
    if (!tr) return;

    // Prevent any buttons or links inside the table from firing (like Google Maps links or Copy buttons)
    e.preventDefault();
    e.stopPropagation();

    // Get intersection data off the row
    const jsonStr = tr.getAttribute("data-json");
    if (!jsonStr) return;
    const rowData = JSON.parse(jsonStr);

    // Populate form
    document.getElementById("reportIntersection").value = rowData.STREETSORT;
    document.getElementById("reportRoute").value = rowData.Route;
    document.getElementById("reportLat").value = rowData.lat || "";
    document.getElementById("reportLon").value = rowData.lon || "";

    // Hide search, show form
    searchCard.style.display = "none";
    formCard.style.display = "block";
});

// Dynamic form fields
formProblemType.addEventListener("change", (e) => {
    const val = e.target.value;
    lightDetails.style.display = (val === "Light Out") ? "block" : "none";
    otherDetails.style.display = (val === "Other") ? "block" : "none";
});

document.getElementById("reportLightColor").addEventListener("change", (e) => {
    const sizeContainer = document.getElementById("lightSizeContainer");
    if (sizeContainer) {
        sizeContainer.style.display = (e.target.value === "Pedestrian") ? "none" : "block";
    }
});

btnCancelForm.addEventListener("click", () => {
    formCard.style.display = "none";
    searchCard.style.display = "block";
    // Reset form
    formProblemType.value = "";
    lightDetails.style.display = "none";
    document.getElementById("reportLightColor").value = "";
    document.getElementById("reportLightSize").value = "";
    const sizeContainer = document.getElementById("lightSizeContainer");
    if (sizeContainer) sizeContainer.style.display = "block";
    otherDetails.style.display = "none";
    document.getElementById("reportOtherDesc").value = "";
    document.getElementById("reportLocationNotes").value = "";
    document.getElementById("reportAdditionalNotes").value = "";
});

btnSubmitReport.addEventListener("click", async () => {
    const type = formProblemType.value;
    if (!type) {
        alert("Please select a Problem Type");
        return;
    }

    let details = "";
    if (type === "Light Out") {
        const c = document.getElementById("reportLightColor").value;
        const s = document.getElementById("reportLightSize").value;
        if (!c) {
            alert("Please select a Color for the light out.");
            return;
        }
        details = c;
        if (c !== "Pedestrian" && s) {
            details += ` - ${s}`;
        }
    } else {
        details = document.getElementById("reportOtherDesc").value;
        if (!details.trim()) {
            alert("Please provide a description.");
            return;
        }
    }

    const payload = {
        action: "submitReport",
        route: document.getElementById("reportRoute").value,
        intersection: document.getElementById("reportIntersection").value,
        lat: document.getElementById("reportLat").value,
        lon: document.getElementById("reportLon").value,
        problemType: type,
        details: details,
        locationNotes: document.getElementById("reportLocationNotes").value,
        additionalNotes: document.getElementById("reportAdditionalNotes").value,
        deviceId: localStorage.getItem("routeDashboardDeviceId") || "Unknown"
    };

    btnSubmitReport.disabled = true;
    btnSubmitReport.textContent = "Submitting...";

    try {
        const resp = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        });
        const result = await resp.json();

        if (result.success) {
            alert("Report submitted successfully!");
            btnCancelForm.click(); // Close form and reset
        } else {
            alert("Submission failed. Try again.");
        }
    } catch (err) {
        console.error("Submit error", err);
        alert("Network error. Could not submit report.");
    } finally {
        btnSubmitReport.disabled = false;
        btnSubmitReport.textContent = "Submit Ticket";
    }
});


// ==========================================
// 4. VIEW OPEN TICKETS TAB
// ==========================================

async function fetchTickets() {
    const container = document.getElementById("ticketsContainer");
    container.innerHTML = `<div class="status-msg" style="text-align: center; padding: 20px; color: var(--muted);">Loading tickets... <span class="spinner"></span></div>`;

    try {
        const resp = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "getReports" })
        });
        const rawText = await resp.text();
        console.log("Raw getReports response:", rawText);
        try {
            openTickets = JSON.parse(rawText);
        } catch (parseErr) {
            console.error("Failed to parse JSON:", parseErr);
            container.innerHTML = `<div class="error" style="text-align: center; padding: 20px;">Could not read Google sheet data. Server said:<br><pre style="font-size:10px;text-align:left;">${rawText.substring(0, 200)}</pre></div>`;
            return;
        }
        renderTickets();
    } catch (e) {
        console.error("Fetch tickets error", e);
        container.innerHTML = `<div class="error" style="text-align: center; padding: 20px;">Failed to load tickets. ${e.message}</div>`;
    }
}

function renderTickets() {
    const container = document.getElementById("ticketsContainer");
    if (!openTickets || openTickets.length === 0) {
        container.innerHTML = `<div style="text-align: center; padding: 30px; background: rgba(0,0,0,0.2); border-radius: 12px; color: var(--muted);">No open tickets! 🎉</div>`;
        return;
    }

    // Sort
    const sortMode = document.getElementById("ticketSortSelect").value;

    let sorted = [...openTickets];
    if (sortMode === "distance" && userLocationForSorting) {
        // Calculate distance via Haversine
        sorted.forEach(t => {
            const lat = parseFloat(t.Lat);
            const lon = parseFloat(t.Lon);
            if (!isNaN(lat) && !isNaN(lon)) {
                t._dist = haversineDistance(userLocationForSorting.lat, userLocationForSorting.lon, lat, lon);
            } else {
                t._dist = Infinity;
            }
        });
        sorted.sort((a, b) => a._dist - b._dist);
    } else {
        // Sort by Time (Newest first)
        sorted.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
    }

    container.innerHTML = sorted.map(t => {
        let distHtml = "";
        if (t._dist && t._dist !== Infinity) {
            distHtml = `<span class="pill" style="font-size: 11px;">📍 ${(t._dist / 1609.34).toFixed(1)} mi</span>`;
        }

        return `
        <div class="ticket-card" data-row-index="${t._rowIndex}">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <h3>${t.Intersection || 'Unknown Location'}</h3>
                ${distHtml}
            </div>
            
            <div class="ticket-meta">
                <span><strong>Rte:</strong> ${t.Route}</span>
                <span>•</span>
                <span><strong>Type:</strong> ${t.ProblemType}</span>
                <span>•</span>
                <span>${new Date(t.Timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at ${new Date(t.Timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
            </div>
            
            <div class="ticket-details">
                <strong>Details:</strong> ${t.Details}<br>
                ${t.LocationNotes ? `<strong>Location:</strong> ${t.LocationNotes}<br>` : ''}
                ${t.AdditionalNotes ? `<strong>Notes:</strong> ${t.AdditionalNotes}` : ''}
            </div>
            
            <button class="btn-resolve" onclick="resolveTicket(${t._rowIndex}, this)">Mark as Resolved</button>
        </div>
        `;
    }).join("");
}

document.getElementById("ticketSortSelect").addEventListener("change", renderTickets);

window.resolveTicket = async function (rowIndex, btnEl) {
    if (!confirm("Are you sure you want to mark this ticket as resolved?")) return;

    btnEl.disabled = true;
    btnEl.innerHTML = `Resolving... <span class="spinner"></span>`;

    try {
        const resp = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "resolveReport", rowIndex: rowIndex })
        });
        const result = await resp.json();
        if (result.success) {
            // Remove from local array
            openTickets = openTickets.filter(t => parseInt(t._rowIndex) !== parseInt(rowIndex));
            renderTickets();
        } else {
            alert("Failed to resolve: " + result.message);
            btnEl.disabled = false;
            btnEl.textContent = "Mark as Resolved";
        }
    } catch (e) {
        console.error("Resolve error", e);
        alert("Network error.");
        btnEl.disabled = false;
        btnEl.textContent = "Mark as Resolved";
    }
}

// Haversine helper
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // metres
    const w1 = lat1 * Math.PI / 180;
    const w2 = lat2 * Math.PI / 180;
    const dw = (lat2 - lat1) * Math.PI / 180;
    const dl = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(dw / 2) * Math.sin(dw / 2) +
        Math.cos(w1) * Math.cos(w2) *
        Math.sin(dl / 2) * Math.sin(dl / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Init
loadWorkbook(false, setStatus, () => {
    // Start with empty state centered search
    document.getElementById("report-header").classList.add("empty-state");
    searchCard.style.display = "none";
});
