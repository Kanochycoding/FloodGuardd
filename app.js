const form = document.getElementById("risk-form");
const input = document.getElementById("location-input");
const locationSuggestions = document.getElementById("location-suggestions");
const currentLocationButton = document.getElementById("current-location-btn");
const geoStatus = document.getElementById("geo-status");
const mapContainer = document.getElementById("ghana-map");
const hotspotList = document.getElementById("hotspot-list");
const hotspotStatus = document.getElementById("hotspot-status");
const refreshHotspotsButton = document.getElementById("refresh-hotspots-btn");
const viewMoreHotspotsButton = document.getElementById("view-more-hotspots-btn");
const floodReportForm = document.getElementById("flood-report-form");
const reportLocationInput = document.getElementById("report-location");
const reportMessageInput = document.getElementById("report-message");
const reportStatus = document.getElementById("report-status");
const reportList = document.getElementById("report-list");
const viewMoreReportsButton = document.getElementById("view-more-reports-btn");
const resultCard = document.getElementById("result");
const alertLevel = document.getElementById("alert-level");
const alertTitle = document.getElementById("alert-title");
const alertMessage = document.getElementById("alert-message");
const metrics = document.getElementById("metrics");

const GHANA_BOUNDS = { minLat: 4.4, maxLat: 11.5, minLon: -3.4, maxLon: 1.4 };
const HISTORICAL_DAYS = 14;
const FLOOD_REPORT_STORAGE_KEY = "ghanaFloodReports";
const REPORTS_VISIBLE_COUNT = 3;
const HOTSPOTS_VISIBLE_COUNT = 8;
const MAX_STORED_REPORTS = 50;
const MAX_LOCATION_QUERY_LENGTH = 100;
const MAX_REPORT_LOCATION_LENGTH = 100;
const MAX_REPORT_MESSAGE_LENGTH = 500;
const ML_MODEL_BLEND = 0.65;
const NEWS_SIGNAL_REFRESH_MS = 10 * 60 * 1000;
const HOTSPOT_AUTO_REFRESH_MS = 10 * 60 * 1000;
const FLOOD_NOTIFICATION_SETTINGS_KEY = "floodGuardNotificationSettings";
const FLOOD_NOTIFICATION_STATE_KEY = "floodGuardNotificationState";
const FLOOD_NOTIFICATION_HISTORY_KEY = "floodGuardNotificationHistory";
const FLOOD_NOTIFICATION_COOLDOWN_MS = 20 * 60 * 1000;
const FLOOD_NOTIFICATION_HISTORY_LIMIT = 30;
const FLOOD_NOTIFICATION_SW_URL = "./notification-sw.js";
const GPS_PRECISE_ACCURACY_METERS = 3000;
const GPS_MAX_ACCEPTABLE_ACCURACY_METERS = 10000;
const NEWS_SIGNAL_FEEDS = [
  "https://news.google.com/rss/search?q=ghana+flood+OR+flooding+ghana+when:7d&hl=en-GB&gl=GH&ceid=GH:en",
  "https://news.google.com/rss/search?q=site:myjoyonline.com+flood+ghana+when:7d&hl=en-GB&gl=GH&ceid=GH:en",
  "https://news.google.com/rss/search?q=site:3news.com+flood+ghana+when:7d&hl=en-GB&gl=GH&ceid=GH:en",
  "https://news.google.com/rss/search?q=site:citinewsroom.com+flood+ghana+when:7d&hl=en-GB&gl=GH&ceid=GH:en",
  "https://news.google.com/rss/search?q=site:yen.com.gh+flood+ghana+when:7d&hl=en-GB&gl=GH&ceid=GH:en",
  // Best-effort social signal mirror for X-like chatter (may not always resolve).
  "https://nitter.net/search/rss?f=tweets&q=ghana%20flood",
];

const GHANA_LOCATION_ALIASES = {
  circle: { name: "Kwame Nkrumah Circle", latitude: 5.5706, longitude: -0.2095 },
  "accra circle": { name: "Kwame Nkrumah Circle", latitude: 5.5706, longitude: -0.2095 },
  "kwame nkrumah circle": {
    name: "Kwame Nkrumah Circle",
    latitude: 5.5706,
    longitude: -0.2095,
  },
  aboabo: { name: "Aboabo, Kumasi", latitude: 6.7035, longitude: -1.6159 },
  "aboabo kumasi": { name: "Aboabo, Kumasi", latitude: 6.7035, longitude: -1.6159 },
  suame: { name: "Suame, Kumasi", latitude: 6.7295, longitude: -1.6228 },
  adabraka: { name: "Adabraka, Accra", latitude: 5.5613, longitude: -0.2074 },
  scc: { name: "SCC, Winneba Road, Accra", latitude: 5.5619, longitude: -0.2199 },
  "scc winneba road": { name: "SCC, Winneba Road, Accra", latitude: 5.5619, longitude: -0.2199 },
  "winneba road": { name: "SCC, Winneba Road, Accra", latitude: 5.5619, longitude: -0.2199 },
  "cape coast": { name: "Cape Coast", latitude: 5.1053, longitude: -1.2466 },
  moree: { name: "Moree", latitude: 5.3841, longitude: -1.4322 },
  samreboi: { name: "Samreboi", latitude: 5.6942, longitude: -2.1791 },
  asankragwa: { name: "Asankragwa", latitude: 5.9284, longitude: -2.4747 },
  tetegu: { name: "Tetegu", latitude: 5.5897, longitude: -0.3051 },
  weija: { name: "Weija", latitude: 5.5837, longitude: -0.3329 },
  alajo: { name: "Alajo, Accra", latitude: 5.5718, longitude: -0.2304 },
  mallam: { name: "Mallam Junction, Accra", latitude: 5.5605, longitude: -0.2857 },
  dansoman: { name: "Dansoman, Accra", latitude: 5.5486, longitude: -0.2657 },
  lashibi: { name: "Lashibi, Tema West", latitude: 5.6761, longitude: -0.0632 },
  klagon: { name: "Klagon, Tema West", latitude: 5.6906, longitude: -0.0617 },
};

const GHANA_FLOOD_HOTSPOTS = [
  { name: "Accra - Odaw Basin", latitude: 5.6037, longitude: -0.187, exposure: 3 },
  { name: "SCC - Winneba Road (Accra)", latitude: 5.5619, longitude: -0.2199, exposure: 3 },
  { name: "Cape Coast", latitude: 5.1053, longitude: -1.2466, exposure: 3 },
  { name: "Moree (Central Region)", latitude: 5.3841, longitude: -1.4322, exposure: 3 },
  { name: "Samreboi", latitude: 5.6942, longitude: -2.1791, exposure: 3 },
  { name: "Asankragwa", latitude: 5.9284, longitude: -2.4747, exposure: 3 },
  { name: "Weija - Tetegu Downstream", latitude: 5.5868, longitude: -0.3188, exposure: 3 },
  { name: "Alajo (Accra)", latitude: 5.5718, longitude: -0.2304, exposure: 3 },
  { name: "Mallam (Accra)", latitude: 5.5605, longitude: -0.2857, exposure: 3 },
  { name: "Dansoman (Accra)", latitude: 5.5486, longitude: -0.2657, exposure: 3 },
  { name: "Tema West - Lashibi/Klagon", latitude: 5.6833, longitude: -0.0623, exposure: 3 },
  { name: "Keta", latitude: 5.9179, longitude: 0.9879, exposure: 3 },
  { name: "Kasoa", latitude: 5.5342, longitude: -0.4168, exposure: 2 },
  { name: "Kumasi - Aboabo", latitude: 6.6885, longitude: -1.6244, exposure: 2 },
  { name: "Sekondi-Takoradi", latitude: 4.934, longitude: -1.7137, exposure: 2 },
  { name: "Ho", latitude: 6.6111, longitude: 0.4703, exposure: 2 },
  { name: "Tamale", latitude: 9.4034, longitude: -0.8424, exposure: 1 },
  { name: "Wa", latitude: 10.0601, longitude: -2.5099, exposure: 1 },
];

