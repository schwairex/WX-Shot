/* WX Shot background controller. Image data never leaves the browser. */

const api = globalThis.browser ?? globalThis.chrome;
const HISTORY_KEY = "wxShotHistory";
const MAX_HISTORY_ITEMS = 6;
const MAX_HISTORY_CHARS = 7_500_000;

async function captureArea(tab) {
  if (!isUsableTab(tab)) return;
  try {
    const dataUrl = await api.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    await api.tabs.sendMessage(tab.id, { type: "WX_SHOT_OPEN", dataUrl });
  } catch (error) {
    console.debug("WX Shot area capture skipped:", error?.message ?? error);
    await showTemporaryBadge(tab.id, "!");
  }
}

async function captureFullPage(tab) {
  if (!isUsableTab(tab)) return;
  try {
    const page = await api.tabs.sendMessage(tab.id, { type: "WX_SHOT_FULL_BEGIN" });
    if (!page?.scrollWidth || !page?.scrollHeight) throw new Error("Page metrics unavailable");

    const positions = buildTilePositions(page);
    for (let index = 0; index < positions.length; index += 1) {
      const position = positions[index];
      const viewport = await api.tabs.sendMessage(tab.id, {
        type: "WX_SHOT_FULL_SCROLL",
        x: position.x,
        y: position.y,
        first: index === 0
      });
      const dataUrl = await api.tabs.captureVisibleTab(tab.windowId, { format: "png" });
      await api.tabs.sendMessage(tab.id, {
        type: "WX_SHOT_FULL_TILE",
        dataUrl,
        x: viewport.x,
        y: viewport.y,
        page
      });
      if (index < positions.length - 1) await delay(550);
    }

    await api.tabs.sendMessage(tab.id, { type: "WX_SHOT_FULL_FINISH" });
  } catch (error) {
    console.debug("WX Shot full-page capture skipped:", error?.message ?? error);
    try {
      await api.tabs.sendMessage(tab.id, { type: "WX_SHOT_FULL_CANCEL" });
    } catch {}
    await showTemporaryBadge(tab.id, "!");
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function buildTilePositions(page) {
  const width = Math.max(1, page.viewportWidth);
  const height = Math.max(1, page.viewportHeight);
  const xPositions = axisPositions(page.scrollWidth, width);
  const yPositions = axisPositions(page.scrollHeight, height);
  const positions = [];
  for (const y of yPositions) {
    for (const x of xPositions) positions.push({ x, y });
  }
  if (positions.length > 80) throw new Error("Page requires too many capture tiles");
  return positions;
}

function axisPositions(total, viewport) {
  if (total <= viewport) return [0];
  const values = [];
  for (let value = 0; value < total; value += viewport) values.push(Math.min(value, total - viewport));
  return [...new Set(values)];
}

function isUsableTab(tab) {
  if (tab?.id == null || tab?.windowId == null) return false;
  if (/^(brave|chrome|edge|about|view-source|chrome-extension|moz-extension):/i.test(tab.url ?? "")) {
    showTemporaryBadge(tab.id, "×");
    return false;
  }
  return true;
}

async function activeTab() {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function showTemporaryBadge(tabId, text) {
  if (!api.action?.setBadgeText) return;
  await api.action.setBadgeBackgroundColor({ tabId, color: "#ef4444" });
  await api.action.setBadgeText({ tabId, text });
  setTimeout(() => api.action.setBadgeText({ tabId, text: "" }), 1800);
}

async function saveHistoryItem(item) {
  const stored = await api.storage.local.get(HISTORY_KEY);
  const history = Array.isArray(stored[HISTORY_KEY]) ? stored[HISTORY_KEY] : [];
  const next = [item, ...history.filter((entry) => entry.id !== item.id)].slice(0, MAX_HISTORY_ITEMS);
  while (next.length > 1 && JSON.stringify(next).length > MAX_HISTORY_CHARS) next.pop();
  await api.storage.local.set({ [HISTORY_KEY]: next });
  return next;
}

async function listHistory() {
  const stored = await api.storage.local.get(HISTORY_KEY);
  return Array.isArray(stored[HISTORY_KEY]) ? stored[HISTORY_KEY] : [];
}

async function clearHistory() {
  await api.storage.local.remove(HISTORY_KEY);
  return [];
}

function createContextMenus() {
  if (!api.contextMenus) return;
  api.contextMenus.removeAll().then(() => {
    api.contextMenus.create({ id: "wx-shot-area", title: api.i18n.getMessage("contextArea"), contexts: ["page"] });
    api.contextMenus.create({ id: "wx-shot-full", title: api.i18n.getMessage("contextFull"), contexts: ["page"] });
  }).catch(() => {});
}

api.runtime.onInstalled.addListener(createContextMenus);
api.runtime.onStartup?.addListener(createContextMenus);
api.action.onClicked.addListener(captureArea);

api.commands.onCommand.addListener(async (command) => {
  const tab = await activeTab();
  if (command === "capture-visible-area") await captureArea(tab);
  if (command === "capture-full-page") await captureFullPage(tab);
});

api.contextMenus?.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "wx-shot-area") await captureArea(tab);
  if (info.menuItemId === "wx-shot-full") await captureFullPage(tab);
});

api.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === "WX_SHOT_CAPTURE") return captureArea(sender.tab);
  if (message?.type === "WX_SHOT_CAPTURE_FULL") return captureFullPage(sender.tab);
  if (message?.type === "WX_SHOT_DOWNLOAD") {
    return api.downloads.download({ url: message.dataUrl, filename: message.filename, saveAs: true });
  }
  if (message?.type === "WX_SHOT_HISTORY_SAVE") return saveHistoryItem(message.item);
  if (message?.type === "WX_SHOT_HISTORY_LIST") return listHistory();
  if (message?.type === "WX_SHOT_HISTORY_CLEAR") return clearHistory();
  return false;
});
