const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const sql = require("mssql/msnodesqlv8");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "guest.html")));
app.use(express.static(__dirname));

const profilePhotoDirectory = path.join(__dirname, "uploads", "technicians");

const dbConfig = {
  connectionString:
    process.env.DB_CONNECTION_STRING ||
    "Driver={ODBC Driver 17 for SQL Server};Server=.\\SQLEXPRESS;Database=GBPServiceDB;Trusted_Connection=Yes;TrustServerCertificate=Yes;"
};

let poolPromise;

function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(dbConfig);
  }
  return poolPromise;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  return hashPassword(password, salt).hash === hash;
}

function isValidPhilippineMobile(phone) {
  return /^09\d{9}$/.test(String(phone || "").trim());
}

function isStrongPassword(password) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(String(password || ""));
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

function isPastOrInvalidCalendarDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return true;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3])) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

function slotToMinuteRange(slot) {
  const parseTime = (value) => {
    const match = String(value || "").trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
    if (!match) return null;
    let hours = Number(match[1]);
    const minutes = Number(match[2] || 0);
    if (hours === 12) hours = 0;
    if (match[3].toUpperCase() === "PM") hours += 12;
    return hours * 60 + minutes;
  };
  const values = String(slot || "").split(/\s*(?:–|—|-)\s*/).map(parseTime);
  return values.length === 2 && values.every(Number.isFinite) ? values : null;
}

function timeSlotsOverlap(firstSlot, secondSlot) {
  const first = slotToMinuteRange(firstSlot);
  const second = slotToMinuteRange(secondSlot);
  return first && second ? first[0] < second[1] && second[0] < first[1] : String(firstSlot) === String(secondSlot);
}

function validateTechnicianPayload({ name, specialty, phoneNumber, email, address }) {
  if (!String(name || "").trim() || !String(specialty || "").trim()) return "Name and fields are required.";
  if (!isValidPhilippineMobile(phoneNumber)) return "Phone number must be an 11-digit Philippine mobile number starting with 09.";
  if (!isValidEmail(email)) return "Enter a valid email address.";
  if (!String(address || "").trim()) return "Address is required.";
  return "";
}

async function saveProfilePhoto(photo) {
  if (!photo) return "";
  const name = String(photo.name || "");
  const extension = path.extname(name).toLowerCase();
  if (!['.jpg', '.jpeg', '.png'].includes(extension)) throw new Error("Profile photo must be a JPG, JPEG, or PNG file.");
  const match = String(photo.data || "").match(/^data:image\/(jpeg|png);base64,(.+)$/);
  if (!match) throw new Error("Profile photo data is invalid.");
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) throw new Error("Profile photo must be smaller than 5 MB.");
  await fs.mkdir(profilePhotoDirectory, { recursive: true });
  const filename = `technician-${Date.now()}-${crypto.randomBytes(6).toString("hex")}${extension}`;
  await fs.writeFile(path.join(profilePhotoDirectory, filename), buffer);
  return `uploads/technicians/${filename}`;
}

function formatAddress(parts = {}) {
  const values = [
    parts.houseNumber,
    parts.street,
    parts.barangay ? `Barangay ${String(parts.barangay).replace(/^barangay\s+/i, "")}` : "",
    parts.city,
    parts.province,
    parts.zipCode
  ];
  return values.map((value) => String(value || "").trim()).filter(Boolean).join(", ");
}

function addressFromBody(body = {}) {
  const structured = {
    houseNumber: body.houseNumber || body.addressHouseNumber,
    street: body.street || body.addressStreet,
    barangay: body.barangay || body.addressBarangay,
    city: body.city || body.addressCity,
    province: body.province || body.addressProvince,
    zipCode: body.zipCode || body.addressZipCode
  };
  const hasStructuredAddress = Object.values(structured).some((value) => String(value || "").trim());
  return {
    ...structured,
    address: hasStructuredAddress ? formatAddress(structured) : String(body.address || "").trim()
  };
}

function validateServicePayload({ name, type, price }) {
  if (!String(name || "").trim()) return "Variant name is required.";
  if (!String(type || "").trim()) return "Category is required.";
  if (price === undefined || price === null || String(price).trim() === "") return "Price is required.";
  const amount = Number(price);
  if (!Number.isFinite(amount) || amount < 0) return "Price cannot be negative.";
  return "";
}

function createToken(user) {
  const payload = Buffer.from(JSON.stringify({ id: user.id, role: user.role, email: user.email, username: user.username })).toString("base64url");
  const signature = crypto.createHmac("sha256", process.env.APP_SECRET || "dev-secret-change-later").update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function readToken(token) {
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  const expected = crypto.createHmac("sha256", process.env.APP_SECRET || "dev-secret-change-later").update(payload).digest("base64url");
  if (signature !== expected) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function requireUser(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const user = readToken(token);
  if (!user) return res.status(401).json({ message: "Please log in first." });
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ message: "Admin access required." });
  next();
}

async function logAction(action, actor, targetType = null, targetId = null) {
  try {
    const pool = await getPool();
    await pool
      .request()
      .input("Actor", sql.NVarChar(100), actor || "System")
      .input("Action", sql.NVarChar(255), action)
      .input("TargetType", sql.NVarChar(50), targetType)
      .input("TargetId", sql.NVarChar(50), targetId ? String(targetId) : null)
      .query(`
        INSERT INTO ActionLogs (Actor, Action, TargetType, TargetId)
        VALUES (@Actor, @Action, @TargetType, @TargetId)
      `);
  } catch (error) {
    console.error("Action log failed:", error.message);
  }
}

