import { rtdb, ref, get, set } from "../utils/firebase.js";

document.addEventListener("DOMContentLoaded", () => {
    const dailyInput = document.getElementById("dailyPrice");
    const monthlyInput = document.getElementById("monthlyPrice");
    const yearlyInput = document.getElementById("yearlyPrice");
    const saveBtn = document.getElementById("savePricesBtn");
    const statusMsg = document.getElementById("priceStatus");

    const STORAGE_KEYS = {
        daily: "price_daily",
        monthly: "price_monthly",
        yearly: "price_yearly"
    };

    // Load prices: check sessionStorage first, otherwise fetch from RTDB
    async function loadPrices() {
        const dailySession = sessionStorage.getItem(STORAGE_KEYS.daily);
        const monthlySession = sessionStorage.getItem(STORAGE_KEYS.monthly);
        const yearlySession = sessionStorage.getItem(STORAGE_KEYS.yearly);

        if (dailySession && monthlySession && yearlySession) {
            dailyInput.value = dailySession;
            monthlyInput.value = monthlySession;
            yearlyInput.value = yearlySession;
            console.log("Prices loaded from session.");
        } else {
            try {
                const dailySnap = await get(ref(rtdb, "admin/settings/prices/daily"));
                const monthlySnap = await get(ref(rtdb, "admin/settings/prices/monthly"));
                const yearlySnap = await get(ref(rtdb, "admin/settings/prices/yearly"));

                const daily = dailySnap.exists() ? dailySnap.val() : 0;
                const monthly = monthlySnap.exists() ? monthlySnap.val() : 0;
                const yearly = yearlySnap.exists() ? yearlySnap.val() : 0;

                dailyInput.value = daily;
                monthlyInput.value = monthly;
                yearlyInput.value = yearly;

                // Save to sessionStorage
                sessionStorage.setItem(STORAGE_KEYS.daily, daily);
                sessionStorage.setItem(STORAGE_KEYS.monthly, monthly);
                sessionStorage.setItem(STORAGE_KEYS.yearly, yearly);
                console.log("Prices loaded from RTDB.");
            } catch (err) {
                console.error("Error fetching prices from Firebase:", err);
            }
        }
    }

    loadPrices();

    // Save prices to Firebase and sessionStorage
    saveBtn.addEventListener("click", async () => {
        const daily = parseFloat(dailyInput.value) || 0;
        const monthly = parseFloat(monthlyInput.value) || 0;
        const yearly = parseFloat(yearlyInput.value) || 0;

        try {
            await Promise.all([
                set(ref(rtdb, "admin/settings/prices/daily"), daily),
                set(ref(rtdb, "admin/settings/prices/monthly"), monthly),
                set(ref(rtdb, "admin/settings/prices/yearly"), yearly),
            ]);

            // Update sessionStorage
            sessionStorage.setItem(STORAGE_KEYS.daily, daily);
            sessionStorage.setItem(STORAGE_KEYS.monthly, monthly);
            sessionStorage.setItem(STORAGE_KEYS.yearly, yearly);

            statusMsg.style.display = "block";
            setTimeout(() => (statusMsg.style.display = "none"), 3000);
        } catch (err) {
            console.error("Error saving prices to Firebase:", err);
            alert("Failed to save prices!");
        }
    });
});