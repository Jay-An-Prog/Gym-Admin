import { auth } from "../utils/firebase.js";
import { signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// Logout (global function for sidebar button)
window.logout = function () {
    if (!confirm("Are you sure you want to logout?")) return;

    signOut(auth)
    .then(() => {
        window.location.href = "login.html";
    })
    .catch((error) => {
        alert("Logout error: " + error.message);
    });
};
