// ContextBridge Popup Controller

document.addEventListener("DOMContentLoaded", () => {
  // App state
  let scrapedData = null;
  let customPreamble = "";
  let defaultTarget = "none";
  let activeMode = "full"; // full, compact, ai

  // Default values
  const DEFAULT_PREAMBLE = 
    `[System Instruction: You are continuing a conversation that began with another AI. Below is the structured transcript of that conversation. Please read the transcript carefully, absorb all context, details, and goals discussed, and then continue responding as the assistant. Acknowledge this context and wait for my next prompt, or proceed directly by answering the last turn.]`;

  // UI Elements
  const detectedPanel = document.getElementById("detected-panel");
  const emptyPanel = document.getElementById("empty-panel");
  const settingsPanel = document.getElementById("settings-panel");
  const settingsToggleBtn = document.getElementById("settings-toggle-btn");
  const settingsCloseBtn = document.getElementById("settings-close-btn");
  
  // Status & Details
  const platformBadge = document.getElementById("platform-badge");
  const detectedPlatformText = document.getElementById("detected-platform-text");
  const chatTitle = document.getElementById("chat-title");
  const messageCountBadge = document.getElementById("message-count-badge");
  const charCountBadge = document.getElementById("char-count-badge");

  // Mode Selection & AI Box
  const segmentButtons = document.querySelectorAll(".segment-btn");
  const aiStatusBox = document.getElementById("ai-status-box");
  const aiStatusText = document.getElementById("ai-status-text");
  
  // Scraper Outline
  const outlineTrigger = document.getElementById("outline-trigger");
  const accordionOutline = outlineTrigger.closest(".accordion");
  const turnsContainer = document.getElementById("turns-container");
  const turnSearch = document.getElementById("turn-search");
  const selectAllTurns = document.getElementById("select-all-turns");
  const selectAllLabel = document.getElementById("select-all-label");
  
  // Manual Input
  const manualTrigger = document.getElementById("manual-trigger");
  const manualContent = document.getElementById("manual-content");
  const manualInput = document.getElementById("manual-input");
  const copyManualBtn = document.getElementById("copy-manual-btn");
  
  // Settings Inputs
  const preambleInput = document.getElementById("preamble-input");
  const defaultTargetSelect = document.getElementById("default-target");
  const saveSettingsBtn = document.getElementById("save-settings-btn");
  const resetSettingsBtn = document.getElementById("reset-settings-btn");
  
  // Premium Feature Toggles
  const autoSendToggle = document.getElementById("auto-send-toggle");
  const autoCompressToggle = document.getElementById("auto-compress-toggle");
  const compressionModeSelect = document.getElementById("compression-mode");
  
  // Premium Action Buttons
  const exportStateBtn = document.getElementById("export-state-btn");
  const oneClickResumeBtn = document.getElementById("one-click-resume-btn");
  
  // Action Buttons
  const copyPromptBtn = document.getElementById("copy-prompt-btn");
  const targetButtons = document.querySelectorAll(".target-btn");
  const toast = document.getElementById("toast");

  // 1. Initialize settings from chrome.storage
  const loadSettings = () => {
    chrome.storage.local.get([
      "preamble", 
      "defaultTarget", 
      "autoSendEnabled",
      "autoCompressEnabled",
      "compressionMode"
    ], (result) => {
      customPreamble = result.preamble || DEFAULT_PREAMBLE;
      defaultTarget = result.defaultTarget || "none";
      
      // Update inputs in settings drawer
      preambleInput.value = customPreamble;
      defaultTargetSelect.value = defaultTarget;
      
      // Update premium toggles
      autoSendToggle.checked = result.autoSendEnabled === true;
      autoCompressToggle.checked = result.autoCompressEnabled !== false; // Default true
      compressionModeSelect.value = result.compressionMode || "compact";
    });
  };

  loadSettings();

  // 2. Settings Drawer Handlers
  settingsToggleBtn.addEventListener("click", () => {
    settingsPanel.classList.remove("hidden");
  });

  settingsCloseBtn.addEventListener("click", () => {
    settingsPanel.classList.add("hidden");
  });

  saveSettingsBtn.addEventListener("click", () => {
    const preambleVal = preambleInput.value.trim() || DEFAULT_PREAMBLE;
    const defaultTargetVal = defaultTargetSelect.value;
    const autoSendVal = autoSendToggle.checked;
    const autoCompressVal = autoCompressToggle.checked;
    const compressionVal = compressionModeSelect.value;

    chrome.storage.local.set({
      preamble: preambleVal,
      defaultTarget: defaultTargetVal,
      autoSendEnabled: autoSendVal,
      autoCompressEnabled: autoCompressVal,
      compressionMode: compressionVal
    }, () => {
      customPreamble = preambleVal;
      defaultTarget = defaultTargetVal;
      showToast("✅ Settings saved successfully!");
      settingsPanel.classList.add("hidden");
    });
  });

  resetSettingsBtn.addEventListener("click", () => {
    if (confirm("Reset all settings to defaults? This will disable premium features.")) {
      preambleInput.value = DEFAULT_PREAMBLE;
      defaultTargetSelect.value = "none";
      autoSendToggle.checked = false;
      autoCompressToggle.checked = true;
      compressionModeSelect.value = "compact";
      
      chrome.storage.local.set({
        preamble: DEFAULT_PREAMBLE,
        defaultTarget: "none",
        autoSendEnabled: false,
        autoCompressEnabled: true,
        compressionMode: "compact"
      }, () => {
        customPreamble = DEFAULT_PREAMBLE;
        defaultTarget = "none";
        showToast("✅ Settings reset to defaults");
      });
    }
  });

  // 3. Accordion triggers
  outlineTrigger.addEventListener("click", () => {
    accordionOutline.classList.toggle("expanded");
  });

  manualTrigger.addEventListener("click", () => {
    const isHidden = manualContent.classList.contains("hidden");
    if (isHidden) {
      manualContent.classList.remove("hidden");
      manualTrigger.querySelector(".arrow").textContent = "▲";
    } else {
      manualContent.classList.add("hidden");
      manualTrigger.querySelector(".arrow").textContent = "▼";
    }
  });

  // 4. Toast notification helper
  const showToast = (message) => {
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
    }, 2500);
  };

  // 5. Context Mode Segment Controller
  segmentButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      segmentButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeMode = btn.dataset.mode;
      
      if (activeMode === "ai") {
        aiStatusBox.classList.remove("hidden");
        checkChromeAI();
      } else {
        aiStatusBox.classList.add("hidden");
      }
      updateCounts();
    });
  });

  const checkChromeAI = async () => {
    if (window.ai && window.ai.assistant) {
      updateAIStatus("⚡ Local AI (Gemini Nano) detected! Prompt will be summarized upon copying.", false);
    } else {
      updateAIStatus("⚠️ Local AI not active in Chrome. Falling back to Smart Compactor (retains code & recent history).", true);
    }
  };

  const updateAIStatus = (text, isWarning) => {
    aiStatusText.textContent = text;
    if (isWarning) {
      aiStatusBox.classList.add("warning");
    } else {
      aiStatusBox.classList.remove("warning");
    }
  };

  // 6. Scrape active tab
  const initScrape = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) return;
      const activeTab = tabs[0];
      const url = activeTab.url || "";

      // List of supported domains
      const isSupported = 
        url.includes("chatgpt.com") || 
        url.includes("chat.openai.com") || 
        url.includes("claude.ai") || 
        url.includes("gemini.google.com") || 
        url.includes("copilot.microsoft.com") ||
        url.includes("copilot.com") || 
        url.includes("grok.com");

      if (isSupported) {
        // Inject content scraper dynamically
        chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ["content/scraper.js"]
        }, (results) => {
          if (results && results[0] && results[0].result) {
            scrapedData = results[0].result;
            if (scrapedData.messages && scrapedData.messages.length > 0) {
              renderScrapedUI();
            } else {
              showEmptyUI();
            }
          } else {
            showEmptyUI();
          }
        });
      } else {
        showEmptyUI();
      }
    });
  };

  const showEmptyUI = () => {
    detectedPanel.classList.add("hidden");
    emptyPanel.classList.remove("hidden");
  };

  const renderScrapedUI = () => {
    emptyPanel.classList.add("hidden");
    detectedPanel.classList.remove("hidden");

    platformBadge.className = `status-badge ${scrapedData.platform}`;
    detectedPlatformText.textContent = `Active: ${scrapedData.platform}`;
    chatTitle.textContent = scrapedData.title;
    
    renderTurnsList();
  };

  const renderTurnsList = () => {
    turnsContainer.innerHTML = "";
    
    let turnNum = 1;
    scrapedData.messages.forEach((msg, idx) => {
      if (msg.role === "user") {
        const itemDiv = document.createElement("div");
        itemDiv.className = "turn-item";
        itemDiv.dataset.index = idx;
        itemDiv.dataset.text = msg.text.toLowerCase();

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = true;
        checkbox.className = "turn-checkbox";
        checkbox.id = `turn-cb-${idx}`;
        checkbox.dataset.index = idx;
        checkbox.addEventListener("change", updateCounts);
        itemDiv.appendChild(checkbox);

        const textSpan = document.createElement("span");
        textSpan.className = "turn-text";
        textSpan.textContent = `${turnNum}. ${msg.text}`;
        textSpan.addEventListener("click", () => {
          checkbox.checked = !checkbox.checked;
          updateCounts();
        });
        itemDiv.appendChild(textSpan);

        const metaSpan = document.createElement("span");
        metaSpan.className = "turn-meta";
        
        let totalLen = msg.text.length;
        if (scrapedData.messages[idx + 1] && scrapedData.messages[idx + 1].role === "assistant") {
          totalLen += scrapedData.messages[idx + 1].text.length;
        }
        metaSpan.textContent = `${totalLen} chars`;
        itemDiv.appendChild(metaSpan);

        turnsContainer.appendChild(itemDiv);
        turnNum++;
      }
    });

    updateCounts();
  };

  // Update turns and character count dynamically
  const updateCounts = () => {
    if (!scrapedData) return;

    const checkboxes = document.querySelectorAll(".turn-checkbox");
    let selectedTurnsCount = 0;
    let selectedMessages = [];

    checkboxes.forEach((cb) => {
      if (cb.checked) {
        selectedTurnsCount++;
        const idx = parseInt(cb.dataset.index);
        selectedMessages.push(scrapedData.messages[idx]);
        if (scrapedData.messages[idx + 1] && scrapedData.messages[idx + 1].role === "assistant") {
          selectedMessages.push(scrapedData.messages[idx + 1]);
        }
      }
    });

    let displayChars = 0;
    if (activeMode === "full") {
      displayChars = selectedMessages.reduce((acc, m) => acc + m.text.length, 0);
    } else if (activeMode === "compact" || activeMode === "ai") {
      // Estimated compactor size
      const compacted = getCompactPrompt(selectedMessages);
      displayChars = compacted.reduce((acc, m) => acc + m.text.length, 0);
    }

    messageCountBadge.textContent = `${selectedTurnsCount} turns selected`;
    charCountBadge.textContent = `~${displayChars.toLocaleString()} chars`;

    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    const someChecked = Array.from(checkboxes).some(cb => cb.checked);
    selectAllTurns.checked = allChecked;
    selectAllTurns.indeterminate = someChecked && !allChecked;
  };

  // Smart Compactor Logic
  const getCompactPrompt = (messages) => {
    if (messages.length === 0) return [];
    
    let compactMsg = [];
    // Keep first turn
    compactMsg.push(messages[0]);
    
    // Extract code blocks from middle turns
    const codeRegex = /```[\s\S]*?```/g;
    const codes = [];
    
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

  selectAllTurns.addEventListener("change", (e) => {
    const isChecked = e.target.checked;
    const items = document.querySelectorAll(".turn-item");
    items.forEach((item) => {
      if (item.style.display !== "none") {
        const cb = item.querySelector(".turn-checkbox");
        if (cb) cb.checked = isChecked;
      }
    });
    updateCounts();
  });

  turnSearch.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();
    const items = document.querySelectorAll(".turn-item");
    
    items.forEach((item) => {
      const text = item.dataset.text || "";
      if (text.includes(query)) {
        item.classList.remove("hidden");
      } else {
        item.classList.add("hidden");
      }
    });
  });

  // 7. Continuation prompt builder (Async for local AI support)
  const buildContinuationPrompt = async () => {
    if (!scrapedData) return "";

    const checkboxes = document.querySelectorAll(".turn-checkbox");
    const selectedMessages = [];

    checkboxes.forEach((cb) => {
      if (cb.checked) {
        const idx = parseInt(cb.dataset.index);
        const userMsg = scrapedData.messages[idx];
        selectedMessages.push({ role: "user", text: userMsg.text });

        if (scrapedData.messages[idx + 1] && scrapedData.messages[idx + 1].role === "assistant") {
          selectedMessages.push({ role: "assistant", text: scrapedData.messages[idx + 1].text });
        }
      }
    });

    if (selectedMessages.length === 0) {
      alert("Please select at least one turn to include in context.");
      return "";
    }

    let transcript = "";

    if (activeMode === "full") {
      selectedMessages.forEach((msg) => {
        const label = msg.role === "user" ? "User" : "Assistant";
        transcript += `${label}: ${msg.text}\n---\n`;
      });
    } else if (activeMode === "compact" || (activeMode === "ai" && (!window.ai || !window.ai.assistant))) {
      // Smart compact mode fallback
      const compacted = getCompactPrompt(selectedMessages);
      compacted.forEach((msg) => {
        const label = msg.role === "user" ? "User" : "Assistant";
        transcript += `${label}: ${msg.text}\n---\n`;
      });
    } else if (activeMode === "ai" && window.ai && window.ai.assistant) {
      // Local AI Summarization
      try {
        updateAIStatus("⚡ Summarizing conversation turns using Gemini Nano...", false);
        const rawTranscript = selectedMessages.map(m => `${m.role}: ${m.text}`).join("\n");
        const session = await window.ai.assistant.create();
        const summary = await session.prompt(
          `Summarize this conversation transcript into a concise prompt for another assistant to resume work. Focus on the core goal, decisions made, current state of code, and active instruction. Transcript:\n\n${rawTranscript}`
        );
        session.destroy();
        updateAIStatus("✨ Summarized successfully!", false);
        
        return `${customPreamble}

=== CONVERSATION SUMMARY START ===
${summary.trim()}
=== CONVERSATION SUMMARY END ===

Please resume based on this summary.`;
      } catch (err) {
        console.error("Local AI failed:", err);
        updateAIStatus("⚠️ Local AI error. Falling back to Smart Compactor.", true);
        const compacted = getCompactPrompt(selectedMessages);
        compacted.forEach((msg) => {
          const label = msg.role === "user" ? "User" : "Assistant";
          transcript += `${label}: ${msg.text}\n---\n`;
        });
      }
    }

    const finalPrompt = 
`${customPreamble}

=== CONVERSATION TRANSCRIPT START ===
${transcript.trim()}
=== CONVERSATION TRANSCRIPT END ===

Please review the transcript above and await my instructions, or proceed by continuing from the last turn.`;

    return finalPrompt;
  };

  // Copy captured prompt
  copyPromptBtn.addEventListener("click", async () => {
    const promptText = await buildContinuationPrompt();
    if (!promptText) return;

    navigator.clipboard.writeText(promptText)
      .then(() => {
        showToast("Continuation prompt copied!");
        
        copyPromptBtn.classList.remove("pulse-glow");
        copyPromptBtn.style.transform = "scale(0.97)";
        setTimeout(() => {
          copyPromptBtn.style.transform = "";
          copyPromptBtn.classList.add("pulse-glow");
        }, 200);

        // Open default target platform and load injection
        if (defaultTarget && defaultTarget !== "none") {
          const targetUrls = {
            chatgpt: "https://chatgpt.com",
            claude: "https://claude.ai",
            gemini: "https://gemini.google.com",
            copilot: "https://copilot.microsoft.com",
            grok: "https://grok.com"
          };
          const url = targetUrls[defaultTarget];
          if (url) {
            chrome.storage.local.set({
              pendingContext: promptText,
              pendingTarget: defaultTarget,
              autoSendOnInject: autoSendToggle.checked
            }, () => {
              setTimeout(() => {
                chrome.tabs.create({ url });
              }, 600);
            });
          }
        }
      })
      .catch((err) => {
        console.error("Clipboard copy failed:", err);
        showToast("Failed to copy automatically.");
      });
  });

  // ==================== PREMIUM FEATURES ====================
  
  // One-Click Auto-Resume (directly inject to default target)
  oneClickResumeBtn.addEventListener("click", async () => {
    if (defaultTarget === "none") {
      alert("🚀 Please set a default target platform in Settings first!");
      return;
    }

    const promptText = await buildContinuationPrompt();
    if (!promptText) return;

    const targetUrl = {
      chatgpt: "https://chatgpt.com",
      claude: "https://claude.ai",
      gemini: "https://gemini.google.com",
      copilot: "https://copilot.microsoft.com",
      grok: "https://grok.com"
    }[defaultTarget];

    chrome.storage.local.set({
      pendingContext: promptText,
      pendingTarget: defaultTarget,
      autoSendOnInject: autoSendToggle.checked
    }, () => {
      showToast("🚀 One-click resume initiated!");
      chrome.tabs.create({ url: targetUrl });
    });
  });

  // Export State File (structured JSON export of conversation)
  exportStateBtn.addEventListener("click", async () => {
    if (!scrapedData) {
      alert("No conversation to export!");
      return;
    }

    const checkboxes = document.querySelectorAll(".turn-checkbox");
    const selectedMessages = [];

    checkboxes.forEach((cb) => {
      if (cb.checked) {
        const idx = parseInt(cb.dataset.index);
        const userMsg = scrapedData.messages[idx];
        selectedMessages.push({ role: "user", text: userMsg.text });

        if (scrapedData.messages[idx + 1] && scrapedData.messages[idx + 1].role === "assistant") {
          selectedMessages.push({ role: "assistant", text: scrapedData.messages[idx + 1].text });
        }
      }
    });

    // Create state file with ContextCondenser if available
    let stateFileContent;
    if (window.ContextCondenser && window.ContextCondenser.createStateFile) {
      const compressionMode = autoCompressToggle.checked ? compressionModeSelect.value : "full";
      stateFileContent = window.ContextCondenser.createStateFile(selectedMessages, compressionMode);
    } else {
      // Fallback: create basic state file
      const timestamp = new Date().toISOString();
      const stateFile = {
        version: "1.0",
        format: "ContextBridge State File",
        exportedAt: timestamp,
        platform: scrapedData.platform,
        title: scrapedData.title,
        statistics: {
          totalTurns: selectedMessages.length,
          totalCharacters: selectedMessages.reduce((sum, m) => sum + m.text.length, 0),
        },
        transcript: selectedMessages,
      };
      stateFileContent = JSON.stringify(stateFile, null, 2);
    }

    // Download as JSON file
    const blob = new Blob([stateFileContent], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contextbridge-export-${scrapedData.platform}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast("💾 State file exported successfully!");
  });

  // ==================== END PREMIUM FEATURES ====================

  // Switch and open in targets
  targetButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const targetUrl = btn.dataset.url;
      
      // Extract target platform key name from class list
      const targetName = Array.from(btn.classList).find(c => ["chatgpt", "claude", "gemini", "copilot", "grok"].includes(c)) || "chatgpt";
      const promptText = await buildContinuationPrompt();
      
      if (promptText) {
        chrome.storage.local.set({
          pendingContext: promptText,
          pendingTarget: targetName,
          autoSendOnInject: autoSendToggle.checked
        }, () => {
          showToast("🌉 Context bridged! Opening tab...");
          setTimeout(() => {
            chrome.tabs.create({ url: targetUrl });
          }, 800);
        });
      } else {
        chrome.tabs.create({ url: targetUrl });
      }
    });
  });

  // Manual wrapper buttons
  copyManualBtn.addEventListener("click", () => {
    const manualVal = manualInput.value.trim();
    if (!manualVal) {
      alert("Please paste some text into the manual area first.");
      return;
    }

    const wrappedPrompt = 
`${customPreamble}

=== MANUAL CONTEXT START ===
${manualVal}
=== MANUAL CONTEXT END ===

Please review this context and await my instructions.`;

    navigator.clipboard.writeText(wrappedPrompt)
      .then(() => {
        showToast("Manual context copied!");
        manualInput.value = "";
      })
      .catch((err) => {
        console.error("Manual copy failed:", err);
      });
  });

  // Trigger scraper on startup
  initScrape();
});
