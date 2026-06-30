const notificationSettingsForm = document.getElementById("notification-settings-form");
const alertsEnabledInput = document.getElementById("alerts-enabled");
const notifyHighOnlyInput = document.getElementById("notify-high-only");
const notifyModerateHighInput = document.getElementById("notify-moderate-high");
const quietHoursEmergencyOnlyInput = document.getElementById("quiet-hours-emergency-only");
const quietHoursInput = document.getElementById("quiet-hours");
const settingsStatus = document.getElementById("notification-settings-status");
const permissionStatus = document.getElementById("notification-permission-status");
const requestPermissionButton = document.getElementById("request-notification-permission-btn");
const testNotificationButton = document.getElementById("test-notification-btn");
const historyList = document.getElementById("notification-history-list");

const NOTIFICATION_SETTINGS_KEY = "floodGuardNotificationSettings";
const NOTIFICATION_HISTORY_KEY = "floodGuardNotificationHistory";
const MAX_HISTORY_ITEMS = 25;
const NOTIFICATION_SW_URL = "./notification-sw.js";
const SW_READY_TIMEOUT_MS = 4000;

function safeGetStorageItem(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (_error) {
    return null;
  }
}

function safeSetStorageItem(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (_error) {
    return false;
  }
}

function isStandaloneDisplayMode() {
  try {
    return Boolean(window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
  } catch (_error) {
    return false;
  }
}

function isIosSafariBrowser() {
  const ua = String(navigator.userAgent || "").toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua);
  const isSafari = /safari/.test(ua) && !/crios|fxios|edgios|opr|opios/.test(ua);
  return isIos && isSafari;
}

function requiresIosHomeScreenForNotifications() {
  return isIosSafariBrowser() && !isStandaloneDisplayMode();
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

function safeParseJSON(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return fallback;
  }
}

function parseQuietHours(value) {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  const match = normalized.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (!match) return null;
  const [, startHourRaw, startMinuteRaw, startMeridiem, endHourRaw, endMinuteRaw, endMeridiem] = match;
  const startHour = to24Hour(Number(startHourRaw), startMeridiem);
  const endHour = to24Hour(Number(endHourRaw), endMeridiem);
  const startMinute = Number(startMinuteRaw || "0");
  const endMinute = Number(endMinuteRaw || "0");
  if (!Number.isFinite(startHour) || !Number.isFinite(endHour)) return null;
  if (startMinute !== 0 || endMinute !== 0) return null;
  return { start: startHour, end: endHour };
}

function to24Hour(hour, meridiem) {
  if (!Number.isFinite(hour) || hour < 1 || hour > 12) return Number.NaN;
  const lower = String(meridiem || "").toLowerCase();
  if (lower === "am") return hour % 12;
  if (lower === "pm") return hour % 12 + 12;
  return Number.NaN;
}

function formatQuietHour(hour24) {
  const normalized = ((hour24 % 24) + 24) % 24;
  const isPm = normalized >= 12;
  const hour12 = normalized % 12 || 12;
  return `${hour12}:00 ${isPm ? "PM" : "AM"}`;
}

function readSettings() {
  const defaults = getDefaultNotificationSettings();
  const raw = safeGetStorageItem(NOTIFICATION_SETTINGS_KEY);
  if (!raw) return defaults;
  const parsed = safeParseJSON(raw, null);
  if (!parsed || typeof parsed !== "object") return defaults;
  return {
    enabled: parsed.enabled !== false,
    notifyMode: parsed.notifyMode === "moderate-high" ? "moderate-high" : "high",
    quietHoursEmergencyOnly: parsed.quietHoursEmergencyOnly !== false,
    quietHoursStart: Number.isFinite(parsed.quietHoursStart) ? parsed.quietHoursStart : defaults.quietHoursStart,
    quietHoursEnd: Number.isFinite(parsed.quietHoursEnd) ? parsed.quietHoursEnd : defaults.quietHoursEnd,
  };
}

function saveSettings(settings) {
  safeSetStorageItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
}

