import { describe, expect, it } from "vitest";
import business from "../utils/business.js";

const { isValidPhilippineMobile, isStrongPassword, isPastOrInvalidCalendarDate, slotToMinuteRange, timeSlotsOverlap, validateTechnicianPayload, validateServicePayload } = business;

describe("business validation", () => {
  it("validates Philippine mobile numbers", () => {
    expect(isValidPhilippineMobile("09171234567")).toBe(true);
    expect(isValidPhilippineMobile("08171234567")).toBe(false);
  });
  it("requires a strong password", () => {
    expect(isStrongPassword("GoodPass1")).toBe(true);
    expect(isStrongPassword("password")).toBe(false);
  });
  it("rejects invalid and past calendar dates", () => {
    expect(isPastOrInvalidCalendarDate("2024-02-30")).toBe(true);
    expect(isPastOrInvalidCalendarDate("2000-01-01")).toBe(true);
    const future = new Date(); future.setDate(future.getDate() + 2);
    expect(isPastOrInvalidCalendarDate(future.toISOString().slice(0, 10))).toBe(false);
  });
  it("converts time slots and detects overlap", () => {
    expect(slotToMinuteRange("9:00 AM - 10:30 AM")).toEqual([540, 630]);
    expect(timeSlotsOverlap("9:00 AM - 10:30 AM", "10:00 AM - 11:00 AM")).toBe(true);
    expect(timeSlotsOverlap("9:00 AM - 10:00 AM", "10:00 AM - 11:00 AM")).toBe(false);
  });
  it("validates technician and service payloads", () => {
    expect(validateTechnicianPayload({ name: "A", specialty: "HVAC", phoneNumber: "09171234567", email: "a@example.com", address: "Address" })).toBe("");
    expect(validateTechnicianPayload({ name: "", specialty: "HVAC", phoneNumber: "09171234567", email: "a@example.com", address: "Address" })).not.toBe("");
    expect(validateServicePayload({ name: "Basic", type: "Repair", price: 100 })).toBe("");
    expect(validateServicePayload({ name: "Basic", type: "Repair", price: -1 })).toBe("Price cannot be negative.");
  });
});
