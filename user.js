// user.js
const https = require("https");

const JSONBIN_ID  = process.env.JSONBIN_ID  || "69ccd744aaba882197b3b932";
const JSONBIN_KEY = process.env.JSONBIN_KEY || "$2a$10$//8WQZ6FAY1V01c/2LFJ1.8Q.RNOmbi9lZI827rDv.NIlxI2CizF.";

// Admin cố định — không lưu lên JSONBin
const adminUser = { username: "admin", password: "admin123", role: "admin" };

// ===== ĐỌC users từ JSONBin =====
function loadUsers() {
  return new Promise((resolve) => {
    const options = {
      hostname: "api.jsonbin.io",
      path:     `/v3/b/${JSONBIN_ID}/latest`,
      method:   "GET",
      headers:  { "X-Master-Key": JSONBIN_KEY, "X-Bin-Meta": "false" }
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve([]); }
      });
    });
    req.on("error", () => resolve([]));
    req.end();
  });
}

// ===== GHI users lên JSONBin =====
function saveUsers(users) {
  return new Promise((resolve) => {
    const body = JSON.stringify(users);
    const options = {
      hostname: "api.jsonbin.io",
      path:     `/v3/b/${JSONBIN_ID}`,
      method:   "PUT",
      headers:  {
        "Content-Type":   "application/json",
        "X-Master-Key":   JSONBIN_KEY,
        "Content-Length": Buffer.byteLength(body)
      }
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve(true));
    });
    req.on("error", () => resolve(false));
    req.write(body);
    req.end();
  });
}

// ===== API =====
async function findUser(username, password) {
  if (username === adminUser.username && password === adminUser.password) return adminUser;
  const users = await loadUsers();
  return users.find(u => u.username === username && u.password === password) || null;
}

async function getSubUsers() {
  const users = await loadUsers();
  return users.map(u => ({ username: u.username, role: u.role }));
}

async function addUser(username, password) {
  if (username === "admin") return { ok: false, message: "Không được dùng tên admin" };
  const users = await loadUsers();
  if (users.find(u => u.username === username)) return { ok: false, message: "Tên đã tồn tại" };
  users.push({ username, password, role: "user" });
  await saveUsers(users);
  return { ok: true };
}

async function deleteUser(username) {
  if (username === "admin") return { ok: false, message: "Không thể xóa admin" };
  const users = await loadUsers();
  const newUsers = users.filter(u => u.username !== username);
  if (newUsers.length === users.length) return { ok: false, message: "Không tìm thấy user" };
  await saveUsers(newUsers);
  return { ok: true };
}

module.exports = { findUser, getSubUsers, addUser, deleteUser };