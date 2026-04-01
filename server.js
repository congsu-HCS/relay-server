// ===== server.js =====
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
  if (Date.now() > data.expires) {
    tokens.delete(token);
    return null;
  }
  return data;
}

// ===== MIDDLEWARE =====
function authMiddleware(req, res, next) {
  const user = verifyToken(req.headers["x-token"]);
  if (!user) return res.status(401).json({ ok: false, message: "Chua dang nhap" });
  req.user = user;
  next();
}

function adminMiddleware(req, res, next) {
  const user = verifyToken(req.headers["x-token"]);
  if (!user) return res.status(401).json({ ok: false, message: "Chua dang nhap" });
  if (user.role !== "admin") return res.status(403).json({ ok: false, message: "Khong co quyen" });
  req.user = user;
  next();
}

// ===== RELAY =====
let relayState = {};

wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "init", state: relayState }));
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  });
}

// ===== ROUTES =====
app.get("/", (req, res) => res.redirect("/login"));
app.get("/login", (req, res) => res.sendFile(__dirname + "/login.html"));
app.get("/app",   (req, res) => res.sendFile(__dirname + "/index.html"));
app.get("/admin", (req, res) => res.sendFile(__dirname + "/admin.html"));
app.get("/ping",  (req, res) => res.json({ ok: true }));

// ===== LOGIN =====
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await findUser(username, password);

  if (!user) {
    return res.status(401).json({ ok: false, message: "Sai tai khoan" });
  }

  const token = createToken(user);
  res.json({ ok: true, token, username: user.username, role: user.role });
});

// ===== RELAY =====
app.post("/relay", authMiddleware, (req, res) => {
  const { relay, state } = req.body;
  relayState[relay] = state;

  broadcast({ type: "relay", relay, state });

  res.json({ ok: true });
});

// ===== ADMIN =====
app.get("/api/users", adminMiddleware, async (req, res) => {
  const users = await getSubUsers();
  res.json({ ok: true, users });
});

app.post("/api/users", adminMiddleware, async (req, res) => {
  const result = await addUser(req.body.username, req.body.password);
  res.json(result);
});

app.delete("/api/users/:username", adminMiddleware, async (req, res) => {
  const result = await deleteUser(req.params.username);
  res.json(result);
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log("Server running:", PORT));