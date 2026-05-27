let barcodeStream = null;
let barcodeScanTimer = null;
let homeUnifiedScanInput = null;
let homeUnifiedScanBusy = false;

function show(el, display = "block") {
  if (el) el.style.display = display;
}

function hide(el) {
  if (el) el.style.display = "none";
}

async function startBarcodeScanner() {
  const video = document.getElementById("barcodeVideo");
  const box = document.getElementById("barcodeScannerBox");
  const status = document.getElementById("barcodeScannerStatus");
  const input = document.getElementById("barcodeInput");
  const startBtn = document.getElementById("startBarcodeScanner");
  const stopBtn = document.getElementById("stopBarcodeScanner");
  const form = document.getElementById("barcodeLookupForm");

  if (!video || !box || !status || !input || !form) return;

  show(box);
  status.textContent = "Starting camera...";

  if (!("BarcodeDetector" in window)) {
    status.textContent = "This browser does not support live barcode scanning. Use barcode photo scan or type the barcode manually.";
    return;
  }

  try {
    barcodeStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false
    });

    video.srcObject = barcodeStream;
    await video.play();

    hide(startBtn);
    show(stopBtn, "inline-flex");
    status.textContent = "Scanning... point the camera at the barcode.";

    const detector = new BarcodeDetector({
      formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"]
    });

    barcodeScanTimer = setInterval(async () => {
      try {
        const codes = await detector.detect(video);
        if (codes.length > 0) {
          const code = codes[0].rawValue;
          input.value = code;
          status.textContent = `Found barcode: ${code}`;
          stopBarcodeScanner();
          form.submit();
        }
      } catch (error) {
        status.textContent = `Scanner error: ${error.message}`;
      }
    }, 600);
  } catch (error) {
    status.textContent = `Camera error: ${error.message}`;
    show(startBtn, "inline-flex");
    hide(stopBtn);
  }
}

function stopBarcodeScanner() {
  const startBtn = document.getElementById("startBarcodeScanner");
  const stopBtn = document.getElementById("stopBarcodeScanner");

  if (barcodeScanTimer) {
    clearInterval(barcodeScanTimer);
    barcodeScanTimer = null;
  }

  if (barcodeStream) {
    for (const track of barcodeStream.getTracks()) track.stop();
    barcodeStream = null;
  }

  show(startBtn, "inline-flex");
  hide(stopBtn);
}

function resetFileInput(input) {
  if (!input) return;
  try {
    input.value = "";
  } catch (error) {
    // Some mobile browsers are weird about file inputs. Replacing the node
    // is overkill here because clearing the value is enough in normal cases.
  }
}

function openFilePicker(input, status, message = "Opening camera/photo picker...") {
  if (!input) return;
  if (status) status.textContent = message;

  // Important on mobile: clear the previous selection before opening the picker.
  // Otherwise Chrome/Safari can treat the same camera/input as already used and
  // the second tap may not fire a change event.
  resetFileInput(input);
  input.click();
}

function submitScanForm(form) {
  if (!form) return;

  if (typeof form.requestSubmit === "function") {
    form.requestSubmit();
    return;
  }

  const event = new Event("submit", { bubbles: true, cancelable: true });
  form.dispatchEvent(event);
}

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = reject;
    img.src = url;
  });
}

async function fileToCompressedDataUrl(file) {
  const img = await fileToImage(file);
  const maxSide = 1400;
  let { width, height } = img;

  if (width > height && width > maxSide) {
    height = Math.round((height * maxSide) / width);
    width = maxSide;
  } else if (height > maxSide) {
    width = Math.round((width * maxSide) / height);
    height = maxSide;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", 0.82);
}

function encodeFoodPayload(food) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(food))));
}

function decodeFoodPayload(payload) {
  return JSON.parse(decodeURIComponent(escape(atob(payload))));
}

