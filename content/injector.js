// ContextBridge - Auto-Resume Ingestor
// Injected on matched pages to automatically paste captured context

(() => {
  "use strict";

  const HOSTNAME = window.location.hostname;

  // Selectors for AI prompt text boxes
  const INPUT_SELECTORS = [
    "textarea#prompt-textarea",                   // ChatGPT
    "div.ProseMirror[contenteditable='true']",    // Claude
    "div.ql-editor[contenteditable='true']",      // Gemini
    "textarea[placeholder*='Ask me anything']",   // Copilot
    "textarea[placeholder*='message']",           // Grok / Fallback
    "textarea",                                   // Generic Textareas
    "div[contenteditable='true']"                 // Generic Editables
  ];

  const checkAndInject = () => {
    chrome.storage.local.get(["pendingContext", "pendingTarget", "autoSendOnInject"], (data) => {
      const { pendingContext, pendingTarget, autoSendOnInject } = data;
      console.log("ContextBridge Injector:", { pendingTarget, autoSendOnInject, contextLength: pendingContext?.length });
      
      if (!pendingContext || !pendingTarget) return;

      // Check if current site matches the intended target
      const targetMatches = 
        (pendingTarget === "chatgpt" && (HOSTNAME.includes("chatgpt.com") || HOSTNAME.includes("chat.openai.com"))) ||
        (pendingTarget === "claude" && HOSTNAME.includes("claude.ai")) ||
        (pendingTarget === "gemini" && HOSTNAME.includes("gemini.google.com")) ||
        (pendingTarget === "copilot" && (HOSTNAME.includes("copilot.microsoft.com") || HOSTNAME.includes("copilot.com"))) ||
        (pendingTarget === "grok" && HOSTNAME.includes("grok.com"));

      if (!targetMatches) return;

      console.log("ContextBridge: Target matched, looking for input element...");

      // Target matched! Start polling for the input element
      let attempts = 0;
      const maxAttempts = 30; // 15 seconds max (500ms intervals)

      const pollInterval = setInterval(() => {
        attempts++;
        let inputElement = null;

        // Try to find a valid, visible input box
        for (const selector of INPUT_SELECTORS) {
          const elems = document.querySelectorAll(selector);
          for (const elem of elems) {
            // Check if element is visible
            const rect = elem.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(elem).display !== "none";
            if (isVisible) {
              inputElement = elem;
              break;
            }
          }
          if (inputElement) break;
        }

        if (inputElement) {
          clearInterval(pollInterval);
          console.log("ContextBridge: Found input element, injecting...");
          injectText(inputElement, pendingContext, autoSendOnInject === true);
          
          // Clear storage immediately to prevent double injection
          chrome.storage.local.remove(["pendingContext", "pendingTarget", "autoSendOnInject"]);
        } else if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          console.error("ContextBridge: Could not locate prompt box for injection after 15 seconds.");
        }
      }, 500);
    });
  };

  const injectText = async (element, text, autoSend = false) => {
    try {
      console.log("ContextBridge: injectText called with autoSend =", autoSend);
      
      // Use SmartInjecter if available for framework-aware injection
      if (window.SmartInjecter) {
        console.log("ContextBridge: Using SmartInjecter for injection...");
        const success = await window.SmartInjecter.injectWithFrameworkDetection(element, text, autoSend);
        if (success) {
          showSuccessBanner(autoSend);
          return;
        }
      }

      // Fallback to legacy injection method
      console.log("ContextBridge: Falling back to legacy injection...");
      element.focus();
      const success = document.execCommand("insertText", false, text);
      
      if (!success) {
        if (element.tagName === "TEXTAREA" || element.tagName === "INPUT") {
          element.value = text;
        } else {
          element.innerText = text;
        }
        
        const events = ["input", "change", "blur"];
        events.forEach((eventName) => {
          const event = new Event(eventName, { bubbles: true });
          element.dispatchEvent(event);
        });
      }

      showSuccessBanner(autoSend);
    } catch (err) {
      console.error("ContextBridge: Ingestion failed", err);
    }
  };

  const showSuccessBanner = (autoSending = false) => {
    // Check if banner already exists
    if (document.getElementById("contextbridge-ingest-banner")) return;

    // Create a beautiful premium overlay banner
    const banner = document.createElement("div");
    banner.id = "contextbridge-ingest-banner";
    
    // Style with dark glassmorphism
    banner.style.cssText = `
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%) translateY(-50px);
      background: linear-gradient(135deg, rgba(22, 22, 22, 0.96) 0%, rgba(30, 30, 30, 0.94) 100%);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 4px 18px rgba(0, 0, 0, 0.5);
      color: #e8e8e8;
      padding: 12px 24px;
      border-radius: 12px;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 13px;
      font-weight: 500;
      z-index: 999999;
      display: flex;
      align-items: center;
      gap: 16px;
      transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      pointer-events: auto;
    `;

    // Banner HTML structure with enhanced messaging
    const statusMessage = autoSending 
      ? `Context injected & auto-sending in 1-2 seconds...`
      : `Context successfully injected! Ready to continue.`;

    banner.innerHTML = `
      <span style="font-size: 16px; animation: pulse 2s infinite;">🌉</span>
      <span>${statusMessage}</span>
      <button id="contextbridge-dismiss-btn" style="
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.15);
        color: #e8e8e8;
        padding: 4px 12px;
        border-radius: 6px;
        font-size: 11px;
        cursor: pointer;
        font-weight: 600;
        transition: all 0.2s;
      ">Dismiss</button>
    `;

    document.body.appendChild(banner);

    // Add pulse animation to styles
    if (!document.getElementById("contextbridge-styles")) {
      const style = document.createElement("style");
      style.id = "contextbridge-styles";
      style.textContent = `
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `;
      document.head.appendChild(style);
    }

    // Slide down transition
    setTimeout(() => {
      banner.style.transform = "translateX(-50%) translateY(0)";
    }, 100);

    // Dismiss trigger
    const dismissBtn = banner.querySelector("#contextbridge-dismiss-btn");
    dismissBtn.addEventListener("click", () => {
      banner.style.transform = "translateX(-50%) translateY(-100px)";
      setTimeout(() => {
        banner.remove();
      }, 400);
    });

    // Auto-dismiss after 6 seconds
    setTimeout(() => {
      if (banner.parentNode) {
        banner.style.transform = "translateX(-50%) translateY(-100px)";
        setTimeout(() => {
          if (banner.parentNode) banner.remove();
        }, 400);
      }
    }, 6000);
  };

  // Run ingest checks on load
  checkAndInject();
})();
