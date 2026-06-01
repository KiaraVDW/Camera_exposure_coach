const video = document.querySelector("#cameraPreview");
const canvas = document.querySelector("#analysisCanvas");
const connectionStatus = document.querySelector("#connectionStatus");
const cameraState = document.querySelector("#cameraState");
const previewPlaceholder = document.querySelector("#previewPlaceholder");
const appMessage = document.querySelector("#appMessage");
const resultCard = document.querySelector("#resultCard");
const exposureStatus = document.querySelector("#exposureStatus");
const brightnessValue = document.querySelector("#brightnessValue");
const contrastValue = document.querySelector("#contrastValue");
const exposureTip = document.querySelector("#exposureTip");
const measurementTime = document.querySelector("#measurementTime");
const savedMeasurement = document.querySelector("#savedMeasurement");
const checklist = document.querySelector("#shootChecklist");

const startCameraButton = document.querySelector("#startCamera");
const measureExposureButton = document.querySelector("#measureExposure");
const stopCameraButton = document.querySelector("#stopCamera");
const saveMeasurementButton = document.querySelector("#saveMeasurement");
const testNotificationButton = document.querySelector("#testNotification");

const MEASUREMENT_KEY = "cameraExposureCoach.lastMeasurement";
const CHECKLIST_KEY = "cameraExposureCoach.checklist";

let currentStream = null;
let lastMeasurement = null;

function showMessage(text) {
  appMessage.textContent = text;
}

function updateConnectionStatus() {
  const isOnline = navigator.onLine;
  connectionStatus.textContent = isOnline ? "Online" : "Offline";
  connectionStatus.classList.toggle("offline", !isOnline);
}

function setCameraActive(isActive) {
  cameraState.textContent = isActive ? "Camera actief" : "Camera niet actief";
  previewPlaceholder.classList.toggle("hidden", isActive);
}

async function startCamera() {
  stopCamera();

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showMessage("Camera niet beschikbaar in deze browser.");
    return;
  }

  try {
    currentStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false
    });
  } catch (environmentError) {
    try {
      currentStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });
    } catch (cameraError) {
      showMessage("Camera-toegang geweigerd of camera niet beschikbaar.");
      setCameraActive(false);
      return;
    }
  }

  video.srcObject = currentStream;
  setCameraActive(true);
  showMessage("Camera gestart. Je kunt nu de belichting meten.");
}

function stopCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach((track) => track.stop());
  }

  currentStream = null;
  video.srcObject = null;
  setCameraActive(false);
}

function calculateExposure(imageData) {
  const pixels = imageData.data;
  let totalBrightness = 0;
  let darkPixels = 0;
  let brightPixels = 0;
  const pixelCount = pixels.length / 4;

  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const brightness = (red + green + blue) / 3;

    totalBrightness += brightness;

    if (brightness < 45) {
      darkPixels += 1;
    }

    if (brightness > 220) {
      brightPixels += 1;
    }
  }

  const brightnessPercent = Math.round((totalBrightness / pixelCount / 255) * 100);
  const darkPercent = Math.round((darkPixels / pixelCount) * 100);
  const brightPercent = Math.round((brightPixels / pixelCount) * 100);
  const contrastScore = Math.min(100, Math.round(brightPercent + darkPercent));

  let status = "Goed belicht";
  let stateClass = "state-good";

  if (brightnessPercent < 30) {
    status = "Te donker";
    stateClass = "state-dark";
  } else if (brightnessPercent > 70) {
    status = "Te fel";
    stateClass = "state-bright";
  }

  let tip = "Belichting ziet er bruikbaar uit.";

  if (brightPercent > 18) {
    tip = "Let op voor overbelichting.";
  } else if (darkPercent > 28) {
    tip = "Er is waarschijnlijk te weinig licht.";
  }

  return {
    status,
    brightnessPercent,
    contrast: `${contrastScore}% verschil tussen lichte en donkere pixels`,
    tip,
    time: new Date().toLocaleString("nl-BE"),
    stateClass
  };
}

