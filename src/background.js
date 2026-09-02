/* WX Shot background controller. No image data ever leaves the browser. */

const api = globalThis.browser ?? globalThis.chrome;

async function capture(tab) {
  if (!tab?.id || !tab.windowId) return;

  try {
    const dataUrl = await api.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    await api.tabs.sendMessage(tab.id, {
      type: "WX_SHOT_OPEN",
      dataUrl
    });
  } catch (error) {
    console.warn("WX Shot capture failed:", error);
    await showTemporaryBadge(tab.id, "!");
  }
}

async function captureActiveTab() {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  await capture(tab);
}

async function showTemporaryBadge(tabId, text) {
  if (!api.action?.setBadgeText) return;
  await api.action.setBadgeBackgroundColor({ tabId, color: "#ef4444" });
  await api.action.setBadgeText({ tabId, text });
  setTimeout(() => api.action.setBadgeText({ tabId, text: "" }), 1800);
}

api.action.onClicked.addListener(capture);
api.commands.onCommand.addListener((command) => {
  if (command === "capture-visible-area") captureActiveTab();
});

api.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === "WX_SHOT_CAPTURE") {
    capture(sender.tab);
    return false;
  }

  if (message?.type === "WX_SHOT_DOWNLOAD") {
    return api.downloads.download({
      url: message.dataUrl,
      filename: message.filename,
      saveAs: true
    });
  }

  return false;
});
