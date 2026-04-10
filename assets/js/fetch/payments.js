import { db } from "../utils/firebase.js";
import { collection, query, where, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// =========================
// STATE
// =========================
let transactionsData = [];
let summaryData = null;
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
// HELPER: safe local date parse
// =========================
function parseDateInput(value) {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00`);
    return isNaN(date) ? null : date;
}

// =========================
// HELPER: format pretty date
// =========================
function formatPrettyDate(value) {
    const date = typeof value === "string" ? parseDateInput(value) : value;
    if (!date || isNaN(date)) return "N/A";

    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
    });
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
// HELPER: get date range
// =========================
function getDateRange() {
    if (currentFilter === "last7" || currentFilter === "last30") {
        const end = new Date(); // use today, not selected date
        end.setHours(0, 0, 0, 0);

        const start = new Date(end);
        start.setDate(end.getDate() - (currentFilter === "last7" ? 6 : 29));

        return {
            start: formatDate(start),
            end: formatDate(end)
        };
    }

    if (currentFilter === "custom") {
        const startValue = document.getElementById("startDate").value;
        const endValue = document.getElementById("endDate").value;

        const start = parseDateInput(startValue);
        const end = parseDateInput(endValue);

        if (!start || !end) return null;

        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);

        if (start > end) return null;

        return {
            start: formatDate(start),
            end: formatDate(end)
        };
    }

    return null;
}

// =========================
// HELPER: get filter key
// =========================
function getFilterKey() {
    const baseDate = new Date(currentDate);

    if (currentFilter === "daily") {
        return formatDate(baseDate);
    }

    if (currentFilter === "monthly") {
        const year = baseDate.getFullYear();
        const month = String(baseDate.getMonth() + 1).padStart(2, "0");
        return `${year}-${month}`;
    }

    if (currentFilter === "yearly") {
        return String(baseDate.getFullYear());
    }

    if (currentFilter === "last7" || currentFilter === "last30" || currentFilter === "custom") {
        const range = getDateRange();
        if (!range) return "invalid-range";
        return `${range.start}_${range.end}`;
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
        const options = { year: "numeric", month: "long", day: "numeric" };
        displayText = currentDate.toLocaleDateString("en-US", options);
    } else if (currentFilter === "monthly") {
        const options = { year: "numeric", month: "long" };
        displayText = currentDate.toLocaleDateString("en-US", options);
    } else if (currentFilter === "yearly") {
        displayText = currentDate.getFullYear();
    } else if (currentFilter === "last7") {
        displayText = "Last 7 Days";
    } else if (currentFilter === "last30") {
        displayText = "Last 30 Days";
    } else if (currentFilter === "custom") {
        const range = getDateRange();
        displayText = range
            ? `${formatPrettyDate(range.start)} - ${formatPrettyDate(range.end)}`
            : "Select a valid range";
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
    const rangeFilters = ["last7", "last30", "custom"];

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
        let totalTransactions = 0;

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
                totalTransactions += Number(tx.total_transactions || 1);
            });

            const totalRow = table.insertRow();
            totalRow.innerHTML = `
                <td class="total-income-td" colspan="6">
                    Total Income: ₱${totalIncome.toFixed(2)}
                </td>
            `;
    
            const transactionsRow = table.insertRow();
            transactionsRow.innerHTML = `
                <td class="total-income-td" colspan="6">
                    Total Transactions: ${totalTransactions}
                </td>
            `;
            }

        return;
    }

    if (rangeFilters.includes(currentFilter)) {
        table.innerHTML = `
            <tr>
                <th>Date</th>
                <th>Revenue</th>
                <th>Total Transactions</th>
            </tr>
        `;

        if (!Array.isArray(summaryData) || summaryData.length === 0) {
            table.innerHTML += `<tr><td colspan="3">No summary data for this range</td></tr>`;
            return;
        }

        let totalRevenue = 0;
        let totalTransactions = 0;

        summaryData.forEach((item) => {
            const row = table.insertRow();
            row.innerHTML = `
                <td>${item.date || "N/A"}</td>
                <td>₱${Number(item.total_revenue || 0).toFixed(2)}</td>
                <td>${item.total_transactions || 0}</td>
            `;

            totalRevenue += Number(item.total_revenue || 0);
            totalTransactions += Number(item.total_transactions || 0);
        });

        const totalRow = table.insertRow();
        totalRow.innerHTML = `
            <td class="total-income-td" colspan="3">
                Total Revenue: ₱${totalRevenue.toFixed(2)}
            </td>
        `;

        const transactionsRow = table.insertRow();
        transactionsRow.innerHTML = `
            <td class="total-income-td" colspan="3">
                Total Transactions: ${totalTransactions}
            </td>
        `;

        return;
    }

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
// =========================
function fetchTransactions() {
    if (fetchTimeout) clearTimeout(fetchTimeout);

    fetchTimeout = setTimeout(async () => {
        const filterKey = getFilterKey();
        const cacheKey = `${currentFilter}_${filterKey}`;

        if (transactionsCache[cacheKey]) {
            const cached = transactionsCache[cacheKey];
            transactionsLoaded = true;

            if (currentFilter === "daily") {
                transactionsData = cached;
                summaryData = null;
            } else if (currentFilter === "last7" || currentFilter === "last30" || currentFilter === "custom") {
                summaryData = cached;
                transactionsData = [];
            } else {
                summaryData = cached;
                transactionsData = [];
            }

            renderPayments();
            updateDateDisplay();
            return;
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
                console.log(`Loaded daily:`, filterKey);
                return;
            }

            if (currentFilter === "last7" || currentFilter === "last30" || currentFilter === "custom") {
                const range = getDateRange();

                if (!range) {
                    summaryData = [];
                    transactionsData = [];
                    transactionsLoaded = true;
                    transactionsCache[cacheKey] = [];
                    renderPayments();
                    updateDateDisplay();
                    return;
                }

                const statsCol = collection(db, "transactions_stats", "summary", "daily");
                const snapshot = await getDocs(statsCol);

                const rows = [];

                snapshot.forEach((docSnap) => {
                    const dateKey = docSnap.id;

                    if (dateKey >= range.start && dateKey <= range.end) {
                        rows.push({
                            date: dateKey,
                            ...docSnap.data()
                        });
                    }
                });

                rows.sort((a, b) => a.date.localeCompare(b.date));

                summaryData = rows;
                transactionsData = [];
                transactionsCache[cacheKey] = rows;
                transactionsLoaded = true;

                renderPayments();
                updateDateDisplay();
                console.log(`Loaded range:`, range.start, range.end);
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
                console.log(`No stats found for:`, currentFilter, filterKey);
                return;
            }

            summaryData = statsSnap.data();
            transactionsData = [];

            transactionsCache[cacheKey] = summaryData;
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
    document.getElementById("customRangeControls").style.display = "none";

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
    document.getElementById("customRangeControls").style.display = "none";

    updateDateDisplay();
    fetchTransactions();
});

document.getElementById("nextDay").addEventListener("click", () => {
    const today = new Date();
    if (formatDate(currentDate) === formatDate(today)) return;

    currentDate.setDate(currentDate.getDate() + 1);

    currentFilter = "daily";
    document.getElementById("filterRange").value = "daily";
    document.getElementById("customRangeControls").style.display = "none";

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

    document.getElementById("customRangeControls").style.display =
        currentFilter === "custom" ? "inline-flex" : "none";

    fetchTransactions();
});


const todayStr = formatDate(new Date());
document.getElementById("startDate").max = todayStr;
document.getElementById("endDate").max = todayStr;
// =========================
// CUSTOM RANGE INPUTS
// =========================
document.getElementById("startDate").addEventListener("change", () => {
    if (currentFilter === "custom") fetchTransactions();
});

document.getElementById("endDate").addEventListener("change", () => {
    if (currentFilter === "custom") fetchTransactions();
});

// =========================
// REFRESH BUTTON
// =========================
document.getElementById("refreshBtn").addEventListener("click", () => {
    const filterKey = getFilterKey();
    const cacheKey = `${currentFilter}_${filterKey}`;

    delete transactionsCache[cacheKey];

    transactionsLoaded = false;
    transactionsData = [];
    summaryData = null;

    fetchTransactions();
});

// =========================
// INITIAL LOAD WHEN OPENED
// =========================
window.loadPayments = () => {
    fetchTransactions();
};

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