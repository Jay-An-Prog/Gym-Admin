// subscriptions.js

import { db } from "../utils/firebase.js"; 
import { collection, doc, onSnapshot, updateDoc, Timestamp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

let subscriptionsData = {};
let membersData = {};
let subsLoaded = false;
let membersLoaded = false;

const tableBody = document.querySelector("#subscriptions table tbody") || document.getElementById("subscriptionsTableBody");

function renderSubscriptionsTable() {
    if (!subsLoaded || !membersLoaded) return;

    tableBody.innerHTML = "";
    let count = 0;

    for (let id in subscriptionsData) {

        const data = subscriptionsData[id];

        // hide other than "pending" subscriptions
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

window.activateSubscription = async (id) => {

    if (!confirm("Activate this subscription?")) return;

    const data = subscriptionsData[id];

    let months = 1;

    if (data.plan === "Yearly") {
        months = 12;
    }

    const startDate = new Date();
    const expirationDate = new Date();

    expirationDate.setMonth(expirationDate.getMonth() + months);

    try {

        await updateDoc(doc(db, "subscriptions", id), {
            subscription_status: "active",
            start_date: Timestamp.fromDate(startDate),
            expiration_date: Timestamp.fromDate(expirationDate),
            updated_at: Timestamp.now()
        });

        alert("Subscription activated successfully.");

    } catch (error) {

        console.error("Activate error:", error);
        alert("Error activating subscription.");

    }
};

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

window.loadSubscriptions = () => {

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