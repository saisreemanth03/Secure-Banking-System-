const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");

const otpModal = document.getElementById("otpModal");
const voiceModal = document.getElementById("voiceModal");

const authSection = document.getElementById("authSection");
const dashboardSection = document.getElementById("dashboardSection");

let currentUsername = "";

// LOGIN
loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = loginUsername.value.trim();
    const password = loginPassword.value.trim();

    const res = await fetch("http://localhost:5000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (data.success) {
        currentUsername = username;
        otpModal.classList.remove("hidden");
    } else alert(data.message);
});

// VERIFY OTP
verifyOtpBtn.onclick = async () => {
    const otp = otpInput.value;

    const res = await fetch("http://localhost:5000/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: currentUsername, otp })
    });

    const data = await res.json();

    if (data.success) {
        otpModal.classList.add("hidden");
        voiceModal.classList.remove("hidden");
    }
};

// VOICE
startVoiceBtn.onclick = () => {
    const rec = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    rec.start();

    rec.onresult = async (e) => {
        const spoken = e.results[0][0].transcript;

        const res = await fetch("http://localhost:5000/verify-voice", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: currentUsername, spokenPhrase: spoken })
        });

        const data = await res.json();

        if (data.success) {
            voiceModal.classList.add("hidden");
            loadDashboard();
        }
    };
};

// LOAD DASHBOARD
async function loadDashboard() {
    const res = await fetch(`http://localhost:5000/user/${currentUsername}`);
    const data = await res.json();

    if (data.success) {
        const user = data.data;

        authSection.classList.add("hidden");
        dashboardSection.classList.remove("hidden");

        balanceDisplay.innerText = "₹" + (user.balance || 0);
        accountNumberDisplay.innerText = "XXXX " + user.accountNumber.slice(-4);

        dashboardName.innerText = user.name || "User";
        dashboardEmail.innerText = user.email || "-";
        dashboardPhone.innerText = user.phone || "-";

        ifscCode.innerText = user.ifsc;
        branchName.innerText = user.branch;
    }
}

// LOGOUT
logoutBtn.onclick = () => {
    dashboardSection.classList.add("hidden");
    authSection.classList.remove("hidden");
};