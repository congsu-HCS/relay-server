// server.js
const express    = require("express");
const http       = require("http");
const WebSocket  = require("ws");
const crypto     = require("crypto");
const { findUser, getSubUsers, addUser, deleteUser } = require("./user");

const app        = express();
const httpServer = http.createServer(app);
const wss        = new WebSocket.Server({ server: httpServer });

app.use(express.json());
app.use(express.static(__dirname, { index: false }));

// ===== TOKEN STORE =====
const tokens = new Map();

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

function createToken(user) {
  const token = generateToken();
  tokens.set(token, {
    username: user.username,
    role:     user.role,
    expires:  Date.now() + 24 * 60 * 60 * 1000
  });
  return token;
}

function verifyToken(token) {
  if (!token) return null;
  const data = tokens.get(token);
  if (!data) return null;
  if (Date.now() > data.expires) { tokens.delete(token); return null; }
  return data;
}

// ===== MIDDLEWARE =====
function authMiddleware(req, res, next) {
  const user = verifyToken(req.headers["x-token"] || req.query.token);
  if (!user) return res.status(401).json({ ok: false, message: "Chua dang nhap" });
  req.user = user;
  next();
}

function adminMiddleware(req, res, next) {
  const user = verifyToken(req.headers["x-token"] || req.query.token);
  if (!user)                 return res.status(401).json({ ok: false, message: "Chua dang nhap" });
  if (user.role !== "admin") return res.status(403).json({ ok: false, message: "Khong co quyen" });
  req.user = user;
  next();
}

// ===== RELAY STATE =====
let relayState = {};

// ===== WEBSOCKET =====
wss.on("connection", (ws) => {
  console.log("ESP32 ket noi WebSocket");
  ws.send(JSON.stringify({ type: "init", state: relayState }));
  ws.on("close", () => console.log("ESP32 ngat ket noi"));
  ws.on("error", (err) => console.log("WS error:", err.message));
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

// ===== PUBLIC ROUTES =====
app.get("/",      (req, res) => res.redirect("/login"));
app.get("/login", (req, res) => res.sendFile(__dirname + "/login.html"));
app.get("/ping",  (req, res) => res.json({ ok: true }));

app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await findUser(username, password);
    if (!user) return res.status(401).json({ ok: false, message: "Sai tai khoan hoac mat khau" });
    const token = createToken(user);
    res.json({ ok: true, token, username: user.username, role: user.role });
  } catch (e) {
    res.status(500).json({ ok: false, message: "Loi server" });
  }
});

// ===== PROTECTED ROUTES =====
app.get("/app", (req, res) => {
  const user = verifyToken(req.headers["x-token"] || req.query.token);

  if (!user) {
    return res.redirect("/login"); // 👉 chưa login thì về login
  }

  res.sendFile(__dirname + "/index.html");
});
app.get("/admin", (req, res) => {
  const user = verifyToken(req.headers["x-token"] || req.query.token);

  if (!user) {
    return res.redirect("/login"); // 👉 chưa login
  }

  if (user.role !== "admin") {
    return res.redirect("/app"); // 👉 không phải admin thì về app
  }

  res.sendFile(__dirname + "/admin.html");
});

app.post("/relay", authMiddleware, (req, res) => {
  const { relay, state } = req.body;
  const adminOnlyRelays = ["57", "58", "59"];
  if (adminOnlyRelays.includes(String(relay)) && req.user.role !== "admin") {
    return res.status(403).json({ ok: false, message: "Chỉ admin mới được điều khiển relay này" });
  }
  relayState[relay] = state;
  console.log("[" + req.user.username + "] Relay " + relay + " -> " + state);
  broadcast({ type: "relay", relay, state });
  res.json({ ok: true });
});

app.get("/relays", authMiddleware, (req, res) => res.json(relayState));

app.post("/api/logout", authMiddleware, (req, res) => {
  tokens.delete(req.headers["x-token"]);
  res.json({ ok: true });
});

// ===== ADMIN: QUẢN LÝ USER =====
app.get("/api/users", adminMiddleware, async (req, res) => {
  try {
    const users = await getSubUsers();
    res.json({ ok: true, users });
  } catch (e) {
    res.status(500).json({ ok: false, message: "Loi doc danh sach user" });
  }
});

app.post("/api/users", adminMiddleware, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.json({ ok: false, message: "Thieu thong tin" });
    const result = await addUser(username, password);
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, message: "Loi them user" });
  }
});

app.delete("/api/users/:username", adminMiddleware, async (req, res) => {
  try {
    const result = await deleteUser(req.params.username);
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, message: "Loi xoa user" });
  }
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log("Server chay tren port:", PORT));