const GHANA_TOWNS_AND_CITIES = [
  "Accra",
  "Tema",
  "Kasoa",
  "Madina",
  "Adenta",
  "Ashaiman",
  "Teshie",
  "Nungua",
  "Koforidua",
  "Nkawkaw",
  "Begoro",
  "Akim Oda",
  "Kumasi",
  "Obuasi",
  "Mampong",
  "Ejisu",
  "Konongo",
  "Asokore Mampong",
  "Tamale",
  "Yendi",
  "Savelugu",
  "Bolgatanga",
  "Navrongo",
  "Bawku",
  "Wa",
  "Lawra",
  "Sunyani",
  "Berekum",
  "Techiman",
  "Goaso",
  "Asankragwa",
  "Samreboi",
  "Cape Coast",
  "Elmina",
  "Moree",
  "Mankessim",
  "Winneba",
  "Tetegu",
  "Weija",
  "Alajo",
  "Mallam",
  "Dansoman",
  "Lashibi",
  "Klagon",
  "Takoradi",
  "Sekondi",
  "Tarkwa",
  "Axim",
  "Ho",
  "Keta",
  "Aflao",
  "Hohoe",
  "Dambai",
];

let ghanaMap = null;
let selectedMarker = null;
let hotspotLayer = null;
let visibleReportCount = REPORTS_VISIBLE_COUNT;
let visibleHotspotCount = HOTSPOTS_VISIBLE_COUNT;
let currentFloodReports = [];
let lastHotspots = [];
let suggestionDebounceTimer = null;
const suggestionCache = new Map();
let isHotspotRefreshing = false;
let newsRiskSignal = {
  score: 0,
  level: "Normal",
  headlineCount: 0,
  sourceCount: 0,
  locationScores: {},
  lastUpdatedAt: null,
};

initializeLocationSuggestions();
input.addEventListener("input", handleLocationInputChange);
initializeNewsRiskSignal();
ensureFloodNotificationServiceWorker().catch(() => {});
window.setInterval(() => {
  refreshNewsRiskSignal().catch(() => {});
}, NEWS_SIGNAL_REFRESH_MS);
window.setInterval(() => {
  triggerHotspotRefresh().catch(() => {});
}, HOTSPOT_AUTO_REFRESH_MS);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const location = input.value.trim();
  if (!location) return;
  if (location.length > MAX_LOCATION_QUERY_LENGTH) {
    showError(`Location is too long. Use ${MAX_LOCATION_QUERY_LENGTH} characters or less.`);
    return;
  }

  setLoadingState(true);
  geoStatus.textContent = "";

  try {
    const place = await getCoordinates(location);
    const riskInputs = await getRiskInputs(place.latitude, place.longitude);
    const risk = evaluateLocationRisk(place, riskInputs);
    renderResult(place, riskInputs, risk);
  } catch (error) {
    showError(error instanceof Error ? error.message : "Request failed.");
  } finally {
    setLoadingState(false);
  }
});

currentLocationButton.addEventListener("click", async () => {
  if (!navigator.geolocation) {
    geoStatus.textContent = "Geolocation is not supported on this browser.";
    return;
  }

  setLoadingState(true);
  geoStatus.textContent = "Reading your current location...";
  try {
    const coords = await getBestAvailableCoordinates();
    if (!isWithinGhana(coords.latitude, coords.longitude)) {
      throw new Error(
        coords.source === "ip"
          ? "Network location looks outside Ghana. Enable device GPS/Precise Location and try again."
          : "Detected location is outside Ghana coverage.",
      );
    }
    const place = await resolvePlaceFromCoordinates(coords.latitude, coords.longitude);
    const isApproximate =
      coords.source === "ip" ||
      (coords.source === "gps" &&
        Number.isFinite(coords.accuracy) &&
        coords.accuracy > GPS_PRECISE_ACCURACY_METERS);
    const displayPlace = isApproximate
      ? { ...place, name: "Approximate Area" }
      : place;
    input.value = `${displayPlace.name}, ${displayPlace.country}`;

    const riskInputs = await getRiskInputs(displayPlace.latitude, displayPlace.longitude);
    const risk = evaluateLocationRisk(displayPlace, riskInputs);
    renderResult(displayPlace, riskInputs, risk);

    if (coords.source === "ip") {
      geoStatus.textContent =
        "Using approximate network location. For exact location, enable GPS and Precise Location in browser settings.";
    } else if (Number.isFinite(coords.accuracy)) {
      const roundedAccuracy = Math.round(coords.accuracy);
      geoStatus.textContent =
        roundedAccuracy > GPS_PRECISE_ACCURACY_METERS
          ? `Using approximate GPS fix (~${roundedAccuracy}m accuracy). Move outdoors and retry for better precision.`
          : `Using your current GPS location (~${roundedAccuracy}m accuracy).`;
    } else {
      geoStatus.textContent = "Using your current GPS location in Ghana.";
    }
  } catch (error) {
    showError(error instanceof Error ? error.message : "Location request failed.");
    geoStatus.textContent = "Could not use current location.";
  } finally {
    setLoadingState(false);
  }
});

refreshHotspotsButton.addEventListener("click", async () => {
  await triggerHotspotRefresh();
});

viewMoreHotspotsButton?.addEventListener("click", () => {
  visibleHotspotCount += HOTSPOTS_VISIBLE_COUNT;
  renderHotspotList(lastHotspots);
});

hotspotList.addEventListener("click", (event) => {
  const trigger = event.target.closest("[data-lat][data-lon][data-name]");
  if (!trigger) return;
  const latitude = Number(trigger.getAttribute("data-lat"));
  const longitude = Number(trigger.getAttribute("data-lon"));
  const name = trigger.getAttribute("data-name");
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !name) return;
  updateMap(latitude, longitude, name);
});

if (floodReportForm && reportLocationInput && reportMessageInput && reportStatus) {
  floodReportForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const location = reportLocationInput.value.trim();
    const message = reportMessageInput.value.trim();
    if (!location || !message) {
      reportStatus.textContent = "Please provide both location and flood details.";
      return;
    }
    if (location.length > MAX_REPORT_LOCATION_LENGTH) {
      reportStatus.textContent = `Location is too long (max ${MAX_REPORT_LOCATION_LENGTH} characters).`;
      return;
    }
    if (message.length > MAX_REPORT_MESSAGE_LENGTH) {
      reportStatus.textContent = `Flood details are too long (max ${MAX_REPORT_MESSAGE_LENGTH} characters).`;
      return;
    }

    const reports = loadFloodReports();
    reports.unshift({
      id: Date.now(),
      location,
      message,
      createdAt: new Date().toISOString(),
    });
    const limited = reports.slice(0, MAX_STORED_REPORTS);
    saveFloodReports(limited);
    visibleReportCount = REPORTS_VISIBLE_COUNT;
    renderFloodReports(limited);
    reportMessageInput.value = "";
    reportStatus.textContent = "Flood report saved successfully.";
  });
}

if (viewMoreReportsButton) {
  viewMoreReportsButton.addEventListener("click", () => {
    visibleReportCount += REPORTS_VISIBLE_COUNT;
    renderFloodReports(currentFloodReports);
  });
}

function setLoadingState(isLoading) {
  const submitButton = form.querySelector("button[type='submit']");
  submitButton.disabled = isLoading;
  currentLocationButton.disabled = isLoading;
  submitButton.textContent = isLoading ? "Checking..." : "Check Risk";
  currentLocationButton.textContent = isLoading ? "Locating..." : "Use Current Location";
}

