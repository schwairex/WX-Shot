(() => {
  "use strict";

  const api = globalThis.browser ?? globalThis.chrome;
  const ROOT_ID = "wx-shot-root";
  const palette = ["#ff3b5c", "#ffb020", "#34d399", "#38bdf8", "#ffffff", "#111827"];
  const language = (api.i18n?.getUILanguage?.() ?? navigator.language ?? "tr").toLowerCase().startsWith("tr") ? "tr" : "en";
  const translations = {
    tr: {
      selectArea: "Bir alan seçmek için sürükleyin", close: "Kapat", editor: "WX Shot düzenleyici",
      pen: "Kalem", highlight: "Vurgula", line: "Çizgi", arrow: "Ok", rect: "Dikdörtgen", ellipse: "Elips",
      text: "Metin", eraser: "Silgi", blur: "Bulanıklaştır", pixelate: "Pikselleştir", smartRedact: "Akıllı gizle",
      undo: "Geri al", redo: "Yinele", copy: "Kopyala", save: "Farklı kaydet", copied: "Panoya kopyalandı",
      copyError: "Kopyalama izni verilemedi", style: "Stil", history: "Geçmiş", clear: "Temizle", noHistory: "Henüz kayıt yok",
      foundSensitive: "hassas alan gizlendi", noSensitive: "Hassas bilgi bulunamadı", zoomFit: "Sığdır",
      fill: "Dolgu", dashed: "Kesik çizgi", shadow: "Gölge", opacity: "Saydamlık", arrowHead: "Ok ucu",
      fullCapture: "Tam sayfa hazırlanıyor…", savedHistory: "Geçmişe eklendi", format: "Biçim", quality: "Kalite",
      zoom: "Yakınlaştırma", zoomIn: "Yakınlaştır", zoomOut: "Uzaklaştır", tools: "Çizim araçları", colors: "Renk seçimi",
      width: "Çizgi kalınlığı", scale: "Ölçek", classic: "Klasik", double: "Çift", dot: "Nokta", textPlaceholder: "Metni yazın…"
    },
    en: {
      selectArea: "Drag to select an area", close: "Close", editor: "WX Shot editor",
      pen: "Pen", highlight: "Highlighter", line: "Line", arrow: "Arrow", rect: "Rectangle", ellipse: "Ellipse",
      text: "Text", eraser: "Eraser", blur: "Blur", pixelate: "Pixelate", smartRedact: "Smart redact",
      undo: "Undo", redo: "Redo", copy: "Copy", save: "Save as", copied: "Copied to clipboard",
      copyError: "Clipboard permission was denied", style: "Style", history: "History", clear: "Clear", noHistory: "No captures yet",
      foundSensitive: "sensitive regions redacted", noSensitive: "No sensitive information found", zoomFit: "Fit",
      fill: "Fill", dashed: "Dashed", shadow: "Shadow", opacity: "Opacity", arrowHead: "Arrow head",
      fullCapture: "Preparing full-page capture…", savedHistory: "Added to history", format: "Format", quality: "Quality",
      zoom: "Zoom", zoomIn: "Zoom in", zoomOut: "Zoom out", tools: "Drawing tools", colors: "Color selection",
      width: "Stroke width", scale: "Scale", classic: "Classic", double: "Double", dot: "Dot", textPlaceholder: "Type text…"
    }
  };
  const t = (key) => translations[language][key] ?? translations.tr[key] ?? key;

  let host = null;
  let shadow = null;
  let screenshotUrl = null;
  let fullPageSession = null;

  api.runtime.onMessage.addListener((message) => {
    if (message?.type === "WX_SHOT_OPEN" && message.dataUrl) return openSelection(message.dataUrl);
    if (message?.type === "WX_SHOT_FULL_BEGIN") return Promise.resolve(beginFullPageCapture());
    if (message?.type === "WX_SHOT_FULL_SCROLL") return scrollFullPage(message);
    if (message?.type === "WX_SHOT_FULL_TILE") return addFullPageTile(message);
    if (message?.type === "WX_SHOT_FULL_FINISH") return finishFullPageCapture();
    if (message?.type === "WX_SHOT_FULL_CANCEL") return Promise.resolve(cancelFullPageCapture());
    return false;
  });

  window.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "PrintScreen" || host) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      api.runtime.sendMessage({ type: "WX_SHOT_CAPTURE" });
    },
    true
  );

  function createRoot() {
    cleanup();
    host = document.createElement("div");
    host.id = ROOT_ID;
    host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;";
    shadow = host.attachShadow({ mode: "closed" });
    document.documentElement.appendChild(host);
    return shadow;
  }

  function cleanup() {
    host?.remove();
    host = null;
    shadow = null;
    screenshotUrl = null;
  }

  function beginFullPageCapture() {
    cleanup();
    const doc = document.documentElement;
    const body = document.body;
    const scrollWidth = Math.max(doc.scrollWidth, body?.scrollWidth ?? 0, window.innerWidth);
    const scrollHeight = Math.max(doc.scrollHeight, body?.scrollHeight ?? 0, window.innerHeight);
    const fixedElements = [];
    for (const element of [...document.querySelectorAll("body *")].slice(0, 8000)) {
      const style = getComputedStyle(element);
      if ((style.position === "fixed" || style.position === "sticky") && element.getBoundingClientRect().height > 0) {
        fixedElements.push({ element, visibility: element.style.visibility });
        if (fixedElements.length >= 300) break;
      }
    }
    fullPageSession = {
      originalX: window.scrollX,
      originalY: window.scrollY,
      originalScrollBehavior: doc.style.scrollBehavior,
      fixedElements,
      stitch: null,
      outputScale: 1,
      privacyRegions: detectSensitiveDomRegions({ x: 0, y: 0, width: scrollWidth, height: scrollHeight }, true)
    };
    doc.style.scrollBehavior = "auto";
    return {
      scrollWidth,
      scrollHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio
    };
  }

  async function scrollFullPage({ x, y, first }) {
    if (!fullPageSession) throw new Error("Full-page session is missing");
    for (const item of fullPageSession.fixedElements) item.element.style.visibility = first ? item.visibility : "hidden";
    window.scrollTo(x, y);
    await nextPaint(90);
    return { x: window.scrollX, y: window.scrollY };
  }

  async function addFullPageTile({ dataUrl, x, y, page }) {
    if (!fullPageSession) throw new Error("Full-page session is missing");
    const tile = await loadImage(dataUrl);
    if (!fullPageSession.stitch) {
      const nativeScale = tile.naturalWidth / page.viewportWidth;
      const maxEdgeScale = Math.min(1, 16384 / Math.max(page.scrollWidth * nativeScale, page.scrollHeight * nativeScale));
      const maxPixelScale = Math.min(1, Math.sqrt(80_000_000 / (page.scrollWidth * page.scrollHeight * nativeScale * nativeScale)));
      fullPageSession.outputScale = nativeScale * Math.min(maxEdgeScale, maxPixelScale);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(page.scrollWidth * fullPageSession.outputScale));
      canvas.height = Math.max(1, Math.round(page.scrollHeight * fullPageSession.outputScale));
      fullPageSession.stitch = canvas;
    }
    const scale = fullPageSession.outputScale;
    fullPageSession.stitch.getContext("2d").drawImage(
      tile,
      Math.round(x * scale),
      Math.round(y * scale),
      Math.round(page.viewportWidth * scale),
      Math.round(page.viewportHeight * scale)
    );
    return true;
  }

  async function finishFullPageCapture() {
    if (!fullPageSession?.stitch) throw new Error("Full-page image is empty");
    const session = fullPageSession;
    restoreFullPage(session);
    fullPageSession = null;
    const blob = await canvasBlob(session.stitch, "image/png");
    const url = URL.createObjectURL(blob);
    try {
      await openEditor(url, { x: 0, y: 0, width: session.stitch.width, height: session.stitch.height }, true, session.privacyRegions);
    } finally {
      URL.revokeObjectURL(url);
    }
    return true;
  }

  function cancelFullPageCapture() {
    if (fullPageSession) restoreFullPage(fullPageSession);
    fullPageSession = null;
    return true;
  }

  function restoreFullPage(session) {
    document.documentElement.style.scrollBehavior = session.originalScrollBehavior;
    for (const item of session.fixedElements) item.element.style.visibility = item.visibility;
    window.scrollTo(session.originalX, session.originalY);
  }

  function nextPaint(extraDelay = 0) {
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, extraDelay))));
  }

  function openSelection(dataUrl) {
    screenshotUrl = dataUrl;
    const root = createRoot();
    root.innerHTML = `
      <style>${styles}</style>
      <div class="selection-shell" tabindex="0">
        <img class="screen" alt="" draggable="false" />
        <div class="shade"></div>
        <div class="selection" hidden><span class="size"></span></div>
        <div class="selection-hint">
          <span class="brand-mark">WX</span>
          <span>${t("selectArea")}</span>
          <kbd>Esc</kbd>
        </div>
      </div>`;

    const shell = root.querySelector(".selection-shell");
    const image = root.querySelector(".screen");
    const selection = root.querySelector(".selection");
    const size = root.querySelector(".size");
    image.src = dataUrl;
    shell.focus();

    let start = null;
    let current = null;

    const update = () => {
      if (!start || !current) return;
      const rect = normalizeRect(start, current);
      selection.hidden = false;
      selection.style.left = `${rect.x}px`;
      selection.style.top = `${rect.y}px`;
      selection.style.width = `${rect.width}px`;
      selection.style.height = `${rect.height}px`;
      size.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
    };

    shell.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      root.querySelector(".shade").style.display = "none";
      start = pointInViewport(event);
      current = start;
      shell.setPointerCapture(event.pointerId);
      update();
    });

    shell.addEventListener("pointermove", (event) => {
      if (!start) return;
      current = pointInViewport(event);
      update();
    });

    shell.addEventListener("pointerup", async (event) => {
      if (!start) return;
      current = pointInViewport(event);
      const rect = normalizeRect(start, current);
      start = null;
      if (rect.width < 8 || rect.height < 8) {
        selection.hidden = true;
        return;
      }
      const privacyRegions = detectSensitiveDomRegions(rect, false);
      await openEditor(dataUrl, rect, false, privacyRegions);
    });

    shell.addEventListener("keydown", (event) => {
      if (event.key === "Escape") cleanup();
      if (event.key === "Tab") {
        const focusable = [...root.querySelectorAll("button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex='0']")]
          .filter((element) => !element.closest("[hidden]") && element.offsetParent !== null);
        if (focusable.length) {
          const current = focusable.indexOf(root.activeElement);
          const next = event.shiftKey ? (current <= 0 ? focusable.length - 1 : current - 1) : (current + 1) % focusable.length;
          event.preventDefault();
          focusable[next].focus();
        }
      }
    });
  }

  async function openEditor(dataUrl, cropRect, pixelCoordinates = false, privacyRegions = []) {
    const image = await loadImage(dataUrl);
    const scaleX = pixelCoordinates ? 1 : image.naturalWidth / window.innerWidth;
    const scaleY = pixelCoordinates ? 1 : image.naturalHeight / window.innerHeight;
    const width = Math.max(1, Math.round(cropRect.width * scaleX));
    const height = Math.max(1, Math.round(cropRect.height * scaleY));
    const drawingSurface = fitDrawingSurface(width, height);

    const root = createRoot();
    root.innerHTML = `
      <style>${styles}</style>
      <div class="editor-shell" tabindex="0">
        <section class="editor" role="dialog" aria-modal="true" aria-label="${t("editor")}">
          <header>
            <div class="logo"><span class="brand-mark">WX</span><strong>Shot</strong></div>
            <div class="header-actions">
              <button class="header-button smart-redact" title="${t("smartRedact")}" aria-label="${t("smartRedact")}">${shieldIcon}<span>${t("smartRedact")}</span></button>
              <button class="icon-button history-toggle" title="${t("history")}" aria-label="${t("history")}">${historyIcon}</button>
              <div class="zoom-controls" aria-label="${t("zoom")}">
                <button class="icon-button zoom-out" aria-label="${t("zoomOut")}">−</button>
                <button class="zoom-value" title="${t("zoomFit")}">100%</button>
                <button class="icon-button zoom-in" aria-label="${t("zoomIn")}">+</button>
              </div>
              <div class="image-info">${width} × ${height} px</div>
              <button class="icon-button close" aria-label="${t("close")}">×</button>
            </div>
          </header>
          <div class="workspace" tabindex="0">
            <div class="canvas-stage">
              <canvas class="base" width="${width}" height="${height}"></canvas>
              <canvas class="effects" width="${drawingSurface.width}" height="${drawingSurface.height}"></canvas>
              <canvas class="draw" width="${drawingSurface.width}" height="${drawingSurface.height}"></canvas>
              <canvas class="preview" width="${drawingSurface.width}" height="${drawingSurface.height}"></canvas>
            </div>
          </div>
          <footer>
            <div class="tools" role="toolbar" aria-label="${t("tools")}">
              ${toolButton("pen", `${t("pen")} (P)`, penIcon, true)}
              ${toolButton("highlight", `${t("highlight")} (H)`, highlightIcon)}
              ${toolButton("line", `${t("line")} (L) • Shift: 45°`, lineIcon)}
              ${toolButton("arrow", `${t("arrow")} (A) • Shift: 45°`, arrowIcon)}
              ${toolButton("rect", `${t("rect")} (R) • Shift`, rectIcon)}
              ${toolButton("ellipse", `${t("ellipse")} (O) • Shift`, ellipseIcon)}
              ${toolButton("blur", `${t("blur")} (B)`, blurIcon)}
              ${toolButton("pixelate", `${t("pixelate")} (X)`, pixelIcon)}
              ${toolButton("text", `${t("text")} (T)`, textIcon)}
              ${toolButton("eraser", `${t("eraser")} (E)`, eraserIcon)}
              <span class="divider"></span>
              <div class="colors" aria-label="${t("colors")}">
                ${palette.map((color, index) => `<button class="color ${index === 0 ? "active" : ""}" data-color="${color}" style="--color:${color}" aria-label="${color}"></button>`).join("")}
              </div>
              <label class="width-control" title="${t("width")}">
                <input class="width-input" type="range" min="2" max="18" value="5" aria-label="${t("width")}" />
              </label>
              <button class="tool style-toggle" title="${t("style")}" aria-label="${t("style")}">${styleIcon}</button>
              <span class="divider"></span>
              <button class="tool undo" title="${t("undo")}" aria-label="${t("undo")}" disabled>${undoIcon}</button>
              <button class="tool redo" title="${t("redo")}" aria-label="${t("redo")}" disabled>${redoIcon}</button>
            </div>
            <div class="actions">
              <select class="format-select" aria-label="${t("format")}">
                <option value="png">PNG</option><option value="jpeg">JPEG</option><option value="webp">WebP</option>
              </select>
              <select class="scale-select" aria-label="${t("scale")}"><option value="1">100%</option><option value="0.75">75%</option><option value="0.5">50%</option></select>
              <button class="secondary copy">${copyIcon}<span>${t("copy")}</span></button>
              <button class="primary save">${downloadIcon}<span>${t("save")}</span></button>
            </div>
          </footer>
          <aside class="style-panel" role="dialog" aria-label="${t("style")}" hidden>
            <div class="panel-title">${t("style")}</div>
            <label>${t("opacity")} <input class="style-opacity" type="range" min="20" max="100" value="100"></label>
            <label class="check"><input class="style-fill" type="checkbox"> ${t("fill")}</label>
            <label class="check"><input class="style-dashed" type="checkbox"> ${t("dashed")}</label>
            <label class="check"><input class="style-shadow" type="checkbox"> ${t("shadow")}</label>
            <label>${t("arrowHead")} <select class="arrow-head"><option value="classic">${t("classic")}</option><option value="double">${t("double")}</option><option value="dot">${t("dot")}</option></select></label>
            <label>${t("quality")} <input class="export-quality" type="range" min="40" max="100" value="92"></label>
          </aside>
          <aside class="history-panel" role="dialog" aria-label="${t("history")}" hidden>
            <div class="history-header"><strong>${t("history")}</strong><button class="clear-history">${t("clear")}</button></div>
            <div class="history-list"></div>
          </aside>
          <div class="toast" aria-live="polite"></div>
        </section>
      </div>`;

    const shell = root.querySelector(".editor-shell");
    const workspace = root.querySelector(".workspace");
    const base = root.querySelector(".base");
    const effects = root.querySelector(".effects");
    const draw = root.querySelector(".draw");
    const preview = root.querySelector(".preview");
    const baseCtx = base.getContext("2d");
    const effectsCtx = effects.getContext("2d", { alpha: true, desynchronized: true });
    const drawCtx = draw.getContext("2d", { alpha: true, desynchronized: true });
    const previewCtx = preview.getContext("2d", { alpha: true, desynchronized: true });
    const stage = root.querySelector(".canvas-stage");
    const undoButton = root.querySelector(".undo");
    const redoButton = root.querySelector(".redo");
    const actions = [];
    const redoStack = [];
    let tool = "pen";
    let color = palette[0];
    let lineWidth = 5;
    let activeAction = null;
    let animationFrame = 0;
    let zoom = 1;
    let fitWidth = 1;
    let fitHeight = 1;
    let spacePressed = false;
    let panState = null;
    let historySaved = false;
    const styleState = { opacity: 1, fill: false, dashed: false, shadow: false, arrowHead: "classic" };
    const freehandTools = new Set(["pen", "highlight", "eraser"]);
    const effectTools = new Set(["blur", "pixelate"]);

    baseCtx.drawImage(
      image,
      Math.round(cropRect.x * scaleX),
      Math.round(cropRect.y * scaleY),
      width,
      height,
      0,
      0,
      width,
      height
    );

    const applyZoom = (nextZoom) => {
      zoom = Math.max(0.25, Math.min(4, nextZoom));
      stage.style.width = `${fitWidth * zoom}px`;
      stage.style.height = `${fitHeight * zoom}px`;
      root.querySelector(".zoom-value").textContent = `${Math.round(zoom * 100)}%`;
    };

    requestAnimationFrame(() => {
      const availableWidth = Math.max(160, workspace.clientWidth - 56);
      const availableHeight = Math.max(120, workspace.clientHeight - 56);
      const fitScale = Math.min(1, availableWidth / width, availableHeight / height);
      fitWidth = Math.max(1, Math.round(width * fitScale));
      fitHeight = Math.max(1, Math.round(height * fitScale));
      applyZoom(1);
    });

    root.querySelector(".zoom-in").addEventListener("click", () => applyZoom(zoom * 1.25));
    root.querySelector(".zoom-out").addEventListener("click", () => applyZoom(zoom / 1.25));
    root.querySelector(".zoom-value").addEventListener("click", () => applyZoom(1));
    workspace.addEventListener("wheel", (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      applyZoom(zoom * (event.deltaY < 0 ? 1.12 : 0.89));
    }, { passive: false });

    const updateHistoryButtons = () => {
      undoButton.disabled = actions.length === 0;
      redoButton.disabled = redoStack.length === 0;
    };

    const renderCommitted = () => {
      drawCtx.clearRect(0, 0, draw.width, draw.height);
      effectsCtx.clearRect(0, 0, effects.width, effects.height);
      actions.forEach((action) => {
        if (effectTools.has(action.tool)) renderEffect(effectsCtx, base, action);
        else drawAction(drawCtx, action);
      });
      updateHistoryButtons();
    };

    const paintActiveAction = () => {
      animationFrame = 0;
      if (!activeAction) return;

      if (freehandTools.has(activeAction.tool)) {
        drawFreehandIncrement(previewCtx, activeAction);
        return;
      }

      previewCtx.clearRect(0, 0, preview.width, preview.height);
      drawAction(previewCtx, activeAction);
    };

    const scheduleActivePaint = () => {
      if (!animationFrame) animationFrame = requestAnimationFrame(paintActiveAction);
    };

    root.querySelectorAll("[data-tool]").forEach((button) => {
      button.addEventListener("click", () => {
        root.querySelectorAll("[data-tool]").forEach((item) => {
          item.classList.remove("active");
          item.setAttribute("aria-pressed", "false");
        });
        button.classList.add("active");
        button.setAttribute("aria-pressed", "true");
        tool = button.dataset.tool;
        preview.dataset.cursor = tool;
      });
    });

    root.querySelectorAll("[data-color]").forEach((button) => {
      button.addEventListener("click", () => {
        root.querySelectorAll("[data-color]").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        color = button.dataset.color;
      });
    });

    root.querySelector(".width-input").addEventListener("input", (event) => {
      lineWidth = Number(event.target.value);
    });

    preview.addEventListener("pointerdown", (event) => {
      if (event.button === 1 || spacePressed) {
        event.preventDefault();
        panState = { x: event.clientX, y: event.clientY, left: workspace.scrollLeft, top: workspace.scrollTop };
        preview.setPointerCapture(event.pointerId);
        stage.classList.add("panning");
        return;
      }
      if (event.button !== 0) return;
      event.preventDefault();
      const point = canvasPoint(event, preview);
      point.pressure = normalizedPressure(event);
      if (tool === "text") {
        showTextInput(stage, preview, point, color, lineWidth, (text) => {
          if (text.trim()) {
            const textAction = { tool: "text", color, width: lineWidth, start: point, text: text.trim(), style: { ...styleState } };
            actions.push(textAction);
            redoStack.length = 0;
            drawAction(drawCtx, textAction);
            updateHistoryButtons();
          }
        });
        return;
      }
      activeAction = {
        tool,
        color,
        width: lineWidth,
        start: point,
        end: point,
        points: [point],
        pointerType: event.pointerType,
        renderedIndex: 0,
        style: { ...styleState }
      };
      if (tool === "eraser") {
        previewCtx.clearRect(0, 0, preview.width, preview.height);
        previewCtx.drawImage(draw, 0, 0);
        draw.style.visibility = "hidden";
      } else {
        previewCtx.clearRect(0, 0, preview.width, preview.height);
      }
      preview.setPointerCapture(event.pointerId);
      scheduleActivePaint();
    });

    preview.addEventListener("pointermove", (event) => {
      if (panState) {
        workspace.scrollLeft = panState.left - (event.clientX - panState.x);
        workspace.scrollTop = panState.top - (event.clientY - panState.y);
        return;
      }
      if (!activeAction) return;
      event.preventDefault();
      const samples = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [event];
      for (const sample of samples) {
        const point = canvasPoint(sample, preview);
        point.pressure = normalizedPressure(sample);
        const last = activeAction.points.at(-1);
        if (!last || distance(last, point) >= 0.35) activeAction.points.push(point);
      }
      const rawEnd = activeAction.points.at(-1) ?? canvasPoint(event, preview);
      activeAction.end = event.shiftKey ? constrainedEnd(activeAction.start, rawEnd, activeAction.tool) : rawEnd;
      scheduleActivePaint();
    });

    const finishAction = (event) => {
      if (panState) {
        panState = null;
        stage.classList.remove("panning");
        if (event?.pointerId != null && preview.hasPointerCapture(event.pointerId)) preview.releasePointerCapture(event.pointerId);
        return;
      }
      if (!activeAction) return;
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
      paintActiveAction();
      const completedAction = { ...activeAction };
      delete completedAction.renderedIndex;
      if (freehandTools.has(completedAction.tool)) {
        completedAction.points = simplifyStrokePoints(completedAction.points, Math.max(0.45, completedAction.width * 0.1));
      }

      if (effectTools.has(completedAction.tool)) {
        renderEffect(effectsCtx, base, completedAction);
      } else {
        drawAction(drawCtx, completedAction);
      }
      actions.push(completedAction);
      activeAction = null;
      redoStack.length = 0;
      draw.style.visibility = "visible";
      previewCtx.clearRect(0, 0, preview.width, preview.height);
      updateHistoryButtons();
      if (event?.pointerId != null && preview.hasPointerCapture(event.pointerId)) {
        preview.releasePointerCapture(event.pointerId);
      }
    };
    preview.addEventListener("pointerup", finishAction);
    preview.addEventListener("pointercancel", finishAction);

    undoButton.addEventListener("click", () => {
      const action = actions.pop();
      if (action) redoStack.push(action);
      renderCommitted();
    });
    redoButton.addEventListener("click", () => {
      const action = redoStack.pop();
      if (action) actions.push(action);
      renderCommitted();
    });

    root.querySelector(".close").addEventListener("click", cleanup);
    shell.addEventListener("keydown", (event) => {
      if (event.key === "Escape") cleanup();
      if (event.key === "Tab") {
        const focusable = [...root.querySelectorAll("button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex='0']")]
          .filter((element) => !element.closest("[hidden]") && element.offsetParent !== null);
        if (focusable.length) {
          const current = focusable.indexOf(root.activeElement);
          const next = event.shiftKey ? (current <= 0 ? focusable.length - 1 : current - 1) : (current + 1) % focusable.length;
          event.preventDefault();
          focusable[next].focus();
        }
      }
      if (event.code === "Space" && !event.target.matches("input,select")) {
        event.preventDefault();
        spacePressed = true;
        stage.classList.add("pan-ready");
      }
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        (event.shiftKey ? redoButton : undoButton).click();
      }
      if (!modifier && !event.altKey && !event.target.matches("input,select")) {
        const shortcuts = { p: "pen", h: "highlight", l: "line", a: "arrow", r: "rect", o: "ellipse", b: "blur", x: "pixelate", t: "text", e: "eraser" };
        const shortcutTool = shortcuts[event.key.toLowerCase()];
        if (shortcutTool) root.querySelector(`[data-tool="${shortcutTool}"]`)?.click();
      }
    });
    shell.addEventListener("keyup", (event) => {
      if (event.code === "Space") {
        spacePressed = false;
        stage.classList.remove("pan-ready");
      }
    });

    const stylePanel = root.querySelector(".style-panel");
    root.querySelector(".style-toggle").addEventListener("click", () => {
      stylePanel.hidden = !stylePanel.hidden;
      root.querySelector(".history-panel").hidden = true;
    });
    root.querySelector(".style-opacity").addEventListener("input", (event) => { styleState.opacity = Number(event.target.value) / 100; });
    root.querySelector(".style-fill").addEventListener("change", (event) => { styleState.fill = event.target.checked; });
    root.querySelector(".style-dashed").addEventListener("change", (event) => { styleState.dashed = event.target.checked; });
    root.querySelector(".style-shadow").addEventListener("change", (event) => { styleState.shadow = event.target.checked; });
    root.querySelector(".arrow-head").addEventListener("change", (event) => { styleState.arrowHead = event.target.value; });

    const historyPanel = root.querySelector(".history-panel");
    const renderHistoryPanel = async () => {
      const list = root.querySelector(".history-list");
      const history = await api.runtime.sendMessage({ type: "WX_SHOT_HISTORY_LIST" });
      list.replaceChildren();
      if (!history?.length) {
        const empty = document.createElement("div");
        empty.className = "history-empty";
        empty.textContent = t("noHistory");
        list.appendChild(empty);
        return;
      }
      for (const entry of history) {
        const button = document.createElement("button");
        button.className = "history-item";
        const imageElement = document.createElement("img");
        imageElement.src = entry.dataUrl;
        imageElement.alt = "";
        const label = document.createElement("span");
        label.textContent = new Date(entry.createdAt).toLocaleString(language);
        button.append(imageElement, label);
        button.addEventListener("click", async () => {
          const historyImage = await loadImage(entry.dataUrl);
          await openEditor(entry.dataUrl, { x: 0, y: 0, width: historyImage.naturalWidth, height: historyImage.naturalHeight }, true, []);
        });
        list.appendChild(button);
      }
    };
    root.querySelector(".history-toggle").addEventListener("click", async () => {
      historyPanel.hidden = !historyPanel.hidden;
      stylePanel.hidden = true;
      if (!historyPanel.hidden) await renderHistoryPanel();
    });
    root.querySelector(".clear-history").addEventListener("click", async () => {
      await api.runtime.sendMessage({ type: "WX_SHOT_HISTORY_CLEAR" });
      await renderHistoryPanel();
    });

    let smartRedacted = false;
    root.querySelector(".smart-redact").addEventListener("click", async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const imageRegions = await detectSensitiveImageRegions(base);
        const regions = dedupeRegions([...privacyRegions, ...imageRegions]);
        if (!regions.length || smartRedacted) {
          showToast(root.querySelector(".toast"), t("noSensitive"), "error");
          return;
        }
        for (const region of regions) {
          actions.push({
            tool: "pixelate",
            color,
            width: Math.max(7, lineWidth),
            start: { x: region.x * effects.width, y: region.y * effects.height },
            end: { x: (region.x + region.width) * effects.width, y: (region.y + region.height) * effects.height },
            points: [],
            style: { ...styleState }
          });
        }
        redoStack.length = 0;
        smartRedacted = true;
        renderCommitted();
        showToast(root.querySelector(".toast"), `${regions.length} ${t("foundSensitive")}`, "success");
      } finally {
        button.disabled = false;
      }
    });

    const rememberCapture = async () => {
      if (historySaved) return;
      const dataUrl = await createHistoryPreview(base, effects, draw);
      await api.runtime.sendMessage({
        type: "WX_SHOT_HISTORY_SAVE",
        item: { id: crypto.randomUUID(), createdAt: Date.now(), width: base.width, height: base.height, dataUrl }
      });
      historySaved = true;
    };

    root.querySelector(".copy").addEventListener("click", async () => {
      const toast = root.querySelector(".toast");
      try {
        const blob = await exportBlob(base, effects, draw, "image/png", 1, 1);
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        await rememberCapture();
        showToast(toast, t("copied"), "success");
      } catch (error) {
        console.warn("WX Shot clipboard error:", error);
        showToast(toast, t("copyError"), "error");
      }
    });

    root.querySelector(".save").addEventListener("click", async () => {
      const format = root.querySelector(".format-select").value;
      const exportScale = Number(root.querySelector(".scale-select").value);
      const quality = Number(root.querySelector(".export-quality").value) / 100;
      const mime = `image/${format}`;
      const extension = format === "jpeg" ? "jpg" : format;
      const blob = await exportBlob(base, effects, draw, mime, quality, exportScale);
      await rememberCapture();
      const reader = new FileReader();
      reader.onloadend = () => {
        api.runtime.sendMessage({
          type: "WX_SHOT_DOWNLOAD",
          dataUrl: reader.result,
          filename: `WX-Shot-${fileTimestamp()}.${extension}`
        });
      };
      reader.readAsDataURL(blob);
    });

    shell.focus();
    preview.dataset.cursor = "pen";
  }

  function drawAction(ctx, action) {
    ctx.save();
    applyActionStyle(ctx, action);

    if (["pen", "highlight", "eraser"].includes(action.tool)) {
      drawSmoothStroke(ctx, action);
    } else if (action.tool === "line") {
      ctx.beginPath();
      ctx.moveTo(action.start.x, action.start.y);
      ctx.lineTo(action.end.x, action.end.y);
      ctx.stroke();
    } else if (action.tool === "rect") {
      if (action.style?.fill) {
        ctx.save();
        ctx.globalAlpha *= 0.2;
        ctx.fillRect(action.start.x, action.start.y, action.end.x - action.start.x, action.end.y - action.start.y);
        ctx.restore();
      }
      ctx.strokeRect(
        action.start.x,
        action.start.y,
        action.end.x - action.start.x,
        action.end.y - action.start.y
      );
    } else if (action.tool === "ellipse") {
      const centerX = (action.start.x + action.end.x) / 2;
      const centerY = (action.start.y + action.end.y) / 2;
      const radiusX = Math.abs(action.end.x - action.start.x) / 2;
      const radiusY = Math.abs(action.end.y - action.start.y) / 2;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, Math.max(radiusX, 0.5), Math.max(radiusY, 0.5), 0, 0, Math.PI * 2);
      if (action.style?.fill) {
        ctx.save();
        ctx.globalAlpha *= 0.2;
        ctx.fill();
        ctx.restore();
      }
      ctx.stroke();
    } else if (action.tool === "arrow") {
      drawArrow(ctx, action.start, action.end, action.width, action.style?.arrowHead ?? "classic");
    } else if (["blur", "pixelate"].includes(action.tool)) {
      ctx.save();
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = "#ffffff";
      ctx.fillStyle = "rgba(99,102,241,.2)";
      ctx.fillRect(action.start.x, action.start.y, action.end.x - action.start.x, action.end.y - action.start.y);
      ctx.strokeRect(action.start.x, action.start.y, action.end.x - action.start.x, action.end.y - action.start.y);
      ctx.restore();
    } else if (action.tool === "text") {
      const fontSize = Math.max(18, action.width * 5);
      ctx.font = `700 ${fontSize}px Inter, Arial, sans-serif`;
      ctx.textBaseline = "top";
      ctx.shadowColor = "rgba(0,0,0,.28)";
      ctx.shadowBlur = 3;
      ctx.fillText(action.text, action.start.x, action.start.y);
    }
    ctx.restore();
  }

  function applyActionStyle(ctx, action) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = action.color;
    ctx.fillStyle = action.color;
    ctx.lineWidth = action.width;
    ctx.globalAlpha = action.style?.opacity ?? 1;
    if (action.style?.dashed) ctx.setLineDash([Math.max(4, action.width * 2.2), Math.max(3, action.width * 1.4)]);
    if (action.style?.shadow) {
      ctx.shadowColor = "rgba(0,0,0,.55)";
      ctx.shadowBlur = Math.max(4, action.width * 2);
      ctx.shadowOffsetY = Math.max(1, action.width * 0.5);
    }
    if (action.tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = action.width * 2.4;
    } else if (action.tool === "highlight") {
      ctx.globalAlpha = (action.style?.opacity ?? 1) * 0.34;
      ctx.lineWidth = action.width * 3;
    }
  }

  function drawSmoothStroke(ctx, action) {
    const points = action.points ?? [];
    if (points.length === 0) return;
    if (points.length === 1) {
      const pressure = action.pointerType === "pen" ? 0.72 + points[0].pressure * 0.7 : 1;
      ctx.beginPath();
      ctx.arc(points[0].x, points[0].y, (ctx.lineWidth * pressure) / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (action.tool === "pen" && action.pointerType === "pen") {
      for (let index = 1; index < points.length; index += 1) {
        const previousPrevious = points[Math.max(0, index - 2)];
        const previous = points[index - 1];
        const current = points[index];
        const start = index === 1 ? previous : midpoint(previousPrevious, previous);
        const end = index === points.length - 1 ? current : midpoint(previous, current);
        ctx.lineWidth = action.width * (0.72 + ((previous.pressure + current.pressure) / 2) * 0.7);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.quadraticCurveTo(previous.x, previous.y, end.x, end.y);
        ctx.stroke();
      }
      return;
    }

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length - 1; index += 1) {
      const middle = midpoint(points[index], points[index + 1]);
      ctx.quadraticCurveTo(points[index].x, points[index].y, middle.x, middle.y);
    }
    const last = points.at(-1);
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }

  function drawFreehandIncrement(ctx, action) {
    const points = action.points;
    if (!points.length) return;
    const startIndex = Math.max(1, action.renderedIndex || 1);
    ctx.save();
    applyActionStyle(ctx, action);

    if (!action.renderedIndex) {
      const pressure = action.pointerType === "pen" ? 0.72 + points[0].pressure * 0.7 : 1;
      ctx.beginPath();
      ctx.arc(points[0].x, points[0].y, (ctx.lineWidth * pressure) / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let index = startIndex; index < points.length; index += 1) {
      const previous = points[index - 1];
      const current = points[index];
      if (action.tool === "pen" && action.pointerType === "pen") {
        ctx.lineWidth = action.width * (0.72 + ((previous.pressure + current.pressure) / 2) * 0.7);
      }
      ctx.beginPath();
      ctx.moveTo(previous.x, previous.y);
      ctx.lineTo(current.x, current.y);
      ctx.stroke();
    }
    action.renderedIndex = points.length;
    ctx.restore();
  }

  function midpoint(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function normalizedPressure(event) {
    if (event.pointerType !== "pen") return 0.5;
    return Math.max(0.05, Math.min(1, event.pressure || 0.5));
  }

  function distance(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  function simplifyStrokePoints(points, tolerance) {
    if (points.length <= 2) return points;
    const simplified = [points[0]];
    let previous = points[0];
    for (let index = 1; index < points.length - 1; index += 1) {
      if (distance(previous, points[index]) >= tolerance) {
        simplified.push(points[index]);
        previous = points[index];
      }
    }
    simplified.push(points.at(-1));
    return simplified;
  }

  function constrainedEnd(start, end, tool) {
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    if (["rect", "ellipse"].includes(tool)) {
      const size = Math.max(Math.abs(deltaX), Math.abs(deltaY));
      return {
        x: start.x + Math.sign(deltaX || 1) * size,
        y: start.y + Math.sign(deltaY || 1) * size
      };
    }
    if (["line", "arrow"].includes(tool)) {
      const radius = Math.hypot(deltaX, deltaY);
      const angle = Math.round(Math.atan2(deltaY, deltaX) / (Math.PI / 4)) * (Math.PI / 4);
      return { x: start.x + Math.cos(angle) * radius, y: start.y + Math.sin(angle) * radius };
    }
    return end;
  }

  function drawArrow(ctx, start, end, width, headStyle = "classic") {
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const head = Math.max(12, width * 4);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    if (headStyle === "dot") {
      ctx.beginPath();
      ctx.arc(end.x, end.y, Math.max(4, width * 1.8), 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    drawArrowHead(ctx, end, angle, head);
    if (headStyle === "double") drawArrowHead(ctx, start, angle + Math.PI, head);
  }

  function drawArrowHead(ctx, tip, angle, size) {
    ctx.beginPath();
    ctx.moveTo(tip.x - size * Math.cos(angle - Math.PI / 6), tip.y - size * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(tip.x, tip.y);
    ctx.lineTo(tip.x - size * Math.cos(angle + Math.PI / 6), tip.y - size * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  }

  function renderEffect(ctx, base, action) {
    const x = Math.min(action.start.x, action.end.x);
    const y = Math.min(action.start.y, action.end.y);
    const width = Math.abs(action.end.x - action.start.x);
    const height = Math.abs(action.end.y - action.start.y);
    if (width < 1 || height < 1) return;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();
    if (action.tool === "blur") {
      ctx.filter = `blur(${Math.max(5, action.width * 1.8)}px)`;
      ctx.drawImage(base, 0, 0, ctx.canvas.width, ctx.canvas.height);
    } else {
      const blockSize = Math.max(6, Math.round(action.width * 2.4));
      const tiny = document.createElement("canvas");
      tiny.width = Math.max(1, Math.ceil(width / blockSize));
      tiny.height = Math.max(1, Math.ceil(height / blockSize));
      const sourceX = x * (base.width / ctx.canvas.width);
      const sourceY = y * (base.height / ctx.canvas.height);
      const sourceWidth = width * (base.width / ctx.canvas.width);
      const sourceHeight = height * (base.height / ctx.canvas.height);
      tiny.getContext("2d").drawImage(base, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, tiny.width, tiny.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tiny, 0, 0, tiny.width, tiny.height, x, y, width, height);
    }
    ctx.restore();
  }

  function showTextInput(stage, canvas, point, color, width, onCommit) {
    stage.querySelector(".text-entry")?.remove();
    const canvasRect = canvas.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const input = document.createElement("input");
    input.className = "text-entry";
    input.placeholder = t("textPlaceholder");
    input.style.left = `${canvasRect.left - stageRect.left + (point.x / canvas.width) * canvasRect.width}px`;
    input.style.top = `${canvasRect.top - stageRect.top + (point.y / canvas.height) * canvasRect.height}px`;
    input.style.color = color;
    input.style.fontSize = `${Math.max(15, width * 3)}px`;
    stage.appendChild(input);
    input.focus();
    let committed = false;
    const commit = () => {
      if (committed) return;
      committed = true;
      onCommit(input.value);
      input.remove();
    };
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") commit();
      if (event.key === "Escape") {
        committed = true;
        input.remove();
      }
    });
    input.addEventListener("blur", commit);
  }

  function exportBlob(base, effects, draw, mime = "image/png", quality = 0.92, scale = 1) {
    const output = document.createElement("canvas");
    output.width = Math.max(1, Math.round(base.width * scale));
    output.height = Math.max(1, Math.round(base.height * scale));
    const ctx = output.getContext("2d");
    if (mime === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, output.width, output.height);
    }
    ctx.drawImage(base, 0, 0, output.width, output.height);
    ctx.drawImage(effects, 0, 0, output.width, output.height);
    ctx.drawImage(draw, 0, 0, output.width, output.height);
    return canvasBlob(output, mime, quality);
  }

  function canvasBlob(canvas, mime = "image/png", quality = 0.92) {
    return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Image export failed")), mime, quality));
  }

  async function createHistoryPreview(base, effects, draw) {
    const maxEdge = 1280;
    const scale = Math.min(1, maxEdge / Math.max(base.width, base.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(base.width * scale));
    canvas.height = Math.max(1, Math.round(base.height * scale));
    const ctx = canvas.getContext("2d");
    ctx.drawImage(base, 0, 0, canvas.width, canvas.height);
    ctx.drawImage(effects, 0, 0, canvas.width, canvas.height);
    ctx.drawImage(draw, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.76);
  }

  function detectSensitiveDomRegions(cropRect, pageCoordinates) {
    if (!document.body || typeof document.createTreeWalker !== "function") return [];
    const results = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!node.textContent?.trim() || !parent || ["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT"].includes(parent.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const pattern = /[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?\d[\d\s().-]{8,}\d)|(?:\d[ -]*?){13,19}/gi;
    let node;
    let scanned = 0;
    while ((node = walker.nextNode()) && scanned < 12000) {
      scanned += 1;
      pattern.lastIndex = 0;
      for (const match of node.textContent.matchAll(pattern)) {
        const range = document.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        for (const clientRect of range.getClientRects()) {
          const left = clientRect.left + (pageCoordinates ? window.scrollX : 0);
          const top = clientRect.top + (pageCoordinates ? window.scrollY : 0);
          const right = left + clientRect.width;
          const bottom = top + clientRect.height;
          const clippedLeft = Math.max(left, cropRect.x);
          const clippedTop = Math.max(top, cropRect.y);
          const clippedRight = Math.min(right, cropRect.x + cropRect.width);
          const clippedBottom = Math.min(bottom, cropRect.y + cropRect.height);
          if (clippedRight <= clippedLeft || clippedBottom <= clippedTop) continue;
          const padX = Math.max(2, cropRect.width * 0.003);
          const padY = Math.max(2, cropRect.height * 0.003);
          results.push({
            x: Math.max(0, (clippedLeft - cropRect.x - padX) / cropRect.width),
            y: Math.max(0, (clippedTop - cropRect.y - padY) / cropRect.height),
            width: Math.min(1, (clippedRight - clippedLeft + padX * 2) / cropRect.width),
            height: Math.min(1, (clippedBottom - clippedTop + padY * 2) / cropRect.height)
          });
        }
      }
    }
    return dedupeRegions(results);
  }

  async function detectSensitiveImageRegions(base) {
    if (typeof globalThis.TextDetector !== "function") return [];
    try {
      const detector = new globalThis.TextDetector();
      const detected = await detector.detect(base);
      return detected.filter((item) => isSensitiveText(item.rawValue ?? "")).map((item) => ({
        x: Math.max(0, item.boundingBox.x / base.width),
        y: Math.max(0, item.boundingBox.y / base.height),
        width: Math.min(1, item.boundingBox.width / base.width),
        height: Math.min(1, item.boundingBox.height / base.height)
      }));
    } catch {
      return [];
    }
  }

  function isSensitiveText(value) {
    return /[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?\d[\d\s().-]{8,}\d)|(?:\d[ -]*?){13,19}/i.test(value);
  }

  function dedupeRegions(regions) {
    const unique = [];
    for (const region of regions) {
      const duplicate = unique.some((item) => {
        const overlapWidth = Math.max(0, Math.min(item.x + item.width, region.x + region.width) - Math.max(item.x, region.x));
        const overlapHeight = Math.max(0, Math.min(item.y + item.height, region.y + region.height) - Math.max(item.y, region.y));
        const intersection = overlapWidth * overlapHeight;
        return intersection > Math.min(item.width * item.height, region.width * region.height) * 0.72;
      });
      if (!duplicate) unique.push(region);
    }
    return unique;
  }

  function showToast(element, message, type) {
    element.textContent = message;
    element.className = `toast show ${type}`;
    clearTimeout(element._timer);
    element._timer = setTimeout(() => { element.className = "toast"; }, 2200);
  }

  function toolButton(tool, label, icon, active = false) {
    return `<button class="tool ${active ? "active" : ""}" data-tool="${tool}" title="${label}" aria-label="${label}" aria-pressed="${active}">${icon}</button>`;
  }

  function pointInViewport(event) {
    return {
      x: Math.max(0, Math.min(window.innerWidth, event.clientX)),
      y: Math.max(0, Math.min(window.innerHeight, event.clientY))
    };
  }

  function normalizeRect(a, b) {
    return {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      width: Math.abs(a.x - b.x),
      height: Math.abs(a.y - b.y)
    };
  }

  function canvasPoint(event, canvas) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  function fitDrawingSurface(width, height) {
    const maxEdge = 3200;
    const maxPixels = 8_000_000;
    const edgeScale = Math.min(1, maxEdge / Math.max(width, height));
    const pixelScale = Math.min(1, Math.sqrt(maxPixels / (width * height)));
    const scale = Math.min(edgeScale, pixelScale);
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale))
    };
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  function fileTimestamp() {
    return new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
  }

  const icon = (body) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
  const penIcon = icon('<path d="m4 20 4.2-1 10.6-10.6a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z"/><path d="m14.5 6.5 3 3"/>');
  const highlightIcon = icon('<path d="m6 15 3 3 10-10-3-3L6 15Z"/><path d="m4 20 6-1-5-5-1 6Z"/><path d="M13 20h7"/>');
  const lineIcon = icon('<path d="M5 19 19 5"/>');
  const arrowIcon = icon('<path d="M5 19 19 5M10 5h9v9"/>');
  const rectIcon = icon('<rect x="4" y="5" width="16" height="14" rx="1"/>');
  const ellipseIcon = icon('<ellipse cx="12" cy="12" rx="8" ry="6.5"/>');
  const blurIcon = icon('<circle cx="9" cy="9" r="4"/><circle cx="15" cy="9" r="4" opacity=".65"/><circle cx="12" cy="15" r="4" opacity=".4"/>');
  const pixelIcon = icon('<rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/>');
  const textIcon = icon('<path d="M5 6V4h14v2M12 4v16M8 20h8"/>');
  const eraserIcon = icon('<path d="m5 15 7-9a2 2 0 0 1 3-.2l3.2 2.8a2 2 0 0 1 .2 2.8L11 20H7l-2-2a2 2 0 0 1 0-3Z"/><path d="m9 11 6 5"/>');
  const undoIcon = icon('<path d="m9 8-5 4 5 4"/><path d="M5 12h8a6 6 0 0 1 6 6"/>');
  const redoIcon = icon('<path d="m15 8 5 4-5 4"/><path d="M19 12h-8a6 6 0 0 0-6 6"/>');
  const copyIcon = icon('<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>');
  const downloadIcon = icon('<path d="M12 3v12m0 0 5-5m-5 5-5-5"/><path d="M5 20h14"/>');
  const shieldIcon = icon('<path d="M12 3 5 6v5c0 4.6 2.8 8 7 10 4.2-2 7-5.4 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-5"/>');
  const historyIcon = icon('<path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6"/><path d="M4 4v4.6h4.6M12 8v5l3 2"/>');
  const styleIcon = icon('<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>');

  const styles = `
    :host { color-scheme: dark; }
    * { box-sizing: border-box; }
    button, input, select { font: inherit; }
    button { -webkit-tap-highlight-color: transparent; }
    svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .brand-mark { display:inline-grid; place-items:center; min-width:34px; height:28px; padding:0 6px; border-radius:8px; background:linear-gradient(135deg,#7657ff,#4f8cff); color:#fff; font:800 12px/1 Inter,system-ui,sans-serif; letter-spacing:-.3px; box-shadow:0 7px 20px rgba(94,92,230,.35); }
    .selection-shell { position:fixed; inset:0; overflow:hidden; cursor:crosshair; outline:none; user-select:none; font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    .screen { position:absolute; inset:0; width:100%; height:100%; object-fit:fill; pointer-events:none; }
    .shade { position:absolute; inset:0; background:rgba(4,8,20,.44); backdrop-filter:saturate(.8); pointer-events:none; }
    .selection { position:absolute; border:1.5px solid #8ea1ff; box-shadow:0 0 0 9999px rgba(4,8,20,.52),0 0 0 1px rgba(255,255,255,.25),0 14px 45px rgba(0,0,0,.22); background:transparent; pointer-events:none; }
    .selection::before,.selection::after { content:"";position:absolute;width:7px;height:7px;border:2px solid #fff;background:#6c63ff;border-radius:2px; }
    .selection::before { left:-5px;top:-5px; }.selection::after { right:-5px;bottom:-5px; }
    .size { position:absolute; left:50%; bottom:-35px; transform:translateX(-50%); padding:5px 9px; border-radius:7px; background:#111827; color:#fff; font:600 11px/1.2 Inter,system-ui,sans-serif; white-space:nowrap; box-shadow:0 5px 18px rgba(0,0,0,.25); }
    .selection-hint { position:absolute; top:24px; left:50%; transform:translateX(-50%); display:flex; align-items:center; gap:12px; padding:10px 12px; border:1px solid rgba(255,255,255,.16); border-radius:13px; background:rgba(15,23,42,.88); color:#f8fafc; box-shadow:0 18px 50px rgba(0,0,0,.3); backdrop-filter:blur(18px); font:500 13px/1 Inter,system-ui,sans-serif; pointer-events:none; }
    kbd { padding:5px 7px; border:1px solid #475569; border-bottom-width:2px; border-radius:6px; color:#cbd5e1; background:#1e293b; font:600 10px/1 Inter,system-ui,sans-serif; }
    .editor-shell { position:fixed; inset:0; display:grid; place-items:center; padding:24px; background:rgba(3,7,18,.76); backdrop-filter:blur(14px); outline:none; font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; color:#e5e7eb; }
    .editor { position:relative; display:grid; grid-template-rows:60px minmax(0,1fr) 78px; width:min(1460px,calc(100vw - 48px)); height:min(900px,calc(100vh - 48px)); overflow:hidden; border:1px solid rgba(255,255,255,.1); border-radius:20px; background:#10131a; box-shadow:0 32px 100px rgba(0,0,0,.55),inset 0 1px rgba(255,255,255,.05); }
    header { display:flex; align-items:center; gap:14px; padding:0 14px 0 18px; border-bottom:1px solid #252a35; background:#151922; }
    .logo { display:flex; align-items:center; gap:9px; color:#fff; }.logo strong { font-size:15px; letter-spacing:-.2px; }
    .header-actions { margin-left:auto; display:flex; align-items:center; gap:6px; min-width:0; }
    .image-info { color:#8d96a8; font-size:12px; font-variant-numeric:tabular-nums; white-space:nowrap; }
    .zoom-controls { display:flex; align-items:center; gap:2px; padding:2px; border:1px solid #303644; border-radius:11px; background:#10141c; }
    .zoom-controls .icon-button { width:31px; height:31px; font-size:18px; }
    .zoom-value { width:43px; padding:0; border:0; color:#bec6d4; background:transparent; text-align:center; font:600 11px/1 Inter,system-ui,sans-serif; font-variant-numeric:tabular-nums; cursor:pointer; }
    .icon-button,.tool,.header-button { display:grid; place-items:center; min-width:38px; height:38px; padding:0; border:0; border-radius:10px; color:#9ca6b8; background:transparent; cursor:pointer; transition:background .16s,color .16s,transform .16s; }
    .header-button { display:flex; align-items:center; gap:7px; padding:0 11px; color:#cbd2df; border:1px solid #303644; background:#1d222c; font-size:11px; font-weight:650; white-space:nowrap; }
    .header-button svg { width:17px; height:17px; }
    .icon-button:hover,.tool:hover:not(:disabled),.header-button:hover { color:#fff; background:#282e3b; }.tool.active { color:#fff; background:#5b5ce2; box-shadow:0 7px 18px rgba(91,92,226,.28); }.tool:active:not(:disabled),.header-button:active{transform:scale(.95)}.tool:disabled{opacity:.28;cursor:default}.close{font-size:26px;font-weight:300;}
    .workspace { min-height:0; display:flex; align-items:center; justify-content:center; overflow:auto; padding:28px; background-color:#0b0e14; background-image:linear-gradient(45deg,#121620 25%,transparent 25%),linear-gradient(-45deg,#121620 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#121620 75%),linear-gradient(-45deg,transparent 75%,#121620 75%); background-size:20px 20px;background-position:0 0,0 10px,10px -10px,-10px 0; }
    .canvas-stage { position:relative; flex:0 0 auto; margin:auto; line-height:0; box-shadow:0 18px 52px rgba(0,0,0,.48); transform-origin:center center; }
    .base { display:block; width:100%; height:100%; }
    .effects,.draw,.preview { position:absolute; inset:0; width:100%; height:100%; contain:strict; }.effects,.draw{pointer-events:none}.preview{touch-action:none}.preview[data-cursor="text"]{cursor:text}.preview[data-cursor="eraser"]{cursor:cell}.preview:not([data-cursor="text"]):not([data-cursor="eraser"]){cursor:crosshair}.canvas-stage.pan-ready .preview{cursor:grab}.canvas-stage.panning .preview{cursor:grabbing}
    .text-entry { position:absolute; z-index:3; min-width:150px; width:220px; padding:7px 9px; border:1px solid #7c73ff; border-radius:8px; outline:none; color:#fff; background:rgba(15,23,42,.92); line-height:1.2; box-shadow:0 9px 30px rgba(0,0,0,.3); transform:translateY(-3px); }
    footer { display:flex; align-items:center; gap:12px; padding:0 14px; border-top:1px solid #252a35; background:#151922; }
    .tools,.actions,.colors { display:flex; align-items:center; gap:5px; }.tools{min-width:0;overflow-x:auto;scrollbar-width:thin;padding:5px 0}.actions{margin-left:auto;gap:8px;flex:0 0 auto}.divider{flex:0 0 1px;width:1px;height:27px;margin:0 4px;background:#303644}
    .color { position:relative; width:23px; height:23px; padding:0; border:2px solid #151922; border-radius:50%; background:var(--color); box-shadow:0 0 0 1px #3a4150; cursor:pointer; transition:transform .15s,box-shadow .15s; }.color:hover{transform:scale(1.12)}.color.active{box-shadow:0 0 0 2px #151922,0 0 0 4px #818cf8}.color[style*="#ffffff"]{box-shadow:0 0 0 1px #667085}
    .width-control { display:flex;align-items:center;margin:0 2px}.width-control input{width:72px;height:4px;accent-color:#7772ee;cursor:pointer}
    .format-select,.scale-select { height:36px; padding:0 25px 0 9px; border:1px solid #343b49; border-radius:9px; outline:none; color:#d8deea; background:#202631; font-size:11px; font-weight:650; cursor:pointer; }
    .export-select:focus-visible,.header-button:focus-visible,.icon-button:focus-visible,.tool:focus-visible,.primary:focus-visible,.secondary:focus-visible,.color:focus-visible { outline:2px solid #a5b4fc; outline-offset:2px; }
    .primary,.secondary { display:flex;align-items:center;gap:8px;height:40px;padding:0 15px;border-radius:10px;cursor:pointer;font:650 12px/1 Inter,system-ui,sans-serif;transition:transform .15s,background .15s,border .15s}.primary:active,.secondary:active{transform:scale(.97)}
    .primary { border:1px solid #716df0; color:#fff; background:linear-gradient(135deg,#6d5fe8,#526de0);box-shadow:0 8px 22px rgba(82,109,224,.25)}.primary:hover{background:linear-gradient(135deg,#796cf0,#607aea)}.secondary{border:1px solid #343b49;color:#d8deea;background:#202631}.secondary:hover{border-color:#4b5568;background:#29303c}.primary svg,.secondary svg{width:17px;height:17px}
    .toast { position:absolute; left:50%; bottom:88px; transform:translate(-50%,12px); padding:10px 14px; border-radius:10px; color:#fff; background:#202631; opacity:0; pointer-events:none; transition:opacity .18s,transform .18s; font-size:12px; box-shadow:0 12px 36px rgba(0,0,0,.35)}.toast.show{opacity:1;transform:translate(-50%,0)}.toast.success{border:1px solid rgba(52,211,153,.45)}.toast.error{border:1px solid rgba(248,113,113,.5)}
    .style-panel,.history-panel { position:absolute; z-index:8; top:68px; right:16px; width:min(340px,calc(100% - 32px)); padding:14px; border:1px solid #343b49; border-radius:14px; background:rgba(24,29,39,.98); box-shadow:0 22px 60px rgba(0,0,0,.45); backdrop-filter:blur(18px); }
    .style-panel[hidden],.history-panel[hidden] { display:none; }
    .style-panel { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:11px; }.style-panel .panel-title{grid-column:1/-1}.style-panel>label{display:grid;gap:6px;color:#aeb7c6;font-size:11px}.style-panel>label.check{display:flex;align-items:center}.style-panel input[type="range"]{width:100%;accent-color:#7772ee}.style-panel input[type="checkbox"]{accent-color:#7772ee}.style-panel select{height:34px;border:1px solid #3a4251;border-radius:8px;color:#e2e8f0;background:#202631;padding:0 7px}
    .panel-title,.history-header { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:2px; color:#fff; font-size:13px; font-weight:700; }.history-header{margin-bottom:12px}.history-header button{border:0;color:#aeb7c6;background:transparent;cursor:pointer;font-size:11px}.history-header button:hover{color:#fff}
    .history-list { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; max-height:310px; overflow:auto; }.history-item{position:relative;aspect-ratio:16/10;padding:0;overflow:hidden;border:1px solid #343b49;border-radius:9px;background:#0b0e14;cursor:pointer}.history-item:hover{border-color:#7772ee}.history-item img{width:100%;height:100%;object-fit:cover}.history-item span{position:absolute;left:3px;right:3px;bottom:3px;overflow:hidden;padding:3px 4px;border-radius:4px;color:#fff;background:rgba(5,8,14,.78);font-size:8px;line-height:1.2;text-overflow:ellipsis;white-space:nowrap}.history-empty{grid-column:1/-1;padding:24px 8px;color:#8d96a8;text-align:center;font-size:12px}
    @media(max-width:1100px){.header-button span,.image-info{display:none}.colors{display:none}.editor{width:calc(100vw - 28px);height:calc(100vh - 28px)}}
    @media(max-width:880px){.editor{grid-template-rows:54px minmax(0,1fr) auto}.editor-shell{padding:10px}.editor{width:calc(100vw - 20px);height:calc(100vh - 20px)}header{gap:6px;padding:0 9px}.logo strong{display:none}.zoom-controls{margin-left:auto}.header-actions{margin-left:0}.header-button{padding:0 8px}footer{align-items:stretch;flex-direction:column;padding:8px;gap:6px}.tools{width:100%}.actions{width:100%;margin:0}.actions .primary,.actions .secondary{flex:1;justify-content:center}.workspace{padding:14px}.style-panel,.history-panel{top:60px;right:10px}}
    @media(prefers-contrast:more){.editor,.style-panel,.history-panel{border-color:#9ca3af}.tool.active{outline:2px solid #fff}.image-info,.tool,.icon-button{color:#d1d5db}}
    @media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
  `;
})();
