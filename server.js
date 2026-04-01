// server.js
const express    = require("express");
const http       = require("http");
const WebSocket  = require("ws");
const crypto     = require("crypto");
const { findUser } = require("./user");

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
  const token = req.headers["x-token"] || req.query.token;
  const user  = verifyToken(token);
  if (!user) return res.status(401).json({ ok: false, message: "Chua dang nhap" });
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
app.get("/login", (req, res) => res.sendFile(__dirname + "/login.html"));

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const user = findUser(username, password);
  if (!user) return res.status(401).json({ ok: false, message: "Sai tai khoan hoac mat khau" });
  const token = createToken(user);
  res.json({ ok: true, token, username: user.username, role: user.role });
});

app.get("/ping", (req, res) => res.json({ ok: true }));

// ===== PROTECTED ROUTES =====
app.get("/", (req, res) => res.redirect("/login"));

app.get("/app", (req, res) => res.sendFile(__dirname + "/index.html"));

app.post("/relay", authMiddleware, (req, res) => {
  const { relay, state } = req.body;
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

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log("Server chay tren port:", PORT));
