import { auth } from "../utils/firebase.js";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

const form = document.querySelector(".login-card");

form.addEventListener("submit", (e) => {
    e.preventDefault();
    
    const email = form.querySelector("input[type='email']").value;
    if (!email.toLowerCase().endsWith("@sonic.com")) {
        console.log("Unknown account detected. Auto signout.");
    
        signOut(auth);
    
        return;
    }
    const password = form.querySelector("input[type='password']").value;
    
    signInWithEmailAndPassword(auth, email, password)
    .then(() => {
        window.location.href = "main.html";
    })
    .catch((error) => {
        alert("Login failed: " + error.message);
    });
});

// Auto-login redirect
onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    const email = user.email?.toLowerCase() || "";

    // 🚫 Block Gmail accounts
    if (!email.toLowerCase().endsWith("@sonic.com")) {
        await signOut(auth);
        alert("Unknown accounts are not allowed for admin access.");
        return;
    }

    // ✅ Only allowed emails reach here
    window.location.href = "main.html";
});