function parseServingGrams(baseUnit) {
  const text = String(baseUnit || "").toLowerCase();
  const match = text.match(/(\d+(?:\.\d+)?)\s*g\b/);
  if (!match) return null;

  const grams = Number(match[1]);
  return Number.isFinite(grams) && grams > 0 ? grams : null;
}

function roundedMacro(value) {
  const num = Number(value || 0);
  return Math.round(num * 10) / 10;
}

function numericInput(name, label, value, step = "0.1") {
  return `
    <label>${label}
      <input class="input" name="${name}" type="number" step="${step}" value="${roundedMacro(value)}" required />
    </label>`;
}

function textInput(name, label, value, placeholder = "") {
  return `
    <label>${label}
      <input class="input" name="${name}" value="${String(value || "").replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}" placeholder="${placeholder}" required />
    </label>`;
}

function maybeScaleBarcodeFoodServing(food) {
  const servingGrams = parseServingGrams(food.baseUnit);
  if (!servingGrams || servingGrams >= 100) return { food, scaled: false };

  const calories = Number(food.calories || 0);
  const protein = Number(food.protein || 0);
  const carbs = Number(food.carbs || 0);
  const fat = Number(food.fat || 0);
  const sugar = Number(food.sugar || 0);
  const fiber = Number(food.fiber || 0);

  // OpenFoodFacts sometimes returns only *_100g values. The old backend then
  // treated those as one serving. Detect impossible serving math and scale from
  // per-100g to the package serving size, e.g. 556 cal/100g -> 250 cal/45g.
  const impossibleCalories = calories > servingGrams * 9 + 20;
  const impossibleMacroWeight = protein + carbs + fat + sugar + fiber > servingGrams * 1.35;

  if (!impossibleCalories && !impossibleMacroWeight) return { food, scaled: false };

  const factor = servingGrams / 100;
  return {
    food: {
      ...food,
      calories: roundedMacro(calories * factor),
      protein: roundedMacro(protein * factor),
      carbs: roundedMacro(carbs * factor),
      fat: roundedMacro(fat * factor),
      sugar: roundedMacro(sugar * factor),
      fiber: roundedMacro(fiber * factor)
    },
    scaled: true
  };
}

function renderMacroPills(pillRow, food) {
  if (!pillRow) return;
  pillRow.innerHTML = `
    <span class="pill">${Math.round(Number(food.calories || 0))} cal</span>
    <span class="pill">P ${roundedMacro(food.protein)}g</span>
    <span class="pill">C ${roundedMacro(food.carbs)}g</span>
    <span class="pill">F ${roundedMacro(food.fat)}g</span>
    <span class="pill">Sug ${roundedMacro(food.sugar)}g</span>
    <span class="pill">Fib ${roundedMacro(food.fiber)}g</span>
  `;
}

function addBarcodeServingNote(form, food, scaled) {
  const existing = document.getElementById("barcodeServingNote");
  if (existing) existing.remove();

  const note = document.createElement("p");
  note.id = "barcodeServingNote";
  note.className = "muted";
  note.textContent = scaled
    ? `Showing macros for 1 serving (${food.baseUnit || "serving"}). Source: barcode database returned per-100g nutrition, so the app scaled it to the serving size. Whole package size: unknown unless the serving is the full package.`
    : `Showing macros for 1 serving (${food.baseUnit || "serving"}). Source: barcode database serving values. Whole package size: unknown unless the serving is the full package.`;

  const pillRow = form.querySelector(".pill-row");
  if (pillRow) pillRow.insertAdjacentElement("afterend", note);
  else form.appendChild(note);
}

