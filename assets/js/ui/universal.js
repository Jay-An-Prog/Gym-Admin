// Show main section
function showSection(id) {

    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });

    const target = document.getElementById(id);
    if (target) target.classList.add('active');
    /*
    // When opening accounts section
    if (id === "accounts") {
        showSubSection("accounts", "createdAccounts");
        if (window.loadCreatedAccounts) loadCreatedAccounts();
    }
    */
    // When opening sections
    if (id === "activity") {
        window.loadActivity?.();
    }
    if (id === "accounts") {
        window.loadAccounts?.();
    }
    if (id === "subscriptions") {
        window.loadSubscriptions?.();
    }
    if (id === "payments") {
        window.loadPayments?.();
    }
}


// Highlight sidebar buttons
document.querySelectorAll(".sidebar button").forEach(button => {

    button.addEventListener("click", function () {

        document.querySelectorAll(".sidebar button")
            .forEach(btn => btn.classList.remove("active"));

        this.classList.add("active");

    });

});


// Sub tab switching
function showSubSection(parentId, subId) {

    const parent = document.getElementById(parentId);

    if (!parent) return;

    // Hide all subsections
    parent.querySelectorAll(".sub-section").forEach(sub => {
        sub.classList.remove("active");
    });

    const target = document.getElementById(subId);
    if (target) target.classList.add("active");

    // Update active sub-tab button
    parent.querySelectorAll(".sub-tabs button").forEach(btn => {

        btn.classList.remove("active");

        if (btn.getAttribute("data-tab") === subId) {
            btn.classList.add("active");
        }

    });

    /*
    // Load account tables
    if (parentId === "accounts") {

        if (subId === "createdAccounts" && window.loadCreatedAccounts) {
            loadCreatedAccounts();
        }

        if (subId === "pendingAccounts" && window.loadPendingAccounts) {
            loadPendingAccounts();
        }

        if (subId === "registeredAccounts" && window.loadRegisteredAccounts) {
            loadRegisteredAccounts();
        }

    }
    */
}

// Default section on page load
document.addEventListener("DOMContentLoaded", () => {

    showSection("overview");

    const defaultBtn = document.getElementById("defaultBtn");

    if (defaultBtn) {
        defaultBtn.classList.add("active");
    }

});