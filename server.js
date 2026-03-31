// server.js
const express = require("express");
const app = express();

app.use(express.json());

let relayState = {}; // lưu trạng thái

// Route nhận lệnh từ web
app.post("/relay", (req, res) => {
    const { relay, state } = req.body;

    relayState[relay] = state;
    console.log("Relay", relay, state);

    res.send({ ok: true });
});

// ESP32 gọi để lấy trạng thái
app.get("/relay/:id", (req, res) => {
    const id = req.params.id;
    res.send({ state: relayState[id] || "OFF" });
});

// Route ping để test server online/offline
app.get("/ping", (req, res) => {
    res.send({ ok: true });
});

// Sử dụng port từ biến môi trường của Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server chạy trên port:", PORT));