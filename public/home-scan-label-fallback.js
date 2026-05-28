(() => {
  async function openHtmlPageFromPost(action, fields) {
    const response = await fetch(action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields),
      credentials: 'same-origin'
    });
    const html = await response.text();
    return { ok: response.ok, html };
  }

  window.handleHomeUnifiedFoodPhoto = async function handleHomeUnifiedFoodPhotoWithFallback(file) {
    if (!file || homeUnifiedScanBusy) return;
    homeUnifiedScanBusy = true;
    try {
      updateHomeScanOverlay({
        progress: 14,
        barcode: { text: 'Preparing…', state: 'active' },
        label: { text: 'Waiting', state: 'idle' }
      });

      const imageDataUrl = await fileToCompressedDataUrl(file);

      updateHomeScanOverlay({
        progress: 30,
        barcode: { text: 'Scanning…', state: 'active' },
        label: { text: 'Waiting', state: 'idle' }
      });

      const barcodeResponse = await fetch('/foods/barcode-image-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl }),
        credentials: 'same-origin'
      });
      const barcodeData = await barcodeResponse.json().catch(() => ({}));
      const barcode = String(barcodeData.barcode || '').replace(/\D/g, '');

      if (barcodeResponse.ok && barcode) {
        updateHomeScanOverlay({
          progress: 42,
          barcode: { text: 'Barcode found', state: 'success' },
          label: { text: 'Checking database…', state: 'idle' }
        });

        const lookup = await openHtmlPageFromPost('/foods/barcode', { barcode });
        const foundProduct = lookup.ok && /Confirm packaged food/i.test(lookup.html) && !/Barcode not found/i.test(lookup.html);

        if (foundProduct) {
          updateHomeScanOverlay({
            progress: 100,
            barcode: { text: 'Product found', state: 'success' },
            label: { text: 'Skipped', state: 'idle' }
          });
          window.setTimeout(() => {
            document.open();
            document.write(lookup.html);
            document.close();
          }, 250);
          return;
        }

        updateHomeScanOverlay({
          progress: 52,
          barcode: { text: 'Barcode not in database', state: 'warn' },
          label: { text: 'Scanning label…', state: 'active' }
        });
      } else {
        updateHomeScanOverlay({
          progress: 48,
          barcode: { text: 'No barcode found', state: 'warn' },
          label: { text: 'Scanning label…', state: 'active' }
        });
      }

      const labelResponse = await fetch('/foods/label-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl }),
        credentials: 'same-origin'
      });
      const labelData = await labelResponse.json().catch(() => ({}));
      if (!labelResponse.ok || !labelData.food) throw new Error(labelData.error || 'Could not read Nutrition Facts.');

      updateHomeScanOverlay({
        progress: 100,
        label: { text: 'Nutrition label found', state: 'success' }
      });
      window.setTimeout(() => submitHiddenPost('/foods/confirm-scanned-label', { food: encodeFoodPayload(labelData.food) }), 350);
    } catch (error) {
      failHomeScanOverlay(error.message || 'Scan failed. Try again.');
    }
  };
})();