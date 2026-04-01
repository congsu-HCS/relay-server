// models/user.js
// Thêm/xóa user tại đây
const users = [
  { username: "admin", password: "admin123", role: "admin" },
  { username: "user1", password: "pass123",  role: "user"  },
];

// Tìm user theo username + password
function findUser(username, password) {
  return users.find(u => u.username === username && u.password === password) || null;
}

module.exports = { findUser };