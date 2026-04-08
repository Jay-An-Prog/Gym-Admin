// subscriptions.js
import { db, rtdb, ref, onValue } from "../utils/firebase.js";
import { collection, doc, setDoc, increment, onSnapshot, updateDoc, Timestamp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

let subscriptionsData = {};
let membersData = {};
let subsLoaded = false;
let membersLoaded = false;

// prevent duplicate listeners
let listenersInitialized = false;

const tableBody = document.querySelector("#subscriptions table tbody") || document.getElementById("subscriptionsTableBody");

// =========================
// RENDER SUBSCRIPTIONS TABLE
// =========================
function renderSubscriptionsTable() {

    if (!subsLoaded || !membersLoaded) return;

    tableBody.innerHTML = "";
    let count = 0;

    for (let id in subscriptionsData) {

        const data = subscriptionsData[id];

        // hide other than pending
        if (data.subscription_status !== "pending") continue;

        const member = membersData[id] || {};

        const name =
            member.first_name && member.last_name
                ? `${member.first_name} ${member.last_name}`
                : `Sub #${id.substring(0, 8)}`;

        const status = data.subscription_status || "pending";

        const receiptBtn = data.receipt_image_url
            ? `<button class="info" onclick="showReceiptImage('${data.receipt_image_url}', '${id}')">View</button>`
            : "No Receipt";

        let actions = `<button class="success" onclick="activateSubscription('${id}')">Activate</button>`;

        if (status === "pending" && data.payment_method === "gcash") {
            actions += ` <button class="danger" onclick="rejectSubscription('${id}')">Reject</button>`;
        }

        const row = tableBody.insertRow();

        row.innerHTML = `
            <td>${name}</td>
            <td>${data.plan || "N/A"}</td>
            <td>${data.payment_method || "N/A"}</td>
            <td>${receiptBtn}</td>
            <td>${actions}</td>
        `;

        count++;
    }

    if (count === 0) {
        tableBody.innerHTML = `<tr><td colspan="5">No subscription requests</td></tr>`;
    }
}

// =========================
// SHOW RECEIPT IMAGE
// =========================
window.showReceiptImage = (url, id) => {

    if (!url) return;

    const w = window.open('', '_blank');

    w.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
        <title>Receipt ${id}</title>
        <style>
        body{
            margin:0;
            display:flex;
            align-items:center;
            justify-content:center;
            height:100vh;
            background:#000;
            color:white;
            font-family:sans-serif;
        }
        img{
            max-width:90vw;
            max-height:90vh;
            border-radius:8px;
            box-shadow:0 0 20px rgba(255,255,255,0.3);
        }
        </style>
        </head>

        <body>

        <img src="${url}"
        onerror="this.parentNode.innerHTML='<h2>Failed to load receipt</h2><p>${url}</p><button onclick=history.back()>Close</button>';">

        </body>

        </html>
    `);

    w.document.close();
};

// =========================
// ACTIVATE SUBSCRIPTION
// =========================
window.activateSubscription = async (id) => {

    if (!confirm("Activate this subscription?")) return;

    const data = subscriptionsData[id];

    // 1️⃣ Get prices from sessionStorage (fallback to defaults)
    const dailyPrice = parseFloat(sessionStorage.getItem("price_daily")) || 600;
    const monthlyPrice = parseFloat(sessionStorage.getItem("price_monthly")) || 600;
    const yearlyPrice = parseFloat(sessionStorage.getItem("price_yearly")) || 600;

    // 2️⃣ Determine subscription length & amount
    let months, amount;
    if (data.plan === "Yearly") {
        months = 12;
        amount = yearlyPrice;
    } else if (data.plan === "Monthly") {
        months = 1;
        amount = monthlyPrice;
    } else { // Daily
        months = 0;
        amount = dailyPrice;
    }

    const startDate = new Date();
    const expirationDate = new Date();
    if (months > 0) expirationDate.setMonth(expirationDate.getMonth() + months);

    try {
        // 3️⃣ Update Firestore subscription
        await updateDoc(doc(db, "subscriptions", id), {
            subscription_status: "active",
            start_date: Timestamp.fromDate(startDate),
            expiration_date: months > 0 ? Timestamp.fromDate(expirationDate) : null,
            updated_at: Timestamp.now()
        });

        // 4️⃣ Get member info
        const member = membersData[id];
        const memberId = member ? member.member_id || id : id;
        let name = member ? `${member.first_name || ""} ${member.last_name || ""}` : `Sub #${id.substring(0,8)}`;

        const nameRef = ref(rtdb, `session_qr/member_data/${memberId}/id_name`);
        await new Promise((resolve) => {
            onValue(
                nameRef,
                (snapshot) => {
                    const rtName = snapshot.val();
                    if (rtName) name = rtName;
                    resolve();
                },
                { onlyOnce: true }
            );
        });

        // 5️⃣ Build timestamps and keys
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, "0");
        const day = now.getDate().toString().padStart(2, "0");
        const dayKey = `${year}-${month}-${day}`;
        const monthKey = `${year}-${month}`;
        const yearKey = `${year}`;
        const timestamp = Math.floor(now.getTime() / 1000);

        // 6️⃣ Save transaction
        const txRef = doc(collection(db, "transactions"));
        await setDoc(txRef, {
            name,
            type: "Membership",
            amount,
            timestamp,
            date: dayKey,
            month: monthKey,
            year: yearKey,
            total_transactions: 1
        });

        // 7️⃣ Update transaction stats
        const dailyRef = doc(db, "transactions_stats", "summary", "daily", dayKey);
        const monthlyRef = doc(db, "transactions_stats", "summary", "monthly", monthKey);
        const yearlyRef = doc(db, "transactions_stats", "summary", "yearly", yearKey);

        await Promise.all([
            setDoc(dailyRef, { total_revenue: increment(amount), total_transactions: increment(1) }, { merge: true }),
            setDoc(monthlyRef, { total_revenue: increment(amount), total_transactions: increment(1) }, { merge: true }),
            setDoc(yearlyRef, { total_revenue: increment(amount), total_transactions: increment(1) }, { merge: true })
        ]);

        alert("Subscription activated and transaction recorded successfully.");

    } catch (error) {
        console.error("Activate error:", error);
        alert("Error activating subscription.");
    }
};

