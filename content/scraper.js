// ContextBridge DOM Scraper
// Injected dynamically when the popup is opened

(() => {
  "use strict";

  const HOSTNAME = window.location.hostname;
  const TITLE = document.title;
  const URL = window.location.origin + window.location.pathname;

  // Identify the active platform
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

  // Scraper functions for each platform
  const scrapers = {
    [PLATFORMS.CHATGPT]: () => {
      // ChatGPT conversational turns
      const turns = document.querySelectorAll("section[data-testid^='conversation-turn-'], div[data-message-author-role]");
      const messages = [];

      turns.forEach((turn) => {
        const turnType = turn.getAttribute("data-turn") || turn.getAttribute("data-message-author-role");
        const header = turn.querySelector("h4")?.textContent?.trim() || "";
        const isUser = turnType === "user" || header.toLowerCase().includes("you said") || turn.querySelector('[data-message-author-role="user"]');

        const role = isUser ? "user" : "assistant";
        const contentElem = turn.querySelector(".markdown, .whitespace-pre-wrap");
        const text = contentElem ? contentElem.innerText.trim() : turn.innerText.trim();

        if (text) {
          messages.push({ role, text });
        }
      });
      return messages;
    },

    [PLATFORMS.CLAUDE]: () => {
      // Claude conversational turns
      const messageItems = document.querySelectorAll(".font-claude-response:not(#markdown-artifact), [data-testid='user-message']");
      const messages = [];

      messageItems.forEach((item) => {
        const isUser = item.matches("[data-testid='user-message']");
        const role = isUser ? "user" : "assistant";

        if (isUser) {
          const text = item.innerText.trim();
          if (text) messages.push({ role, text });
        } else {
          // AI message - clean up "thinking" and artifact boxes
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
    },

    [PLATFORMS.GEMINI]: () => {
      // Google Gemini turns
      const items = document.querySelectorAll("user-query, model-response");
      const messages = [];

      items.forEach((item) => {
        const tagName = item.tagName.toLowerCase();
        const isUser = tagName === "user-query";
        const role = isUser ? "user" : "assistant";

        const contentElem = isUser 
          ? item.querySelector("div.query-content, .query-text")
          : item.querySelector("message-content, .model-response-text");

        if (contentElem) {
          let text = contentElem.innerText.trim();
          // Strip Gemini's helper prefixes
          if (isUser) {
            text = text.replace(/^you said\s+/i, "");
          }
          if (text) {
            messages.push({ role, text });
          }
        }
      });
      return messages;
    },

    [PLATFORMS.COPILOT]: () => {
      // Microsoft Copilot turns
      const items = document.querySelectorAll(".group\\/user-message, .group\\/ai-message");
      const messages = [];

      items.forEach((item) => {
        const isUser = item.matches(".group\\/user-message");
        const role = isUser ? "user" : "assistant";

        const contentElem = isUser
          ? item.querySelector('[data-content="user-message"]')
          : item.querySelector(".group\\/ai-message-item");

        if (contentElem) {
          const text = contentElem.innerText.trim();
          if (text) {
            messages.push({ role, text });
          }
        }
      });
      return messages;
    },

    [PLATFORMS.GROK]: () => {
      // xAI Grok turns
      const items = document.querySelectorAll("div[id^='response-']");
      const messages = [];

      items.forEach((item) => {
        const isUser = item.matches(".items-end");
        const role = isUser ? "user" : "assistant";
        const contentElem = item.querySelector(".response-content-markdown");

        if (contentElem) {
          const text = contentElem.innerText.trim();
          if (text) {
            messages.push({ role, text });
          }
        }
      });
      return messages;
    },

    [PLATFORMS.UNKNOWN]: () => {
      // Fallback scraper if URL not explicitly supported or selectors fail
      return runFallbackScraper();
    }
  };

  // Fallback scraper logic
  const runFallbackScraper = () => {
    const messages = [];
    
    // Attempt 1: Search for common message structures (ARIA roles or typical chat indicators)
    const chatElements = document.querySelectorAll('[role="log"], [class*="chat-history"], [class*="chat-container"], main');
    if (chatElements.length > 0) {
      // Find candidate speech bubbles
      const bubbles = document.querySelectorAll('[class*="message"], [class*="bubble"], [class*="chat-item"], p');
      bubbles.forEach((bubble) => {
        const text = bubble.innerText.trim();
        if (text && text.length > 5) {
          // Heuristic to decide if it's user or assistant: alignment or background color
          const style = window.getComputedStyle(bubble);
          const alignRight = style.textAlign === "right" || style.justifyContent === "flex-end";
          const role = alignRight ? "user" : "assistant";
          messages.push({ role, text });
        }
      });
    }
    
    return messages;
  };

  // Run scraper based on platform
  let messages = [];
  try {
    if (platform !== PLATFORMS.UNKNOWN) {
      messages = scrapers[platform]();
    }
    
    // If platform-specific scraper yielded no results, execute generic fallback
    if (messages.length === 0) {
      messages = runFallbackScraper();
    }
  } catch (error) {
    console.error("ContextBridge scraper error:", error);
    messages = runFallbackScraper();
  }

  // Clean title suffix
  let cleanTitle = TITLE;
  if (platform === PLATFORMS.CHATGPT) cleanTitle = cleanTitle.replace(" - ChatGPT", "");
  if (platform === PLATFORMS.CLAUDE) cleanTitle = cleanTitle.replace(" - Claude", "");
  if (platform === PLATFORMS.GEMINI) cleanTitle = cleanTitle.replace("Gemini - ", "");
  if (platform === PLATFORMS.GROK) cleanTitle = cleanTitle.replace(" - Grok", "");
  cleanTitle = cleanTitle.trim() || "Untitled Conversation";

  return {
    platform,
    title: cleanTitle,
    url: URL,
    messages
  };
})();
