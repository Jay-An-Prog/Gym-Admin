import { rtdb, ref, onValue } from '../utils/firebase.js'; // assuming your export file

// ----------------------------
// 1️⃣ Get today's date key
// ----------------------------
function getTodayKey() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = ("0" + (today.getMonth() + 1)).slice(-2);
    const dd = ("0" + today.getDate()).slice(-2);
    return `${yyyy}-${mm}-${dd}`;
}

const dateKey = getTodayKey();

// ----------------------------
// 2️⃣ Reference to payments/date
// ----------------------------
const paymentsRef = ref(rtdb, `admin/payments/${dateKey}`);

// ----------------------------
// 3️⃣ Listen for changes (Realtime)
// ----------------------------
onValue(paymentsRef, (snapshot) => {
    const data = snapshot.val() || {};
    
    // Update Checked-in Members
    const checkedInCount = data.checked_in_count || 0;
    document.getElementById("checkInCount").textContent = checkedInCount;

    // Update Total Payment
    const totalPayment = data.total_payment || 0;
    document.getElementById("totalPayment").textContent = `₱${totalPayment.toFixed(2)}`;
}, (error) => {
    console.error("RTDB Error:", error);
});