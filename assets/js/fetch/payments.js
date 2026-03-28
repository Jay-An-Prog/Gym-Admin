import { db } from "../utils/firebase.js"; // Firestore instance
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// =========================
// STATE
// =========================
let transactionsData = {};
let transactionsLoaded = false;
let currentDate = new Date(); // current displayed date
let transactionsCache = {};   // <-- cache by dateKey
let currentFilter = "daily"; // default

// =========================
// HELPER: format date to yyyy-mm-dd
// =========================
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

// =========================
// HELPER: format timestamp to HH:MM:SS
// =========================
function formatTime(ts) {
    if (!ts) return "N/A";

    // Firestore Timestamp support
    if (typeof ts.toDate === "function") {
        ts = ts.toDate();
    } else if (typeof ts === "number") {
        ts = new Date(ts * 1000);
    }

    const hours = String(ts.getHours()).padStart(2, "0");
    const minutes = String(ts.getMinutes()).padStart(2, "0");
    const seconds = String(ts.getSeconds()).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
}

// =========================
// HELPER: get timestamp value for sorting
// =========================
function getTimestampValue(ts) {
    if (!ts) return 0;

    if (typeof ts.toDate === "function") {
        return ts.toDate().getTime();
    }

    if (typeof ts === "number") {
        return ts * 1000;
    }

    return new Date(ts).getTime() || 0;
}