// =========================
// REJECT SUBSCRIPTION
// =========================
window.rejectSubscription = async (id) => {

    if (!confirm("Reject this subscription?")) return;

    try {

        await updateDoc(doc(db, "subscriptions", id), {
            subscription_status: "rejected",
            updated_at: Math.floor(Date.now() / 1000)
        });

        alert("Subscription rejected.");

    } catch (error) {

        console.error("Reject error:", error);
        alert("Error rejecting subscription.");

    }
};

// =========================
// LOAD SUBSCRIPTIONS & MEMBERS
// =========================
window.loadSubscriptions = () => {

    // prevent duplicate listeners
    if (listenersInitialized) return;
    listenersInitialized = true;

    // subscriptions listener
    const subsQ = collection(db, "subscriptions");

    onSnapshot(subsQ, (snapshot) => {

        subscriptionsData = {};

        snapshot.forEach((docSnap) => {
            subscriptionsData[docSnap.id] = docSnap.data();
        });

        subsLoaded = true;

        console.log("Subscriptions loaded:", Object.keys(subscriptionsData).length);

        renderSubscriptionsTable();

    }, (error) => console.error("Subscriptions error:", error));

    // members listener
    const membersQ = collection(db, "members");

    onSnapshot(membersQ, (snapshot) => {

        membersData = {};

        snapshot.forEach((docSnap) => {
            membersData[docSnap.id] = docSnap.data();
        });

        membersLoaded = true;

        console.log("Members loaded:", Object.keys(membersData).length);

        renderSubscriptionsTable();

    }, (error) => console.error("Members error:", error));
};