async function getCoordinates(query) {
  const alias = getAliasCoordinates(query);
  if (alias) return alias;
  const hotspot = getHotspotCoordinates(query);
  if (hotspot) return hotspot;

  const normalized = query.toLowerCase().includes("ghana") ? query : `${query}, Ghana`;
  const providers = [geocodeByOpenMeteo, geocodeByNominatim];
  for (const provider of providers) {
    const result = await provider(normalized).catch(() => null);
    if (!result) continue;
    if (!isWithinGhana(result.latitude, result.longitude)) continue;
    return result;
  }
  throw new Error("Location not found in Ghana. Try another city or landmark.");
}

function initializeLocationSuggestions() {
  renderLocationSuggestionOptions(buildLocalSuggestionSeed());
}

function buildLocalSuggestionSeed() {
  const basePlaces = [
    ...GHANA_TOWNS_AND_CITIES,
    ...GHANA_FLOOD_HOTSPOTS.map((item) => item.name),
    ...Object.values(GHANA_LOCATION_ALIASES).map((item) => item.name),
  ];
  return dedupeSuggestions(basePlaces).slice(0, 24);
}

function handleLocationInputChange() {
  if (!locationSuggestions) return;
  if (suggestionDebounceTimer) {
    window.clearTimeout(suggestionDebounceTimer);
  }
  const query = input.value.trim();
  suggestionDebounceTimer = window.setTimeout(() => {
    updateLocationSuggestions(query).catch(() => {});
  }, 220);
}

async function updateLocationSuggestions(query) {
  const localMatches = findLocalSuggestions(query);
  if (query.length < 2) {
    renderLocationSuggestionOptions(localMatches);
    return;
  }

  const cacheKey = normalizePlaceKey(query);
  if (suggestionCache.has(cacheKey)) {
    const cached = suggestionCache.get(cacheKey) || [];
    renderLocationSuggestionOptions(dedupeSuggestions([...localMatches, ...cached]).slice(0, 12));
    return;
  }

  const remoteSuggestions = await fetchRemoteLocationSuggestions(query);
  suggestionCache.set(cacheKey, remoteSuggestions);
  renderLocationSuggestionOptions(
    dedupeSuggestions([...localMatches, ...remoteSuggestions]).slice(0, 12),
  );
}

function findLocalSuggestions(query) {
  const normalizedQuery = normalizePlaceKey(query);
  const seed = buildLocalSuggestionSeed();
  if (!normalizedQuery) return seed;
  return seed.filter((item) => normalizePlaceKey(item).includes(normalizedQuery));
}

function renderLocationSuggestionOptions(options) {
  if (!locationSuggestions) return;
  locationSuggestions.innerHTML = "";
  options.forEach((optionValue) => {
    const option = document.createElement("option");
    option.value = optionValue;
    locationSuggestions.appendChild(option);
  });
}

async function fetchRemoteLocationSuggestions(query) {
  try {
    const [openMeteoResults, nominatimResults] = await Promise.all([
      fetchRemoteSuggestionsOpenMeteo(query),
      fetchRemoteSuggestionsNominatim(query),
    ]);
    return dedupeSuggestions([...openMeteoResults, ...nominatimResults]);
  } catch (_error) {
    return [];
  }
}

async function fetchRemoteSuggestionsOpenMeteo(query) {
  const url =
    "https://geocoding-api.open-meteo.com/v1/search?count=15&countryCode=GH&name=" +
    encodeURIComponent(query);
  const response = await fetch(url);
  if (!response.ok) return [];
  const data = await response.json();
  if (!data.results || !Array.isArray(data.results)) return [];
  return data.results
    .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
    .filter((item) => isWithinGhana(item.latitude, item.longitude))
    .map((item) => {
      const district = item.admin1 || item.admin2 || "";
      return district ? `${item.name}, ${district}` : item.name;
    });
}

async function fetchRemoteSuggestionsNominatim(query) {
  const url =
    "https://nominatim.openstreetmap.org/search?format=json&limit=12&countrycodes=gh&q=" +
    encodeURIComponent(query);
  const response = await fetch(url);
  if (!response.ok) return [];
  const data = await response.json();
  if (!Array.isArray(data)) return [];
  return data
    .map((item) => ({
      lat: Number(item.lat),
      lon: Number(item.lon),
      name: item.display_name || "",
    }))
    .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lon))
    .filter((item) => isWithinGhana(item.lat, item.lon))
    .map((item) => {
      const parts = item.name.split(",").map((value) => value.trim()).filter(Boolean);
      return parts.slice(0, 2).join(", ");
    });
}

function dedupeSuggestions(items) {
  const unique = new Map();
  items.forEach((item) => {
    const cleaned = String(item || "").trim();
    if (!cleaned) return;
    const key = normalizePlaceKey(cleaned);
    if (!unique.has(key)) unique.set(key, cleaned);
  });
  return Array.from(unique.values());
}

function getHotspotCoordinates(query) {
  const queryKey = normalizePlaceKey(query);
  if (!queryKey) return null;

  const directMatch = GHANA_FLOOD_HOTSPOTS.find((area) => {
    const areaKey = normalizePlaceKey(area.name);
    const areaWithoutRegionKey = normalizePlaceKey(area.name.replace("-", " "));
    return (
      areaKey === queryKey ||
      areaWithoutRegionKey === queryKey ||
      areaKey.includes(queryKey) ||
      queryKey.includes(areaKey) ||
      areaWithoutRegionKey.includes(queryKey) ||
      queryKey.includes(areaWithoutRegionKey)
    );
  });

  if (!directMatch) return null;
  return {
    name: directMatch.name,
    country: "Ghana",
    latitude: directMatch.latitude,
    longitude: directMatch.longitude,
  };
}

function getAliasCoordinates(query) {
  const key = normalizePlaceKey(query);
  let alias = GHANA_LOCATION_ALIASES[key];
  if (!alias) {
    const matchedKey = Object.keys(GHANA_LOCATION_ALIASES).find((candidate) =>
      key.includes(candidate),
    );
    alias = matchedKey ? GHANA_LOCATION_ALIASES[matchedKey] : null;
  }
  if (!alias) return null;
  return {
    name: alias.name,
    country: "Ghana",
    latitude: alias.latitude,
    longitude: alias.longitude,
  };
}

async function geocodeByOpenMeteo(query) {
  const url =
    "https://geocoding-api.open-meteo.com/v1/search?count=1&countryCode=GH&name=" +
    encodeURIComponent(query);
  const response = await fetchWithHelpfulErrors(url, "geocoding");
  if (!response.ok) return null;
  const data = await response.json();
  if (!data.results || !data.results.length) return null;
  const first = data.results[0];
  return {
    name: first.name || query,
    country: first.country || "Ghana",
    latitude: first.latitude,
    longitude: first.longitude,
  };
}

async function geocodeByNominatim(query) {
  const url =
    "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=gh&q=" +
    encodeURIComponent(query);
  const response = await fetchWithHelpfulErrors(url, "nominatim-geocoding");
  if (!response.ok) return null;
  const data = await response.json();
  if (!Array.isArray(data) || !data.length) return null;
  const first = data[0];
  return {
    name: (first.display_name || query).split(",")[0].trim(),
    country: "Ghana",
    latitude: Number(first.lat),
    longitude: Number(first.lon),
  };
}

async function reverseGeocodeByNominatim(latitude, longitude) {
  const url =
    "https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=" +
    encodeURIComponent(latitude) +
    "&lon=" +
    encodeURIComponent(longitude) +
    "&zoom=12";
  const response = await fetchWithHelpfulErrors(url, "nominatim-reverse-geocoding");
  if (!response.ok) return null;
  const data = await response.json();
  if (!data) return null;
  const name =
    data.name ||
    (data.address &&
      (data.address.city ||
        data.address.town ||
        data.address.village ||
        data.address.suburb ||
        data.address.county));
  if (!name) return null;
  return {
    name,
    country: "Ghana",
    latitude,
    longitude,
  };
}

