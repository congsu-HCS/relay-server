const express = require("express");
const app = express();

app.use(express.json());

let relayState = {}; // lưu trạng thái

// nhận lệnh từ web
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

app.listen(3000, () => console.log("Server chạy"));