import { db, rtdb, ref, onValue, update, remove } from "../utils/firebase.js";
import { collection, onSnapshot, doc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { get, set } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

let membersData = {};
let statusData = {};
let subscriptionsData = {};

let firestoreLoaded = false;
let statusLoaded = false;
let subscriptionsLoaded = false;

let tableBodies = {
    createdAccountsBody: document.getElementById("createdAccountsBody"),
    pendingAccountsBody: document.getElementById("pendingAccountsBody"),
    registeredAccountsBody: document.getElementById("registeredAccountsBody"),
    deletedAccountsBody: document.getElementById("deletedAccountsBody")
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
    if (!firestoreLoaded || !statusLoaded || !subscriptionsLoaded) return;

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

            const startTimestamp = subscriptionsData[uid]?.start_date;
            const startDate = startTimestamp?.toDate
                ? startTimestamp.toDate().getTime()
                : startTimestamp;
            
            const expirationTimestamp = subscriptionsData[uid]?.expiration_date;
            const expirationDate = expirationTimestamp?.toDate
                ? expirationTimestamp.toDate().getTime()
                : expirationTimestamp;

            const row = tableBodies.registeredAccountsBody.insertRow();

            const deactivateState = status === "deactivated" ? "is-disabled" : "";
            const activateState = status === "activated" ? "is-disabled" : "";
            
            row.innerHTML = `
                <td>${data.first_name || ""} ${data.last_name || ""}</td>
                <td>${data.email || ""}</td>
                <td>${formatDate(startDate)}</td>
                <td>${formatDate(expirationDate)}</td>
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
function renderDeletedAccounts() {

    if (!deletedLoaded) return;

    const tbody = tableBodies.deletedAccountsBody;
    tbody.innerHTML = "";

    let count = 0;

    for (let uid in deletedData) {

        const data = deletedData[uid];
        const member = data.firestore?.members;

        const name = member
            ? `${member.first_name || ""} ${member.last_name || ""}`
            : "Unknown";

        const email = member?.email || "N/A";

        // ← NEW: Get last member_status from RTDB archive
        const memberStatus = data.rtdb?.member_status?.status || "N/A";

        count++;

        const row = tbody.insertRow();

        row.innerHTML = `
            <td>${name}</td>
            <td>${email}</td>
            <td>${memberStatus}</td>
            <td>
                <button class="success" onclick="restoreAccount('${uid}')">Restore</button>
                <button class="danger" onclick="permanentlyDeleteAccount('${uid}')">Delete</button>
            </td>
        `;
    }

    if (count === 0) {
        tbody.innerHTML = `<tr><td colspan="4">No deleted accounts</td></tr>`;
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
// FIRESTORE DELETED
//
let deletedData = {};
let deletedLoaded = false;

const deletedQuery = collection(db, "deleted_members");

onSnapshot(deletedQuery, (snapshot) => {

    deletedData = {};

    snapshot.forEach((doc) => {
        deletedData[doc.id] = doc.data();
    });

    deletedLoaded = true;

    console.log("Deleted loaded:", Object.keys(deletedData).length);

    renderDeletedAccounts();

}, (error) => console.error("Deleted error:", error));

//
// SUBSCRIPTION DATABASE EXPIRATION
//
const subscriptionsQuery = collection(db, "subscriptions");

onSnapshot(subscriptionsQuery, (snapshot) => {

    subscriptionsData = {};

    snapshot.forEach((doc) => {
        subscriptionsData[doc.id] = doc.data();
    });

    subscriptionsLoaded = true;

    console.log("Subscriptions loaded:", Object.keys(subscriptionsData).length);

    renderTabs();

}, (error) => console.error("Subscriptions error:", error));

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


window.deleteAccount = async (uid) => {
    
    if (!confirm("⚠️ This will archive and delete this member. Continue?")) return;

    const archiveRef = doc(db, "deleted_members", uid);

    try {

        // =========================
        // 1. PREVENT DOUBLE DELETE
        // =========================
        const existingArchive = await getDoc(archiveRef);
        if (existingArchive.exists() && existingArchive.data().status === "completed") {
            alert("This member is already deleted.");
            return;
        }

        // =========================
        // 2. FETCH ALL DATA
        // =========================
        const collections = ["members", "subscriptions", "aioutput", "nutritions", "progresses"];
        let firestoreData = {};

        for (let col of collections) {
            const snap = await getDoc(doc(db, col, uid));
            firestoreData[col] = snap.exists() ? snap.data() : null;
        }

        const statusSnap = await get(ref(rtdb, "member_status/" + uid));
        const sessionSnap = await get(ref(rtdb, "session_qr/" + uid));

        const statusRTDB = statusSnap.val() || null;
        const sessionRTDB = sessionSnap.val() || null;

        let storedQR = null;

        if (sessionRTDB?.current_qr) {
            const qrSnap = await get(ref(rtdb, "stored_qrs/" + sessionRTDB.current_qr));
            storedQR = qrSnap.val() || null;
        }

        // =========================
        // 3. ARCHIVE (PENDING)
        // =========================
        await setDoc(archiveRef, {
            uid,
            firestore: firestoreData,
            rtdb: {
                member_status: statusRTDB,
                session_qr: sessionRTDB,
                stored_qr: storedQR
            },
            deleted_at: Date.now(),
            status: "pending"
        });

        // =========================
        // 4. DELETE FIRESTORE
        // =========================
        for (let col of collections) {
            await deleteDoc(doc(db, col, uid));
        }

        // =========================
        // 5. DELETE RTDB
        // =========================
        await remove(ref(rtdb, "member_status/" + uid));
        await remove(ref(rtdb, "session_qr/" + uid));

        if (sessionRTDB?.current_qr) {
            await remove(ref(rtdb, "stored_qrs/" + sessionRTDB.current_qr));
        }

        // =========================
        // 6. MARK AS COMPLETED
        // =========================
        await setDoc(archiveRef, {
            status: "completed"
        }, { merge: true });

        alert("✅ Member safely deleted and archived.");

    } catch (error) {

        console.error("Delete failed:", error);

        // =========================
        // 7. MARK AS FAILED
        // =========================
        try {
            await setDoc(archiveRef, {
                status: "failed",
                error: error.message,
                failed_at: Date.now()
            }, { merge: true });
        } catch (e) {
            console.error("Failed to mark archive error:", e);
        }

        alert("❌ Delete failed. No full cleanup was completed.");
    }
};


window.restoreAccount = async (uid) => {

    if (!confirm("Restore this member?")) return;

    try {

        const archiveRef = doc(db, "deleted_members", uid);
        const snap = await getDoc(archiveRef);

        if (!snap.exists()) {
            alert("No archive found.");
            return;
        }

        const data = snap.data();

        if (data.status !== "completed") {
            alert("Cannot restore. Archive is incomplete.");
            return;
        }

        const firestoreData = data.firestore;
        const rtdbData = data.rtdb;

        // =========================
        // 1. RESTORE FIRESTORE
        // =========================
        for (let col in firestoreData) {
            if (firestoreData[col]) {
                await setDoc(doc(db, col, uid), firestoreData[col]);
            }
        }

        // =========================
        // 2. RESTORE RTDB
        // =========================
        if (rtdbData?.member_status) {
            await set(ref(rtdb, "member_status/" + uid), rtdbData.member_status);
        }

        if (rtdbData?.session_qr) {
            await set(ref(rtdb, "session_qr/" + uid), rtdbData.session_qr);
        }

        if (rtdbData?.session_qr?.current_qr && rtdbData?.stored_qr) {
            await set(
                ref(rtdb, "stored_qrs/" + rtdbData.session_qr.current_qr),
                rtdbData.stored_qr
            );
        }

        // =========================
        // 3. DELETE ARCHIVE (OPTIONAL)
        // =========================
        await deleteDoc(archiveRef);

        alert("✅ Member restored successfully.");

    } catch (error) {
        console.error("Restore error:", error);
        alert("❌ Failed to restore member.");
    }
};


window.permanentlyDeleteAccount = async (uid) => {

    if (!confirm("⚠️ This will permanently delete this record. This cannot be undone. Continue?")) return;

    try {

        const archiveRef = doc(db, "deleted_members", uid);
        const snap = await getDoc(archiveRef);

        if (!snap.exists()) {
            alert("No archive found.");
            return;
        }

        const data = snap.data();

        // =========================
        // SAFETY CHECK
        // =========================
        if (data.status !== "completed") {
            alert("Cannot permanently delete. Archive is not fully completed.");
            return;
        }

        // =========================
        // DELETE ARCHIVE
        // =========================
        await deleteDoc(archiveRef);

        alert("🗑️ Permanently deleted.");

    } catch (error) {
        console.error("Permanent delete error:", error);
        alert("❌ Failed to permanently delete.");
    }
};