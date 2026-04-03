import { db } from "../utils/firebase.js"; // Firestore instance
import { collection, query, where, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// =========================
// STATE
// =========================
let transactionsData = [];       // raw rows for daily
let summaryData = null;          // stats doc for monthly/yearly
let transactionsLoaded = false;
let currentDate = new Date();
let transactionsCache = {};
let currentFilter = "daily";

let fetchTimeout;

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
// HELPER: get filter key
// =========================
function getFilterKey() {
    const baseDate = new Date(currentDate);

    if (currentFilter === "daily") {
        return formatDate(baseDate);         // 2026-04-02
    }

    if (currentFilter === "monthly") {
        const year = baseDate.getFullYear();
        const month = String(baseDate.getMonth() + 1).padStart(2, "0");
        return `${year}-${month}`;           // 2026-04
    }

    if (currentFilter === "yearly") {
        return String(baseDate.getFullYear()); // 2026
    }

    return "";
}

// =========================
// HELPER: get stats doc ref
// =========================
function getStatsDocRef() {
    const statsKey = getFilterKey();
    return doc(db, "transactions_stats", "summary", currentFilter, statsKey);
}

// =========================
// UPDATE CURRENT DATE DISPLAY
// =========================
function updateDateDisplay() {
    let displayText = "";

    if (currentFilter === "daily") {
        // Friendly date: March 21, 2026
        const options = { year: "numeric", month: "long", day: "numeric" };
        displayText = currentDate.toLocaleDateString("en-US", options);
    } else if (currentFilter === "monthly") {
        const options = { year: "numeric", month: "long" };
        displayText = currentDate.toLocaleDateString("en-US", options);
    } else if (currentFilter === "yearly") {
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
    const titleKey = getFilterKey();

    if (currentFilter === "daily") {
        table.innerHTML = `
            <tr>
                <th>Date</th>
                <th>Name</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Transaction</th>
                <th>Time</th>
            </tr>
        `;

        let totalIncome = 0;

        if (transactionsData.length === 0) {
            table.innerHTML += `<tr><td colspan="6">No transactions for this date</td></tr>`;
        } else {
            transactionsData.forEach((tx) => {
                const row = table.insertRow();
                row.innerHTML = `
                    <td>${tx.date || "N/A"}</td>
                    <td>${tx.name || "N/A"}</td>
                    <td>${tx.type || "N/A"}</td>
                    <td>₱${Number(tx.amount || 0).toFixed(2)}</td>
                    <td>${tx.total_transactions || 1}</td>
                    <td>${formatTime(tx.timestamp)}</td>
                `;
                totalIncome += Number(tx.amount || 0);
            });
        }

        const totalRow = table.insertRow();
        totalRow.innerHTML = `
            <td class="total-income-td" colspan="6">
                Total Income: ₱${totalIncome.toFixed(2)}
            </td>
        `;
        return;
    }

    // Monthly / Yearly = stats view
    table.innerHTML = `
        <tr>
            <th>Period</th>
            <th>Revenue</th>
            <th>Total Transactions</th>
        </tr>
    `;

    if (!summaryData) {
        table.innerHTML += `<tr><td colspan="3">No summary data for ${titleKey}</td></tr>`;
        return;
    }

    const row = table.insertRow();
    row.innerHTML = `
        <td>${titleKey}</td>
        <td>₱${Number(summaryData.total_revenue || 0).toFixed(2)}</td>
        <td>${summaryData.total_transactions || 0}</td>
    `;

    const totalRow = table.insertRow();
    totalRow.innerHTML = `
        <td class="total-income-td" colspan="3">
            Total Revenue: ₱${Number(summaryData.total_revenue || 0).toFixed(2)}
        </td>
    `;
}

// =========================
// FETCH TRANSACTIONS
// forceRefresh = false by default
// =========================
function fetchTransactions(forceRefresh = false) {
    if (fetchTimeout) clearTimeout(fetchTimeout);

    fetchTimeout = setTimeout(async () => {
        const filterKey = getFilterKey();
        const cacheKey = `${currentFilter}_${filterKey}`;

        // skip cache when refreshing
        if (!forceRefresh && transactionsCache[cacheKey]) {
            const cached = transactionsCache[cacheKey];
            transactionsLoaded = true;

            if (currentFilter === "daily") {
                transactionsData = cached;
                summaryData = null;
            } else {
                summaryData = cached;
                transactionsData = [];
            }

            renderPayments();
            updateDateDisplay();
            return;
        }

        // remove old cache if refreshing
        if (forceRefresh) {
            delete transactionsCache[cacheKey];
        }

        transactionsLoaded = false;

        try {
            if (currentFilter === "daily") {
                const transactionsCol = collection(db, "transactions");
                const q = query(transactionsCol, where("date", "==", filterKey));
                const snapshot = await getDocs(q);

                const transactionsArray = [];

                snapshot.forEach((docSnap) => {
                    transactionsArray.push({
                        id: docSnap.id,
                        data: docSnap.data()
                    });
                });

                transactionsArray.sort((a, b) => {
                    return getTimestampValue(a.data.timestamp) - getTimestampValue(b.data.timestamp);
                });

                transactionsData = transactionsArray.map(item => item.data);
                summaryData = null;

                transactionsCache[cacheKey] = transactionsData;
                transactionsLoaded = true;

                renderPayments();
                updateDateDisplay();
                return;
            }

            const statsRef = getStatsDocRef();
            const statsSnap = await getDoc(statsRef);

            if (!statsSnap.exists()) {
                summaryData = null;
                transactionsData = [];
                transactionsLoaded = true;
                transactionsCache[cacheKey] = null;

                renderPayments();
                updateDateDisplay();
                return;
            }

            summaryData = statsSnap.data();
            transactionsData = [];

            transactionsCache[cacheKey] = summaryData;
            transactionsLoaded = true;

            renderPayments();
            updateDateDisplay();

        } catch (error) {
            console.error("Firestore error:", error);
        }
    }, 500);
}

// =========================
// OPEN CALENDAR
// =========================
document.getElementById("currentDate").addEventListener("click", openCalendar);
document.getElementById("calendarBtn").addEventListener("click", openCalendar);

function openCalendar() {
    const picker = document.getElementById("datePicker");
    picker.value = formatDate(currentDate);
    picker.showPicker();
}

// =========================
// CALENDAR DATE SELECT
// =========================
document.getElementById("datePicker").addEventListener("change", (e) => {
    currentFilter = "daily";
    document.getElementById("filterRange").value = "daily";
    
    const selectedDate = new Date(e.target.value);
    const today = new Date();

    if (isNaN(selectedDate)) return;

    selectedDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    if (selectedDate > today) {
        e.target.value = formatDate(currentDate);
        return;
    }

    currentDate = selectedDate;
    updateDateDisplay();
    fetchTransactions();
});

// =========================
// DATE NAVIGATION
// =========================
document.getElementById("prevDay").addEventListener("click", () => {
    currentDate.setDate(currentDate.getDate() - 1);

    currentFilter = "daily";
    document.getElementById("filterRange").value = "daily";

    updateDateDisplay();
    fetchTransactions();
});

document.getElementById("nextDay").addEventListener("click", () => {
    const today = new Date();
    if (formatDate(currentDate) === formatDate(today)) return;

    currentDate.setDate(currentDate.getDate() + 1);

    currentFilter = "daily";
    document.getElementById("filterRange").value = "daily";

    updateDateDisplay();
    fetchTransactions();
});

// =========================
// DROP DOWN
// =========================
document.getElementById("filterRange").addEventListener("change", (e) => {
    currentFilter = e.target.value || "daily";
    transactionsData = [];
    summaryData = null;
    transactionsLoaded = false;

    fetchTransactions();
});

// =========================
// REFRESH BUTTON
// =========================
document.getElementById("refreshBtn").addEventListener("click", () => {
    fetchTransactions(true); // force reload
});

// =========================
// INITIAL LOAD
// =========================
fetchTransactions();

// =========================
// DOWNLOAD PDF
// =========================
document.getElementById("downloadPdf").addEventListener("click", () => {
    const table = document.querySelector("#payments table");
    const opt = {
        margin: 0.5,
        filename: `Payment_Records_${formatDate(currentDate)}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: "in", format: "letter", orientation: "portrait" }
    };
    html2pdf().set(opt).from(table).save();
});