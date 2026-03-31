// server.js
const express = require("express");
const http    = require("http");
const WebSocket = require("ws");

const app        = express();
const httpServer = http.createServer(app);
const wss        = new WebSocket.Server({ server: httpServer });

app.use(express.json());
app.use(express.static(__dirname));

let relayState = {};

// ===== WebSocket =====
wss.on("connection", (ws) => {
    console.log("ESP32 đã kết nối WebSocket");

    // gửi trạng thái hiện tại ngay khi ESP32 kết nối
    ws.send(JSON.stringify({ type: "init", state: relayState }));

    ws.on("close", () => console.log("ESP32 ngắt kết nối"));
    ws.on("error", (err) => console.log("WS error:", err.message));
});

// broadcast tới tất cả ESP32 đang kết nối
function broadcast(data) {
    const msg = JSON.stringify(data);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(msg);
        }
    });
}

// ===== REST API =====

// Web gửi lệnh relay
app.post("/relay", (req, res) => {
    const { relay, state } = req.body;
    relayState[relay] = state;
    console.log("Relay", relay, "->", state);

    // đẩy lệnh ngay lập tức tới ESP32 qua WebSocket
    broadcast({ type: "relay", relay, state });

    res.send({ ok: true });
});

// Lấy trạng thái 1 relay
app.get("/relay/:id", (req, res) => {
    res.send({ state: relayState[req.params.id] || "OFF" });
});

// Lấy toàn bộ trạng thái
app.get("/relays", (req, res) => {
    res.send(relayState);
});

// Số ESP32 đang kết nối
app.get("/status", (req, res) => {
    res.send({ esp32_connected: wss.clients.size, relayState });
});

// Ping
app.get("/ping", (req, res) => {
    res.send({ ok: true });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log("Server chạy trên port:", PORT));