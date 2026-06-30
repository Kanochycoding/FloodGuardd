const form = document.getElementById("photo-report-form");
const imageInput = document.getElementById("flood-image");
const startCameraButton = document.getElementById("start-camera-btn");
const capturePhotoButton = document.getElementById("capture-photo-btn");
const stopCameraButton = document.getElementById("stop-camera-btn");
const deletePhotoButton = document.getElementById("delete-photo-btn");
const cameraPreview = document.getElementById("camera-preview");
const cameraCanvas = document.getElementById("camera-canvas");
const capturedPhotoPreview = document.getElementById("captured-photo-preview");
const locationInput = document.getElementById("flood-location");
const noteInput = document.getElementById("flood-note");
const statusText = document.getElementById("photo-report-status");
const reportList = document.getElementById("photo-report-list");

const STORAGE_KEY = "ghanaFloodPhotoReports";
const USER_ID_STORAGE_KEY = "ghanaFloodPhotoReportUserId";
const MAX_REPORTS = 40;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_LOCATION_LENGTH = 100;
const MAX_NOTE_LENGTH = 500;
const MAX_COMMENT_LENGTH = 240;
const MAX_COMMENTS_PER_REPORT = 20;
const GHANA_BOUNDS = { minLat: 4.4, maxLat: 11.5, minLon: -3.4, maxLon: 1.4 };
const FLOOD_SCENE_MIN_SCORE = 0.34;
const LOCATION_ALIASES = {
  circle: { name: "Kwame Nkrumah Circle", latitude: 5.5706, longitude: -0.2095 },
  "accra circle": { name: "Kwame Nkrumah Circle", latitude: 5.5706, longitude: -0.2095 },
  aboabo: { name: "Aboabo, Kumasi", latitude: 6.7035, longitude: -1.6159 },
  "aboabo kumasi": { name: "Aboabo, Kumasi", latitude: 6.7035, longitude: -1.6159 },
};

const currentUserId = getOrCreateCurrentUserId();
let map = null;
let markersLayer = null;
let cameraStream = null;
let capturedPhotoDataUrl = "";

ensureMap();
renderReports();
updateDeletePhotoButtonState();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusText.textContent = "Saving report...";

  const location = locationInput.value.trim();
  const note = noteInput.value.trim();
  const imageFile = imageInput.files && imageInput.files[0];

  if (!location || (!imageFile && !capturedPhotoDataUrl)) {
    statusText.textContent = "Please select or capture an image and enter location.";
    return;
  }
  if (location.length > MAX_LOCATION_LENGTH) {
    statusText.textContent = `Location is too long (max ${MAX_LOCATION_LENGTH} characters).`;
    return;
  }
  if (note.length > MAX_NOTE_LENGTH) {
    statusText.textContent = `Note is too long (max ${MAX_NOTE_LENGTH} characters).`;
    return;
  }
  if (imageFile && imageFile.size > MAX_UPLOAD_BYTES) {
    statusText.textContent = "Image is too large. Please upload an image smaller than 8MB.";
    return;
  }

  try {
    const coords = await resolveGhanaLocation(location);
    const imageDataUrl = capturedPhotoDataUrl || (await readImageAsDataUrl(imageFile));
    const floodScene = await evaluateFloodSceneFromDataUrl(imageDataUrl);
    if (!floodScene.isFloodLike) {
      statusText.textContent =
        "Photo rejected: this does not look like a flood scene. Capture visible flooding (waterlogged roads, overflow drains, submerged areas).";
      return;
    }
    const compressedImage = await compressImage(imageDataUrl, 900, 0.78);

    const reports = loadReports();
    reports.unshift({
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      ownerId: currentUserId,
      locationLabel: coords.name || location,
      originalLocationText: location,
      latitude: coords.latitude,
      longitude: coords.longitude,
      note,
      imageDataUrl: compressedImage,
      votes: {},
      comments: [],
      createdAt: new Date().toISOString(),
    });

    saveReports(reports.slice(0, MAX_REPORTS));
    form.reset();
    clearCapturedPhoto();
    stopCamera();
    updateDeletePhotoButtonState();
    statusText.textContent = "Flood photo report saved and mapped.";
    renderReports();
  } catch (error) {
    statusText.textContent =
      error instanceof Error ? error.message : "Could not save report.";
  }
});