async function ensureSchema() {
  const pool = await getPool();
  await pool.request().query(`
    IF OBJECT_ID('Customers', 'U') IS NULL
    CREATE TABLE Customers (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(100) NOT NULL,
      Phone NVARCHAR(50),
      Email NVARCHAR(100),
      Address NVARCHAR(255),
      CreatedAt DATETIME DEFAULT GETDATE()
    );

    IF OBJECT_ID('Technicians', 'U') IS NULL
    CREATE TABLE Technicians (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(100) NOT NULL,
      Specialty NVARCHAR(100),
      Status NVARCHAR(50) DEFAULT 'Active',
      PhoneNumber NVARCHAR(11) NULL,
      Email NVARCHAR(255) NULL,
      Address NVARCHAR(255) NULL,
      ProfilePhoto NVARCHAR(255) NULL,
      CreatedAt DATETIME DEFAULT GETDATE()
    );

    IF OBJECT_ID('Services', 'U') IS NULL
    CREATE TABLE Services (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(100) NOT NULL,
      Type NVARCHAR(100),
      Price DECIMAL(10,2),
      Inclusion NVARCHAR(MAX),
      Exclusion NVARCHAR(MAX),
      Image NVARCHAR(MAX),
      CreatedAt DATETIME DEFAULT GETDATE()
    );

    IF OBJECT_ID('Products', 'U') IS NULL
    CREATE TABLE Products (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(100) NOT NULL,
      Type NVARCHAR(100),
      Brand NVARCHAR(100),
      Price DECIMAL(10,2),
      Stocks INT,
      Horsepower NVARCHAR(50),
      Image NVARCHAR(MAX),
      CreatedAt DATETIME DEFAULT GETDATE()
    );

    IF OBJECT_ID('Bookings', 'U') IS NULL
    CREATE TABLE Bookings (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      CustomerId INT NULL,
      CustomerName NVARCHAR(100) NOT NULL,
      Phone NVARCHAR(50),
      Email NVARCHAR(150),
      ServiceId INT NULL,
      ServiceName NVARCHAR(100),
      Address NVARCHAR(255),
      PreferredDate DATE,
      PreferredTime NVARCHAR(50),
      TotalAmount DECIMAL(10,2) NULL,
      Status NVARCHAR(50) DEFAULT 'Pending',
      CreatedAt DATETIME DEFAULT GETDATE(),
      FOREIGN KEY (CustomerId) REFERENCES Customers(Id),
      FOREIGN KEY (ServiceId) REFERENCES Services(Id)
    );

    IF OBJECT_ID('Schedules', 'U') IS NULL
    CREATE TABLE Schedules (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      BookingId INT NOT NULL,
      TechnicianId INT NOT NULL,
      ScheduleDate DATE,
      ScheduleTime NVARCHAR(50),
      Status NVARCHAR(50) DEFAULT 'Scheduled',
      CreatedAt DATETIME DEFAULT GETDATE(),
      FOREIGN KEY (BookingId) REFERENCES Bookings(Id),
      FOREIGN KEY (TechnicianId) REFERENCES Technicians(Id)
    );

    IF OBJECT_ID('Activities', 'U') IS NULL
    CREATE TABLE Activities (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Icon NVARCHAR(50),
      Color NVARCHAR(50),
      Text NVARCHAR(255),
      CreatedAt DATETIME DEFAULT GETDATE()
    );

    IF OBJECT_ID('Users', 'U') IS NULL
    CREATE TABLE Users (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Username NVARCHAR(80) NULL UNIQUE,
      FullName NVARCHAR(100) NOT NULL,
      Email NVARCHAR(150) NOT NULL UNIQUE,
      PasswordHash NVARCHAR(255) NOT NULL,
      PasswordSalt NVARCHAR(80) NOT NULL,
      Role NVARCHAR(30) NOT NULL DEFAULT 'customer',
      CreatedAt DATETIME DEFAULT GETDATE()
    );

    IF COL_LENGTH('Users', 'Username') IS NULL
      ALTER TABLE Users ADD Username NVARCHAR(80) NULL;

    IF OBJECT_ID('ActionLogs', 'U') IS NULL
    CREATE TABLE ActionLogs (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Actor NVARCHAR(100) NOT NULL,
      Action NVARCHAR(255) NOT NULL,
      TargetType NVARCHAR(50),
      TargetId NVARCHAR(50),
      CreatedAt DATETIME DEFAULT GETDATE()
    );

    IF COL_LENGTH('Bookings', 'PreferredTime') IS NULL
      ALTER TABLE Bookings ADD PreferredTime NVARCHAR(50) NULL;
    IF COL_LENGTH('Bookings', 'Phone') IS NULL
      ALTER TABLE Bookings ADD Phone NVARCHAR(50) NULL;
    IF COL_LENGTH('Bookings', 'Email') IS NULL
      ALTER TABLE Bookings ADD Email NVARCHAR(150) NULL;
    IF COL_LENGTH('Bookings', 'TotalAmount') IS NULL
      ALTER TABLE Bookings ADD TotalAmount DECIMAL(10,2) NULL;
    IF COL_LENGTH('Bookings', 'ServiceName') IS NOT NULL
      ALTER TABLE Bookings ALTER COLUMN ServiceName NVARCHAR(500) NULL;
    IF COL_LENGTH('Services', 'Image') IS NULL
      ALTER TABLE Services ADD Image NVARCHAR(MAX) NULL;
    IF COL_LENGTH('Schedules', 'ScheduleTime') IS NULL
      ALTER TABLE Schedules ADD ScheduleTime NVARCHAR(50) NULL;
    IF COL_LENGTH('Customers', 'HouseNumber') IS NULL
      ALTER TABLE Customers ADD HouseNumber NVARCHAR(50) NULL;
    IF COL_LENGTH('Customers', 'Street') IS NULL
      ALTER TABLE Customers ADD Street NVARCHAR(150) NULL;
    IF COL_LENGTH('Customers', 'Barangay') IS NULL
      ALTER TABLE Customers ADD Barangay NVARCHAR(150) NULL;
    IF COL_LENGTH('Customers', 'City') IS NULL
      ALTER TABLE Customers ADD City NVARCHAR(150) NULL;
    IF COL_LENGTH('Customers', 'Province') IS NULL
      ALTER TABLE Customers ADD Province NVARCHAR(150) NULL;
    IF COL_LENGTH('Customers', 'ZipCode') IS NULL
      ALTER TABLE Customers ADD ZipCode NVARCHAR(20) NULL;
    IF COL_LENGTH('Technicians', 'PhoneNumber') IS NULL
      ALTER TABLE Technicians ADD PhoneNumber NVARCHAR(11) NULL;
    IF COL_LENGTH('Technicians', 'Email') IS NULL
      ALTER TABLE Technicians ADD Email NVARCHAR(255) NULL;
    IF COL_LENGTH('Technicians', 'Address') IS NULL
      ALTER TABLE Technicians ADD Address NVARCHAR(255) NULL;
    IF COL_LENGTH('Technicians', 'ProfilePhoto') IS NULL
      ALTER TABLE Technicians ADD ProfilePhoto NVARCHAR(255) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Technicians_Email' AND object_id = OBJECT_ID('Technicians'))
      EXEC('CREATE UNIQUE INDEX UX_Technicians_Email ON Technicians(Email) WHERE Email IS NOT NULL');
  `);

  const adminPassword = hashPassword("admin123", "gbp-default-admin-salt");
  await pool
    .request()
    .input("Username", sql.NVarChar(80), "admin")
    .input("FullName", sql.NVarChar(100), "System Administrator")
    .input("Email", sql.NVarChar(150), "admin@gmail.com")
    .input("PasswordHash", sql.NVarChar(255), adminPassword.hash)
    .input("PasswordSalt", sql.NVarChar(80), adminPassword.salt)
    .input("Role", sql.NVarChar(30), "admin")
    .query(`
      IF EXISTS (SELECT 1 FROM Users WHERE Username = @Username)
      BEGIN
        UPDATE Users
        SET FullName = @FullName, Email = @Email, PasswordHash = @PasswordHash, PasswordSalt = @PasswordSalt, Role = @Role
        WHERE Username = @Username
      END
      ELSE
      BEGIN
        INSERT INTO Users (Username, FullName, Email, PasswordHash, PasswordSalt, Role)
        VALUES (@Username, @FullName, @Email, @PasswordHash, @PasswordSalt, @Role)
      END
    `);
}

