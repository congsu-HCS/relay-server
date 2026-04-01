const SERVER_URL = "https://relay-server-p7mj.onrender.com";
const token = new URLSearchParams(window.location.search).get("token");

const buttons = document.querySelectorAll(".btn");
const statusBar  = document.getElementById("statusBar");
const statusDot  = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const statusTime = document.getElementById("statusTime");

let isRunning = false;
let timers = {};

// =============================================
// 🔌 KIỂM TRA KẾT NỐI SERVER
// =============================================
function setStatus(type, message) {
    statusBar.className  = "status-bar " + type;
    statusText.textContent = message;

    const now = new Date();
    const h = String(now.getHours()).padStart(2,"0");
    const m = String(now.getMinutes()).padStart(2,"0");
    const s = String(now.getSeconds()).padStart(2,"0");
    statusTime.textContent = "Cập nhật lúc " + h + ":" + m + ":" + s;
}

async function checkConnection() {
    setStatus("checking", "Đang kiểm tra kết nối server...");
    try {
        const res = await fetch(SERVER_URL + "/ping", { signal: AbortSignal.timeout(5000) });
        const data = await res.json();
        if (data.ok) {
            setStatus("connected", "✅ Server đang hoạt động — Sẵn sàng điều khiển");
        } else {
            setStatus("disconnected", "⚠️ Server phản hồi lỗi");
        }
    } catch (err) {
        setStatus("disconnected", "❌ Mất kết nối server — Kiểm tra mạng hoặc chờ server khởi động");
    }
}

// Kiểm tra ngay khi load, sau đó mỗi 15 giây
checkConnection();
setInterval(checkConnection, 15000);

// =============================================
// 🔒 KHÓA / MỞ GIAO DIỆN
// =============================================
function lockAll(exceptBtn) {
    buttons.forEach(b => {
        if (b !== exceptBtn) b.classList.add("disabled");
    });
}

function unlockAll() {
    buttons.forEach(b => b.classList.remove("disabled"));
}

// =============================================
// 🎛️ XỬ LÝ NÚT RELAY
// =============================================
buttons.forEach(btn => {
    btn.addEventListener("click", () => {
        if (isRunning) return;

        const parent = btn.parentElement;
        const input = parent.querySelector(".count");

        let times = parseInt(input.value) || 1;
        if (times > 100) times = 100;
        if (times < 1)   times = 1;

        const id = btn.dataset.id;

        isRunning = true;
        lockAll(btn);

        let count = 0;

        function runPulse() {
            if (count >= times * 2) {
                timers[id] = null;
                isRunning = false;
                unlockAll();
                return;
            }

            btn.classList.toggle("active");
            const state = btn.classList.contains("active") ? "ON" : "OFF";

            console.log("Relay:", id, state);

            fetch("/relay?token=" + token, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ relay: id, state: state })
            })
            .then(res => res.json())
            .then(data => {
                console.log("Server:", data);
                // cập nhật trạng thái khi gửi thành công
                setStatus("connected", "✅ Relay " + id + " → " + state);
            })
            .catch(err => {
                console.error("Lỗi:", err);
                setStatus("disconnected", "❌ Gửi lệnh thất bại — Relay " + id);
            });

            count++;
            timers[id] = setTimeout(runPulse, 500);
        }

        runPulse();
    });
});
