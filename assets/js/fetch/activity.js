import { rtdb, ref, onValue, off, db } from "../utils/firebase.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// -----------------------------
// ELEMENTS
// -----------------------------
const tableBody = document.getElementById("activityTableBody");
const calendarBtn = document.getElementById("activityCalendarBtn");
const datePicker = document.getElementById("activityDatePicker");
const activityCurrentDate = document.getElementById("activityCurrentDate");

// Variables
let firestoreFetchTimeout = null;
const activityCache = {};

// -----------------------------
// RTDB SETUP
// -----------------------------
const qrRef = ref(rtdb, "stored_qrs");
let rtdbListener = null;

// -----------------------------
// OPEN DATE PICKER
// -----------------------------
calendarBtn.addEventListener("click", () => {
    if (typeof datePicker.showPicker === "function") {
        datePicker.showPicker();
    } else {
        datePicker.click();
    }
});

// -----------------------------
// DATE CHANGE HANDLER
// -----------------------------
datePicker.addEventListener("change", async () => {
    const selectedDate = datePicker.value;
    if (!selectedDate) return;

    activityCurrentDate.textContent = selectedDate;

    const today = getToday();

    if (selectedDate === today) {
        activityCurrentDate.textContent = selectedDate + " • LIVE";

        detachRTDB(); // prevent duplicate listeners
        loadRTDBActivity();

    } else {
        activityCurrentDate.textContent = selectedDate + " • HISTORY";

        detachRTDB(); // stop realtime when switching to history
        loadFirestoreActivityByDate(selectedDate);
    }
});

// -----------------------------
// DEFAULT LOAD (TODAY)
// -----------------------------
window.loadActivity = () => {
    const today = getToday();
    activityCurrentDate.textContent = today + " • LIVE";
    loadRTDBActivity();
};

// -----------------------------
// RTDB REALTIME LOADER
// -----------------------------
function loadRTDBActivity() {
    tableBody.innerHTML = "<tr><td colspan='4'>Loading...</td></tr>";

    rtdbListener = onValue(qrRef, (snapshot) => {
        tableBody.innerHTML = "";

        if (!snapshot.exists()) {
            tableBody.innerHTML = "<tr><td colspan='4'>No data found</td></tr>";
            return;
        }

        snapshot.forEach((childSnapshot) => {
            const data = childSnapshot.val();

            const name = data.id_name || "Unknown";
            const checkin = formatTime(data.qr_checkin);
            const checkout = data.qr_checkout ? formatTime(data.qr_checkout) : "---";
            const date = formatDate(data.qr_checkin);

            tableBody.innerHTML += `
                <tr>
                    <td>${date}</td>
                    <td>${name}</td>
                    <td>${checkin}</td>
                    <td>${checkout}</td>
                </tr>
            `;
        });
        console.log("Using RTDB (today)");
    }, (error) => {
        console.error("RTDB error:", error);
        tableBody.innerHTML = "<tr><td colspan='4'>Error loading data</td></tr>";
    });
}

// -----------------------------
// DETACH RTDB LISTENER
// -----------------------------
function detachRTDB() {
    if (rtdbListener) {
        off(qrRef);
        rtdbListener = null;
    }
}

// -----------------------------
// FIRESTORE (ONE-TIME FETCH)
// -----------------------------
function loadFirestoreActivityByDate(selectedDate) {
    if (firestoreFetchTimeout) clearTimeout(firestoreFetchTimeout);

    firestoreFetchTimeout = setTimeout(async () => {
        // -----------------------------
        // Check cache first
        // -----------------------------
        if (activityCache[selectedDate]) {
            renderActivityTable(activityCache[selectedDate]);
            return;
        } else {
            console.log(`[FIRESTORE] Loaded records for ${selectedDate}`);
        }

        tableBody.innerHTML = "<tr><td colspan='4'>Loading...</td></tr>";

        const visitsRef = collection(db, "visits");
        const q = query(visitsRef, where("date", "==", selectedDate));

        try {
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                tableBody.innerHTML = "<tr><td colspan='4'>No records found</td></tr>";
                activityCache[selectedDate] = []; // cache empty result
                return;
            }

            const grouped = {};

            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const key = data.member_id || data.qr_code || docSnap.id;

                if (!grouped[key]) {
                    grouped[key] = {
                        date: data.date || selectedDate,
                        name: data.id_name || "Unknown",
                        checkin: "---",
                        checkout: "---",
                    };
                }

                const time = formatTime(data.timestamp);

                if (data.event_type === "check-in") {
                    grouped[key].checkin = time;
                } else if (data.event_type === "check-out") {
                    grouped[key].checkout = time;
                }
            });

            const rows = Object.values(grouped);
            activityCache[selectedDate] = rows; // store in cache

            renderActivityTable(rows);
        } catch (error) {
            console.error(`[FIRESTORE ERROR] Failed to load records for ${selectedDate}:`, error);
            tableBody.innerHTML = "<tr><td colspan='4'>Failed to load records</td></tr>";
        }
    }, 500);
}

// -----------------------------
// HELPERS
// -----------------------------
function renderActivityTable(rows) {
    tableBody.innerHTML = "";

    if (!rows || rows.length === 0) {
        tableBody.innerHTML = "<tr><td colspan='4'>No data found</td></tr>";
        return;
    }

    rows.forEach((row) => {
        tableBody.innerHTML += `
            <tr>
                <td>${row.date}</td>
                <td>${row.name}</td>
                <td>${row.checkin}</td>
                <td>${row.checkout}</td>
            </tr>
        `;
    });
}

function getToday() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function formatTime(timestamp) {
    if (!timestamp) return "---";

    const date = new Date(timestamp * 1000);

    return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
    });
}

function formatDate(timestamp) {
    if (!timestamp) return "---";

    const date = new Date(timestamp * 1000);
    return date.toISOString().split("T")[0];
}