// =========================
// HELPER: Weekly
// =========================
function getWeekKey(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    
    // Set to nearest Thursday: current date + 4 - current day number
    // Sunday=0, Monday=1, ..., Saturday=6
    const dayNum = d.getUTCDay() || 7; // make Sunday=7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);

    // Year of the Thursday
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    
    // Calculate full weeks to nearest Thursday
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1)/7);

    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2,"0")}`;
}

// =========================
// UPDATE CURRENT DATE DISPLAY
// =========================
function updateDateDisplay() {
    let displayText = "";

    if (currentFilter === "daily") {
        displayText = formatDate(currentDate);
    } 
    else if (currentFilter === "weekly") {
        const weekKey = getWeekKey(currentDate); // e.g. 2026-W13
        const [year, week] = weekKey.split("-W");
        displayText = `Week ${week} (${year})`;
    } 
    else if (currentFilter === "monthly") {
        const options = { year: "numeric", month: "long" };
        displayText = currentDate.toLocaleDateString("en-US", options);
    } 
    else if (currentFilter === "yearly") {
        displayText = currentDate.getFullYear();
    }

    document.getElementById("currentDate").textContent = `(  ${displayText}  )`;
}

// =========================
// RENDER FUNCTION
// =========================
function renderPayments() {
    if (!transactionsLoaded) return;

    const table = document.querySelector("#payments table");

    // Reset table (keep header)
    table.innerHTML = `
        <tr>
            <th>Date</th>
            <th>Name</th>
            <th>Type</th>
            <th>Amount</th>
            <th>Time</th>
        </tr>
    `;

    let totalIncome = 0;
    let count = 0;

    for (let id in transactionsData) {
        const tx = transactionsData[id];
        count++;

        const row = table.insertRow();
        row.innerHTML = `
            <td>${tx.date || "N/A"}</td>
            <td>${tx.name || "N/A"}</td>
            <td>${tx.type || "N/A"}</td>
            <td>₱${tx.amount || 0}</td>
            <td>${formatTime(tx.timestamp)}</td>
        `;

        totalIncome += Number(tx.amount || 0);
    }

    if (count === 0) {
        table.innerHTML += `<tr><td colspan="5">No transactions for this date</td></tr>`;
    }

    const totalRow = table.insertRow();
    totalRow.innerHTML = `
        <td class="total-income-td" colspan="3">Total Income: ₱${totalIncome.toFixed(2)}</td>
    `;
}

let fetchTimeout; // <-- debounce timeout

function fetchTransactions(date) {
    if (fetchTimeout) clearTimeout(fetchTimeout);

    fetchTimeout = setTimeout(async () => {

        let filterKey = "";
        let fieldKey = "";

        // =========================
        // DETERMINE FILTER TYPE
        // =========================
        if (currentFilter === "daily") {
            filterKey = formatDate(date);
            fieldKey = "date";
        } 
        else if (currentFilter === "weekly") {
            filterKey = getWeekKey(date);
            fieldKey = "week";
        } 
        else if (currentFilter === "monthly") {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            filterKey = `${year}-${month}`;
            fieldKey = "month";
        } 
        else if (currentFilter === "yearly") {
            filterKey = String(date.getFullYear());
            fieldKey = "year";
        }

        const cacheKey = `${currentFilter}_${filterKey}`;

        // =========================
        // CACHE CHECK
        // =========================
        if (transactionsCache[cacheKey]) {
            transactionsData = transactionsCache[cacheKey];
            transactionsLoaded = true;
            renderPayments();
            updateDateDisplay();
            return;
        }

        transactionsLoaded = false;

        try {
            const transactionsCol = collection(db, "transactions");
            const q = query(transactionsCol, where(fieldKey, "==", filterKey));
            const snapshot = await getDocs(q);

            // =========================
            // SORT FIRESTORE DOCUMENTS BY LATEST TIMESTAMP FIRST
            // =========================
            const transactionsArray = [];

            snapshot.forEach(doc => {
                transactionsArray.push({
                    id: doc.id,
                    data: doc.data()
                });
            });

            transactionsArray.sort((a, b) => {
                return getTimestampValue(b.data.timestamp) - getTimestampValue(a.data.timestamp);
            });

            // Map Firestore documents to transactionsData
            transactionsData = {};
            transactionsArray.forEach(item => {
                transactionsData[item.id] = item.data;
            });

            transactionsCache[cacheKey] = transactionsData;
            transactionsLoaded = true;
            renderPayments();
            updateDateDisplay();

            console.log(`Loaded ${currentFilter}:`, filterKey);

        } catch (error) {
            console.error("Firestore error:", error);
        }

    }, 500);
}

// =========================
// DATE CLICK → OPEN CALENDAR
// =========================
document.getElementById("currentDate").addEventListener("click", () => {
    const picker = document.getElementById("datePicker");
    picker.value = formatDate(currentDate);
    picker.showPicker();
});

// =========================
// CALENDAR DATE SELECT
// =========================
document.getElementById("datePicker").addEventListener("change", (e) => {
    const selectedDate = new Date(e.target.value);
    const today = new Date();

    if (isNaN(selectedDate)) return;
    if (selectedDate > today) {
        e.target.value = formatDate(currentDate);
        return;
    }

    currentDate = selectedDate;
    updateDateDisplay();
    fetchTransactions(currentDate);
});

// =========================
// DATE NAVIGATION
// =========================
document.getElementById("prevDay").addEventListener("click", () => {
    currentDate.setDate(currentDate.getDate() - 1);

    currentFilter = "daily"
    document.getElementById("filterRange").value = "daily";

    updateDateDisplay();
    fetchTransactions(currentDate);
});

document.getElementById("nextDay").addEventListener("click", () => {
    const today = new Date();
    if (formatDate(currentDate) === formatDate(today)) return;
    currentDate.setDate(currentDate.getDate() + 1);

    currentFilter = "daily"
    document.getElementById("filterRange").value = "daily";

    updateDateDisplay();
    fetchTransactions(currentDate);
});

// =========================
// DROP DOWN
// =========================
document.getElementById("filterRange").addEventListener("change", (e) => {
    currentFilter = e.target.value || "daily";

    // reset cache view but keep stored cache
    transactionsData = {};
    transactionsLoaded = false;

    fetchTransactions(currentDate);
});


// =========================
// INITIAL LOAD
// =========================
fetchTransactions(currentDate);

// =========================
// DOWNLOAD PDF
// =========================
document.getElementById("downloadPdf").addEventListener("click", () => {
    const table = document.querySelector("#payments table");
    const opt = {
        margin: 0.5,
        filename: `Payment_Records_${formatDate(currentDate)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(table).save();
});