async function resolvePlaceFromCoordinates(latitude, longitude) {
  const fallbackPlace = {
    name: "Current Location",
    country: "Ghana",
    latitude,
    longitude,
  };
  try {
    const url =
      "https://geocoding-api.open-meteo.com/v1/reverse?count=1&latitude=" +
      latitude +
      "&longitude=" +
      longitude;
    const response = await fetchWithHelpfulErrors(url, "reverse-geocoding");
    if (response.ok) {
      const data = await response.json();
      if (data.results && data.results.length) {
        const first = data.results[0];
        return {
          name: first.name || fallbackPlace.name,
          country: first.country || "Ghana",
          latitude,
          longitude,
        };
      }
    }

    const nominatimPlace = await reverseGeocodeByNominatim(latitude, longitude).catch(
      () => null,
    );
    return nominatimPlace || fallbackPlace;
  } catch (_error) {
    const nominatimPlace = await reverseGeocodeByNominatim(latitude, longitude).catch(
      () => null,
    );
    return nominatimPlace || fallbackPlace;
  }
}

async function getWeather(latitude, longitude) {
  const url =
    "https://api.open-meteo.com/v1/forecast?latitude=" +
    latitude +
    "&longitude=" +
    longitude +
    "&forecast_days=3&current_weather=true&hourly=precipitation,soil_moisture_0_to_1cm&daily=precipitation_sum,weathercode&timezone=auto";
  const response = await fetchWithHelpfulErrors(url, "weather");
  if (!response.ok) throw new Error("Could not reach weather service.");
  const data = await response.json();
  if (!data.hourly || !data.daily) throw new Error("Weather data incomplete.");

  const hourlyRain = data.hourly.precipitation || [];
  const soilMoisture = data.hourly.soil_moisture_0_to_1cm || [];
  const dailyRain = data.daily.precipitation_sum || [];
  const dailyWeatherCodes = data.daily.weathercode || data.daily.weather_code || [];
  const currentWeatherCode =
    (data.current_weather && data.current_weather.weathercode) ||
    (data.current && data.current.weather_code);
  const weatherCode = Number.isFinite(currentWeatherCode)
    ? currentWeatherCode
    : dailyWeatherCodes[0];
  const forecastRainTotal = sumValues(dailyRain);
  const rainfallLikely = dailyRain.some((amount) => amount >= 1) || maxValue(hourlyRain) >= 0.5;
  return {
    maxHourlyRain: maxValue(hourlyRain),
    maxDailyRain: maxValue(dailyRain),
    avgSoilMoisture: averageValue(soilMoisture),
    forecastRainTotal,
    weatherCondition: describeWeatherCondition(weatherCode, maxValue(dailyRain)),
    rainfallLikely,
  };
}

async function getHistoricalContext(latitude, longitude, days) {
  const endDate = formatDate(dateDaysAgo(1));
  const startDate = formatDate(dateDaysAgo(days));
  const url =
    "https://archive-api.open-meteo.com/v1/archive?latitude=" +
    latitude +
    "&longitude=" +
    longitude +
    "&start_date=" +
    startDate +
    "&end_date=" +
    endDate +
    "&daily=precipitation_sum&hourly=soil_moisture_0_to_1cm&timezone=auto";
  const response = await fetchWithHelpfulErrors(url, "historical-weather");
  if (!response.ok) throw new Error("Could not reach historical weather service.");
  const data = await response.json();
  const historicalDailyRain = (data.daily && data.daily.precipitation_sum) || [];
  const historicalSoilMoisture =
    (data.hourly && data.hourly.soil_moisture_0_to_1cm) || [];
  return {
    pastRainTotal: sumValues(historicalDailyRain),
    historicalAvgSoilMoisture: averageValue(historicalSoilMoisture),
  };
}

async function getRiskInputs(latitude, longitude) {
  const [weather, historicalResult] = await Promise.all([
    getWeather(latitude, longitude),
    getHistoricalContext(latitude, longitude, HISTORICAL_DAYS).catch(() => null),
  ]);
  return {
    ...weather,
    pastRainTotal: historicalResult ? historicalResult.pastRainTotal : 0,
    historicalAvgSoilMoisture: historicalResult
      ? historicalResult.historicalAvgSoilMoisture
      : 0,
    historicalDays: HISTORICAL_DAYS,
    historicalAvailable: Boolean(historicalResult),
  };
}

function evaluateRisk(weather, place = null) {
  const probability = computeFloodProbability(weather, 0);
  const newsAdjustment = getNewsRiskAdjustment(place);
  const adjustedProbability = clamp(probability + newsAdjustment, 0, 1);
  const classified = classifyRiskFromProbability(adjustedProbability, {
    mediumThreshold: 0.4,
    highThreshold: 0.7,
    statusHigh: "Imminent Threat Alert",
    statusMedium: "Weather Watch",
    statusLow: "Advisory",
    adviceHigh:
      "Heavy rainfall and saturated ground increase flooding chance. Avoid low-lying roads and monitor local emergency alerts.",
    adviceMedium:
      "Flooding is possible in vulnerable areas. Stay alert and prepare to move if conditions worsen.",
    adviceLow:
      "Current forecast does not indicate significant flood conditions. Continue routine monitoring.",
  });
  return attachNewsSignalToRisk(classified, place, newsAdjustment);
}

function evaluateLocationRisk(place, weather) {
  const matchedHotspot = findMatchingHotspot(place);
  if (matchedHotspot) {
    return evaluateHotspotRisk(matchedHotspot, weather, place);
  }
  return evaluateRisk(weather, place);
}

function renderResult(place, weather, risk) {
  resultCard.classList.remove("hidden", "high", "medium", "low");
  resultCard.classList.add(risk.level);
  alertLevel.textContent = risk.statusText;
  alertTitle.textContent = `${risk.headline} - ${place.name}, ${place.country}`;
  alertMessage.textContent = risk.advice;
  updateMap(place.latitude, place.longitude, `${place.name}, Ghana`);

  metrics.innerHTML = "";
  [
    `Weather: ${weather.weatherCondition}`,
    weather.rainfallLikely ? "Possible rainfall: Yes" : "Possible rainfall: No",
    `News flood pressure: ${risk.newsLevel}`,
    `News signals: ${risk.newsHeadlineCount} headline(s) / ${risk.newsSourceCount} source(s)`,
    risk.newsLocationContext
      ? `News local signal (${risk.newsLocationContext}): +${(risk.newsLocalBoost * 100).toFixed(0)}%`
      : "News local signal: none",
    `Forecast rain (3 days): ${weather.forecastRainTotal.toFixed(1)} mm`,
    `Max hourly rain: ${weather.maxHourlyRain.toFixed(1)} mm`,
    `Max daily rain: ${weather.maxDailyRain.toFixed(1)} mm`,
    `Avg soil moisture: ${(weather.avgSoilMoisture * 100).toFixed(0)}%`,
    `Model flood probability: ${(risk.probability * 100).toFixed(0)}%`,
    weather.historicalAvailable
      ? `Past ${weather.historicalDays}-day rain: ${weather.pastRainTotal.toFixed(1)} mm`
      : "Historical data: unavailable",
  ].forEach((label) => {
    const pill = document.createElement("span");
    pill.className = "metric-pill";
    pill.textContent = label;
    metrics.appendChild(pill);
  });
}

function showError(message) {
  resultCard.classList.remove("hidden", "high", "medium", "low");
  resultCard.classList.add("high");
  alertLevel.textContent = "Error";
  alertTitle.textContent = "Unable to evaluate flood risk";
  alertMessage.textContent = message;
  metrics.innerHTML = "";
}

