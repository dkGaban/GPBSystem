const path = require("path");
const fs = require("fs/promises");
const crypto = require("crypto");

function formatAddress(parts = {}) {
  const values = [parts.houseNumber, parts.street, parts.barangay ? `Barangay ${String(parts.barangay).replace(/^barangay\s+/i, "")}` : "", parts.city, parts.province, parts.zipCode];
  return values.map((value) => String(value || "").trim()).filter(Boolean).join(", ");
}

function addressFromBody(body = {}) {
  const structured = { houseNumber: body.houseNumber || body.addressHouseNumber, street: body.street || body.addressStreet, barangay: body.barangay || body.addressBarangay, city: body.city || body.addressCity, province: body.province || body.addressProvince, zipCode: body.zipCode || body.addressZipCode };
  const hasStructuredAddress = Object.values(structured).some((value) => String(value || "").trim());
  return { ...structured, address: hasStructuredAddress ? formatAddress(structured) : String(body.address || "").trim() };
}

async function saveProfilePhoto(photo) {
  if (!photo) return "";
  const name = String(photo.name || "");
  const extension = path.extname(name).toLowerCase();
  if (![".jpg", ".jpeg", ".png"].includes(extension)) throw new Error("Profile photo must be a JPG, JPEG, or PNG file.");
  const match = String(photo.data || "").match(/^data:image\/(jpeg|png);base64,(.+)$/);
  if (!match) throw new Error("Profile photo data is invalid.");
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) throw new Error("Profile photo must be smaller than 5 MB.");
  const directory = path.join(__dirname, "..", "uploads", "technicians");
  await fs.mkdir(directory, { recursive: true });
  const filename = `technician-${Date.now()}-${crypto.randomBytes(6).toString("hex")}${extension}`;
  await fs.writeFile(path.join(directory, filename), buffer);
  return `uploads/technicians/${filename}`;
}

module.exports = { addressFromBody, formatAddress, saveProfilePhoto };
