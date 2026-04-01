// Highlight sidebar buttons
document.querySelectorAll(".sub-tabs button").forEach(button => {

    button.addEventListener("click", function () {

        document.querySelectorAll(".sub-tabs button")
            .forEach(btn => btn.classList.remove("active"));

        this.classList.add("active");

    });

});