async function getBestAvailableCoordinates() {
  const isSecure = window.isSecureContext || isLocalhost();
  if (!isSecure) {
    throw new Error(
      "Current location requires HTTPS or localhost. Open from local server (http://localhost).",
    );
  }
  try {
    const gps = await readCurrentCoordinates({
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    });
    if (!Number.isFinite(gps.accuracy) || gps.accuracy <= GPS_MAX_ACCEPTABLE_ACCURACY_METERS) {
      return { ...gps, source: "gps" };
    }
    // Retry one more time when first fix is too coarse.
    const refinedGps = await readCurrentCoordinates({
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 0,
    });
    return { ...refinedGps, source: "gps" };
  } catch (_error) {
    try {
      const relaxed = await readCurrentCoordinates({
        enableHighAccuracy: false,
        timeout: 25000,
        maximumAge: 600000,
      });
      return { ...relaxed, source: "gps" };
    } catch (_error2) {
      const ip = await getApproximateCoordinatesFromIP();
      return { ...ip, source: "ip" };
    }
  }
}

function readCurrentCoordinates(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error("Location permission denied."));
          return;
        }
        if (error.code === error.POSITION_UNAVAILABLE) {
          reject(new Error("Current location unavailable."));
          return;
        }
        if (error.code === error.TIMEOUT) {
          reject(new Error("Location request timed out."));
          return;
        }
        reject(new Error("Could not read current location."));
      },
      options,
    );
  });
}

async function getApproximateCoordinatesFromIP() {
  const providers = [
    { name: "ipapi", url: "https://ipapi.co/json/", latKey: "latitude", lonKey: "longitude" },
    { name: "ipwhois", url: "https://ipwho.is/", latKey: "latitude", lonKey: "longitude" },
    { name: "geolocation-db", url: "https://geolocation-db.com/json/", latKey: "latitude", lonKey: "longitude" },
  ];

  for (const provider of providers) {
    try {
      const response = await fetchWithHelpfulErrors(provider.url, `${provider.name}-location`);
      if (!response.ok) continue;
      const data = await response.json();
      const latitude = Number(data[provider.latKey]);
      const longitude = Number(data[provider.lonKey]);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        return { latitude, longitude };
      }
    } catch (_error) {
      // Try next provider.
    }
  }
  throw new Error("Could not use network location fallback.");
}

function updateMap(latitude, longitude, label) {
  ensureMapReady();
  ghanaMap.setView([latitude, longitude], 13);
  if (!selectedMarker) {
    selectedMarker = window.L.marker([latitude, longitude]).addTo(ghanaMap);
  } else {
    selectedMarker.setLatLng([latitude, longitude]);
  }
  selectedMarker.bindPopup(escapeHtml(label)).openPopup();

  if (reportLocationInput && !reportLocationInput.value.trim()) {
    reportLocationInput.value = label.replace(", Ghana", "");
  }
}

function ensureMapReady() {
  if (ghanaMap || !window.L || !mapContainer) return;
  ghanaMap = window.L.map("ghana-map", { zoomControl: true }).setView([7.95, -1.03], 7);
  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(ghanaMap);
  hotspotLayer = window.L.layerGroup().addTo(ghanaMap);
}

async function loadFloodProneAreas() {
  if (isHotspotRefreshing) return;
  isHotspotRefreshing = true;
  hotspotStatus.textContent = "Loading current hotspot risk levels...";
  refreshHotspotsButton.disabled = true;
  refreshHotspotsButton.textContent = "Refreshing...";
  hotspotList.innerHTML = "";
  try {
    await refreshNewsRiskSignal().catch(() => {});

    const resolved = await Promise.all(
      GHANA_FLOOD_HOTSPOTS.map(async (area) => {
        try {
          const riskInputs = await getRiskInputs(area.latitude, area.longitude);
          const placeContext = { name: area.name, country: "Ghana" };
          const risk = evaluateHotspotRisk(area, riskInputs, placeContext);
          const localNewsScore = getLocalNewsScore(placeContext);
          const isCurrentFlooding = isAreaCurrentlyFlooding(area, riskInputs, risk, localNewsScore);
          return {
            ...area,
            riskLevel: risk.level,
            riskLabel: risk.headline,
            probability: risk.probability,
            maxDailyRain: riskInputs.maxDailyRain,
            maxHourlyRain: riskInputs.maxHourlyRain,
            pastRainTotal: riskInputs.pastRainTotal,
            historicalDays: riskInputs.historicalDays,
            localNewsScore,
            isCurrentFlooding,
          };
        } catch (_error) {
          // Keep list alive even when weather fetch fails.
          const fallbackRisk = evaluateHotspotRisk(area, {
            maxHourlyRain: 0,
            maxDailyRain: 0,
            avgSoilMoisture: 0,
            pastRainTotal: 0,
            historicalAvgSoilMoisture: 0,
          });
          return {
            ...area,
            riskLevel: fallbackRisk.level,
            riskLabel: fallbackRisk.headline,
            probability: fallbackRisk.probability || 0,
            maxDailyRain: 0,
            maxHourlyRain: 0,
            pastRainTotal: 0,
            historicalDays: HISTORICAL_DAYS,
            localNewsScore: 0,
            isCurrentFlooding: false,
          };
        }
      }),
    );

    const sortedAreas = resolved.sort((a, b) => {
      if (a.isCurrentFlooding !== b.isCurrentFlooding) {
        return Number(b.isCurrentFlooding) - Number(a.isCurrentFlooding);
      }
      const riskDelta = riskPriority(b.riskLevel) - riskPriority(a.riskLevel);
      if (riskDelta !== 0) return riskDelta;
      return (b.probability || 0) - (a.probability || 0);
    });
    lastHotspots = sortedAreas;
    await processHotspotRiskNotifications(sortedAreas);
    visibleHotspotCount = HOTSPOTS_VISIBLE_COUNT;
    renderHotspotList(sortedAreas);
    renderHotspotsOnMap(sortedAreas);

    const activeFlooding = sortedAreas.filter((item) => item.isCurrentFlooding).length;
    hotspotStatus.textContent = `Updated ${new Date().toLocaleTimeString()} | ${activeFlooding} currently flooding area(s) | Auto-updates every 10 min`;
  } catch (_error) {
    hotspotStatus.textContent = "Could not refresh hotspot list right now. Retrying automatically.";
  } finally {
    refreshHotspotsButton.disabled = false;
    refreshHotspotsButton.textContent = "Refresh List";
    isHotspotRefreshing = false;
  }
}

async function triggerHotspotRefresh() {
  await loadFloodProneAreas();
}

function isAreaCurrentlyFlooding(area, riskInputs, risk, localNewsScore) {
  const severeRainNow = riskInputs.maxHourlyRain >= 8 || riskInputs.maxDailyRain >= 25;
  const saturatedGround = riskInputs.avgSoilMoisture >= 0.38;
  const strongNewsPressure = localNewsScore >= 2.2;
  const hotspotExposureHigh = (area.exposure || 0) >= 2;
  const highRisk = risk.level === "high" || (risk.probability || 0) >= 0.72;
  return (
    highRisk &&
    (severeRainNow || (saturatedGround && hotspotExposureHigh) || strongNewsPressure)
  );
}

function renderHotspotList(areas) {
  if (!areas.length) {
    hotspotList.innerHTML = "<p class='hotspot-meta'>No hotspot data available.</p>";
    viewMoreHotspotsButton?.classList.add("hidden");
    return;
  }
  const areasToDisplay = areas.slice(0, visibleHotspotCount);
  hotspotList.innerHTML = areasToDisplay
    .map(
      (area) => `
      <article class="hotspot-item ${area.riskLevel}">
        <div>
          <p class="hotspot-name">
            <span class="hotspot-dot ${area.riskLevel}" aria-hidden="true"></span>
            ${escapeHtml(area.name)}
          </p>
          ${
            area.isCurrentFlooding
              ? `<p class="hotspot-live">Currently flooding / active flood pressure</p>`
              : ""
          }
          <p class="hotspot-meta">Max daily rain: ${area.maxDailyRain.toFixed(1)} mm | Past ${area.historicalDays}-day rain: ${area.pastRainTotal.toFixed(1)} mm</p>
        </div>
        <div>
          <span class="risk-badge ${area.riskLevel}">${escapeHtml(area.riskLabel)}</span>
          <button
            type="button"
            class="btn btn-secondary btn-small"
            data-lat="${area.latitude}"
            data-lon="${area.longitude}"
            data-name="${escapeHtml(area.name)}"
          >
            View on Map
          </button>
        </div>
      </article>
    `,
    )
    .join("");

  if (!viewMoreHotspotsButton) return;
  if (visibleHotspotCount < areas.length) {
    viewMoreHotspotsButton.classList.remove("hidden");
    viewMoreHotspotsButton.textContent = `View More Locations (${areas.length - visibleHotspotCount} left)`;
  } else {
    viewMoreHotspotsButton.classList.add("hidden");
  }
}

