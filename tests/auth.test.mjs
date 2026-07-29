import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import registerAuthRoutes from "../routes/auth.js";

function makeApp() {
  const capturedRoles = [];
  const rows = [[], [{ id: 7, username: "newuser", fullName: "New User", email: "new@example.com", role: "customer" }], []];
  const pool = { request() {
    const current = { input(name, type, value) { if (name === "Role") capturedRoles.push(value); return current; }, async query() { return { recordset: rows.shift() || [] }; } };
    return current;
  }};
  const app = express(); app.use(express.json());
  registerAuthRoutes(app, {
    getPool: async () => pool, sql: { NVarChar: () => "nvarchar" }, authLimiter: (req, res, next) => next(), requireUser: (req, res, next) => next(), requireAdmin: (req, res, next) => next(),
    logAction: async () => {}, actorName: () => "admin@example.com", sendInternalError: (res) => res.status(500).json({ message: "Something went wrong, please try again." }),
    normalizeEmail: (email) => String(email || "").trim().toLowerCase(), addressFromBody: (body) => ({ address: body.address || "123 Main St" }),
    isValidPhilippineMobile: (phone) => /^09\d{9}$/.test(phone), isStrongPassword: () => true,
    hashPassword: () => ({ salt: "salt", hash: "hash" }), createToken: () => "token"
  });
  return { app, capturedRoles };
}

describe("auth endpoints", () => {
  it("always registers a customer even when a client sends admin role", async () => {
    const { app, capturedRoles } = makeApp();
    const response = await request(app).post("/api/auth/register").send({ fullName: "New User", email: "new@example.com", password: "GoodPass1", phone: "09171234567", role: "admin" });
    expect(response.status).toBe(201); expect(capturedRoles).toEqual(["customer"]); expect(response.body.user.role).toBe("customer");
  });
});
