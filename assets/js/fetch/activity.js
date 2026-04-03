import { rtdb, ref, onValue } from "../utils/firebase.js";

const tableBody = document.getElementById("activityTableBody");

// Reference to stored_qrs
const qrRef = ref(rtdb, "stored_qrs");

// Listen for real-time updates
onValue(qrRef, (snapshot) => {
    tableBody.innerHTML = ""; // clear table first

    if (!snapshot.exists()) {
        tableBody.innerHTML = "<tr><td colspan='4'>No data found</td></tr>";
        return;
    }

    snapshot.forEach((childSnapshot) => {
        const data = childSnapshot.val();

        const name = data.id_name || "Unknown";

        // Convert timestamps
        const checkin = formatTime(data.qr_checkin);
        const checkout = data.qr_checkout ? formatTime(data.qr_checkout) : "---";

        const date = formatDate(data.qr_checkin);

        // Create row
        const row = `
            <tr>
                <td>${date}</td>
                <td>${name}</td>
                <td>${checkin}</td>
                <td>${checkout}</td>
            </tr>
        `;

        tableBody.innerHTML += row;
    });
});

// Format timestamp → Time with seconds
function formatTime(timestamp) {
    if (!timestamp) return "---";

    const date = new Date(timestamp * 1000); // convert seconds → ms

    return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit", // add seconds
        hour12: true      // keeps AM/PM format
    });
}

// Format timestamp → Date (YYYY-MM-DD)
function formatDate(timestamp) {
    if (!timestamp) return "---";

    const date = new Date(timestamp * 1000);

    return date.toISOString().split("T")[0]; // YYYY-MM-DD
}