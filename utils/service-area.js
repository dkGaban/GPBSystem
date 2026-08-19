const CITY_ALIASES = new Map([
  ["san fernando", "San Fernando"], ["naga", "Naga"], ["minglanilla", "Minglanilla"],
  ["talisay", "Talisay City"], ["talisay city", "Talisay City"], ["cebu", "Cebu City"],
  ["cebu city", "Cebu City"], ["mandaue", "Mandaue City"], ["mandaue city", "Mandaue City"],
  ["consolacion", "Consolacion"], ["liloan", "Liloan"], ["compostela", "Compostela"],
  ["danao", "Danao City"], ["danao city", "Danao City"]
]);

function normalizeServiceAreaCity(city) {
  return CITY_ALIASES.get(String(city || "").trim().toLowerCase()) || "";
}

function validateServiceArea({ city, latitude, longitude, requireCoordinates = false } = {}) {
  const normalizedCity = normalizeServiceAreaCity(city);
  if (!normalizedCity) return "We currently only operate within the Metro Cebu area (San Fernando to Danao City). This location is outside our service area.";
  const hasCoordinates = latitude !== undefined && latitude !== null && longitude !== undefined && longitude !== null && latitude !== "" && longitude !== "";
  if (requireCoordinates && !hasCoordinates) return "Please drop a pin on the map so we can confirm the service location.";
  if (hasCoordinates && (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude)) || Number(latitude) < -90 || Number(latitude) > 90 || Number(longitude) < -180 || Number(longitude) > 180)) return "Please choose a valid location on the map.";
  return "";
}

module.exports = { validateServiceArea };
