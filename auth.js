document.getElementById("login").addEventListener("submit", async function (e) {
    e.preventDefault();
    const username = document.getElementById("login-username").value;
    const password = document.getElementById("login-password").value;

    try {
        const response = await fetch("http://localhost:3000/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });

        if (!response.ok) {
            throw new Error("Login failed");
        }
        const data = await response.json();
        localStorage.setItem("token", data.token);
        alert("Login successful!");
        window.location.href = "add-point.html"; // Harita sayfasına yönlendirme
    } catch (error) {
        console.error("Error during login:", error);
        alert("Login failed. Please try again.");
    }
});

document.getElementById("register").addEventListener("submit", async function (e) {
    e.preventDefault();
    const username = document.getElementById("register-username").value;
    const password = document.getElementById("register-password").value;
    const role_id = document.getElementById("register-role").value;

    try {
        const response = await fetch("http://localhost:3000/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password, role_id }),
        });

        if (!response.ok) {
            throw new Error("Registration failed");
        }

        alert("Registration successful! Please login.");
    } catch (error) {
        console.error("Error during registration:", error);
        alert("Registration failed. Please try again.");
    }
});