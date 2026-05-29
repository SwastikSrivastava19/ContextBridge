// ContextBridge Service Worker

chrome.runtime.onInstalled.addListener(() => {
  console.log("ContextBridge Extension Installed successfully.");
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "openTab") {
    // Open a new tab with the specified URL
    chrome.tabs.create({ url: request.url }, (tab) => {
      sendResponse({ success: true, tabId: tab.id });
    });
    return true; // Keep the message channel open for async response
  }
});