reportList.addEventListener("click", (event) => {
  const viewButton = event.target.closest("[data-view-id]");
  if (viewButton) {
    const reportId = viewButton.getAttribute("data-view-id");
    if (reportId) {
      focusReportOnMap(reportId);
    }
    return;
  }

  const deleteButton = event.target.closest("[data-delete-id]");
  if (deleteButton) {
    const reportId = deleteButton.getAttribute("data-delete-id");
    if (reportId) {
      deleteReport(reportId);
    }
    return;
  }

  const likeButton = event.target.closest("[data-like-id]");
  if (likeButton) {
    const reportId = likeButton.getAttribute("data-like-id");
    if (reportId) {
      applyVote(reportId, 1);
    }
    return;
  }

  const dislikeButton = event.target.closest("[data-dislike-id]");
  if (dislikeButton) {
    const reportId = dislikeButton.getAttribute("data-dislike-id");
    if (reportId) {
      applyVote(reportId, -1);
    }
  }
});

reportList.addEventListener("submit", (event) => {
  const formElement = event.target.closest("[data-comment-report-id]");
  if (!formElement) return;
  event.preventDefault();
  const reportId = formElement.getAttribute("data-comment-report-id");
  const inputElement = formElement.querySelector("[data-comment-input]");
  const text = inputElement ? inputElement.value.trim() : "";
  if (!reportId) return;
  if (!text) {
    statusText.textContent = "Comment cannot be empty.";
    return;
  }
  if (text.length > MAX_COMMENT_LENGTH) {
    statusText.textContent = `Comment too long (max ${MAX_COMMENT_LENGTH} characters).`;
    return;
  }
  addCommentToReport(reportId, text);
  if (inputElement) inputElement.value = "";
});

if (startCameraButton) {
  startCameraButton.addEventListener("click", startCamera);
}

if (capturePhotoButton) {
  capturePhotoButton.addEventListener("click", capturePhotoFromCamera);
}

if (stopCameraButton) {
  stopCameraButton.addEventListener("click", stopCamera);
}

if (deletePhotoButton) {
  deletePhotoButton.addEventListener("click", clearSelectedPhoto);
}

if (imageInput) {
  imageInput.addEventListener("change", async () => {
    if (imageInput.files && imageInput.files[0]) {
      clearCapturedPhoto();
      try {
        const selectedFile = imageInput.files[0];
        if (!String(selectedFile.type || "").startsWith("image/")) {
          imageInput.value = "";
          statusText.textContent = "Only image files are allowed.";
          updateDeletePhotoButtonState();
          return;
        }
        if (selectedFile.size > MAX_UPLOAD_BYTES) {
          imageInput.value = "";
          statusText.textContent = "Image is too large. Please upload an image smaller than 8MB.";
          updateDeletePhotoButtonState();
          return;
        }
        const selectedImageDataUrl = await readImageAsDataUrl(selectedFile);
        const floodCheck = await evaluateFloodSceneFromDataUrl(selectedImageDataUrl);
        if (!floodCheck.isFloodLike) {
          imageInput.value = "";
          statusText.textContent =
            "Selected upload is not flood-related enough. Choose a photo showing flooding.";
        } else {
          statusText.textContent = "Flood-like upload verified. You can save this report.";
        }
      } catch (_error) {
        imageInput.value = "";
        statusText.textContent = "Could not verify selected image. Please choose another photo.";
      }
    }
    updateDeletePhotoButtonState();
  });
}

