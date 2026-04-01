import { rtdb, ref, onValue } from '../utils/firebase.js';

// ----------------------------
// Reference directly to the server-updated node
// ----------------------------
const paymentsRef = ref(rtdb, 'admin/payments/current_day');

// ----------------------------
// Listen for changes (Realtime)
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