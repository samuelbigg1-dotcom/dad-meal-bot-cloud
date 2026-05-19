let barcodeStream = null;
let barcodeScanTimer = null;

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

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

  if (!video || !box || !status || !input || !form) {
    return;
  }

  show(box);
  status.textContent = "Starting camera...";

  if (!("BarcodeDetector" in window)) {
    status.textContent =
      "This browser does not support camera barcode scanning. Type the barcode number manually instead.";
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
    for (const track of barcodeStream.getTracks()) {
      track.stop();
    }
    barcodeStream = null;
  }

  show(startBtn, "inline-flex");
  hide(stopBtn);
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

async function handleLabelScan(event) {
  event.preventDefault();

  const input = document.getElementById("labelImageInput");
  const status = document.getElementById("labelScanStatus");

  if (!input || !status) return;

  const file = input.files && input.files[0];

  if (!file) {
    status.textContent = "Choose a Nutrition Facts label photo first.";
    return;
  }

  status.textContent = "Compressing photo...";

  try {
    const imageDataUrl = await fileToCompressedDataUrl(file);

    status.textContent = "Reading Nutrition Facts label...";

    const response = await fetch("/foods/label-scan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ imageDataUrl })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not scan label.");
    }

    if (!data.food) {
      throw new Error("No food data returned from label scan.");
    }

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
    status.textContent = `Label scan failed: ${error.message}`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.getElementById("startBarcodeScanner");
  const stopBtn = document.getElementById("stopBarcodeScanner");
  const labelForm = document.getElementById("labelScanForm");

  if (startBtn) {
    startBtn.addEventListener("click", startBarcodeScanner);
  }

  if (stopBtn) {
    stopBtn.addEventListener("click", stopBarcodeScanner);
  }

  if (labelForm) {
    labelForm.addEventListener("submit", handleLabelScan);
  }
});
