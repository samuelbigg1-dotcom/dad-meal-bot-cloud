let barcodeStream = null;
let barcodeScanTimer = null;

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
    addBarcodeServingNote(form, food, scaled);
  } catch (error) {
    // If the hidden payload is not the expected format, leave the page alone.
  }
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