function readHistory() {
  const raw = safeGetStorageItem(NOTIFICATION_HISTORY_KEY);
  if (!raw) return [];
  const parsed = safeParseJSON(raw, []);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (item) =>
      item &&
      typeof item.location === "string" &&
      typeof item.createdAt === "string" &&
      typeof item.toLevel === "string",
  );
}

function renderHistory() {
  if (!historyList) return;
  const items = readHistory();
  if (!items.length) {
    historyList.innerHTML = "<p class='report-time'>No alert has been sent yet.</p>";
    return;
  }
  historyList.innerHTML = items
    .slice(0, MAX_HISTORY_ITEMS)
    .map((item) => {
      const fromLabel = item.fromLevel ? `${capitalize(item.fromLevel)} to ` : "";
      return `
        <article class="report-item">
          <p class="report-headline">${escapeHtml(item.location)}</p>
          <p class="report-time">${fromLabel}${capitalize(item.toLevel)} Flood Risk | ${new Date(item.createdAt).toLocaleString()}</p>
        </article>
      `;
    })
    .join("");
}

function appendHistoryEntry(entry) {
  const history = readHistory();
  history.unshift(entry);
  safeSetStorageItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY_ITEMS)));
}

function populateFormFromSettings(settings) {
  alertsEnabledInput.checked = settings.enabled;
  notifyHighOnlyInput.checked = settings.notifyMode !== "moderate-high";
  notifyModerateHighInput.checked = settings.notifyMode === "moderate-high";
  quietHoursEmergencyOnlyInput.checked = settings.quietHoursEmergencyOnly;
  quietHoursInput.value = `${formatQuietHour(settings.quietHoursStart)} - ${formatQuietHour(settings.quietHoursEnd)}`;
}

function collectSettingsFromForm() {
  const quietHours = parseQuietHours(quietHoursInput.value);
  if (!quietHours) {
    throw new Error("Quiet hours format should look like: 10:00 PM - 6:00 AM");
  }
  return {
    enabled: alertsEnabledInput.checked,
    notifyMode: notifyModerateHighInput.checked ? "moderate-high" : "high",
    quietHoursEmergencyOnly: quietHoursEmergencyOnlyInput.checked,
    quietHoursStart: quietHours.start,
    quietHoursEnd: quietHours.end,
  };
}

function capitalize(value) {
  const text = String(value || "");
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}

function updatePermissionStatusLabel() {
  if (!permissionStatus) return;
  if (requiresIosHomeScreenForNotifications()) {
    permissionStatus.textContent =
      "Safari on iPhone requires Add to Home Screen for notifications. Install app and open from home screen icon.";
    if (requestPermissionButton) requestPermissionButton.disabled = true;
    if (testNotificationButton) testNotificationButton.disabled = true;
    return;
  }
  if (!window.isSecureContext) {
    permissionStatus.textContent =
      "Notifications need HTTPS or localhost. Open this app from http://localhost.";
    return;
  }
  if (!("Notification" in window)) {
    permissionStatus.textContent =
      "This browser does not support web push notifications. Try Chrome/Edge or install app to home screen.";
    if (requestPermissionButton) requestPermissionButton.disabled = true;
    if (testNotificationButton) testNotificationButton.disabled = true;
    return;
  }
  if (requestPermissionButton) requestPermissionButton.disabled = false;
  if (testNotificationButton) testNotificationButton.disabled = false;
  if (Notification.permission === "granted") {
    permissionStatus.textContent = "Browser notifications are allowed.";
    return;
  }
  if (Notification.permission === "denied") {
    permissionStatus.textContent = "Browser notifications are blocked. Enable them in browser settings.";
    return;
  }
  permissionStatus.textContent = "Browser notification permission is not granted yet.";
}