function renderHotspotsOnMap(areas) {
  ensureMapReady();
  hotspotLayer.clearLayers();
  areas.forEach((area) => {
    const color = getRiskColor(area.riskLevel);
    const marker = window.L.circleMarker([area.latitude, area.longitude], {
      radius: 8,
      color,
      weight: 2,
      fillColor: color,
      fillOpacity: 0.85,
    });
    marker
      .bindPopup(
        `<strong>${escapeHtml(area.name)}</strong><br>${escapeHtml(
          area.riskLabel,
        )}<br>${
          area.isCurrentFlooding ? "<span style='color:#ffb3b3;'>Currently flooding</span><br>" : ""
        }Max daily rain: ${area.maxDailyRain.toFixed(1)} mm`,
      )
      .addTo(hotspotLayer);
  });
}

function evaluateHotspotRisk(area, weather, placeContext = null) {
  const exposure = area.exposure || 0;
  let probability = computeFloodProbability(weather, exposure);
  const effectivePlace = placeContext || { name: area.name, country: "Ghana" };
  const newsAdjustment = getNewsRiskAdjustment(effectivePlace);

  // Exposure prior: known chronic hotspots should not downgrade too aggressively.
  if (exposure >= 3) probability = Math.max(probability, 0.74);
  else if (exposure === 2) probability = Math.max(probability, 0.48);
  if (weather.maxDailyRain >= 12) probability += 0.04;
  if (weather.maxHourlyRain >= 8) probability += 0.04;
  probability += newsAdjustment * 0.8;
  probability = clamp(probability, 0, 1);

  const dynamic = classifyRiskFromProbability(probability, {
    mediumThreshold: 0.48,
    highThreshold: 0.72,
    statusHigh: "Flood Hotspot Alert",
    statusMedium: "Flood Hotspot Watch",
    statusLow: "Hotspot Advisory",
    adviceHigh: "Elevated flood pressure in this hotspot.",
    adviceMedium: "Moderate warning signals in this hotspot.",
    adviceLow: "Lower pressure now, but monitor closely.",
  });

  if ((area.exposure || 0) >= 3) {
    return attachNewsSignalToRisk(
      {
      level: "high",
      headline: "High Flood Risk",
      statusText: "Chronic High-Risk Zone",
      advice: "Historically flood-prone zone. Treat as high risk.",
      probability,
      },
      effectivePlace,
      newsAdjustment * 0.8,
    );
  }
  if ((area.exposure || 0) === 2 && dynamic.level === "low") {
    return attachNewsSignalToRisk(
      {
      level: "medium",
      headline: "Moderate Flood Risk",
      statusText: "Flood-Prone Zone",
      advice: "Known flood susceptibility despite lower weather pressure.",
      probability,
      },
      effectivePlace,
      newsAdjustment * 0.8,
    );
  }
  return attachNewsSignalToRisk(dynamic, effectivePlace, newsAdjustment * 0.8);
}

function initializeNewsRiskSignal() {
  refreshNewsRiskSignal().catch(() => {});
}

async function refreshNewsRiskSignal() {
  const feedResults = await Promise.allSettled(
    NEWS_SIGNAL_FEEDS.map(async (feedUrl) => {
      const proxyUrl = "https://api.allorigins.win/raw?url=" + encodeURIComponent(feedUrl);
      const response = await fetch(proxyUrl, { cache: "no-store" });
      if (!response.ok) return [];
      const rssText = await response.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(rssText, "application/xml");
      return Array.from(xml.querySelectorAll("item"))
        .slice(0, 10)
        .map((item) => ({
          title: item.querySelector("title")?.textContent || "",
          description: item.querySelector("description")?.textContent || "",
          source: item.querySelector("source")?.textContent || hostnameLabelFromLink(item),
        }));
    }),
  );
  const items = dedupeNewsItems(
    feedResults
      .filter((result) => result.status === "fulfilled")
      .flatMap((result) => result.value),
  ).slice(0, 24);
  if (!items.length) return;

  const uniqueSources = new Set();
  const locationScores = {};
  const locationKeys = getNewsLocationKeys();
  let weightedSignal = 0;
  items.forEach((item, index) => {
    const title = item.title || "";
    const description = item.description || "";
    const source = item.source || "";
    if (source.trim()) uniqueSources.add(normalizePlaceKey(source));
    const text = `${title} ${description}`.toLowerCase();
    let severity = 0;
    if (text.includes("death") || text.includes("fatal")) severity += 3.2;
    if (text.includes("collapse") || text.includes("displaced")) severity += 2.4;
    if (text.includes("submerge") || text.includes("overflow") || text.includes("spillage")) {
      severity += 1.8;
    }
    if (text.includes("warning") || text.includes("alert") || text.includes("evacuat")) {
      severity += 1.6;
    }
    if (text.includes("flood")) severity += 0.8;
    const recencyWeight = 1 - index / 16;
    weightedSignal += Math.max(severity, 0) * recencyWeight;

    locationKeys.forEach((key) => {
      if (!key) return;
      if (text.includes(key)) {
        locationScores[key] = (locationScores[key] || 0) + Math.max(severity, 0.6) * recencyWeight;
      }
    });
  });
  const score = clamp(weightedSignal / 24, 0, 1);
  let level = "Normal";
  if (score >= 0.62) level = "Elevated";
  else if (score >= 0.32) level = "Watch";
  newsRiskSignal = {
    score,
    level,
    headlineCount: items.length,
    sourceCount: uniqueSources.size,
    locationScores,
    lastUpdatedAt: Date.now(),
  };
}

function getNewsRiskAdjustment(place = null) {
  const freshnessMs = Date.now() - (newsRiskSignal.lastUpdatedAt || 0);
  const isFresh = freshnessMs >= 0 && freshnessMs <= NEWS_SIGNAL_REFRESH_MS * 3;
  if (!isFresh) return 0;
  let adjustment = 0;
  if (newsRiskSignal.level === "Elevated") adjustment += 0.1;
  else if (newsRiskSignal.level === "Watch") adjustment += 0.05;
  if (place) {
    const localScore = getLocalNewsScore(place);
    adjustment += clamp(localScore / 10, 0, 0.08);
  }
  return adjustment;
}

function attachNewsSignalToRisk(risk, place = null, appliedAdjustment = 0) {
  const localScore = place ? getLocalNewsScore(place) : 0;
  const contextLabel = place?.name ? place.name : "";
  return {
    ...risk,
    newsLevel: newsRiskSignal.level,
    newsHeadlineCount: newsRiskSignal.headlineCount,
    newsSourceCount: newsRiskSignal.sourceCount,
    newsLocalBoost: appliedAdjustment,
    newsLocationContext: contextLabel,
    newsLocalScore: localScore,
  };
}

function dedupeNewsItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = normalizePlaceKey(`${item.title} ${item.source}`);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hostnameLabelFromLink(itemNode) {
  const link = itemNode.querySelector("link")?.textContent || "";
  try {
    return new URL(link).hostname.replace(/^www\./, "").split(".")[0];
  } catch (_error) {
    return "";
  }
}