function ensureMap() {
  if (map || !window.L) {
    return;
  }

  map = window.L.map("photo-report-map", { zoomControl: true }).setView([7.95, -1.03], 7);
  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);
  markersLayer = window.L.layerGroup().addTo(map);
}

function renderReports() {
  const reports = loadReports();
  const markerMap = new Map();
  reportList.innerHTML = "";
  markersLayer.clearLayers();

  if (!reports.length) {
    const empty = document.createElement("p");
    empty.className = "report-time";
    empty.textContent = "No photo reports saved yet.";
    reportList.appendChild(empty);
    return;
  }

  const markerBounds = [];
  reports.forEach((report) => {
    const likes = countVotes(report.votes, 1);
    const dislikes = countVotes(report.votes, -1);
    const userVote = report.votes && report.votes[currentUserId] ? report.votes[currentUserId] : 0;
    const comments = Array.isArray(report.comments) ? report.comments : [];
    const marker = window.L.marker([report.latitude, report.longitude]).addTo(markersLayer);
    marker.bindPopup(`
      <strong>${escapeHtml(report.locationLabel)}</strong><br/>
      <small>${new Date(report.createdAt).toLocaleString()}</small><br/>
      <img src="${report.imageDataUrl}" alt="Flood report" style="width:120px;height:auto;border-radius:8px;margin-top:6px;" />
      ${report.note ? `<p style="margin:6px 0 0;">${escapeHtml(report.note)}</p>` : ""}
    `);

    markerBounds.push([report.latitude, report.longitude]);
    markerMap.set(report.id, marker);

    const card = document.createElement("article");
    card.className = "photo-report-item";

    const isOwner = !report.ownerId || report.ownerId === currentUserId;
    card.innerHTML = `
      <img src="${report.imageDataUrl}" alt="Flood scene at ${escapeHtml(report.locationLabel)}" />
      <div class="photo-report-content">
        <p class="report-headline">${escapeHtml(report.locationLabel)}</p>
        <p class="report-time">${new Date(report.createdAt).toLocaleString()}</p>
        ${report.note ? `<p class="report-body">${escapeHtml(report.note)}</p>` : ""}
        <div class="report-feedback">
          <button
            type="button"
            class="btn btn-secondary btn-small vote-btn ${userVote === 1 ? "active" : ""}"
            data-like-id="${report.id}"
          >
            👍 Like (${likes})
          </button>
          <button
            type="button"
            class="btn btn-secondary btn-small vote-btn ${userVote === -1 ? "active" : ""}"
            data-dislike-id="${report.id}"
          >
            👎 Dislike (${dislikes})
          </button>
        </div>
        <div class="comment-list">
          ${comments.length
            ? comments
                .slice(0, 5)
                .map(
                  (comment) => `
                    <p class="comment-item">
                      ${escapeHtml(comment.text)}
                      <span>${new Date(comment.createdAt).toLocaleString()}</span>
                    </p>
                  `,
                )
                .join("")
            : "<p class='comment-item empty'>No comments yet.</p>"}
        </div>
        <form class="comment-form" data-comment-report-id="${report.id}">
          <input
            type="text"
            maxlength="${MAX_COMMENT_LENGTH}"
            data-comment-input
            placeholder="Add a comment to confirm this report..."
          />
          <button type="submit" class="btn btn-secondary btn-small">Comment</button>
        </form>
        <div class="report-actions">
          <button type="button" class="btn btn-secondary btn-small" data-view-id="${report.id}">View on Map</button>
          ${
            isOwner
              ? `<button type="button" class="btn btn-danger btn-small" data-delete-id="${report.id}" title="Delete this report">Delete</button>`
              : ""
          }
        </div>
      </div>
    `;

    reportList.appendChild(card);
  });

  reportList._markerMap = markerMap;

  if (markerBounds.length > 1) {
    map.fitBounds(markerBounds, { padding: [20, 20] });
  } else {
    map.setView(markerBounds[0], 13);
  }
}

