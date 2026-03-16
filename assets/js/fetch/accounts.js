import { db, rtdb, ref, onValue, update } from "../utils/firebase.js";
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";


let membersData = {};
let statusData = {};

let firestoreLoaded = false;
let statusLoaded = false;

let tableBodies = {
    createdAccountsBody: document.getElementById("createdAccountsBody"),
    pendingAccountsBody: document.getElementById("pendingAccountsBody"),
    registeredAccountsBody: document.getElementById("registeredAccountsBody")
};

function formatDate(timestamp) {
    if (!timestamp) return "N/A";

    const date = new Date(timestamp);

    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();

    return `${month}/${day}/${year}`;
}
function renderTabs() {

    // Wait until both Firestore and RTDB loaded
    if (!firestoreLoaded || !statusLoaded) return;

    // Clear tables
    tableBodies.createdAccountsBody.innerHTML = "";
    tableBodies.pendingAccountsBody.innerHTML = "";
    tableBodies.registeredAccountsBody.innerHTML = "";

    let createdCount = 0;
    let pendingCount = 0;
    let registeredCount = 0;

    for (let uid in membersData) {

        const data = membersData[uid];
        const status = statusData[uid]?.status || "";

        // CREATED ACCOUNTS
        if (status === "" || status === "rejected") {

            createdCount++;

            const row = tableBodies.createdAccountsBody.insertRow();

            row.innerHTML = `
                <td>${data.first_name || ""} ${data.last_name || ""}</td>
                <td>${data.email || ""}</td>
                <td>${formatDate(data.created_at)}</td>
                <td>
                    <button class="danger" onclick="deleteAccount('${uid}')">Delete</button>
                </td>
            `;
        }

        // PENDING ACCOUNTS
        if (status === "pending") {

            pendingCount++;

            const row = tableBodies.pendingAccountsBody.insertRow();

            const faceImg = data.face_image_url ? `<button class="info" onclick="showImage('${data.face_image_url}', 'Face Image')">View</button>` : 'No Image';
            const idImg = data.id_image_url ? `<button class="info" onclick="showImage('${data.id_image_url}', 'ID Image')">View</button>` : 'No ID';
            
            row.innerHTML = `
                <td>${data.first_name || ""} ${data.last_name || ""}</td>
                <td>${data.email || ""}</td>
                <td>${faceImg}</td>
                <td>${idImg}</td>
                <td>
                    <button class="success" onclick="activateAccount('${uid}')">Activate</button>
                    <button class="warning" onclick="rejectAccount('${uid}')">Reject</button>
                    <button class="danger" onclick="deleteAccount('${uid}')">Delete</button>
                </td>
            `;
        }

        // REGISTERED ACCOUNTS
        if (status === "activated" || status === "deactivated") {

            registeredCount++;

            const updated = statusData[uid]?.updated_at;

            const row = tableBodies.registeredAccountsBody.insertRow();

            const deactivateState = status === "deactivated" ? "is-disabled" : "";
            const activateState = status === "activated" ? "is-disabled" : "";
            
            row.innerHTML = `
                <td>${data.first_name || ""} ${data.last_name || ""}</td>
                <td>${data.email || ""}</td>
                <td>${status === "deactivated" ? "Deactivated" : "Activated"}</td>
                <td>${formatDate(updated)}</td>
                <td>
                    <button class="warning ${deactivateState}" onclick="deactivateAccount('${uid}')">Deactivate</button>
                    <button class="success ${activateState}" onclick="activateAccount('${uid}')">Activate</button>
                    <button class="danger" onclick="deleteAccount('${uid}')">Delete</button>
                </td>
            `;
        }
    }

    // Empty states
    if (createdCount === 0) {
        tableBodies.createdAccountsBody.innerHTML =
            `<tr><td colspan="4">No created accounts</td></tr>`;
    }

    if (pendingCount === 0) {
        tableBodies.pendingAccountsBody.innerHTML =
            `<tr><td colspan="5">No pending accounts</td></tr>`;
    }

    if (registeredCount === 0) {
        tableBodies.registeredAccountsBody.innerHTML =
            `<tr><td colspan="4">No registered accounts</td></tr>`;
    }
}

//
// FIRESTORE MEMBERS
//
const membersQuery = collection(db, "members");

onSnapshot(membersQuery, (snapshot) => {

    membersData = {};

    snapshot.forEach((doc) => {
        membersData[doc.id] = doc.data();
    });

    firestoreLoaded = true;

    console.log("Members loaded:", Object.keys(membersData).length);

    renderTabs();

}, (error) => console.error("Firestore error:", error));

//
// REALTIME DATABASE STATUS
//
const statusRef = ref(rtdb, "member_status");

onValue(statusRef, (snapshot) => {

    statusData = snapshot.val() || {};

    statusLoaded = true;

    console.log("Status loaded:", Object.keys(statusData).length);

    renderTabs();

}, (error) => console.error("RTDB error:", error));

//
// ACTION FUNCTIONS
window.showImage = (url, title) => {
    if (!url) return;
    const w = window.open('', '_blank');
    w.document.write(`
        <!DOCTYPE html>
        <html><head><title>${title}</title>
        <style>body {margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#000;color:white;font-family:sans-serif;} img {max-width:90vw;max-height:90vh;border-radius:8px;box-shadow:0 0 20px rgba(255,255,255,0.3);}</style>
        </head><body>
            <img src="${url}" onerror="this.parentNode.innerHTML='<h2>Failed to load image</h2><p>${url}</p><button onclick=history.back()>Close</button>';">
            <script>setTimeout(() => {if (window.innerHeight !== screen.availHeight) window.onresize = () => location.reload();}, 100);</script>
        </body></html>
    `);
    w.document.close();
};

window.activateAccount = (uid) => {

    if (!confirm("Activate this account?")) return;

    update(ref(rtdb, "member_status/" + uid), {
        status: "activated",
        updated_at: Date.now()
    })
    .then(() => {
        alert("Account activated successfully.");
    })
    .catch((error) => {
        console.error("Activate error:", error);
        alert("Error activating account.");
    });
};


window.rejectAccount = (uid) => {

    if (!confirm("Reject this account?")) return;

    update(ref(rtdb, "member_status/" + uid), {
        status: "rejected",
        updated_at: Date.now()
    })
    .then(() => {
        alert("Account rejected.");
    })
    .catch((error) => {
        console.error("Reject error:", error);
        alert("Error rejecting account.");
    });
};


window.deleteAccount = (uid) => {

    if (!confirm("Delete this account?")) return;

    update(ref(rtdb, "member_status/" + uid), {
        status: "",
        updated_at: Date.now()
    })
    .then(() => {
        alert("Account removed.");
    })
    .catch((error) => {
        console.error("Delete error:", error);
        alert("Error deleting account.");
    });
};


window.deactivateAccount = (uid) => {

    if (!confirm("Deactivate this account?")) return;

    update(ref(rtdb, "member_status/" + uid), {
        status: "deactivated",
        updated_at: Date.now()
    })
    .then(() => {
        alert("Account deactivated.");
    })
    .catch((error) => {
        console.error("Deactivate error:", error);
        alert("Error deactivating account.");
    });
};