function getNewsLocationKeys() {
  const keys = [
    ...GHANA_TOWNS_AND_CITIES,
    ...GHANA_FLOOD_HOTSPOTS.map((item) => item.name),
    ...Object.keys(GHANA_LOCATION_ALIASES),
  ].map((item) => normalizePlaceKey(item));
  return Array.from(new Set(keys)).filter((item) => item && item.length >= 3);
}

function getLocalNewsScore(place) {
  const keySet = new Set();
  const base = normalizePlaceKey(place.name || "");
  if (!base) return 0;
  const withCountry = normalizePlaceKey(`${place.name || ""} ${place.country || ""}`);
  if (base) keySet.add(base);
  if (withCountry) keySet.add(withCountry);

  GHANA_FLOOD_HOTSPOTS.forEach((area) => {
    const areaKey = normalizePlaceKey(area.name);
    if (areaKey && (areaKey.includes(base) || base.includes(areaKey))) {
      keySet.add(areaKey);
    }
  });

  let localScore = 0;
  keySet.forEach((key) => {
    localScore += newsRiskSignal.locationScores[key] || 0;
  });
  return localScore;
}

function computeFloodProbability(weather, exposure) {
  const hourlyRainNorm = normalizeRange(weather.maxHourlyRain, 0, 25);
  const dailyRainNorm = normalizeRange(weather.maxDailyRain, 0, 70);
  const soilNorm = normalizeRange(weather.avgSoilMoisture, 0.2, 0.6);
  const pastRainNorm = normalizeRange(weather.pastRainTotal, 0, 180);
  const historicalSoilNorm = normalizeRange(weather.historicalAvgSoilMoisture, 0.2, 0.55);
  const exposureNorm = normalizeRange(exposure || 0, 0, 3);

  // Logistic model style: weighted features + interaction + sigmoid.
  const wetGroundInteraction = dailyRainNorm * soilNorm;
  const linearScore =
    -3.1 +
    2.0 * hourlyRainNorm +
    2.0 * dailyRainNorm +
    1.5 * soilNorm +
    1.4 * pastRainNorm +
    1.2 * historicalSoilNorm +
    1.1 * wetGroundInteraction +
    0.55 * exposureNorm;

  const mlProbability = sigmoid(linearScore);
  const ruleProbability = clamp(computeWeatherRiskScore(weather) / 13, 0, 1);
  return clamp(
    ML_MODEL_BLEND * mlProbability + (1 - ML_MODEL_BLEND) * ruleProbability,
    0,
    1,
  );
}

function findMatchingHotspot(place) {
  const placeKey = normalizePlaceKey(place.name || "");
  const placeWithCountryKey = normalizePlaceKey(`${place.name || ""} ${place.country || ""}`);

  let directMatch = GHANA_FLOOD_HOTSPOTS.find((area) => {
    const areaKey = normalizePlaceKey(area.name);
    return (
      areaKey.includes(placeKey) ||
      placeKey.includes(areaKey) ||
      areaKey.includes(placeWithCountryKey) ||
      placeWithCountryKey.includes(areaKey)
    );
  });

  if (directMatch) return directMatch;

  let nearest = null;
  let nearestDistanceKm = Number.POSITIVE_INFINITY;
  GHANA_FLOOD_HOTSPOTS.forEach((area) => {
    const distanceKm = haversineKm(
      place.latitude,
      place.longitude,
      area.latitude,
      area.longitude,
    );
    if (distanceKm < nearestDistanceKm) {
      nearestDistanceKm = distanceKm;
      nearest = area;
    }
  });

  if (nearest && nearestDistanceKm <= 25) {
    return nearest;
  }
  return null;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function computeWeatherRiskScore(weather) {
  let score = 0;
  if (weather.maxHourlyRain >= 20) score += 3;
  else if (weather.maxHourlyRain >= 10) score += 2;
  else if (weather.maxHourlyRain >= 5) score += 1;

  if (weather.maxDailyRain >= 60) score += 3;
  else if (weather.maxDailyRain >= 30) score += 2;
  else if (weather.maxDailyRain >= 15) score += 1;

  if (weather.avgSoilMoisture >= 0.45) score += 2;
  else if (weather.avgSoilMoisture >= 0.3) score += 1;

  if (weather.pastRainTotal >= 160) score += 3;
  else if (weather.pastRainTotal >= 100) score += 2;
  else if (weather.pastRainTotal >= 60) score += 1;

  if (weather.historicalAvgSoilMoisture >= 0.42) score += 2;
  else if (weather.historicalAvgSoilMoisture >= 0.32) score += 1;

  return score;
}

function classifyRiskFromScore(score, config) {
  if (score >= config.highThreshold) {
    return {
      level: "high",
      headline: "High Flood Risk",
      statusText: config.statusHigh,
      advice: config.adviceHigh,
    };
  }
  if (score >= config.mediumThreshold) {
    return {
      level: "medium",
      headline: "Moderate Flood Risk",
      statusText: config.statusMedium,
      advice: config.adviceMedium,
    };
  }
  return {
    level: "low",
    headline: "Low Flood Risk",
    statusText: config.statusLow,
    advice: config.adviceLow,
  };
}

function classifyRiskFromProbability(probability, config) {
  if (probability >= config.highThreshold) {
    return {
      level: "high",
      headline: "High Flood Risk",
      statusText: config.statusHigh,
      advice: config.adviceHigh,
      probability,
    };
  }
  if (probability >= config.mediumThreshold) {
    return {
      level: "medium",
      headline: "Moderate Flood Risk",
      statusText: config.statusMedium,
      advice: config.adviceMedium,
      probability,
    };
  }
  return {
    level: "low",
    headline: "Low Flood Risk",
    statusText: config.statusLow,
    advice: config.adviceLow,
    probability,
  };
}

function normalizeRange(value, minValue, maxValue) {
  if (!Number.isFinite(value)) return 0;
  if (maxValue <= minValue) return 0;
  return clamp((value - minValue) / (maxValue - minValue), 0, 1);
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-value));
}

function clamp(value, minValue, maxValue) {
  return Math.min(maxValue, Math.max(minValue, value));
}

function getRiskColor(level) {
  if (level === "high") return "#dc3545";
  if (level === "medium") return "#ff8a00";
  return "#22c55e";
}

function riskPriority(level) {
  if (level === "high") return 3;
  if (level === "medium") return 2;
  return 1;
}

function getDefaultNotificationSettings() {
  return {
    enabled: true,
    notifyMode: "high", // high | moderate-high
    quietHoursEmergencyOnly: true,
    quietHoursStart: 22,
    quietHoursEnd: 6,
  };
}

function loadNotificationSettings() {
  const defaults = getDefaultNotificationSettings();
  try {
    const raw = localStorage.getItem(FLOOD_NOTIFICATION_SETTINGS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaults;
    return {
      enabled: parsed.enabled !== false,
      notifyMode: parsed.notifyMode === "moderate-high" ? "moderate-high" : "high",
      quietHoursEmergencyOnly: parsed.quietHoursEmergencyOnly !== false,
      quietHoursStart: Number.isFinite(parsed.quietHoursStart)
        ? parsed.quietHoursStart
        : defaults.quietHoursStart,
      quietHoursEnd: Number.isFinite(parsed.quietHoursEnd)
        ? parsed.quietHoursEnd
        : defaults.quietHoursEnd,
    };
  } catch (_error) {
    return defaults;
  }
}

function loadNotificationState() {
  try {
    const raw = localStorage.getItem(FLOOD_NOTIFICATION_STATE_KEY);
    if (!raw) return { byArea: {} };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !parsed.byArea || typeof parsed.byArea !== "object") {
      return { byArea: {} };
    }
    return parsed;
  } catch (_error) {
    return { byArea: {} };
  }
}

function saveNotificationState(state) {
  try {
    localStorage.setItem(FLOOD_NOTIFICATION_STATE_KEY, JSON.stringify(state));
  } catch (_error) {
    // Ignore storage issues and continue app execution.
  }
}

