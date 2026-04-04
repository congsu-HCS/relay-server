const SERVER_URL = "https://relay-server-p7mj.onrender.com";

const buttons    = document.querySelectorAll(".btn");
const statusDot  = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const statusTime = document.getElementById("statusTime");
const cancelWrap = document.getElementById("cancelWrap");
const btnCancel  = document.getElementById("btnCancel");

let isRunning   = false;
let activeTimer = null;
let activeBtn   = null;
let activeId    = null;

// =============================================
// 🔌 KIỂM TRA KẾT NỐI SERVER
// =============================================
function setStatus(type, message) {
  statusDot.className    = "status-dot " + type;
  statusText.textContent = message;
  const now = new Date();
  const h = String(now.getHours()).padStart(2,"0");
  const m = String(now.getMinutes()).padStart(2,"0");
  const s = String(now.getSeconds()).padStart(2,"0");
  statusTime.textContent = h + ":" + m + ":" + s;
}

async function checkConnection() {
  setStatus("", "Đang kiểm tra kết nối server...");
  try {
    const res  = await fetch(SERVER_URL + "/ping", { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    setStatus(data.ok ? "online" : "offline",
              data.ok ? "✅ Server đang hoạt động — Sẵn sàng điều khiển"
                      : "⚠️ Server phản hồi lỗi");
  } catch {
    setStatus("offline", "❌ Mất kết nối server — Kiểm tra mạng hoặc chờ server khởi động");
  }
}

checkConnection();
setInterval(checkConnection, 15000);

// =============================================
// 🔒 KHÓA / MỞ GIAO DIỆN
// =============================================
function lockAll(exceptBtn) {
  buttons.forEach(b => { if (b !== exceptBtn) b.classList.add("disabled"); });
  cancelWrap.style.display = "flex";   // hiện nút hủy
}

function unlockAll() {
  buttons.forEach(b => b.classList.remove("disabled"));
  cancelWrap.style.display = "none";   // ẩn nút hủy
}

// =============================================
// ⛔ HỦY GIỮA CHỪNG
// =============================================
function cancelCycle() {
  if (!isRunning) return;

  clearTimeout(activeTimer);
  activeTimer = null;

  // Tắt relay đang chạy
  if (activeBtn) activeBtn.classList.remove("active");
  if (activeId) {
    fetch(SERVER_URL + "/relay", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-token": token },
      body: JSON.stringify({ relay: activeId, state: "OFF" })
    }).catch(() => {});
  }

  isRunning = false;
  activeBtn = null;
  activeId  = null;
  unlockAll();
  setStatus("online", "⛔ Đã dừng — Relay tắt");
}

btnCancel.addEventListener("click", cancelCycle);

// =============================================
// 🎛️ XỬ LÝ NÚT RELAY
// =============================================
buttons.forEach(btn => {
  btn.addEventListener("click", () => {
    if (isRunning) return;

    const input = btn.parentElement.querySelector(".count");
    let times = Math.min(Math.max(parseInt(input.value) || 1, 1), 100);
    const id  = btn.dataset.id;

    isRunning = true;
    activeBtn = btn;
    activeId  = id;
    lockAll(btn);

    let count = 0;

    function runPulse() {
      if (count >= times * 2) {
        activeTimer = null;
        isRunning   = false;
        activeBtn   = null;
        activeId    = null;
        unlockAll();
        return;
      }

      btn.classList.toggle("active");
      const state = btn.classList.contains("active") ? "ON" : "OFF";

      fetch(SERVER_URL + "/relay", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-token": token },
        body: JSON.stringify({ relay: id, state })
      })
      .then(res => res.json())
      .then(() => setStatus("online", "✅ Relay " + id + " → " + state))
      .catch(() => setStatus("offline", "❌ Gửi lệnh thất bại — Relay " + id));

      count++;
      activeTimer = setTimeout(runPulse, 500);
    }

    runPulse();
  });
});
