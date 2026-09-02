(() => {
  "use strict";

  const api = globalThis.browser ?? globalThis.chrome;
  const ROOT_ID = "wx-shot-root";
  const palette = ["#ff3b5c", "#ffb020", "#34d399", "#38bdf8", "#ffffff", "#111827"];

  let host = null;
  let shadow = null;
  let screenshotUrl = null;

  api.runtime.onMessage.addListener((message) => {
    if (message?.type === "WX_SHOT_OPEN" && message.dataUrl) {
      openSelection(message.dataUrl);
    }
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
          <span>Bir alan seçmek için sürükleyin</span>
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
      await openEditor(dataUrl, rect);
    });

    shell.addEventListener("keydown", (event) => {
      if (event.key === "Escape") cleanup();
    });
  }

  async function openEditor(dataUrl, cropRect) {
    const image = await loadImage(dataUrl);
    const scaleX = image.naturalWidth / window.innerWidth;
    const scaleY = image.naturalHeight / window.innerHeight;
    const width = Math.max(1, Math.round(cropRect.width * scaleX));
    const height = Math.max(1, Math.round(cropRect.height * scaleY));

    const root = createRoot();
    root.innerHTML = `
      <style>${styles}</style>
      <div class="editor-shell" tabindex="0">
        <section class="editor" role="dialog" aria-modal="true" aria-label="WX Shot düzenleyici">
          <header>
            <div class="logo"><span class="brand-mark">WX</span><strong>Shot</strong></div>
            <div class="image-info">${width} × ${height} px</div>
            <button class="icon-button close" aria-label="Kapat">×</button>
          </header>
          <div class="workspace">
            <div class="canvas-stage">
              <canvas class="base" width="${width}" height="${height}"></canvas>
              <canvas class="draw" width="${width}" height="${height}"></canvas>
            </div>
          </div>
          <footer>
            <div class="tools" role="toolbar" aria-label="Çizim araçları">
              ${toolButton("pen", "Kalem", penIcon, true)}
              ${toolButton("highlight", "Vurgula", highlightIcon)}
              ${toolButton("arrow", "Ok", arrowIcon)}
              ${toolButton("rect", "Dikdörtgen", rectIcon)}
              ${toolButton("text", "Metin", textIcon)}
              ${toolButton("eraser", "Silgi", eraserIcon)}
              <span class="divider"></span>
              <div class="colors" aria-label="Renk seçimi">
                ${palette.map((color, index) => `<button class="color ${index === 0 ? "active" : ""}" data-color="${color}" style="--color:${color}" aria-label="${color}"></button>`).join("")}
              </div>
              <label class="width-control" title="Çizgi kalınlığı">
                <input type="range" min="2" max="18" value="5" aria-label="Çizgi kalınlığı" />
              </label>
              <span class="divider"></span>
              <button class="tool undo" title="Geri al" aria-label="Geri al" disabled>${undoIcon}</button>
              <button class="tool redo" title="Yinele" aria-label="Yinele" disabled>${redoIcon}</button>
            </div>
            <div class="actions">
              <button class="secondary copy">${copyIcon}<span>Kopyala</span></button>
              <button class="primary save">${downloadIcon}<span>Farklı kaydet</span></button>
            </div>
          </footer>
          <div class="toast" aria-live="polite"></div>
        </section>
      </div>`;

    const shell = root.querySelector(".editor-shell");
    const base = root.querySelector(".base");
    const draw = root.querySelector(".draw");
    const baseCtx = base.getContext("2d");
    const drawCtx = draw.getContext("2d");
    const stage = root.querySelector(".canvas-stage");
    const undoButton = root.querySelector(".undo");
    const redoButton = root.querySelector(".redo");
    const actions = [];
    const redoStack = [];
    let tool = "pen";
    let color = palette[0];
    let lineWidth = 5;
    let activeAction = null;

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

    const render = () => {
      drawCtx.clearRect(0, 0, width, height);
      [...actions, ...(activeAction ? [activeAction] : [])].forEach((action) => drawAction(drawCtx, action));
      undoButton.disabled = actions.length === 0;
      redoButton.disabled = redoStack.length === 0;
    };

    root.querySelectorAll("[data-tool]").forEach((button) => {
      button.addEventListener("click", () => {
        root.querySelectorAll("[data-tool]").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        tool = button.dataset.tool;
        draw.dataset.cursor = tool;
      });
    });

    root.querySelectorAll("[data-color]").forEach((button) => {
      button.addEventListener("click", () => {
        root.querySelectorAll("[data-color]").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        color = button.dataset.color;
      });
    });

    root.querySelector("input[type=range]").addEventListener("input", (event) => {
      lineWidth = Number(event.target.value);
    });

    draw.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      const point = canvasPoint(event, draw);
      if (tool === "text") {
        showTextInput(stage, draw, point, color, lineWidth, (text) => {
          if (text.trim()) {
            actions.push({ tool: "text", color, width: lineWidth, start: point, text: text.trim() });
            redoStack.length = 0;
            render();
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
        points: [point]
      };
      draw.setPointerCapture(event.pointerId);
    });

    draw.addEventListener("pointermove", (event) => {
      if (!activeAction) return;
      const point = canvasPoint(event, draw);
      activeAction.end = point;
      if (["pen", "highlight", "eraser"].includes(activeAction.tool)) activeAction.points.push(point);
      render();
    });

    const finishAction = () => {
      if (!activeAction) return;
      actions.push(activeAction);
      activeAction = null;
      redoStack.length = 0;
      render();
    };
    draw.addEventListener("pointerup", finishAction);
    draw.addEventListener("pointercancel", finishAction);

    undoButton.addEventListener("click", () => {
      const action = actions.pop();
      if (action) redoStack.push(action);
      render();
    });
    redoButton.addEventListener("click", () => {
      const action = redoStack.pop();
      if (action) actions.push(action);
      render();
    });

    root.querySelector(".close").addEventListener("click", cleanup);
    shell.addEventListener("keydown", (event) => {
      if (event.key === "Escape") cleanup();
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        (event.shiftKey ? redoButton : undoButton).click();
      }
    });

    root.querySelector(".copy").addEventListener("click", async () => {
      const toast = root.querySelector(".toast");
      try {
        const blob = await exportBlob(base, draw);
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        showToast(toast, "Panoya kopyalandı", "success");
      } catch (error) {
        console.warn("WX Shot clipboard error:", error);
        showToast(toast, "Kopyalama izni verilemedi", "error");
      }
    });

    root.querySelector(".save").addEventListener("click", async () => {
      const blob = await exportBlob(base, draw);
      const reader = new FileReader();
      reader.onloadend = () => {
        api.runtime.sendMessage({
          type: "WX_SHOT_DOWNLOAD",
          dataUrl: reader.result,
          filename: `WX-Shot-${fileTimestamp()}.png`
        });
      };
      reader.readAsDataURL(blob);
    });

    shell.focus();
    draw.dataset.cursor = "pen";
  }

  function drawAction(ctx, action) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = action.color;
    ctx.fillStyle = action.color;
    ctx.lineWidth = action.width;

    if (action.tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = action.width * 2.4;
    }
    if (action.tool === "highlight") {
      ctx.globalAlpha = 0.34;
      ctx.lineWidth = action.width * 3;
    }

    if (["pen", "highlight", "eraser"].includes(action.tool)) {
      ctx.beginPath();
      action.points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
    } else if (action.tool === "rect") {
      ctx.strokeRect(
        action.start.x,
        action.start.y,
        action.end.x - action.start.x,
        action.end.y - action.start.y
      );
    } else if (action.tool === "arrow") {
      drawArrow(ctx, action.start, action.end, action.width);
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

  function drawArrow(ctx, start, end, width) {
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const head = Math.max(12, width * 4);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.lineTo(end.x - head * Math.cos(angle - Math.PI / 6), end.y - head * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x - head * Math.cos(angle + Math.PI / 6), end.y - head * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  }

  function showTextInput(stage, canvas, point, color, width, onCommit) {
    stage.querySelector(".text-entry")?.remove();
    const canvasRect = canvas.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const input = document.createElement("input");
    input.className = "text-entry";
    input.placeholder = "Metni yazın…";
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

  function exportBlob(base, draw) {
    const output = document.createElement("canvas");
    output.width = base.width;
    output.height = base.height;
    const ctx = output.getContext("2d");
    ctx.drawImage(base, 0, 0);
    ctx.drawImage(draw, 0, 0);
    return new Promise((resolve, reject) => output.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG oluşturulamadı")), "image/png"));
  }

  function showToast(element, message, type) {
    element.textContent = message;
    element.className = `toast show ${type}`;
    clearTimeout(element._timer);
    element._timer = setTimeout(() => { element.className = "toast"; }, 2200);
  }

  function toolButton(tool, label, icon, active = false) {
    return `<button class="tool ${active ? "active" : ""}" data-tool="${tool}" title="${label}" aria-label="${label}">${icon}</button>`;
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
  const arrowIcon = icon('<path d="M5 19 19 5M10 5h9v9"/>');
  const rectIcon = icon('<rect x="4" y="5" width="16" height="14" rx="1"/>');
  const textIcon = icon('<path d="M5 6V4h14v2M12 4v16M8 20h8"/>');
  const eraserIcon = icon('<path d="m5 15 7-9a2 2 0 0 1 3-.2l3.2 2.8a2 2 0 0 1 .2 2.8L11 20H7l-2-2a2 2 0 0 1 0-3Z"/><path d="m9 11 6 5"/>');
  const undoIcon = icon('<path d="m9 8-5 4 5 4"/><path d="M5 12h8a6 6 0 0 1 6 6"/>');
  const redoIcon = icon('<path d="m15 8 5 4-5 4"/><path d="M19 12h-8a6 6 0 0 0-6 6"/>');
  const copyIcon = icon('<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>');
  const downloadIcon = icon('<path d="M12 3v12m0 0 5-5m-5 5-5-5"/><path d="M5 20h14"/>');

  const styles = `
    :host { color-scheme: dark; }
    * { box-sizing: border-box; }
    button, input { font: inherit; }
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
    .editor { position:relative; display:grid; grid-template-rows:58px minmax(0,1fr) 74px; width:min(1180px,calc(100vw - 48px)); height:min(820px,calc(100vh - 48px)); overflow:hidden; border:1px solid rgba(255,255,255,.1); border-radius:20px; background:#10131a; box-shadow:0 32px 100px rgba(0,0,0,.55),inset 0 1px rgba(255,255,255,.05); }
    header { display:flex; align-items:center; padding:0 18px; border-bottom:1px solid #252a35; background:#151922; }
    .logo { display:flex; align-items:center; gap:9px; color:#fff; }.logo strong { font-size:15px; letter-spacing:-.2px; }
    .image-info { margin:auto; color:#8d96a8; font-size:12px; font-variant-numeric:tabular-nums; }
    .icon-button,.tool { display:grid; place-items:center; width:38px; height:38px; padding:0; border:0; border-radius:10px; color:#9ca6b8; background:transparent; cursor:pointer; transition:background .16s,color .16s,transform .16s; }
    .icon-button:hover,.tool:hover:not(:disabled) { color:#fff; background:#282e3b; }.tool.active { color:#fff; background:#5b5ce2; box-shadow:0 7px 18px rgba(91,92,226,.28); }.tool:active:not(:disabled){transform:scale(.95)}.tool:disabled{opacity:.28;cursor:default}.close{font-size:26px;font-weight:300;}
    .workspace { min-height:0; display:grid; place-items:center; overflow:auto; padding:28px; background-color:#0b0e14; background-image:linear-gradient(45deg,#121620 25%,transparent 25%),linear-gradient(-45deg,#121620 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#121620 75%),linear-gradient(-45deg,transparent 75%,#121620 75%); background-size:20px 20px;background-position:0 0,0 10px,10px -10px,-10px 0; }
    .canvas-stage { position:relative; max-width:100%; max-height:100%; line-height:0; box-shadow:0 18px 52px rgba(0,0,0,.48); }
    canvas { display:block; max-width:100%; max-height:calc(100vh - 220px); width:auto; height:auto; }
    .draw { position:absolute; inset:0; touch-action:none; }.draw[data-cursor="text"]{cursor:text}.draw[data-cursor="eraser"]{cursor:cell}.draw:not([data-cursor="text"]):not([data-cursor="eraser"]){cursor:crosshair}
    .text-entry { position:absolute; z-index:3; min-width:150px; width:220px; padding:7px 9px; border:1px solid #7c73ff; border-radius:8px; outline:none; color:#fff; background:rgba(15,23,42,.92); line-height:1.2; box-shadow:0 9px 30px rgba(0,0,0,.3); transform:translateY(-3px); }
    footer { display:flex; align-items:center; gap:18px; padding:0 16px; border-top:1px solid #252a35; background:#151922; }
    .tools,.actions,.colors { display:flex; align-items:center; gap:5px; }.actions{margin-left:auto;gap:9px}.divider{width:1px;height:27px;margin:0 5px;background:#303644}
    .color { position:relative; width:23px; height:23px; padding:0; border:2px solid #151922; border-radius:50%; background:var(--color); box-shadow:0 0 0 1px #3a4150; cursor:pointer; transition:transform .15s,box-shadow .15s; }.color:hover{transform:scale(1.12)}.color.active{box-shadow:0 0 0 2px #151922,0 0 0 4px #818cf8}.color[style*="#ffffff"]{box-shadow:0 0 0 1px #667085}
    .width-control { display:flex;align-items:center;margin:0 2px}.width-control input{width:72px;height:4px;accent-color:#7772ee;cursor:pointer}
    .primary,.secondary { display:flex;align-items:center;gap:8px;height:40px;padding:0 15px;border-radius:10px;cursor:pointer;font:650 12px/1 Inter,system-ui,sans-serif;transition:transform .15s,background .15s,border .15s}.primary:active,.secondary:active{transform:scale(.97)}
    .primary { border:1px solid #716df0; color:#fff; background:linear-gradient(135deg,#6d5fe8,#526de0);box-shadow:0 8px 22px rgba(82,109,224,.25)}.primary:hover{background:linear-gradient(135deg,#796cf0,#607aea)}.secondary{border:1px solid #343b49;color:#d8deea;background:#202631}.secondary:hover{border-color:#4b5568;background:#29303c}.primary svg,.secondary svg{width:17px;height:17px}
    .toast { position:absolute; left:50%; bottom:88px; transform:translate(-50%,12px); padding:10px 14px; border-radius:10px; color:#fff; background:#202631; opacity:0; pointer-events:none; transition:opacity .18s,transform .18s; font-size:12px; box-shadow:0 12px 36px rgba(0,0,0,.35)}.toast.show{opacity:1;transform:translate(-50%,0)}.toast.success{border:1px solid rgba(52,211,153,.45)}.toast.error{border:1px solid rgba(248,113,113,.5)}
    @media(max-width:880px){.editor{grid-template-rows:54px minmax(0,1fr) auto}.editor-shell{padding:10px}.editor{width:calc(100vw - 20px);height:calc(100vh - 20px)}footer{align-items:stretch;flex-direction:column;padding:10px;gap:8px}.tools{overflow-x:auto}.actions{width:100%;margin:0}.actions button{flex:1;justify-content:center}.divider{flex:0 0 1px}.workspace{padding:14px}canvas{max-height:calc(100vh - 250px)}}
  `;
})();