function actorName(req) {
  return req.user?.email || "Guest";
}

app.get("/api/health", async (req, res) => {
  try {
    await getPool();
    res.json({ ok: true, database: "GBPServiceDB" });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

app.post("/api/auth/register", async (req, res) => {
  const { fullName, password, phone = "" } = req.body;
  const email = normalizeEmail(req.body.email);
  const role = req.body.role === "admin" ? "admin" : "customer";
  const address = addressFromBody(req.body);

  if (!fullName || !email || !password) {
    return res.status(400).json({ message: "Complete the registration form." });
  }
  if (!isValidPhilippineMobile(phone)) {
    return res.status(400).json({ message: "Please enter a valid Philippine mobile number." });
  }
  if (!isStrongPassword(password)) {
    return res.status(400).json({ message: "Password must be at least 8 characters and include uppercase, lowercase, and a number." });
  }
  if (role === "customer" && !address.address) {
    return res.status(400).json({ message: "Complete the customer address fields." });
  }

  try {
    const pool = await getPool();
    const existing = await pool.request().input("Email", sql.NVarChar(150), email).query("SELECT TOP 1 Id FROM Users WHERE Email = @Email");
    if (existing.recordset.length) return res.status(409).json({ message: "This email is already registered." });

    const { salt, hash } = hashPassword(password);
    const result = await pool
      .request()
      .input("Username", sql.NVarChar(80), email.split("@")[0].toLowerCase())
      .input("FullName", sql.NVarChar(100), fullName)
      .input("Email", sql.NVarChar(150), email.toLowerCase())
      .input("PasswordHash", sql.NVarChar(255), hash)
      .input("PasswordSalt", sql.NVarChar(80), salt)
      .input("Role", sql.NVarChar(30), role)
      .query(`
        INSERT INTO Users (Username, FullName, Email, PasswordHash, PasswordSalt, Role)
        OUTPUT INSERTED.Id AS id, INSERTED.Username AS username, INSERTED.FullName AS fullName, INSERTED.Email AS email, INSERTED.Role AS role
        VALUES (@Username, @FullName, @Email, @PasswordHash, @PasswordSalt, @Role)
      `);

    const user = result.recordset[0];
    if (role === "customer") {
      await pool
        .request()
        .input("Name", sql.NVarChar(100), fullName)
        .input("Phone", sql.NVarChar(50), phone)
        .input("Email", sql.NVarChar(100), email.toLowerCase())
        .input("Address", sql.NVarChar(255), address.address)
        .input("HouseNumber", sql.NVarChar(50), address.houseNumber || "")
        .input("Street", sql.NVarChar(150), address.street || "")
        .input("Barangay", sql.NVarChar(150), address.barangay || "")
        .input("City", sql.NVarChar(150), address.city || "")
        .input("Province", sql.NVarChar(150), address.province || "")
        .input("ZipCode", sql.NVarChar(20), address.zipCode || "")
        .query(`
          IF NOT EXISTS (SELECT 1 FROM Customers WHERE Email = @Email)
          BEGIN
            INSERT INTO Customers (Name, Phone, Email, Address, HouseNumber, Street, Barangay, City, Province, ZipCode)
            VALUES (@Name, @Phone, @Email, @Address, @HouseNumber, @Street, @Barangay, @City, @Province, @ZipCode)
          END
        `);
    }
    await logAction(`Registered ${role} account for ${fullName}`, email, "Users", user.id);
    res.status(201).json({ user, token: createToken(user) });
  } catch (error) {
    const message = error.message.includes("UNIQUE") ? "This email is already registered." : error.message;
    res.status(500).json({ message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { password } = req.body;
  const email = normalizeEmail(req.body.email);
  if (!email || !password) return res.status(400).json({ message: "Enter your username/email and password." });

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("Login", sql.NVarChar(150), email.toLowerCase())
      .query(`
        SELECT Id AS id, Username AS username, FullName AS fullName, Email AS email, Role AS role, PasswordHash AS passwordHash, PasswordSalt AS passwordSalt
        FROM Users
        WHERE Email = @Login OR Username = @Login
      `);

    const user = result.recordset[0];
    if (!user) return res.status(404).json({ message: "Your account does not exist." });
    if (!verifyPassword(password, user.passwordSalt, user.passwordHash)) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    delete user.passwordHash;
    delete user.passwordSalt;
    await logAction(`Logged in as ${user.role}`, user.email, "Users", user.id);
    res.json({ user, token: createToken(user) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put("/api/auth/change-password", requireUser, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword !== confirmPassword) return res.status(400).json({ message: "Enter the current password and matching new passwords." });
  if (!isStrongPassword(newPassword)) return res.status(400).json({ message: "New password must be at least 8 characters with uppercase, lowercase, and a number." });
  try {
    const pool = await getPool();
    const existing = await pool.request().input("Id", sql.Int, req.user.id).query("SELECT PasswordHash, PasswordSalt FROM Users WHERE Id = @Id");
    if (!existing.recordset.length || !verifyPassword(currentPassword, existing.recordset[0].PasswordSalt, existing.recordset[0].PasswordHash)) return res.status(400).json({ message: "Current password is incorrect." });
    const next = hashPassword(newPassword);
    await pool.request().input("Id", sql.Int, req.user.id).input("PasswordHash", sql.NVarChar(255), next.hash).input("PasswordSalt", sql.NVarChar(80), next.salt).query("UPDATE Users SET PasswordHash = @PasswordHash, PasswordSalt = @PasswordSalt WHERE Id = @Id");
    res.json({ message: "Password changed successfully." });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.get("/api/logs", requireUser, requireAdmin, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT TOP 100
        Id AS id,
        Actor AS actor,
        Action AS action,
        TargetType AS targetType,
        TargetId AS targetId,
        CreatedAt AS createdAt
        FROM ActionLogs
        ORDER BY Id DESC
    `);

    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/customers", requireUser, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        Id AS id,
        Name AS name,
        Phone AS phone,
        Email AS email,
        COALESCE(NULLIF(CONCAT(
          NULLIF(HouseNumber, ''), CASE WHEN NULLIF(HouseNumber, '') IS NOT NULL THEN ', ' ELSE '' END,
          NULLIF(Street, ''), CASE WHEN NULLIF(Street, '') IS NOT NULL THEN ', ' ELSE '' END,
          CASE WHEN NULLIF(Barangay, '') IS NOT NULL THEN CONCAT('Barangay ', REPLACE(Barangay, 'Barangay ', '')) ELSE NULL END, CASE WHEN NULLIF(Barangay, '') IS NOT NULL THEN ', ' ELSE '' END,
          NULLIF(City, ''), CASE WHEN NULLIF(City, '') IS NOT NULL THEN ', ' ELSE '' END,
          NULLIF(Province, ''), CASE WHEN NULLIF(Province, '') IS NOT NULL THEN ', ' ELSE '' END,
          NULLIF(ZipCode, '')
        ), ''), Address) AS address,
        HouseNumber AS houseNumber,
        Street AS street,
        Barangay AS barangay,
        City AS city,
        Province AS province,
        ZipCode AS zipCode
      FROM Customers
      ORDER BY Id DESC
    `);
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/customers", requireUser, async (req, res) => {
  const { name, phone } = req.body;
  const email = normalizeEmail(req.body.email);
  const address = addressFromBody(req.body);
  if (!name || !phone || !email || !address.address) return res.status(400).json({ message: "Missing required customer fields." });
  if (!isValidPhilippineMobile(phone)) return res.status(400).json({ message: "Contact number must contain exactly 11 digits." });

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("Name", sql.NVarChar(100), name)
      .input("Phone", sql.NVarChar(50), phone)
      .input("Email", sql.NVarChar(100), email)
      .input("Address", sql.NVarChar(255), address.address)
      .query(`
        INSERT INTO Customers (Name, Phone, Email, Address)
        OUTPUT INSERTED.Id AS id, INSERTED.Name AS name, INSERTED.Phone AS phone, INSERTED.Email AS email, INSERTED.Address AS address
        VALUES (@Name, @Phone, @Email, @Address)
      `);
    await logAction(`Created customer ${name}`, actorName(req), "Customers", result.recordset[0].id);
    res.status(201).json(result.recordset[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put("/api/customers/:id", requireUser, async (req, res) => {
  const { name, phone } = req.body;
  const email = normalizeEmail(req.body.email);
  const address = addressFromBody(req.body);
  if (!name || !phone || !email || !address.address) return res.status(400).json({ message: "Missing required customer fields." });
  if (!isValidPhilippineMobile(phone)) return res.status(400).json({ message: "Contact number must contain exactly 11 digits." });

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("Id", sql.Int, Number(req.params.id))
      .input("Name", sql.NVarChar(100), name)
      .input("Phone", sql.NVarChar(50), phone)
      .input("Email", sql.NVarChar(100), email)
      .input("Address", sql.NVarChar(255), address.address)
      .query(`
        UPDATE Customers
        SET Name = @Name, Phone = @Phone, Email = @Email, Address = @Address
        OUTPUT INSERTED.Id AS id, INSERTED.Name AS name, INSERTED.Phone AS phone, INSERTED.Email AS email, INSERTED.Address AS address
        WHERE Id = @Id
      `);
    if (!result.recordset.length) return res.status(404).json({ message: "Customer not found." });
    await logAction(`Updated customer ${name}`, actorName(req), "Customers", req.params.id);
    res.json(result.recordset[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete("/api/customers/:id", requireUser, requireAdmin, async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().input("Id", sql.Int, Number(req.params.id)).query("DELETE FROM Customers WHERE Id = @Id");
    await logAction("Deleted a customer", actorName(req), "Customers", req.params.id);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/technicians", requireUser, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Admin access required." });
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT Id AS id, Name AS name, Specialty AS specialty, Status AS status,
        PhoneNumber AS phoneNumber, Email AS email, Address AS address, ProfilePhoto AS profilePhoto
      FROM Technicians
      ORDER BY Id DESC
    `);
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/technicians", requireUser, requireAdmin, async (req, res) => {
  const { name, specialty, status = "Active", phoneNumber, address, password = "", profilePhoto } = req.body;
  const email = normalizeEmail(req.body.email);
  const validationError = validateTechnicianPayload({ name, specialty, phoneNumber, email, address });
  if (validationError) return res.status(400).json({ message: validationError });
  if (password && !isStrongPassword(password)) return res.status(400).json({ message: "Temporary password must be at least 8 characters and include uppercase, lowercase, and a number." });

  try {
    const pool = await getPool();
    const existingUser = await pool
      .request()
      .input("Email", sql.NVarChar(150), email)
      .query("SELECT TOP 1 Id FROM Users WHERE Email = @Email");
    if (existingUser.recordset.length) {
      return res.status(409).json({ message: "That email is already registered." });
    }
    const savedPhoto = await saveProfilePhoto(profilePhoto);

    const result = await pool
      .request()
      .input("Name", sql.NVarChar(100), name)
      .input("Specialty", sql.NVarChar(100), specialty)
      .input("Status", sql.NVarChar(50), status)
      .input("PhoneNumber", sql.NVarChar(11), phoneNumber.trim())
      .input("Email", sql.NVarChar(255), email)
      .input("Address", sql.NVarChar(255), address.trim())
      .input("ProfilePhoto", sql.NVarChar(255), savedPhoto || null)
      .query(`
        INSERT INTO Technicians (Name, Specialty, Status, PhoneNumber, Email, Address, ProfilePhoto)
        OUTPUT INSERTED.Id AS id, INSERTED.Name AS name, INSERTED.Specialty AS specialty, INSERTED.Status AS status,
          INSERTED.PhoneNumber AS phoneNumber, INSERTED.Email AS email, INSERTED.Address AS address, INSERTED.ProfilePhoto AS profilePhoto
        VALUES (@Name, @Specialty, @Status, @PhoneNumber, @Email, @Address, @ProfilePhoto)
      `);

    if (password) {
      const { salt, hash } = hashPassword(password);
      await pool
        .request()
        .input("Username", sql.NVarChar(80), email.split("@")[0].toLowerCase())
        .input("FullName", sql.NVarChar(100), name)
        .input("Email", sql.NVarChar(150), email)
        .input("PasswordHash", sql.NVarChar(255), hash)
        .input("PasswordSalt", sql.NVarChar(80), salt)
        .input("Role", sql.NVarChar(30), "technician")
        .query(`
          INSERT INTO Users (Username, FullName, Email, PasswordHash, PasswordSalt, Role)
          VALUES (@Username, @FullName, @Email, @PasswordHash, @PasswordSalt, @Role)
        `);
    }

    await logAction(`Created technician ${name}`, actorName(req), "Technicians", result.recordset[0].id);
    res.status(201).json(result.recordset[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put("/api/technicians/:id", requireUser, requireAdmin, async (req, res) => {
  const { name, specialty, status = "Active", phoneNumber, address, profilePhoto } = req.body;
  const email = normalizeEmail(req.body.email);
  const validationError = validateTechnicianPayload({ name, specialty, phoneNumber, email, address });
  if (validationError) return res.status(400).json({ message: validationError });

  try {
    const pool = await getPool();
    const duplicate = await pool.request().input("Email", sql.NVarChar(255), email).input("Id", sql.Int, Number(req.params.id)).query("SELECT TOP 1 Id FROM Technicians WHERE Email = @Email AND Id <> @Id");
    if (duplicate.recordset.length) return res.status(409).json({ message: "That email is already assigned to another technician." });
    const existing = await pool.request().input("Id", sql.Int, Number(req.params.id)).query("SELECT ProfilePhoto, Email FROM Technicians WHERE Id = @Id");
    if (!existing.recordset.length) return res.status(404).json({ message: "Technician not found." });
    const emailInUse = await pool.request().input("Email", sql.NVarChar(150), email).input("OldEmail", sql.NVarChar(255), existing.recordset[0].Email).query("SELECT TOP 1 Id FROM Users WHERE Email = @Email AND Email <> @OldEmail");
    if (emailInUse.recordset.length) return res.status(409).json({ message: "That email is already registered." });
    const savedPhoto = profilePhoto ? await saveProfilePhoto(profilePhoto) : existing.recordset[0].ProfilePhoto;
    const result = await pool
      .request()
      .input("Id", sql.Int, Number(req.params.id))
      .input("Name", sql.NVarChar(100), name)
      .input("Specialty", sql.NVarChar(100), specialty)
      .input("Status", sql.NVarChar(50), status)
      .input("PhoneNumber", sql.NVarChar(11), phoneNumber.trim())
      .input("Email", sql.NVarChar(255), email)
      .input("Address", sql.NVarChar(255), address.trim())
      .input("ProfilePhoto", sql.NVarChar(255), savedPhoto || null)
      .query(`
        UPDATE Technicians
        SET Name = @Name, Specialty = @Specialty, Status = @Status, PhoneNumber = @PhoneNumber, Email = @Email, Address = @Address, ProfilePhoto = @ProfilePhoto
        OUTPUT INSERTED.Id AS id, INSERTED.Name AS name, INSERTED.Specialty AS specialty, INSERTED.Status AS status,
          INSERTED.PhoneNumber AS phoneNumber, INSERTED.Email AS email, INSERTED.Address AS address, INSERTED.ProfilePhoto AS profilePhoto
        WHERE Id = @Id
      `);
    await pool.request().input("OldEmail", sql.NVarChar(255), existing.recordset[0].Email).input("FullName", sql.NVarChar(100), name.trim()).input("Email", sql.NVarChar(150), email).query(`
      UPDATE Users SET FullName = @FullName, Email = @Email WHERE Role = 'technician' AND Email = @OldEmail
    `);
    await logAction(`Updated technician ${name}`, actorName(req), "Technicians", req.params.id);
    res.json(result.recordset[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/technicians/me", requireUser, async (req, res) => {
  if (req.user.role !== "technician") return res.status(403).json({ message: "Technician access required." });
  try {
    const pool = await getPool();
    const result = await pool.request().input("UserId", sql.Int, req.user.id).query(`
      SELECT t.Id AS id, t.Name AS name, t.Specialty AS specialty, t.Status AS status,
        t.PhoneNumber AS phoneNumber, t.Email AS email, t.Address AS address, t.ProfilePhoto AS profilePhoto
      FROM Technicians t INNER JOIN Users u ON u.Email = t.Email
      WHERE u.Id = @UserId AND u.Role = 'technician'
    `);
    if (!result.recordset.length) return res.status(404).json({ message: "No technician profile is linked to this account." });
    res.json(result.recordset[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put("/api/technicians/me", requireUser, async (req, res) => {
  if (req.user.role !== "technician") return res.status(403).json({ message: "Technician access required." });
  const { name, phoneNumber, address, profilePhoto } = req.body;
  const email = normalizeEmail(req.body.email);
  if (!String(name || "").trim() || !isValidPhilippineMobile(phoneNumber) || !isValidEmail(email) || !String(address || "").trim()) {
    return res.status(400).json({ message: "Provide a name, valid Philippine mobile number, valid email, and address." });
  }
  try {
    const pool = await getPool();
    const current = await pool.request().input("UserId", sql.Int, req.user.id).query(`
      SELECT t.Id, t.ProfilePhoto, t.Email FROM Technicians t INNER JOIN Users u ON u.Email = t.Email
      WHERE u.Id = @UserId AND u.Role = 'technician'
    `);
    if (!current.recordset.length) return res.status(404).json({ message: "No technician profile is linked to this account." });
    const technician = current.recordset[0];
    const duplicate = await pool.request().input("Email", sql.NVarChar(255), email).input("Id", sql.Int, technician.Id).query("SELECT TOP 1 Id FROM Technicians WHERE Email = @Email AND Id <> @Id");
    if (duplicate.recordset.length) return res.status(409).json({ message: "That email is already assigned to another technician." });
    const emailInUse = await pool.request().input("Email", sql.NVarChar(150), email).input("UserId", sql.Int, req.user.id).query("SELECT TOP 1 Id FROM Users WHERE Email = @Email AND Id <> @UserId");
    if (emailInUse.recordset.length) return res.status(409).json({ message: "That email is already registered." });
    const savedPhoto = profilePhoto ? await saveProfilePhoto(profilePhoto) : technician.ProfilePhoto;
    const result = await pool.request().input("Id", sql.Int, technician.Id).input("Name", sql.NVarChar(100), name.trim()).input("PhoneNumber", sql.NVarChar(11), phoneNumber.trim()).input("Email", sql.NVarChar(255), email).input("Address", sql.NVarChar(255), address.trim()).input("ProfilePhoto", sql.NVarChar(255), savedPhoto || null).query(`
      UPDATE Technicians SET Name = @Name, PhoneNumber = @PhoneNumber, Email = @Email, Address = @Address, ProfilePhoto = @ProfilePhoto
      OUTPUT INSERTED.Id AS id, INSERTED.Name AS name, INSERTED.Specialty AS specialty, INSERTED.Status AS status,
        INSERTED.PhoneNumber AS phoneNumber, INSERTED.Email AS email, INSERTED.Address AS address, INSERTED.ProfilePhoto AS profilePhoto
      WHERE Id = @Id
    `);
    await pool.request().input("UserId", sql.Int, req.user.id).input("Name", sql.NVarChar(100), name.trim()).input("Email", sql.NVarChar(150), email).query("UPDATE Users SET FullName = @Name, Email = @Email WHERE Id = @UserId");
    await logAction(`Updated technician profile ${name}`, actorName(req), "Technicians", technician.Id);
    res.json(result.recordset[0]);
  } catch (error) {
    res.status(500).json({ message: error.message.includes("UNIQUE") ? "That email is already registered." : error.message });
  }
});

app.delete("/api/technicians/:id", requireUser, requireAdmin, async (req, res) => {
  try {
    const pool = await getPool();
    const technician = await pool.request().input("Id", sql.Int, Number(req.params.id)).query("SELECT Email FROM Technicians WHERE Id = @Id");
    if (!technician.recordset.length) return res.status(404).json({ message: "Technician not found." });
    await pool.request().input("Id", sql.Int, Number(req.params.id)).query("DELETE FROM Schedules WHERE TechnicianId = @Id; DELETE FROM Technicians WHERE Id = @Id; IF NOT EXISTS (SELECT 1 FROM Technicians) DBCC CHECKIDENT ('Technicians', RESEED, 0)");
    if (technician.recordset[0].Email) {
      await pool.request().input("Email", sql.NVarChar(255), technician.recordset[0].Email).query("DELETE FROM Users WHERE Role = 'technician' AND Email = @Email");
    }
    await logAction("Deleted a technician", actorName(req), "Technicians", req.params.id);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/bookings", requireUser, async (req, res) => {
  try {
    const pool = await getPool();
    const request = pool.request();
    const customerFilter = req.user.role === "customer" ? "WHERE LOWER(b.Email) = LOWER(@Email)" : "";
    if (req.user.role === "customer") request.input("Email", sql.NVarChar(150), req.user.email);
    const result = await request.query(`
      SELECT
        b.Id AS id,
        b.CustomerName AS customer,
        b.Phone AS phone,
        b.Email AS email,
        b.ServiceName AS service,
        b.Address AS address,
        CONVERT(varchar(10), b.PreferredDate, 23) AS preferredDate,
        b.PreferredTime AS preferredTime,
        b.TotalAmount AS totalAmount,
        b.Status AS status,
        t.Name AS technician,
        CONVERT(varchar(10), s.ScheduleDate, 23) AS scheduleDate,
        s.ScheduleTime AS scheduleTime
      FROM Bookings b
      LEFT JOIN Schedules s ON s.BookingId = b.Id
      LEFT JOIN Technicians t ON t.Id = s.TechnicianId
      ${customerFilter}
      ORDER BY b.Id DESC
    `);
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/bookings", requireUser, async (req, res) => {
  const { customer, phone, email, service, services = [], address, preferredDate, preferredTime } = req.body;
  const selectedServices = Array.isArray(services) && services.length ? services : String(service || "").split(",").map((item) => item.trim()).filter(Boolean);
  if (!customer || !selectedServices.length || !address || !preferredDate || !preferredTime) {
    return res.status(400).json({ message: "Missing required booking fields." });
  }
  if (phone && !isValidPhilippineMobile(phone)) {
    return res.status(400).json({ message: "Please enter a valid Philippine mobile number." });
  }
  if (isPastOrInvalidCalendarDate(preferredDate)) {
    return res.status(400).json({ message: "Preferred date cannot be in the past. Please choose today or a future date." });
  }

  try {
    const pool = await getPool();
    const pricedServices = await Promise.all(selectedServices.map(async (selected) => {
      const id = Number(selected?.id);
      const result = Number.isInteger(id) && id > 0
        ? await pool.request().input("Id", sql.Int, id).query("SELECT TOP 1 Id, Name, Type, Price FROM Services WHERE Id = @Id")
        : await pool.request().input("Name", sql.NVarChar(100), String(selected?.name || selected).trim()).query("SELECT TOP 1 Id, Name, Type, Price FROM Services WHERE Name = @Name");
      return result.recordset[0];
    }));
    if (pricedServices.some((item) => !item)) return res.status(400).json({ message: "One or more selected services are no longer available." });
    const serviceLabel = pricedServices.map((item) => `${item.Type || "Uncategorized"} - ${item.Name}`).join(", ");
    const serviceTotal = pricedServices.reduce((sum, item) => sum + Number(item.Price || 0), 0);
    const result = await pool
      .request()
      .input("CustomerName", sql.NVarChar(100), customer)
      .input("Phone", sql.NVarChar(50), phone || "")
      .input("Email", sql.NVarChar(150), email || "")
      .input("ServiceName", sql.NVarChar(500), serviceLabel)
      .input("TotalAmount", sql.Decimal(10, 2), serviceTotal)
      .input("Address", sql.NVarChar(255), address)
      .input("PreferredDate", sql.Date, preferredDate)
      .input("PreferredTime", sql.NVarChar(50), preferredTime || "")
      .query(`
        INSERT INTO Bookings (CustomerName, Phone, Email, ServiceName, TotalAmount, Address, PreferredDate, PreferredTime, Status)
        OUTPUT
          INSERTED.Id AS id,
          INSERTED.CustomerName AS customer,
          INSERTED.Phone AS phone,
          INSERTED.Email AS email,
          INSERTED.ServiceName AS service,
          INSERTED.TotalAmount AS totalAmount,
          INSERTED.Address AS address,
          CONVERT(varchar(10), INSERTED.PreferredDate, 23) AS preferredDate,
          INSERTED.PreferredTime AS preferredTime,
          INSERTED.Status AS status
        VALUES (@CustomerName, @Phone, @Email, @ServiceName, @TotalAmount, @Address, @PreferredDate, @PreferredTime, 'Pending')
      `);
    await logAction(`Created booking for ${customer}`, actorName(req), "Bookings", result.recordset[0].id);
    res.status(201).json(result.recordset[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put("/api/bookings/:id/status", requireUser, requireAdmin, async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ message: "Status is required." });

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("Id", sql.Int, Number(req.params.id))
      .input("Status", sql.NVarChar(50), status)
      .query(`
        UPDATE Bookings
        SET Status = @Status
        OUTPUT INSERTED.Id AS id, INSERTED.CustomerName AS customer, INSERTED.ServiceName AS service, INSERTED.Address AS address, INSERTED.Status AS status
        WHERE Id = @Id
      `);
    if (!result.recordset.length) return res.status(404).json({ message: "Booking not found." });
    await logAction(`Marked booking ${req.params.id} as ${status}`, actorName(req), "Bookings", req.params.id);
    res.json(result.recordset[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put("/api/bookings/:id/technician-status", requireUser, async (req, res) => {
  const { status } = req.body;
  if (req.user.role !== "technician" && req.user.role !== "admin") return res.status(403).json({ message: "Technician access required." });
  if (!status) return res.status(400).json({ message: "Status is required." });

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("Id", sql.Int, Number(req.params.id))
      .input("Status", sql.NVarChar(50), status)
      .query(`
        UPDATE Bookings
        SET Status = @Status
        OUTPUT INSERTED.Id AS id, INSERTED.CustomerName AS customer, INSERTED.ServiceName AS service, INSERTED.Address AS address, INSERTED.Status AS status
        WHERE Id = @Id
      `);
    if (!result.recordset.length) return res.status(404).json({ message: "Booking not found." });
    await logAction(`Updated job ${req.params.id} to ${status}`, actorName(req), "Bookings", req.params.id);
    res.json(result.recordset[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put("/api/bookings/:id/cancel", requireUser, async (req, res) => {
  if (req.user.role !== "customer") return res.status(403).json({ message: "Customer access required." });
  try {
    const pool = await getPool();
    const booking = await pool.request()
      .input("Id", sql.Int, Number(req.params.id))
      .input("Email", sql.NVarChar(150), req.user.email)
      .query("SELECT Id, Status FROM Bookings WHERE Id = @Id AND LOWER(Email) = LOWER(@Email)");
    if (!booking.recordset.length) return res.status(404).json({ message: "Booking not found." });
    if (["Completed", "Cancelled"].includes(booking.recordset[0].Status)) return res.status(400).json({ message: "This booking can no longer be cancelled." });
    await pool.request().input("Id", sql.Int, Number(req.params.id)).query("DELETE FROM Schedules WHERE BookingId = @Id; UPDATE Bookings SET Status = 'Cancelled' WHERE Id = @Id;");
    await logAction(`Cancelled booking ${req.params.id}`, actorName(req), "Bookings", req.params.id);
    res.json({ id: Number(req.params.id), status: "Cancelled" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete("/api/bookings/:id", requireUser, requireAdmin, async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().input("Id", sql.Int, Number(req.params.id)).query("DELETE FROM Schedules WHERE BookingId = @Id; DELETE FROM Bookings WHERE Id = @Id;");
    await logAction("Deleted a booking", actorName(req), "Bookings", req.params.id);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/schedules", requireUser, requireAdmin, async (req, res) => {
  const { bookingId, technicianId } = req.body;
  if (!bookingId || !technicianId) return res.status(400).json({ message: "Select a booking and technician." });

  try {
    const pool = await getPool();
    const bookingResult = await pool.request().input("BookingId", sql.Int, Number(bookingId)).query(`
      SELECT PreferredDate AS scheduleDate, PreferredTime AS scheduleTime, Status AS status
      FROM Bookings WHERE Id = @BookingId
    `);
    if (!bookingResult.recordset.length) return res.status(404).json({ message: "Booking not found." });
    const requested = bookingResult.recordset[0];
    if (!requested.scheduleDate || !requested.scheduleTime) return res.status(400).json({ message: "This booking has no preferred date and time." });
    if (requested.status !== "Approved") return res.status(400).json({ message: "Only approved bookings can be assigned. Use a separate schedule-edit flow to change an existing assignment." });
    const technicianResult = await pool.request()
      .input("TechnicianId", sql.Int, Number(technicianId))
      .query(`
        SELECT Id FROM Technicians WHERE Id = @TechnicianId AND Status = 'Active'
      `);
    if (!technicianResult.recordset.length) return res.status(400).json({ message: "Select an active technician." });
    const assignments = await pool.request()
      .input("TechnicianId", sql.Int, Number(technicianId))
      .input("ScheduleDate", sql.Date, requested.scheduleDate)
      .query(`
        SELECT s.BookingId, s.ScheduleTime
        FROM Schedules s
        WHERE s.TechnicianId = @TechnicianId
          AND s.ScheduleDate = @ScheduleDate
      `);
    if (assignments.recordset.some((assignment) => Number(assignment.BookingId) !== Number(bookingId) && timeSlotsOverlap(assignment.ScheduleTime, requested.scheduleTime))) {
      return res.status(409).json({ message: "This technician is already assigned during the customer's requested time slot." });
    }
    await pool.request()
      .input("BookingId", sql.Int, Number(bookingId))
      .input("TechnicianId", sql.Int, Number(technicianId))
      .input("ScheduleDate", sql.Date, requested.scheduleDate)
      .input("ScheduleTime", sql.NVarChar(50), requested.scheduleTime)
      .query(`
        DELETE FROM Schedules WHERE BookingId = @BookingId;
        INSERT INTO Schedules (BookingId, TechnicianId, ScheduleDate, ScheduleTime, Status)
        VALUES (@BookingId, @TechnicianId, @ScheduleDate, @ScheduleTime, 'Assigned');
        UPDATE Bookings SET Status = 'Scheduled' WHERE Id = @BookingId;
      `);
    await logAction(`Assigned technician ${technicianId} to booking ${bookingId}`, actorName(req), "Schedules", bookingId);
    res.status(201).json({ ok: true, scheduleDate: requested.scheduleDate, scheduleTime: requested.scheduleTime });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/products", async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        Id AS id,
        Name AS name,
        Type AS type,
        Brand AS brand,
        Price AS price,
        Stocks AS stocks,
        Horsepower AS horsepower,
        Image AS image
      FROM Products
      ORDER BY Id DESC
    `);

    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/services", async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        Id AS id,
        Name AS name,
        Type AS type,
        Price AS price,
        Inclusion AS inclusion,
        Exclusion AS exclusion,
        Image AS image
      FROM Services
      ORDER BY Type, Name
    `);

    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/services", requireUser, requireAdmin, async (req, res) => {
  const { name, type, price, inclusion = "", exclusion = "", image = "" } = req.body;

  const validationMessage = validateServicePayload({ name, type, price });
  if (validationMessage) return res.status(400).json({ message: validationMessage });

  try {
    const pool = await getPool();
    const existing = await pool.request()
      .input("Name", sql.NVarChar(100), name.trim())
      .input("Type", sql.NVarChar(100), type.trim())
      .query("SELECT TOP 1 Id FROM Services WHERE LOWER(Name) = LOWER(@Name) AND LOWER(Type) = LOWER(@Type)");
    if (existing.recordset.length) return res.status(409).json({ message: "This category already has a variant with that name." });

    const result = await pool
      .request()
      .input("Name", sql.NVarChar(100), name.trim())
      .input("Type", sql.NVarChar(100), type.trim())
      .input("Price", sql.Decimal(10, 2), Number(price))
      .input("Inclusion", sql.NVarChar(sql.MAX), String(inclusion || "").trim())
      .input("Exclusion", sql.NVarChar(sql.MAX), String(exclusion || "").trim())
      .input("Image", sql.NVarChar(sql.MAX), String(image || ""))
      .query(`
        INSERT INTO Services (Name, Type, Price, Inclusion, Exclusion, Image)
        OUTPUT
          INSERTED.Id AS id,
          INSERTED.Name AS name,
          INSERTED.Type AS type,
          INSERTED.Price AS price,
          INSERTED.Inclusion AS inclusion,
          INSERTED.Exclusion AS exclusion
          , INSERTED.Image AS image
        VALUES (@Name, @Type, @Price, @Inclusion, @Exclusion, @Image)
      `);

    await logAction(`Created service ${name}`, actorName(req), "Services", result.recordset[0].id);
    res.status(201).json(result.recordset[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put("/api/services/:id", requireUser, requireAdmin, async (req, res) => {
  const { name, type, price, inclusion = "", exclusion = "", image = "" } = req.body;

  const validationMessage = validateServicePayload({ name, type, price });
  if (validationMessage) return res.status(400).json({ message: validationMessage });

  try {
    const pool = await getPool();
    const duplicate = await pool
      .request()
      .input("Id", sql.Int, Number(req.params.id))
      .input("Name", sql.NVarChar(100), name.trim())
      .input("Type", sql.NVarChar(100), type.trim())
      .query("SELECT TOP 1 Id FROM Services WHERE LOWER(Name) = LOWER(@Name) AND LOWER(Type) = LOWER(@Type) AND Id <> @Id");
    if (duplicate.recordset.length) return res.status(409).json({ message: "This category already has a variant with that name." });

    const result = await pool
      .request()
      .input("Id", sql.Int, Number(req.params.id))
      .input("Name", sql.NVarChar(100), name.trim())
      .input("Type", sql.NVarChar(100), type.trim())
      .input("Price", sql.Decimal(10, 2), Number(price))
      .input("Inclusion", sql.NVarChar(sql.MAX), String(inclusion || "").trim())
      .input("Exclusion", sql.NVarChar(sql.MAX), String(exclusion || "").trim())
      .input("Image", sql.NVarChar(sql.MAX), String(image || ""))
      .query(`
        UPDATE Services
        SET
          Name = @Name,
          Type = @Type,
          Price = @Price,
          Inclusion = @Inclusion,
          Exclusion = @Exclusion,
          Image = @Image
        OUTPUT
          INSERTED.Id AS id,
          INSERTED.Name AS name,
          INSERTED.Type AS type,
          INSERTED.Price AS price,
          INSERTED.Inclusion AS inclusion,
          INSERTED.Exclusion AS exclusion,
          INSERTED.Image AS image
        WHERE Id = @Id
      `);

    if (!result.recordset.length) {
      return res.status(404).json({ message: "Service not found." });
    }

    await logAction(`Updated service ${name}`, actorName(req), "Services", req.params.id);
    res.json(result.recordset[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete("/api/services/:id", requireUser, requireAdmin, async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().input("Id", sql.Int, Number(req.params.id)).query("DELETE FROM Services WHERE Id = @Id");
    await logAction("Deleted a service", actorName(req), "Services", req.params.id);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/products", requireUser, requireAdmin, async (req, res) => {
  const { name, type, brand, price, stocks, horsepower, image } = req.body;

  if (!name || !type || !brand || price === undefined || stocks === undefined || !horsepower) {
    return res.status(400).json({ message: "Missing required product fields." });
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("Name", sql.NVarChar(100), name)
      .input("Type", sql.NVarChar(100), type)
      .input("Brand", sql.NVarChar(100), brand)
      .input("Price", sql.Decimal(10, 2), Number(price))
      .input("Stocks", sql.Int, Number(stocks))
      .input("Horsepower", sql.NVarChar(50), horsepower)
      .input("Image", sql.NVarChar(sql.MAX), image || null)
      .query(`
        INSERT INTO Products (Name, Type, Brand, Price, Stocks, Horsepower, Image)
        OUTPUT
          INSERTED.Id AS id,
          INSERTED.Name AS name,
          INSERTED.Type AS type,
          INSERTED.Brand AS brand,
          INSERTED.Price AS price,
          INSERTED.Stocks AS stocks,
          INSERTED.Horsepower AS horsepower,
          INSERTED.Image AS image
        VALUES (@Name, @Type, @Brand, @Price, @Stocks, @Horsepower, @Image)
      `);

    await logAction(`Created product ${name}`, actorName(req), "Products", result.recordset[0].id);
    res.status(201).json(result.recordset[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put("/api/products/:id", requireUser, requireAdmin, async (req, res) => {
  const { name, type, brand, price, stocks, horsepower, image } = req.body;

  if (!name || !type || !brand || price === undefined || stocks === undefined || !horsepower) {
    return res.status(400).json({ message: "Missing required product fields." });
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("Id", sql.Int, Number(req.params.id))
      .input("Name", sql.NVarChar(100), name)
      .input("Type", sql.NVarChar(100), type)
      .input("Brand", sql.NVarChar(100), brand)
      .input("Price", sql.Decimal(10, 2), Number(price))
      .input("Stocks", sql.Int, Number(stocks))
      .input("Horsepower", sql.NVarChar(50), horsepower)
      .input("Image", sql.NVarChar(sql.MAX), image || null)
      .query(`
        UPDATE Products
        SET
          Name = @Name,
          Type = @Type,
          Brand = @Brand,
          Price = @Price,
          Stocks = @Stocks,
          Horsepower = @Horsepower,
          Image = @Image
        OUTPUT
          INSERTED.Id AS id,
          INSERTED.Name AS name,
          INSERTED.Type AS type,
          INSERTED.Brand AS brand,
          INSERTED.Price AS price,
          INSERTED.Stocks AS stocks,
          INSERTED.Horsepower AS horsepower,
          INSERTED.Image AS image
        WHERE Id = @Id
      `);

    if (!result.recordset.length) {
      return res.status(404).json({ message: "Product not found." });
    }

    await logAction(`Updated product ${name}`, actorName(req), "Products", req.params.id);
    res.json(result.recordset[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete("/api/products/:id", requireUser, requireAdmin, async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().input("Id", sql.Int, Number(req.params.id)).query("DELETE FROM Products WHERE Id = @Id");
    await logAction("Deleted a product", actorName(req), "Products", req.params.id);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

ensureSchema()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database schema:", error.message);
    process.exit(1);
  });
