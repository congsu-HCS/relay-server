const SERVER_URL = "https://relay-server-p7mj.onrender.com";

// ===== CHECK LOGIN =====
const token = localStorage.getItem("token");
if (!token) {
    window.location.href = "/login";
}

// ===== ELEMENT =====
const buttons = document.querySelectorAll(".btn");
const statusBar  = document.getElementById("statusBar");
const statusText = document.getElementById("statusText");
const statusTime = document.getElementById("statusTime");

let isRunning = false;

// ===== STATUS =====
function setStatus(type, message) {
    statusBar.className  = "status-bar " + type;
    statusText.textContent = message;

    const now = new Date();
    statusTime.textContent =
        "Cập nhật lúc " +
        now.getHours().toString().padStart(2,"0") + ":" +
        now.getMinutes().toString().padStart(2,"0") + ":" +
        now.getSeconds().toString().padStart(2,"0");
}

// ===== CHECK SERVER =====
async function checkConnection() {
    setStatus("checking", "Đang kiểm tra server...");
    try {
        const res = await fetch(SERVER_URL + "/ping");
        const data = await res.json();
        if (data.ok) {
            setStatus("connected", "✅ Server OK");
        } else {
            setStatus("disconnected", "⚠️ Server lỗi");
        }
    } catch {
        setStatus("disconnected", "❌ Mất kết nối");
    }
}

checkConnection();
setInterval(checkConnection, 15000);

// ===== RELAY =====
buttons.forEach(btn => {
    btn.addEventListener("click", async () => {
        if (isRunning) return;

        const id = btn.dataset.id;
        const input = btn.parentElement.querySelector(".count");

        let times = parseInt(input.value) || 1;
        times = Math.max(1, Math.min(100, times));

        isRunning = true;

        for (let i = 0; i < times * 2; i++) {
            btn.classList.toggle("active");
            const state = btn.classList.contains("active") ? "ON" : "OFF";

            try {
                const res = await fetch(SERVER_URL + "/relay", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-token": token
                    },
                    body: JSON.stringify({ relay: id, state })
                });

                const data = await res.json();

                if (!data.ok) {
                    alert("Hết phiên đăng nhập!");
                    localStorage.clear();
                    window.location.href = "/login.html";
                    return;
                }

                setStatus("connected", `Relay ${id} → ${state}`);
            } catch {
                setStatus("disconnected", "Lỗi gửi lệnh");
            }

            await new Promise(r => setTimeout(r, 500));
        }

        isRunning = false;
    });
});