function addEditableConfirmationFields(form, food) {
  if (document.getElementById("editableNutritionFields")) return;

  const fields = document.createElement("div");
  fields.id = "editableNutritionFields";
  fields.className = "grid-form";
  fields.innerHTML = `
    ${numericInput("baseQty", "Serving quantity", food.baseQty || 1, "0.001")}
    ${textInput("baseUnit", "Serving unit", food.baseUnit || "serving", "45 g / cup / serving")}
    ${numericInput("calories", "Calories", food.calories || 0)}
    ${numericInput("protein", "Protein g", food.protein || 0)}
    ${numericInput("carbs", "Carbs g", food.carbs || 0)}
    ${numericInput("fat", "Fat g", food.fat || 0)}
    ${numericInput("sugar", "Sugar g", food.sugar || 0)}
    ${numericInput("fiber", "Fiber g", food.fiber || 0)}
  `;

  const pillRow = form.querySelector(".pill-row");
  if (pillRow) pillRow.insertAdjacentElement("beforebegin", fields);
  else form.appendChild(fields);

  form.addEventListener("submit", () => {
    const hiddenFoodInput = form.querySelector("input[name='food']");
    if (!hiddenFoodInput) return;

    let current = {};
    try {
      current = decodeFoodPayload(hiddenFoodInput.value);
    } catch (error) {
      current = {};
    }

    const updated = {
      ...current,
      baseQty: Number(form.querySelector("input[name='baseQty']")?.value || 1),
      baseUnit: form.querySelector("input[name='baseUnit']")?.value || "serving",
      calories: Number(form.querySelector("input[name='calories']")?.value || 0),
      protein: Number(form.querySelector("input[name='protein']")?.value || 0),
      carbs: Number(form.querySelector("input[name='carbs']")?.value || 0),
      fat: Number(form.querySelector("input[name='fat']")?.value || 0),
      sugar: Number(form.querySelector("input[name='sugar']")?.value || 0),
      fiber: Number(form.querySelector("input[name='fiber']")?.value || 0)
    };

    hiddenFoodInput.value = encodeFoodPayload(updated);
  });
}

function fixConfirmPackagedFoodIfNeeded() {
  const form = document.getElementById("confirm-package-form");
  if (!form) return;

  const hiddenFoodInput = form.querySelector("input[name='food']");
  if (!hiddenFoodInput || !hiddenFoodInput.value) return;

  try {
    const originalFood = decodeFoodPayload(hiddenFoodInput.value);
    const { food, scaled } = maybeScaleBarcodeFoodServing(originalFood);

    hiddenFoodInput.value = encodeFoodPayload(food);

    const servingLine = form.querySelector("p");
    if (servingLine) {
      servingLine.textContent = scaled
        ? `${food.baseQty || 1} ${food.baseUnit || "serving"} — corrected from barcode per-100g data`
        : `${food.baseQty || 1} ${food.baseUnit || "serving"}`;
    }

    renderMacroPills(form.querySelector(".pill-row"), food);
    addEditableConfirmationFields(form, food);
    addBarcodeServingNote(form, food, scaled);
  } catch (error) {
    // If the hidden payload is not the expected format, leave the page alone.
  }
}

function collapseManualFoodForm() {
  const cards = [...document.querySelectorAll("section.card")];
  const manualCard = cards.find((card) => card.querySelector("h2")?.textContent?.includes("Add food manually"));
  if (!manualCard) return;

  const form = manualCard.querySelector("form");
  if (!form || document.getElementById("toggleManualFoodForm")) return;

  form.style.display = "none";

  const button = document.createElement("button");
  button.id = "toggleManualFoodForm";
  button.className = "button wide";
  button.type = "button";
  button.textContent = "+ Add food manually";

  const note = document.createElement("p");
  note.className = "muted";
  note.textContent = "Usually you will scan a barcode or Nutrition Facts label instead.";

  manualCard.insertBefore(button, form);
  manualCard.insertBefore(note, form);

  button.addEventListener("click", () => {
    const isHidden = form.style.display === "none";
    form.style.display = isHidden ? "grid" : "none";
    button.textContent = isHidden ? "Hide manual add" : "+ Add food manually";
  });
}

