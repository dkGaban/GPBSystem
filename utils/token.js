const jwt = require("jsonwebtoken");

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) throw new Error("JWT_SECRET must be set before using authentication tokens.");

function createToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email, username: user.username },
    jwtSecret,
    { expiresIn: "24h" }
  );
}

function readToken(token) {
  if (!token) return null;
  return jwt.verify(token, jwtSecret);
}

module.exports = { createToken, readToken };
