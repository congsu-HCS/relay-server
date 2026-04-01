const SERVER_URL = "https://relay-server-p7mj.onrender.com";

// ===== KIỂM TRA ĐĂNG NHẬP =====
const token    = localStorage.getItem("token");
const username = localStorage.getItem("username");

if (!token) {
  window.location.href = "/login";
}

// ===== STATUS BAR =====
const statusBar  = document.getElementById("statusBar");
const statusText = document.getElementById("statusText");
const statusTime = document.getElementById("statusTime");

function setStatus(type, message) {
  statusBar.className = "status-bar " + type;
  statusText.textContent = message;
  const now = new Date();
  const h = String(now.getHours()).padStart(2,"0");
  const m = String(now.getMinutes()).padStart(2,"0");
  const s = String(now.getSeconds()).padStart(2,"0");
  statusTime.textContent = "Cập nhật lúc " + h + ":" + m + ":" + s;
}

// ===== KIỂM TRA KẾT NỐI =====
async function checkConnection() {
  setStatus("checking", "Đang kiểm tra kết nối server...");
  try {
    const res  = await fetch(SERVER_URL + "/ping", { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    if (data.ok) setStatus("connected", "✅ Server đang hoạt động — Sẵn sàng điều khiển");
    else         setStatus("disconnected", "⚠️ Server phản hồi lỗi");
  } catch {
    setStatus("disconnected", "❌ Mất kết nối server");
  }
}

checkConnection();
setInterval(checkConnection, 15000);

// ===== NÚT RELAY =====
const buttons = document.querySelectorAll(".btn");
let isRunning = false;
let timers    = {};

function lockAll(exceptBtn) { buttons.forEach(b => { if (b !== exceptBtn) b.classList.add("disabled"); }); }
function unlockAll()        { buttons.forEach(b => b.classList.remove("disabled")); }

buttons.forEach(btn => {
  btn.addEventListener("click", () => {
    if (isRunning) return;

    const input = btn.parentElement.querySelector(".count");
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
        isRunning  = false;
        unlockAll();
        return;
      }

      btn.classList.toggle("active");
      const state = btn.classList.contains("active") ? "ON" : "OFF";

      fetch(SERVER_URL + "/relay", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          "x-token": token   // ← gửi kèm token
        },
        body: JSON.stringify({ relay: id, state })
      })
      .then(res => {
        if (res.status === 401) {
          // Token hết hạn → về trang login
          localStorage.clear();
          window.location.href = "/login";
        }
        return res.json();
      })
      .then(data => setStatus("connected", "✅ Relay " + id + " → " + state))
      .catch(()  => setStatus("disconnected", "❌ Gửi lệnh thất bại — Relay " + id));

      count++;
      timers[id] = setTimeout(runPulse, 500);
    }

    runPulse();
  });
});

// ===== ĐĂNG XUẤT =====
document.getElementById("btnLogout").addEventListener("click", async () => {
  await fetch(SERVER_URL + "/api/logout", {
    method:  "POST",
    headers: { "x-token": token }
  }).catch(() => {});
  localStorage.clear();
  window.location.href = "/login";
});