function focusReportOnMap(reportId) {
  const reports = loadReports();
  const report = reports.find((item) => String(item.id) === String(reportId));
  if (!report) {
    return;
  }

  map.setView([report.latitude, report.longitude], 14);
  const marker = reportList._markerMap && reportList._markerMap.get(report.id);
  if (marker) {
    marker.openPopup();
  }
}

function deleteReport(reportId) {
  const reports = loadReports();
  const target = reports.find((item) => String(item.id) === String(reportId));
  if (!target) {
    statusText.textContent = "Report not found.";
    return;
  }

  const isOwner = !target.ownerId || target.ownerId === currentUserId;
  if (!isOwner) {
    statusText.textContent = "You can only delete reports you posted.";
    return;
  }

  const confirmed = window.confirm("Delete this saved photo report?");
  if (!confirmed) {
    return;
  }

  const updated = reports.filter((item) => String(item.id) !== String(reportId));
  saveReports(updated);
  statusText.textContent = "Photo report deleted.";
  renderReports();
}

async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    statusText.textContent = "Camera is not supported on this browser/device.";
    return;
  }

  try {
    stopCamera();
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
    cameraPreview.srcObject = cameraStream;
    cameraPreview.classList.remove("hidden");
    capturePhotoButton.classList.remove("hidden");
    stopCameraButton.classList.remove("hidden");
    startCameraButton.classList.add("hidden");
    clearCapturedPhoto();
    statusText.textContent = "Camera ready. Capture when focused on flood scene.";
  } catch (_error) {
    statusText.textContent = "Could not access camera. Check permissions.";
  }
}

function capturePhotoFromCamera() {
  if (!cameraStream || !cameraPreview.videoWidth || !cameraPreview.videoHeight) {
    statusText.textContent = "Camera is not ready yet.";
    return;
  }

  cameraCanvas.width = cameraPreview.videoWidth;
  cameraCanvas.height = cameraPreview.videoHeight;
  const context = cameraCanvas.getContext("2d");
  if (!context) {
    statusText.textContent = "Could not capture image.";
    return;
  }

  context.drawImage(cameraPreview, 0, 0, cameraCanvas.width, cameraCanvas.height);
  const candidatePhotoDataUrl = cameraCanvas.toDataURL("image/jpeg", 0.9);
  const floodCheck = evaluateFloodSceneFromCanvas(cameraCanvas);
  if (!floodCheck.isFloodLike) {
    statusText.textContent =
      "Capture blocked: scene is not flood-related enough. Point camera at flooding and try again.";
    return;
  }
  capturedPhotoDataUrl = candidatePhotoDataUrl;
  capturedPhotoPreview.src = capturedPhotoDataUrl;
  capturedPhotoPreview.classList.remove("hidden");
  imageInput.value = "";
  updateDeletePhotoButtonState();
  statusText.textContent = "Photo captured. Fill location and save report.";
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
  if (cameraPreview) {
    cameraPreview.srcObject = null;
    cameraPreview.classList.add("hidden");
  }
  if (capturePhotoButton) {
    capturePhotoButton.classList.add("hidden");
  }
  if (stopCameraButton) {
    stopCameraButton.classList.add("hidden");
  }
  if (startCameraButton) {
    startCameraButton.classList.remove("hidden");
  }
}

function clearCapturedPhoto() {
  capturedPhotoDataUrl = "";
  capturedPhotoPreview.src = "";
  capturedPhotoPreview.classList.add("hidden");
  updateDeletePhotoButtonState();
}

function clearSelectedPhoto() {
  const hadPhoto = Boolean(
    capturedPhotoDataUrl || (imageInput && imageInput.files && imageInput.files.length),
  );
  if (imageInput) {
    imageInput.value = "";
  }
  clearCapturedPhoto();
  if (hadPhoto) {
    statusText.textContent = "Selected photo removed.";
  }
}

