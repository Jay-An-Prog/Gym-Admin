import { rtdb, ref, onValue } from "../utils/firebase.js";

// =========================
// STATE
// =========================
let transactionsData = {};
let transactionsLoaded = false;
let currentDate = new Date(); // current displayed date

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

    // If timestamp is in seconds, convert to milliseconds
    const date = new Date(ts * 1000);

    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");

    return `${hours}:${minutes}:${seconds}`;
}

// =========================
// UPDATE CURRENT DATE DISPLAY
// =========================
function updateDateDisplay() {
    document.getElementById("currentDate").textContent = `< ${formatDate(currentDate)} >`;
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

    // Loop through transactions
    for (let id in transactionsData) {
        const tx = transactionsData[id];
        count++;

        const row = table.insertRow();
        row.innerHTML = `
            <td>${formatDate(currentDate)}</td>
            <td>${tx.name || "N/A"}</td>
            <td>${tx.type || "N/A"}</td>
            <td>₱${tx.amount || 0}</td>
            <td>${formatTime(tx.timestamp)}</td>
        `;

        totalIncome += Number(tx.amount || 0);
    }

    // Empty state
    if (count === 0) {
        table.innerHTML += `<tr><td colspan="5">No transactions for this date</td></tr>`;
    }

    // Add Total Income row at the bottom
    const totalRow = table.insertRow();
    totalRow.innerHTML = `
        <td colspan="3" style="text-align:left; font-weight:bold;">Total Income: ₱${totalIncome.toFixed(2)}</td>
    `;
}

// =========================
// FETCH TRANSACTIONS FOR A GIVEN DATE
// =========================
function fetchTransactionsForDate(date) {
    transactionsLoaded = false; // reset state
    const dateKey = formatDate(date);
    const transactionsRef = ref(rtdb, `admin/transactions/${dateKey}`);

    onValue(
        transactionsRef,
        (snapshot) => {
            transactionsData = snapshot.val() || {};
            transactionsLoaded = true;
            renderPayments();
            updateDateDisplay();
            console.log(`Transactions loaded for ${dateKey}:`, Object.keys(transactionsData).length);
        },
        (error) => console.error("RTDB Transactions error:", error)
    );
}

// =========================
// EVENT LISTENERS FOR DATE NAVIGATION
// =========================
document.getElementById("prevDay").addEventListener("click", () => {
    currentDate.setDate(currentDate.getDate() - 1); // go to previous day
    fetchTransactionsForDate(currentDate);
});

document.getElementById("nextDay").addEventListener("click", () => {
    const today = new Date();
    if (formatDate(currentDate) === formatDate(today)) return; // prevent future
    currentDate.setDate(currentDate.getDate() + 1); // go to next day
    fetchTransactionsForDate(currentDate);
});

// =========================
// INITIAL LOAD
// =========================
fetchTransactionsForDate(currentDate);



document.getElementById("downloadPdf").addEventListener("click", () => {
    const table = document.querySelector("#payments table");

    // PDF options
    const opt = {
        margin:       0.5,
        filename:     `Payment_Records_${formatDate(currentDate)}.pdf`, // <-- fix here
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(table).save();
});