function submitHiddenPost(action, fields) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = action;
  Object.entries(fields).forEach(([name, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
}

function getHomeUnifiedScanInput() {
  if (homeUnifiedScanInput) return homeUnifiedScanInput;
  homeUnifiedScanInput = document.createElement("input");
  homeUnifiedScanInput.type = "file";
  homeUnifiedScanInput.accept = "image/*";
  homeUnifiedScanInput.capture = "environment";
  homeUnifiedScanInput.style.position = "fixed";
  homeUnifiedScanInput.style.left = "-9999px";
  homeUnifiedScanInput.style.top = "0";
  homeUnifiedScanInput.setAttribute("aria-hidden", "true");
  document.body.appendChild(homeUnifiedScanInput);
  return homeUnifiedScanInput;
}

function scanIconSvg() {
  return `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M14 23v-7a2 2 0 0 1 2-2h7"/><path d="M41 14h7a2 2 0 0 1 2 2v7"/>
    <path d="M50 41v7a2 2 0 0 1-2 2h-7"/><path d="M23 50h-7a2 2 0 0 1-2-2v-7"/>
    <path d="M24 28v8M30 28v8M36 28v8M42 28v8"/>
  </svg>`;
}

function ensureHomeScanOverlay() {
  let overlay = document.querySelector(".scan-overlay.home-scan-overlay");
  if (overlay) return overlay;
  overlay = document.createElement("div");
  overlay.className = "scan-overlay home-scan-overlay";
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");
  overlay.innerHTML = `<div class="scan-overlay-card">
    <div class="scan-ring" style="--scan-progress:6"><div class="scan-ring-icon">${scanIconSvg()}</div></div>
    <h2 class="scan-overlay-title">Scanning your food</h2>
    <p class="scan-overlay-subtitle">We’ll check barcode first, then the nutrition label if needed.</p>
    <div class="scan-step-list">
      <div class="scan-step" data-step="barcode"><div class="scan-step-num">1</div><div class="scan-step-label">Barcode check</div><div class="scan-chip scan-active">Starting…</div></div>
      <div class="scan-step" data-step="label"><div class="scan-step-num">2</div><div class="scan-step-label">Nutrition label check</div><div class="scan-chip">Waiting</div></div>
    </div>
    <div class="scan-footer"><span class="scan-footer-star">✦</span><span>Hang tight! This helps us give you accurate nutrition data.</span></div>
  </div>`;
  document.body.appendChild(overlay);
  return overlay;
}

function updateHomeScanOverlay({ progress, barcode, label, title, subtitle, error = false } = {}) {
  const overlay = ensureHomeScanOverlay();
  const card = overlay.querySelector(".scan-overlay-card");
  const ring = overlay.querySelector(".scan-ring");
  if (typeof progress === "number") ring?.style.setProperty("--scan-progress", String(Math.max(0, Math.min(100, progress))));
  if (title) overlay.querySelector(".scan-overlay-title").textContent = title;
  if (subtitle) overlay.querySelector(".scan-overlay-subtitle").textContent = subtitle;
  card?.classList.toggle("scan-error-state", Boolean(error));

  const setStep = (name, data) => {
    if (!data) return;
    const chip = overlay.querySelector(`[data-step='${name}'] .scan-chip`);
    if (!chip) return;
    chip.textContent = data.text || chip.textContent;
    chip.className = `scan-chip ${data.state ? `scan-${data.state}` : ""}`.trim();
  };
  setStep("barcode", barcode);
  setStep("label", label);
}

function hideHomeScanOverlay(delay = 0) {
  window.setTimeout(() => {
    const overlay = document.querySelector(".scan-overlay.home-scan-overlay");
    if (overlay?.isConnected) overlay.remove();
  }, delay);
}

function failHomeScanOverlay(message) {
  updateHomeScanOverlay({
    progress: 100,
    title: "Couldn’t scan this photo",
    subtitle: message || "Try a clearer Nutrition Facts label or barcode.",
    barcode: { text: "Not found", state: "error" },
    label: { text: "Not found", state: "error" },
    error: true
  });
  homeUnifiedScanBusy = false;
}

async function handleHomeUnifiedFoodPhoto(file) {
  if (!file || homeUnifiedScanBusy) return;
  homeUnifiedScanBusy = true;
  try {
    updateHomeScanOverlay({ progress: 14, barcode: { text: "Preparing…", state: "active" }, label: { text: "Waiting", state: "idle" } });
    const imageDataUrl = await fileToCompressedDataUrl(file);

    updateHomeScanOverlay({ progress: 30, barcode: { text: "Scanning…", state: "active" }, label: { text: "Waiting", state: "idle" } });
    const barcodeResponse = await fetch("/foods/barcode-image-scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageDataUrl }),
      credentials: "same-origin"
    });
    const barcodeData = await barcodeResponse.json().catch(() => ({}));
    const barcode = String(barcodeData.barcode || "").replace(/\D/g, "");
    if (barcodeResponse.ok && barcode) {
      updateHomeScanOverlay({ progress: 100, barcode: { text: "Barcode found", state: "success" }, label: { text: "Skipped", state: "idle" } });
      window.setTimeout(() => submitHiddenPost("/foods/barcode", { barcode }), 350);
      return;
    }

    updateHomeScanOverlay({ progress: 48, barcode: { text: "No barcode found", state: "warn" }, label: { text: "Scanning…", state: "active" } });
    const labelResponse = await fetch("/foods/label-scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageDataUrl }),
      credentials: "same-origin"
    });
    const labelData = await labelResponse.json().catch(() => ({}));
    if (!labelResponse.ok || !labelData.food) throw new Error(labelData.error || "Could not read Nutrition Facts.");
    updateHomeScanOverlay({ progress: 100, barcode: { text: "No barcode found", state: "warn" }, label: { text: "Nutrition label found", state: "success" } });
    window.setTimeout(() => submitHiddenPost("/foods/confirm-scanned-label", { food: encodeFoodPayload(labelData.food) }), 350);
  } catch (error) {
    failHomeScanOverlay(error.message || "Scan failed. Try again.");
  }
}