async function requestPermission() {
  if (requiresIosHomeScreenForNotifications()) {
    settingsStatus.textContent =
      "On iPhone Safari, first Add to Home Screen, then open the app from the icon to allow notifications.";
    return;
  }
  if (!("Notification" in window)) {
    settingsStatus.textContent = "This browser does not support notifications.";
    return;
  }
  let permission = "default";
  try {
    permission = await Notification.requestPermission();
  } catch (_error) {
    settingsStatus.textContent =
      "Could not request notification permission on this browser/device.";
    return;
  }
  if (permission === "granted") {
    settingsStatus.textContent = "Notifications enabled successfully.";
  } else {
    settingsStatus.textContent = "Notification permission was not granted.";
  }
  updatePermissionStatusLabel();
}

async function ensureNotificationServiceWorker() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  try {
    let registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      registration = await navigator.serviceWorker.register(NOTIFICATION_SW_URL);
    }
    // On some mobile browsers this can stall forever; bound the wait.
    if (!registration.active && navigator.serviceWorker.ready) {
      await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((resolve) => window.setTimeout(resolve, SW_READY_TIMEOUT_MS)),
      ]);
    }
  } catch (_error) {
    // Ignore registration errors and fall back to Notification API.
  }
}

async function dispatchDesktopNotification(title, options) {
  if (!window.isSecureContext) {
    return false;
  }
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return false;
  }

  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.showNotification(title, options);
        return true;
      }
    }
  } catch (_error) {
    // Fall through to direct Notification constructor.
  }

  try {
    new Notification(title, options);
    return true;
  } catch (_error) {
    return false;
  }
}

async function sendTestNotification() {
  if (requiresIosHomeScreenForNotifications()) {
    settingsStatus.textContent =
      "Test unavailable in Safari tab. Open Flood Guard from Home Screen icon and try again.";
    return;
  }
  if (!window.isSecureContext) {
    settingsStatus.textContent =
      "Test failed: notifications need HTTPS or localhost (http://localhost).";
    return;
  }
  if (!("Notification" in window)) {
    settingsStatus.textContent = "This browser does not support notifications.";
    return;
  }
  if (Notification.permission !== "granted") {
    settingsStatus.textContent = "Please allow browser notifications first.";
    return;
  }
  await ensureNotificationServiceWorker();
  const osNotificationSent = await dispatchDesktopNotification("Flood Guard Alert Test", {
    body: "Test successful. You will receive alerts when flood risk increases.",
    tag: "flood-guard-test",
    requireInteraction: true,
    renotify: true,
  });
  if (osNotificationSent) {
    appendHistoryEntry({
      location: "Test Alert",
      fromLevel: "low",
      toLevel: "high",
      createdAt: new Date().toISOString(),
    });
    renderHistory();
  }
  settingsStatus.textContent = osNotificationSent
    ? "Desktop notification sent to your computer."
    : "Could not deliver desktop notification. Check Windows notification banners and browser site settings.";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

populateFormFromSettings(readSettings());
renderHistory();
updatePermissionStatusLabel();
ensureNotificationServiceWorker().catch(() => {});

notifyHighOnlyInput.addEventListener("change", () => {
  if (notifyHighOnlyInput.checked) notifyModerateHighInput.checked = false;
  if (!notifyHighOnlyInput.checked && !notifyModerateHighInput.checked) {
    notifyHighOnlyInput.checked = true;
  }
});

notifyModerateHighInput.addEventListener("change", () => {
  if (notifyModerateHighInput.checked) notifyHighOnlyInput.checked = false;
  if (!notifyHighOnlyInput.checked && !notifyModerateHighInput.checked) {
    notifyModerateHighInput.checked = true;
  }
});

notificationSettingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const settings = collectSettingsFromForm();
    saveSettings(settings);
    settingsStatus.textContent = "Notification preferences updated.";
    if (settings.enabled && "Notification" in window && Notification.permission === "default") {
      await requestPermission();
    }
  } catch (error) {
    settingsStatus.textContent =
      error instanceof Error ? error.message : "Could not update notification settings.";
  }
});

requestPermissionButton.addEventListener("click", () => {
  requestPermission().catch(() => {
    settingsStatus.textContent = "Could not request notification permission.";
  });
});

testNotificationButton?.addEventListener("click", () => {
  sendTestNotification().catch(() => {
    settingsStatus.textContent = "Could not send test desktop notification.";
  });
});