function updateDeletePhotoButtonState() {
  if (!deletePhotoButton) return;
  const hasPhoto = Boolean(
    capturedPhotoDataUrl || (imageInput && imageInput.files && imageInput.files.length),
  );
  deletePhotoButton.disabled = !hasPhoto;
}

async function resolveGhanaLocation(query) {
  const aliasMatch = getAliasCoordinates(query);
  if (aliasMatch) {
    return aliasMatch;
  }

  const normalizedQuery = query.toLowerCase().includes("ghana")
    ? query
    : `${query}, Ghana`;

  const providers = [geocodeByOpenMeteo, geocodeByNominatim];
  for (const provider of providers) {
    const result = await provider(normalizedQuery).catch(() => null);
    if (!result) {
      continue;
    }
    if (!isWithinGhana(result.latitude, result.longitude)) {
      continue;
    }
    return result;
  }

  throw new Error("Location not found in Ghana. Try nearby landmarks.");
}

function getAliasCoordinates(query) {
  const key = normalizePlaceKey(query);
  let alias = LOCATION_ALIASES[key];
  if (!alias) {
    const matchedKey = Object.keys(LOCATION_ALIASES).find((candidate) =>
      key.includes(candidate),
    );
    alias = matchedKey ? LOCATION_ALIASES[matchedKey] : null;
  }

  if (!alias) {
    return null;
  }

  return {
    name: alias.name,
    latitude: alias.latitude,
    longitude: alias.longitude,
  };
}

async function geocodeByOpenMeteo(query) {
  const url =
    "https://geocoding-api.open-meteo.com/v1/search?count=1&countryCode=GH&name=" +
    encodeURIComponent(query);
  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }
  const data = await response.json();
  if (!data.results || !data.results.length) {
    return null;
  }
  const first = data.results[0];
  return {
    name: first.name,
    latitude: first.latitude,
    longitude: first.longitude,
  };
}

async function geocodeByNominatim(query) {
  const url =
    "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=gh&q=" +
    encodeURIComponent(query);
  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }
  const data = await response.json();
  if (!Array.isArray(data) || !data.length) {
    return null;
  }
  const first = data[0];
  return {
    name: (first.display_name || query).split(",")[0].trim(),
    latitude: Number(first.lat),
    longitude: Number(first.lon),
  };
}

function loadReports() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ({
      ...item,
      votes:
        item && item.votes && typeof item.votes === "object" && !Array.isArray(item.votes)
          ? item.votes
          : {},
      comments: Array.isArray(item && item.comments) ? item.comments : [],
    }));
  } catch (_error) {
    return [];
  }
}

function saveReports(reports) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

function applyVote(reportId, voteValue) {
  const reports = loadReports();
  const report = reports.find((item) => String(item.id) === String(reportId));
  if (!report) {
    statusText.textContent = "Report not found for voting.";
    return;
  }
  const existingVote = Number(report.votes[currentUserId] || 0);
  if (existingVote === voteValue) {
    delete report.votes[currentUserId];
  } else {
    report.votes[currentUserId] = voteValue;
  }
  saveReports(reports);
  renderReports();
}

function countVotes(votes, direction) {
  if (!votes || typeof votes !== "object") return 0;
  return Object.values(votes).filter((value) => Number(value) === direction).length;
}

function addCommentToReport(reportId, commentText) {
  const reports = loadReports();
  const report = reports.find((item) => String(item.id) === String(reportId));
  if (!report) {
    statusText.textContent = "Report not found for commenting.";
    return;
  }
  report.comments = Array.isArray(report.comments) ? report.comments : [];
  report.comments.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    userId: currentUserId,
    text: commentText,
    createdAt: new Date().toISOString(),
  });
  report.comments = report.comments.slice(0, MAX_COMMENTS_PER_REPORT);
  saveReports(reports);
  statusText.textContent = "Comment added.";
  renderReports();
}

