const { createToken } = require("../utils/token");

module.exports = function registerAuthRoutes(app, deps) {
const {
    getPool, sql, authLimiter, requireUser, requireAdmin, logAction, actorName, sendInternalError,
    normalizeEmail, addressFromBody, isValidPhilippineMobile, isStrongPassword, isValidEmail,
    verifyPassword, hashPassword, validateServiceArea = () => ""
  } = deps;

  app.post("/api/auth/register", authLimiter, async (req, res) => {
    const { fullName, password, phone = "" } = req.body;
    const email = normalizeEmail(req.body.email);
    const address = addressFromBody(req.body);

    if (!fullName || !email || !password) return res.status(400).json({ message: "Complete the registration form." });
    if (!isValidPhilippineMobile(phone)) return res.status(400).json({ message: "Please enter a valid Philippine mobile number." });
    if (!isStrongPassword(password)) return res.status(400).json({ message: "Password must be at least 8 characters and include uppercase, lowercase, and a number." });
    if (!address.address) return res.status(400).json({ message: "Complete the customer address fields." });
    const serviceAreaError = validateServiceArea({ city: address.city });
    if (serviceAreaError) return res.status(400).json({ message: serviceAreaError });

    try {
      const pool = await getPool();
      const existing = await pool.request().input("Email", sql.NVarChar(150), email).query("SELECT TOP 1 Id FROM Users WHERE Email = @Email");
      if (existing.recordset.length) return res.status(409).json({ message: "This email is already registered." });

      const { salt, hash } = hashPassword(password);
      const result = await pool.request()
        .input("Username", sql.NVarChar(80), email.split("@")[0].toLowerCase())
        .input("FullName", sql.NVarChar(100), fullName)
        .input("Email", sql.NVarChar(150), email)
        .input("PasswordHash", sql.NVarChar(255), hash)
        .input("PasswordSalt", sql.NVarChar(80), salt)
        .input("Role", sql.NVarChar(30), "customer")
        .query(`
          INSERT INTO Users (Username, FullName, Email, PasswordHash, PasswordSalt, Role)
          OUTPUT INSERTED.Id AS id, INSERTED.Username AS username, INSERTED.FullName AS fullName, INSERTED.Email AS email, INSERTED.Role AS role
          VALUES (@Username, @FullName, @Email, @PasswordHash, @PasswordSalt, @Role)
        `);

      const user = result.recordset[0];
      await pool.request()
        .input("Name", sql.NVarChar(100), fullName)
        .input("Phone", sql.NVarChar(50), phone)
        .input("Email", sql.NVarChar(100), email)
        .input("Address", sql.NVarChar(255), address.address)
        .input("HouseNumber", sql.NVarChar(50), address.houseNumber || "")
        .input("Street", sql.NVarChar(150), address.street || "")
        .input("Barangay", sql.NVarChar(150), address.barangay || "")
        .input("City", sql.NVarChar(150), address.city || "")
        .input("Province", sql.NVarChar(150), address.province || "")
        .input("ZipCode", sql.NVarChar(20), address.zipCode || "")
        .query(`
          IF NOT EXISTS (SELECT 1 FROM Customers WHERE Email = @Email)
          INSERT INTO Customers (Name, Phone, Email, Address, HouseNumber, Street, Barangay, City, Province, ZipCode)
          VALUES (@Name, @Phone, @Email, @Address, @HouseNumber, @Street, @Barangay, @City, @Province, @ZipCode)
        `);
      await logAction(`Registered customer account for ${fullName}`, email, "Users", user.id);
      res.status(201).json({ user, token: createToken(user) });
    } catch (error) {
      if (error.message.includes("UNIQUE")) return res.status(409).json({ message: "This email is already registered." });
      sendInternalError(res, error, "Registration failed");
    }
  });

  app.post("/api/auth/login", authLimiter, async (req, res) => {
    const { password } = req.body;
    const email = normalizeEmail(req.body.email);
    if (!email || !password) return res.status(400).json({ message: "Enter your username/email and password." });
    try {
      const pool = await getPool();
      const result = await pool.request().input("Login", sql.NVarChar(150), email).query(`
        SELECT Id AS id, Username AS username, FullName AS fullName, Email AS email, Role AS role, MustChangePassword AS mustChangePassword, PasswordHash AS passwordHash, PasswordSalt AS passwordSalt
        FROM Users WHERE Email = @Login OR Username = @Login
      `);
      const user = result.recordset[0];
      if (!user) return res.status(404).json({ message: "Your account does not exist." });
      if (!verifyPassword(password, user.passwordSalt, user.passwordHash)) return res.status(401).json({ message: "Invalid email or password." });
      delete user.passwordHash; delete user.passwordSalt;
      await logAction(`Logged in as ${user.role}`, user.email, "Users", user.id);
      res.json({ user, token: createToken(user) });
    } catch (error) {
      sendInternalError(res, error, "Login failed");
    }
  });

  app.post("/api/auth/users", requireUser, requireAdmin, async (req, res) => {
    const { fullName, password, role } = req.body;
    const email = normalizeEmail(req.body.email);
    if (!fullName || !email || !password || !["admin", "technician"].includes(role)) {
      return res.status(400).json({ message: "Complete the account form with a valid staff role." });
    }
    if (!isValidEmail(email)) return res.status(400).json({ message: "Enter a valid email address." });
    if (!isStrongPassword(password)) return res.status(400).json({ message: "Password must be at least 8 characters and include uppercase, lowercase, and a number." });
    try {
      const pool = await getPool();
      const existing = await pool.request().input("Email", sql.NVarChar(150), email).query("SELECT TOP 1 Id FROM Users WHERE Email = @Email");
      if (existing.recordset.length) return res.status(409).json({ message: "This email is already registered." });
      const { salt, hash } = hashPassword(password);
      const result = await pool.request()
        .input("Username", sql.NVarChar(80), email.split("@")[0].toLowerCase())
        .input("FullName", sql.NVarChar(100), fullName)
        .input("Email", sql.NVarChar(150), email)
        .input("PasswordHash", sql.NVarChar(255), hash)
        .input("PasswordSalt", sql.NVarChar(80), salt)
        .input("Role", sql.NVarChar(30), role)
        .query(`INSERT INTO Users (Username, FullName, Email, PasswordHash, PasswordSalt, Role)
          OUTPUT INSERTED.Id AS id, INSERTED.Username AS username, INSERTED.FullName AS fullName, INSERTED.Email AS email, INSERTED.Role AS role
          VALUES (@Username, @FullName, @Email, @PasswordHash, @PasswordSalt, @Role)`);
      await logAction(`Created ${role} account for ${fullName}`, actorName(req), "Users", result.recordset[0].id);
      res.status(201).json({ user: result.recordset[0] });
    } catch (error) {
      if (error.message.includes("UNIQUE")) return res.status(409).json({ message: "This email is already registered." });
      sendInternalError(res, error, "Staff account creation failed");
    }
  });
};
