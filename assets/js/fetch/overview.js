import { rtdb, ref, onValue } from '../utils/firebase.js';

// ----------------------------
// Get today's date key
// ----------------------------
function getTodayKey() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = ("0" + (today.getMonth() + 1)).slice(-2);
    const dd = ("0" + today.getDate()).slice(-2);
    return `${yyyy}-${mm}-${dd}`;
}

const todayKey = getTodayKey();

// ----------------------------
// Reference to current_day
// ----------------------------
const paymentsRef = ref(rtdb, 'admin/payments/current_day');

// ----------------------------
// Listen for changes (Realtime)
// ----------------------------
onValue(paymentsRef, (snapshot) => {
    const data = snapshot.val() || {};

    // ❗ Check if date matches today
    if (data.date !== todayKey) {
        // If not today, show 0 (or "No data yet")
        document.getElementById("checkInCount").textContent = 0;
        document.getElementById("totalPayment").textContent = `₱0.00`;
        return;
    }

    // ✅ Valid today's data
    const checkedInCount = data.checked_in_count || 0;
    document.getElementById("checkInCount").textContent = checkedInCount;

    const totalPayment = data.total_payment || 0;
    document.getElementById("totalPayment").textContent = `₱${totalPayment.toFixed(2)}`;

}, (error) => {
    console.error("RTDB Error:", error);
});