function getOrCreateCurrentUserId() {
  let id = localStorage.getItem(USER_ID_STORAGE_KEY);
  if (id) {
    return id;
  }
  id = `user-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  localStorage.setItem(USER_ID_STORAGE_KEY, id);
  return id;
}

function isWithinGhana(latitude, longitude) {
  return (
    latitude >= GHANA_BOUNDS.minLat &&
    latitude <= GHANA_BOUNDS.maxLat &&
    longitude >= GHANA_BOUNDS.minLon &&
    longitude <= GHANA_BOUNDS.maxLon
  );
}

function normalizePlaceKey(value) {
  return value
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read selected image."));
    reader.readAsDataURL(file);
  });
}

function compressImage(dataUrl, maxSize, quality) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(maxSize / image.width, maxSize / image.height, 1);
      const width = Math.round(image.width * scale);
      const height = Math.round(image.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Could not process image."));
        return;
      }
      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    image.onerror = () => reject(new Error("Could not process image."));
    image.src = dataUrl;
  });
}

async function evaluateFloodSceneFromDataUrl(dataUrl) {
  const image = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  const maxDimension = 360;
  const scale = Math.min(maxDimension / image.width, maxDimension / image.height, 1);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return { isFloodLike: false, score: 0 };
  context.drawImage(image, 0, 0, width, height);
  return evaluateFloodSceneFromCanvas(canvas);
}

function evaluateFloodSceneFromCanvas(canvas) {
  const context = canvas.getContext("2d");
  if (!context) return { isFloodLike: false, score: 0 };
  const { width, height } = canvas;
  const imageData = context.getImageData(0, 0, width, height).data;

  let sampled = 0;
  let waterLike = 0;
  let lowerHalfWaterLike = 0;
  let reflectiveLike = 0;
  let highDetailColorLike = 0;
  const step = 6;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const index = (y * width + x) * 4;
      const r = imageData[index] / 255;
      const g = imageData[index + 1] / 255;
      const b = imageData[index + 2] / 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const saturation = max === 0 ? 0 : (max - min) / max;
      const brightness = (r + g + b) / 3;
      sampled += 1;

      const isBlueGrayWater =
        b >= g * 0.94 &&
        g >= r * 0.9 &&
        saturation <= 0.26 &&
        brightness >= 0.16 &&
        brightness <= 0.78;
      const isMuddyWater =
        r >= g * 0.95 &&
        g >= b * 0.88 &&
        saturation <= 0.28 &&
        brightness >= 0.16 &&
        brightness <= 0.68;
      const isWaterLike = isBlueGrayWater || isMuddyWater;
      const isReflectiveWater = isWaterLike && brightness >= 0.52 && saturation <= 0.17;
      const isHighDetailColor = saturation >= 0.5 && brightness >= 0.2 && brightness <= 0.9;

      if (isWaterLike) {
        waterLike += 1;
        if (y >= height * 0.45) {
          lowerHalfWaterLike += 1;
        }
      }
      if (isReflectiveWater) reflectiveLike += 1;
      if (isHighDetailColor) highDetailColorLike += 1;
    }
  }

  if (!sampled) return { isFloodLike: false, score: 0 };

  const waterRatio = waterLike / sampled;
  const lowerHalfWaterRatio = lowerHalfWaterLike / sampled;
  const reflectiveRatio = reflectiveLike / sampled;
  const detailColorRatio = highDetailColorLike / sampled;
  const score = clampScore(
    waterRatio * 0.8 + lowerHalfWaterRatio * 0.15 + reflectiveRatio * 0.05 - detailColorRatio * 0.1,
  );
  const isFloodLike =
    score >= FLOOD_SCENE_MIN_SCORE && waterRatio >= 0.2 && lowerHalfWaterRatio >= 0.16;

  return {
    isFloodLike,
    score,
  };
}

function clampScore(value) {
  return Math.min(1, Math.max(0, value));
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not process image for flood detection."));
    image.src = dataUrl;
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