function shouldHandleHomeScanClick(target) {
  const action = target.closest?.("a,button");
  if (!action) return null;
  const pageTitle = (document.querySelector("h1")?.textContent || "").trim().toLowerCase();
  if (pageTitle !== "today" && pageTitle !== "home") return null;
  const label = (action.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
  const href = action.getAttribute("href") || "";
  if (href === "#scan-food" || (action.classList.contains("today-action") && label.includes("scan food"))) return action;
  return null;
}

function bindHomeUnifiedScanDelegation() {
  if (window.__homeUnifiedScanDelegationBound) return;
  window.__homeUnifiedScanDelegationBound = true;
  document.addEventListener("click", (event) => {
    const action = shouldHandleHomeScanClick(event.target);
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const input = getHomeUnifiedScanInput();
    resetFileInput(input);
    input.onchange = () => handleHomeUnifiedFoodPhoto(input.files && input.files[0]);
    input.click();
  }, true);
}

async function handleLabelScan(event) {
  event.preventDefault();

  const input = document.getElementById("labelImageInput");
  const status = document.getElementById("labelScanStatus");

  if (!input || !status) return;

  const file = input.files && input.files[0];
  if (!file) {
    openFilePicker(input, status, "Choose or take a Nutrition Facts label photo...");
    return;
  }

  status.textContent = "Compressing photo...";

  try {
    const imageDataUrl = await fileToCompressedDataUrl(file);
    status.textContent = "Reading Nutrition Facts label...";

    const response = await fetch("/foods/label-scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageDataUrl })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not scan label.");
    if (!data.food) throw new Error("No food data returned from label scan.");

    status.textContent = "Label read. Opening confirmation...";

    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/foods/confirm-scanned-label";

    const foodInput = document.createElement("input");
    foodInput.type = "hidden";
    foodInput.name = "food";
    foodInput.value = encodeFoodPayload(data.food);

    form.appendChild(foodInput);
    document.body.appendChild(form);
    form.submit();
  } catch (error) {
    resetFileInput(input);
    status.textContent = `Label scan failed: ${error.message}`;
  }
}

async function handleBarcodeImageScan(event) {
  event.preventDefault();

  const input = document.getElementById("barcodeImageInput");
  const status = document.getElementById("barcodeImageScanStatus");

  if (!input || !status) return;

  const file = input.files && input.files[0];
  if (!file) {
    openFilePicker(input, status, "Choose or take a clear barcode photo...");
    return;
  }

  status.textContent = "Compressing barcode photo...";

  try {
    const imageDataUrl = await fileToCompressedDataUrl(file);
    status.textContent = "Reading barcode...";

    const response = await fetch("/foods/barcode-image-scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageDataUrl })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not scan barcode.");

    const barcode = String(data.barcode || "").replace(/\D/g, "");
    if (!barcode) throw new Error("No barcode number found.");

    status.textContent = `Found barcode ${barcode}. Looking up product...`;

    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/foods/barcode";

    const barcodeInput = document.createElement("input");
    barcodeInput.type = "hidden";
    barcodeInput.name = "barcode";
    barcodeInput.value = barcode;

    form.appendChild(barcodeInput);
    document.body.appendChild(form);
    form.submit();
  } catch (error) {
    resetFileInput(input);
    status.textContent = `Barcode scan failed: ${error.message}`;
  }
}

bindHomeUnifiedScanDelegation();

document.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.getElementById("startBarcodeScanner");
  const stopBtn = document.getElementById("stopBarcodeScanner");
  const labelForm = document.getElementById("labelScanForm");
  const barcodeImageForm = document.getElementById("barcodeImageScanForm");
  const labelImageInput = document.getElementById("labelImageInput");
  const barcodeImageInput = document.getElementById("barcodeImageInput");
  const labelScanButton = labelForm ? labelForm.querySelector("button[type='submit']") : null;
  const barcodeImageScanButton = barcodeImageForm ? barcodeImageForm.querySelector("button[type='submit']") : null;

  fixConfirmPackagedFoodIfNeeded();
  collapseManualFoodForm();
  bindHomeUnifiedScanDelegation();

  if (startBtn) startBtn.addEventListener("click", startBarcodeScanner);
  if (stopBtn) stopBtn.addEventListener("click", stopBarcodeScanner);
  if (labelForm) labelForm.addEventListener("submit", handleLabelScan);
  if (barcodeImageForm) barcodeImageForm.addEventListener("submit", handleBarcodeImageScan);

  if (labelScanButton && labelImageInput) {
    labelScanButton.addEventListener("click", (event) => {
      event.preventDefault();
      const status = document.getElementById("labelScanStatus");
      openFilePicker(labelImageInput, status, "Choose or take a Nutrition Facts label photo...");
    });
  }

  if (barcodeImageScanButton && barcodeImageInput) {
    barcodeImageScanButton.addEventListener("click", (event) => {
      event.preventDefault();
      const status = document.getElementById("barcodeImageScanStatus");
      openFilePicker(barcodeImageInput, status, "Choose or take a clear barcode photo...");
    });
  }

  if (labelImageInput && labelForm) {
    labelImageInput.addEventListener("click", () => resetFileInput(labelImageInput));
    labelImageInput.addEventListener("change", () => {
      if (labelImageInput.files && labelImageInput.files[0]) submitScanForm(labelForm);
    });
  }

  if (barcodeImageInput && barcodeImageForm) {
    barcodeImageInput.addEventListener("click", () => resetFileInput(barcodeImageInput));
    barcodeImageInput.addEventListener("change", () => {
      if (barcodeImageInput.files && barcodeImageInput.files[0]) submitScanForm(barcodeImageForm);
    });
  }
});