function updateResult(measurement) {
  exposureStatus.textContent = measurement.status;
  brightnessValue.textContent = `${measurement.brightnessPercent}%`;
  contrastValue.textContent = measurement.contrast;
  exposureTip.textContent = measurement.tip;
  measurementTime.textContent = measurement.time;

  resultCard.classList.remove("state-idle", "state-dark", "state-good", "state-bright");
  resultCard.classList.add(measurement.stateClass);
}

function measureExposure() {
  if (!currentStream || !video.videoWidth) {
    showMessage("Start eerst de camera voor je een meting doet.");
    return;
  }

  const width = video.videoWidth;
  const height = video.videoHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  canvas.width = width;
  canvas.height = height;
  context.drawImage(video, 0, 0, width, height);

  const imageData = context.getImageData(0, 0, width, height);
  lastMeasurement = calculateExposure(imageData);
  updateResult(lastMeasurement);
  showMessage("Belichting gemeten. Je kunt deze meting bewaren.");
}

function renderSavedMeasurement(measurement) {
  if (!measurement) {
    savedMeasurement.textContent = "Nog geen meting opgeslagen.";
    return;
  }

  savedMeasurement.innerHTML = `
    <strong>${measurement.status}</strong> - ${measurement.brightnessPercent}% helderheid<br>
    ${measurement.contrast}<br>
    ${measurement.tip}<br>
    Opgeslagen: ${measurement.time}
  `;
}

function saveMeasurement() {
  if (!lastMeasurement) {
    showMessage("Er is nog geen meting gedaan.");
    return;
  }

  localStorage.setItem(MEASUREMENT_KEY, JSON.stringify(lastMeasurement));
  renderSavedMeasurement(lastMeasurement);
  showMessage("Belichting opgeslagen voor deze shoot.");
  showNotification("Belichting opgeslagen voor deze shoot.");
}

async function showNotification(text) {
  if (!("Notification" in window)) {
    showMessage("Notificaties worden niet ondersteund in deze browser.");
    return;
  }

  const permission = Notification.permission === "default"
    ? await Notification.requestPermission()
    : Notification.permission;

  if (permission === "granted") {
    new Notification("Camera Exposure Coach", {
      body: text,
      icon: "icons/icon-192.png"
    });
  } else {
    showMessage("Notificaties zijn geweigerd.");
  }
}

function saveChecklist() {
  const checklistData = {};

  checklist.querySelectorAll("input[type='checkbox']").forEach((item) => {
    checklistData[item.name] = item.checked;
  });

  localStorage.setItem(CHECKLIST_KEY, JSON.stringify(checklistData));
}

function loadChecklist() {
  const savedChecklist = JSON.parse(localStorage.getItem(CHECKLIST_KEY) || "{}");

  checklist.querySelectorAll("input[type='checkbox']").forEach((item) => {
    item.checked = Boolean(savedChecklist[item.name]);
  });
}

function loadSavedMeasurement() {
  const saved = localStorage.getItem(MEASUREMENT_KEY);

  if (!saved) {
    renderSavedMeasurement(null);
    return;
  }

  try {
    const measurement = JSON.parse(saved);
    lastMeasurement = measurement;
    updateResult(measurement);
    renderSavedMeasurement(measurement);
  } catch (error) {
    localStorage.removeItem(MEASUREMENT_KEY);
    renderSavedMeasurement(null);
  }
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js")
      .then(() => console.log("Service worker registered"))
      .catch((error) => console.log("Service worker registration failed", error));
  }
}

startCameraButton.addEventListener("click", startCamera);
measureExposureButton.addEventListener("click", measureExposure);
stopCameraButton.addEventListener("click", () => {
  stopCamera();
  showMessage("Camera gestopt.");
});
saveMeasurementButton.addEventListener("click", saveMeasurement);
testNotificationButton.addEventListener("click", () => {
  showNotification("Belichting opgeslagen voor deze shoot.");
});
checklist.addEventListener("change", saveChecklist);
window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);

window.addEventListener("load", () => {
  updateConnectionStatus();
  setCameraActive(false);
  loadChecklist();
  loadSavedMeasurement();
  registerServiceWorker();
});