function isNotificationLevelEnabled(level, settings) {
  if (settings.notifyMode === "moderate-high") {
    return level === "high" || level === "medium";
  }
  return level === "high";
}

function isInsideQuietHours(settings, now = new Date()) {
  const currentHour = now.getHours();
  const start = ((settings.quietHoursStart % 24) + 24) % 24;
  const end = ((settings.quietHoursEnd % 24) + 24) % 24;
  if (start === end) return false;
  if (start < end) return currentHour >= start && currentHour < end;
  return currentHour >= start || currentHour < end;
}

function shouldSendDuringQuietHours(level, settings) {
  if (!settings.quietHoursEmergencyOnly) return true;
  return level === "high";
}

function appendNotificationHistory(entry) {
  try {
    const raw = localStorage.getItem(FLOOD_NOTIFICATION_HISTORY_KEY);
    const existing = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(existing) ? existing : [];
    list.unshift(entry);
    localStorage.setItem(
      FLOOD_NOTIFICATION_HISTORY_KEY,
      JSON.stringify(list.slice(0, FLOOD_NOTIFICATION_HISTORY_LIMIT)),
    );
  } catch (_error) {
    // Ignore history failures.
  }
}

async function ensureFloodNotificationServiceWorker() {
  if (!window.isSecureContext || !("serviceWorker" in navigator)) return;
  try {
    let registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      registration = await navigator.serviceWorker.register(FLOOD_NOTIFICATION_SW_URL);
    }
    if (!registration.active) {
      await navigator.serviceWorker.ready;
    }
  } catch (_error) {
    // Continue without service worker and fallback to Notification API.
  }
}

async function sendFloodNotification({ areaName, fromLevel, toLevel, probability }) {
  if (!window.isSecureContext || !("Notification" in window) || Notification.permission !== "granted") {
    return false;
  }
  await ensureFloodNotificationServiceWorker();
  const probabilityPercent = Math.round((probability || 0) * 100);
  const fromText = fromLevel ? `${fromLevel.toUpperCase()} -> ` : "";
  const body = `${fromText}${toLevel.toUpperCase()} flood risk in ${areaName}. Model probability: ${probabilityPercent}%.`;
  try {
    if ("serviceWorker" in navigator) {
      const registration =
        (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.ready);
      if (registration) {
        await registration.showNotification("Flood Guard Alert", {
          body,
          tag: `flood-${normalizePlaceKey(areaName)}`,
          requireInteraction: true,
          renotify: true,
        });
        return true;
      }
    }
    new Notification("Flood Guard Alert", {
      body,
      tag: `flood-${normalizePlaceKey(areaName)}`,
      requireInteraction: true,
      renotify: true,
    });
    return true;
  } catch (_error) {
    return false;
  }
}

async function processHotspotRiskNotifications(areas) {
  const settings = loadNotificationSettings();
  const state = loadNotificationState();
  const byArea = state.byArea || {};
  const now = Date.now();
  const inQuietHours = isInsideQuietHours(settings, new Date(now));

  for (const area of areas) {
    const key = normalizePlaceKey(area.name);
    if (!key) continue;
    const previous = byArea[key];
    const nextPriority = riskPriority(area.riskLevel);
    const previousPriority = previous ? riskPriority(previous.level) : nextPriority;
    let lastNotifiedAt = previous && Number.isFinite(previous.lastNotifiedAt) ? previous.lastNotifiedAt : 0;

    const increased = previous && nextPriority > previousPriority;
    const eligibleLevel = isNotificationLevelEnabled(area.riskLevel, settings);
    const quietHoursAllowed = !inQuietHours || shouldSendDuringQuietHours(area.riskLevel, settings);
    const cooldownPassed = now - lastNotifiedAt >= FLOOD_NOTIFICATION_COOLDOWN_MS;

    if (settings.enabled && increased && eligibleLevel && quietHoursAllowed && cooldownPassed) {
      const sent = await sendFloodNotification({
        areaName: area.name,
        fromLevel: previous.level,
        toLevel: area.riskLevel,
        probability: area.probability,
      });
      if (sent) {
        lastNotifiedAt = now;
        appendNotificationHistory({
          location: area.name,
          fromLevel: previous.level,
          toLevel: area.riskLevel,
          probability: area.probability || 0,
          createdAt: new Date(now).toISOString(),
        });
      }
    }

    byArea[key] = {
      level: area.riskLevel,
      probability: area.probability || 0,
      label: area.riskLabel || "",
      updatedAt: now,
      lastNotifiedAt,
    };
  }

  saveNotificationState({ byArea });
}

function describeWeatherCondition(weatherCode, maxDailyRain) {
  const code = Number(weatherCode);
  if (!Number.isFinite(code)) {
    if (maxDailyRain >= 1) return "Rain showers expected";
    return "Partly cloudy";
  }
  if (code === 0) return "Clear sky";
  if (code === 1) return "Mainly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Foggy";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rainy";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Thunderstorm";
  if (maxDailyRain >= 1) return "Rain showers expected";
  return "Partly cloudy";
}

async function fetchWithHelpfulErrors(url, serviceName) {
  try {
    return await fetch(url);
  } catch (_error) {
    throw new Error(
      `Network request failed for ${serviceName}. Check internet and run via localhost.`,
    );
  }
}

function loadFloodReports() {
  try {
    const raw = localStorage.getItem(FLOOD_REPORT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        item &&
        typeof item.location === "string" &&
        typeof item.message === "string" &&
        typeof item.createdAt === "string",
    );
  } catch (_error) {
    return [];
  }
}

function saveFloodReports(reports) {
  try {
    localStorage.setItem(FLOOD_REPORT_STORAGE_KEY, JSON.stringify(reports));
  } catch (_error) {
    if (reportStatus) {
      reportStatus.textContent = "Could not save report history on this browser/device.";
    }
  }
}

function renderFloodReports(reports) {
  if (!reportList || !viewMoreReportsButton) return;
  currentFloodReports = reports;
  reportList.innerHTML = "";
  if (!reports.length) {
    const emptyState = document.createElement("p");
    emptyState.className = "report-time";
    emptyState.textContent = "No flood incidence reports yet.";
    reportList.appendChild(emptyState);
    viewMoreReportsButton.classList.add("hidden");
    return;
  }

  const reportsToDisplay = reports.slice(0, visibleReportCount);
  reportsToDisplay.forEach((report) => {
    const article = document.createElement("article");
    article.className = "report-item";

    const title = document.createElement("p");
    title.className = "report-headline";
    title.textContent = report.location;

    const time = document.createElement("p");
    time.className = "report-time";
    time.textContent = `Reported ${new Date(report.createdAt).toLocaleString()}`;

    const body = document.createElement("p");
    body.className = "report-body";
    body.textContent = report.message;

    article.append(title, time, body);
    reportList.appendChild(article);
  });

  if (visibleReportCount < reports.length) {
    viewMoreReportsButton.classList.remove("hidden");
    viewMoreReportsButton.textContent = `View More Reports (${
      reports.length - visibleReportCount
    } left)`;
  } else {
    viewMoreReportsButton.classList.add("hidden");
  }
}

function maxValue(values) {
  if (!values || !values.length) return 0;
  return Math.max(...values);
}

function averageValue(values) {
  if (!values || !values.length) return 0;
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function sumValues(values) {
  if (!values || !values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0);
}

function dateDaysAgo(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isWithinGhana(latitude, longitude) {
  return (
    latitude >= GHANA_BOUNDS.minLat &&
    latitude <= GHANA_BOUNDS.maxLat &&
    longitude >= GHANA_BOUNDS.minLon &&
    longitude <= GHANA_BOUNDS.maxLon
  );
}

function isLocalhost() {
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function normalizePlaceKey(value) {
  return value
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

ensureMapReady();
triggerHotspotRefresh().catch(() => {});
renderFloodReports(loadFloodReports());
