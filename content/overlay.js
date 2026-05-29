// ContextBridge Page Overlay Widget
// Injected into AI chat pages to allow quick context transfer without opening the extension popup

(() => {
  "use strict";

  const HOSTNAME = window.location.hostname;
  const URL = window.location.origin + window.location.pathname;

  // Platform detection
  const PLATFORMS = {
    CHATGPT: "chatgpt",
    CLAUDE: "claude",
    GEMINI: "gemini",
    COPILOT: "copilot",
    GROK: "grok",
    UNKNOWN: "unknown"
  };

  const getPlatform = () => {
    if (HOSTNAME.includes("chatgpt.com") || HOSTNAME.includes("chat.openai.com")) return PLATFORMS.CHATGPT;
    if (HOSTNAME.includes("claude.ai")) return PLATFORMS.CLAUDE;
    if (HOSTNAME.includes("gemini.google.com")) return PLATFORMS.GEMINI;
    if (HOSTNAME.includes("copilot.microsoft.com") || HOSTNAME.includes("copilot.com")) return PLATFORMS.COPILOT;
    if (HOSTNAME.includes("grok.com")) return PLATFORMS.GROK;
    return PLATFORMS.UNKNOWN;
  };

  const platform = getPlatform();
  if (platform === PLATFORMS.UNKNOWN) return; // Exit if not a matched AI platform

  // Inlined Scraping Logic
  const scrapeConversation = () => {
    try {
      if (platform === PLATFORMS.CHATGPT) {
        const turns = document.querySelectorAll("section[data-testid^='conversation-turn-'], div[data-message-author-role]");
        const messages = [];
        turns.forEach((turn) => {
          const turnType = turn.getAttribute("data-turn") || turn.getAttribute("data-message-author-role");
          const header = turn.querySelector("h4")?.textContent?.trim() || "";
          const isUser = turnType === "user" || header.toLowerCase().includes("you said") || turn.querySelector('[data-message-author-role="user"]');
          const role = isUser ? "user" : "assistant";
          const contentElem = turn.querySelector(".markdown, .whitespace-pre-wrap");
          const text = contentElem ? contentElem.innerText.trim() : turn.innerText.trim();
          if (text) messages.push({ role, text });
        });
        return messages;
      }
      
      if (platform === PLATFORMS.CLAUDE) {
        const messageItems = document.querySelectorAll(".font-claude-response:not(#markdown-artifact), [data-testid='user-message']");
        const messages = [];
        messageItems.forEach((item) => {
          const isUser = item.matches("[data-testid='user-message']");
          const role = isUser ? "user" : "assistant";
          if (isUser) {
            const text = item.innerText.trim();
            if (text) messages.push({ role, text });
          } else {
            const container = document.createElement("div");
            Array.from(item.children).forEach((child) => {
              const isThinking = child.className.includes("transition-all") || child.querySelector("[class*='thinking']");
              const isArtifact = (child.className.includes("pt-3") && child.className.includes("pb-3")) || child.querySelector(".artifact-block-cell");
              if (!isThinking && !isArtifact) {
                const content = child.querySelector(".grid-cols-1") || child;
                container.appendChild(content.cloneNode(true));
              }
            });
            const text = container.innerText.trim();
            if (text) messages.push({ role, text });
          }
        });
        return messages;
      }

      if (platform === PLATFORMS.GEMINI) {
        const items = document.querySelectorAll("user-query, model-response");
        const messages = [];
        items.forEach((item) => {
          const tagName = item.tagName.toLowerCase();
          const isUser = tagName === "user-query";
          const role = isUser ? "user" : "assistant";
          const contentElem = isUser ? item.querySelector("div.query-content, .query-text") : item.querySelector("message-content, .model-response-text");
          if (contentElem) {
            let text = contentElem.innerText.trim();
            if (isUser) text = text.replace(/^you said\s+/i, "");
            if (text) messages.push({ role, text });
          }
        });
        return messages;
      }

      if (platform === PLATFORMS.COPILOT) {
        const items = document.querySelectorAll(".group\\/user-message, .group\\/ai-message");
        const messages = [];
        items.forEach((item) => {
          const isUser = item.matches(".group\\/user-message");
          const role = isUser ? "user" : "assistant";
          const contentElem = isUser ? item.querySelector('[data-content="user-message"]') : item.querySelector(".group\\/ai-message-item");
          if (contentElem) {
            const text = contentElem.innerText.trim();
            if (text) messages.push({ role, text });
          }
        });
        return messages;
      }

      if (platform === PLATFORMS.GROK) {
        const items = document.querySelectorAll("div[id^='response-']");
        const messages = [];
        items.forEach((item) => {
          const isUser = item.matches(".items-end");
          const role = isUser ? "user" : "assistant";
          const contentElem = item.querySelector(".response-content-markdown");
          if (contentElem) {
            const text = contentElem.innerText.trim();
            if (text) messages.push({ role, text });
          }
        });
        return messages;
      }
    } catch (e) {
      console.error("ContextBridge: widget scraper failed", e);
    }
    return [];
  };

  // Smart Compactor Logic
  const getCompactPrompt = (messages) => {
    if (messages.length === 0) return "";
    
    // Retain first turn (goal setting)
    let compactMsg = [];
    compactMsg.push(messages[0]);
    
    // Find all code snippets from intermediate turns
    const codeRegex = /```[\s\S]*?```/g;
    const codes = [];
    
    // Extract code blocks from middle turns
    for (let i = 1; i < messages.length - 3; i++) {
      const text = messages[i].text;
      const matches = text.match(codeRegex);
      if (matches) {
        matches.forEach(code => codes.push(code));
      }
    }

    if (codes.length > 0) {
      compactMsg.push({
        role: "user",
        text: `[System State Info: The following code snippets were created/modified during intermediate conversation turns:\n\n${codes.join("\n\n")}]`
      });
    }

    // Retain last 3 turns
    const lastIdx = Math.max(1, messages.length - 3);
    for (let i = lastIdx; i < messages.length; i++) {
      compactMsg.push(messages[i]);
    }

    return compactMsg;
  };

  // Shadow DOM creation
  const host = document.createElement("div");
  host.id = "contextbridge-widget-host";
  
  // Staging positioning container styles
  host.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 24px;
    z-index: 99999;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  `;

  const shadow = host.attachShadow({ mode: "open" });
  document.body.appendChild(host);

  // HTML content inside shadow DOM
  shadow.innerHTML = `
    <style>
      /* Stylesheet isolated in Shadow DOM — Neutral Dark Theme */
      .fab-btn {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: linear-gradient(135deg, #3a3a3a 0%, #2a2a2a 100%);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: #fff;
        font-size: 20px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
        transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      .fab-btn:hover {
        transform: scale(1.1) rotate(5deg);
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.55);
      }
      .fab-btn.active {
        transform: scale(0.9) rotate(-45deg);
      }
      
      .panel-card {
        position: absolute;
        bottom: 60px;
        right: 0;
        width: 320px;
        background: rgba(20, 20, 20, 0.96);
        backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 16px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 1px rgba(255, 255, 255, 0.05);
        padding: 16px;
        color: #e8e8e8;
        display: flex;
        flex-direction: column;
        gap: 12px;
        opacity: 0;
        transform: translateY(20px) scale(0.95);
        pointer-events: none;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        transform-origin: bottom right;
      }
      .panel-card.open {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: auto;
      }
      
      /* Card elements */
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        padding-bottom: 8px;
      }
      .header h2 {
        font-size: 13px;
        font-weight: 700;
        margin: 0;
        color: #e8e8e8;
      }
      .close-btn {
        background: transparent;
        border: none;
        color: #999;
        cursor: pointer;
        font-size: 14px;
      }
      .close-btn:hover { color: #fff; }
      
      .stats-badge {
        font-size: 10px;
        padding: 4px 8px;
        border-radius: 6px;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.08);
        display: flex;
        justify-content: space-between;
      }
      
      /* Mode selector styles */
      .mode-section {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .mode-label { font-size: 10px; color: #999; text-transform: uppercase; font-weight: 600; }
      .mode-options {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 4px;
        background: rgba(0, 0, 0, 0.2);
        padding: 2px;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.05);
      }
      .mode-opt {
        background: transparent;
        border: none;
        border-radius: 6px;
        color: #999;
        font-size: 9px;
        font-weight: 600;
        padding: 6px 0;
        cursor: pointer;
        transition: all 0.2s;
      }
      .mode-opt.active {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
      }
      
      /* Action button styling */
      .action-btn {
        background: linear-gradient(135deg, #3a3a3a 0%, #2a2a2a 100%);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #fff;
        font-weight: 600;
        font-size: 11px;
        padding: 8px 12px;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: all 0.2s;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
      }
      .action-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
      }
      
      /* Grid launch switch */
      .target-grid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 4px;
        margin-top: 4px;
      }
      .target-btn {
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 6px;
        padding: 6px 0;
        font-size: 8px;
        color: #999;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        transition: all 0.2s;
      }
      .target-btn:hover {
        color: #fff;
        background: rgba(255, 255, 255, 0.06);
        border-color: rgba(255, 255, 255, 0.15);
      }
      
      .toast {
        position: absolute;
        bottom: -40px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(50, 50, 50, 0.95);
        color: #fff;
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 9px;
        font-weight: 600;
        white-space: nowrap;
        opacity: 0;
        transition: opacity 0.3s, bottom 0.3s;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
      }
      .toast.show { opacity: 1; bottom: -30px; }
      
      .ai-box {
        font-size: 8.5px;
        color: #c8c8c8;
        background: rgba(150, 150, 150, 0.05);
        border: 1px dashed rgba(150, 150, 150, 0.15);
        padding: 6px;
        border-radius: 6px;
        display: none;
        line-height: 1.3;
      }
      .ai-box.show { display: block; }
    </style>

    <button class="fab-btn" id="fab">🌉</button>
    
    <div class="panel-card" id="card">
      <div class="header">
        <h2>🌉 ContextBridge</h2>
        <button class="close-btn" id="close-card">✕</button>
      </div>

      <div class="stats-badge">
        <span id="plat-text">Platform: Detected</span>
        <span id="turn-text">0 turns</span>
      </div>

      <div class="mode-section">
        <span class="mode-label">Context Mode</span>
        <div class="mode-options">
          <button class="mode-opt active" data-mode="full">Full</button>
          <button class="mode-opt" data-mode="compact">Compact</button>
          <button class="mode-opt" data-mode="ai">AI</button>
        </div>
      </div>

      <div class="ai-box" id="ai-info">
        ⚡ Injected local AI (Gemini Nano) to summarize conversation turns...
      </div>

      <button class="action-btn" id="copy-bridge">
        <span>📋</span> Copy Continuation Prompt
      </button>

      <div style="font-size: 9px; color: #9ca3af; text-transform: uppercase; font-weight: 600;">Switch & Resume:</div>
      <div class="target-grid">
        <button class="target-btn" data-target="chatgpt" data-url="https://chatgpt.com">💬 GPT</button>
        <button class="target-btn" data-target="claude" data-url="https://claude.ai">🎭 Claude</button>
        <button class="target-btn" data-target="gemini" data-url="https://gemini.google.com">✨ Gem</button>
        <button class="target-btn" data-target="copilot" data-target-url="https://copilot.microsoft.com">🌀 Cop</button>
        <button class="target-btn" data-target="grok" data-url="https://grok.com">𝕏 Grok</button>
      </div>
      
      <div class="toast" id="widget-toast">Copied context!</div>
    </div>
  `;

  // UI bindings
  const fab = shadow.getElementById("fab");
  const card = shadow.getElementById("card");
  const closeCard = shadow.getElementById("close-card");
  const platText = shadow.getElementById("plat-text");
  const turnText = shadow.getElementById("turn-text");
  const copyBtn = shadow.getElementById("copy-bridge");
  const toast = shadow.getElementById("widget-toast");
  const modeOpts = shadow.querySelectorAll(".mode-opt");
  const aiInfo = shadow.getElementById("ai-info");
  const targetGridBtns = shadow.querySelectorAll(".target-btn");

  let activeMode = "full";
  let activeMessages = [];
  let preamble = `[System Instruction: You are continuing a conversation that began with another AI. Below is the structured transcript of that conversation. Please read the transcript carefully, absorb all context, details, and goals discussed, and then continue responding as the assistant. Acknowledge this context and wait for my next prompt, or proceed directly by answering the last turn.]`;

  // Retrieve custom preamble if saved
  chrome.storage.local.get(["preamble"], (res) => {
    if (res.preamble) preamble = res.preamble;
  });

  const showToast = (message) => {
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2500);
  };

  // Toggle card visibility
  const toggleCard = () => {
    const isOpen = card.classList.contains("open");
    if (isOpen) {
      card.classList.remove("open");
      fab.classList.remove("active");
    } else {
      activeMessages = scrapeConversation();
      platText.textContent = `Platform: ${platform}`;
      turnText.textContent = `${activeMessages.length} turns`;
      
      card.classList.add("open");
      fab.classList.add("active");
    }
  };

  fab.addEventListener("click", toggleCard);
  closeCard.addEventListener("click", toggleCard);

  // Switch context modes
  modeOpts.forEach((opt) => {
    opt.addEventListener("click", () => {
      modeOpts.forEach(o => o.classList.remove("active"));
      opt.classList.add("active");
      activeMode = opt.dataset.mode;
      
      if (activeMode === "ai") {
        aiInfo.classList.add("show");
        checkChromeAI();
      } else {
        aiInfo.classList.remove("show");
      }
    });
  });

  // Local AI checker
  const checkChromeAI = async () => {
    if (window.ai && window.ai.assistant) {
      aiInfo.textContent = "⚡ Local AI (Gemini Nano) detected! Prompt will be summarized upon copy.";
      aiInfo.style.color = "#c8c8c8";
    } else {
      aiInfo.textContent = "⚠️ Chrome Local AI not active. Falling back to Smart Compactor (strips filler, retains code).";
      aiInfo.style.color = "#f59e0b";
    }
  };

  // Smart prompt builder with full condenser integration
  const buildPrompt = async () => {
    if (activeMessages.length === 0) {
      activeMessages = scrapeConversation();
    }
    if (activeMessages.length === 0) {
      showToast("No active conversation found.");
      return "";
    }

    let finalPrompt = "";

    if (activeMode === "full") {
      // Full transcript mode
      let transcript = "";
      activeMessages.forEach((msg) => {
        const label = msg.role === "user" ? "User" : "Assistant";
        transcript += `${label}: ${msg.text}\n---\n`;
      });
      finalPrompt = `${preamble}

=== CONVERSATION TRANSCRIPT START ===
${transcript.trim()}
=== CONVERSATION TRANSCRIPT END ===

Please continue the conversation based on the context above.`;

    } else if (activeMode === "compact") {
      // Smart compact mode with ContextCondenser
      if (window.ContextCondenser) {
        const condenserPrompt = window.ContextCondenser.buildContextPrompt(activeMessages, "compact", preamble);
        finalPrompt = condenserPrompt;
      } else {
        // Fallback if condenser not loaded
        let transcript = "";
        const compacted = getCompactPrompt(activeMessages);
        compacted.forEach((msg) => {
          const label = msg.role === "user" ? "User" : "Assistant";
          transcript += `${label}: ${msg.text}\n---\n`;
        });
        finalPrompt = `${preamble}

=== CONVERSATION TRANSCRIPT START ===
${transcript.trim()}
=== CONVERSATION TRANSCRIPT END ===

Please continue the conversation based on the context above.`;
      }

    } else if (activeMode === "ai") {
      // AI Summarization mode
      if (window.ai && window.ai.assistant) {
        try {
          aiInfo.textContent = "⚡ Gemini Nano summarizing transcript...";
          
          const summary = await window.ContextCondenser?.summarizeWithLocalAI(activeMessages);
          if (summary && summary.content) {
            finalPrompt = `${preamble}

=== AI-GENERATED SUMMARY ===
${summary.content}
=== END SUMMARY ===

Please continue the conversation based on this summary.`;
            aiInfo.textContent = "✅ Summarized successfully with Gemini Nano!";
          }
        } catch (err) {
          console.error("Local AI failed:", err);
          aiInfo.textContent = "⚠️ AI generation failed. Falling back to Compact mode.";
          // Fallback to compact
          if (window.ContextCondenser) {
            finalPrompt = window.ContextCondenser.buildContextPrompt(activeMessages, "compact", preamble);
          }
        }
      } else {
        // Local AI not available - use compact
        aiInfo.textContent = "⚠️ Chrome Local AI not active. Using Smart Compactor.";
        if (window.ContextCondenser) {
          finalPrompt = window.ContextCondenser.buildContextPrompt(activeMessages, "compact", preamble);
        }
      }
    }

    return finalPrompt;
  };

  // Copy prompt
  copyBtn.addEventListener("click", async () => {
    const promptText = await buildPrompt();
    if (!promptText) return;

    navigator.clipboard.writeText(promptText)
      .then(() => {
        showToast("Continuation prompt copied!");
      })
      .catch((err) => {
        console.error("Widget copy failed:", err);
        showToast("Failed to copy automatically.");
      });
  });

  // Enhanced redirect targets with one-click auto-resume
  targetGridBtns.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const targetUrl = btn.dataset.url || "https://chatgpt.com";
      const targetName = btn.dataset.target || "chatgpt";
      const promptText = await buildPrompt();

      if (promptText) {
        // Auto-save context to storage with auto-send preference
        chrome.storage.local.get("autoSendEnabled", (result) => {
          chrome.storage.local.set({
            pendingContext: promptText,
            pendingTarget: targetName,
            autoSendOnInject: result.autoSendEnabled === true
          }, () => {
            showToast("🚀 Opening tab...");
            
            // Use messaging to background script to open tab (content scripts can't use chrome.tabs)
            chrome.runtime.sendMessage({
              action: "openTab",
              url: targetUrl
            }, (response) => {
              if (chrome.runtime.lastError) {
                // Fallback: direct window.open if messaging fails
                console.warn("Tab message failed, using fallback:", chrome.runtime.lastError);
                window.open(targetUrl, "_blank");
              }
            });
          });
        });
      } else {
        // No context, just open the tab
        window.open(targetUrl, "_blank");
      }
    });

    // Add visual feedback on hover
    btn.addEventListener("mouseenter", function() {
      this.style.transform = "scale(1.1)";
      this.style.backgroundColor = "rgba(255, 255, 255, 0.08)";
    });

    btn.addEventListener("mouseleave", function() {
      this.style.transform = "scale(1)";
      this.style.backgroundColor = "rgba(255, 255, 255, 0.02)";
    });
  });
})();
