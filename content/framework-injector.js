// ContextBridge Framework-Specific Injector
// Intelligently detects and interacts with various frontend frameworks

(() => {
  "use strict";

  const HOSTNAME = window.location.hostname;

  // Framework detection and interaction utilities
  const FrameworkDetector = {
    
    // Detect which framework the page uses
    detectFramework() {
      const frameworks = [];

      // React detection - look for __react fiber
      if (window.__react || window.__reactEvents || document._reactRootContainer) {
        frameworks.push("react");
      }

      // Vue detection
      if (window.__vue__ || window.$nuxt) {
        frameworks.push("vue");
      }

      // Angular detection
      if (window.ng || window.angular) {
        frameworks.push("angular");
      }

      // ProseMirror (Claude, Gemini) - look for contenteditable with ProseMirror
      const proseMirrorEditors = document.querySelectorAll('[contenteditable="true"].ProseMirror');
      if (proseMirrorEditors.length > 0) {
        frameworks.push("prosemirror");
      }

      // Draft.js (some platforms)
      if (window.Draft) {
        frameworks.push("draftjs");
      }

      // Custom checks
      if (HOSTNAME.includes("chatgpt.com") || HOSTNAME.includes("chat.openai.com")) {
        frameworks.push("react"); // ChatGPT uses React
      }
      if (HOSTNAME.includes("claude.ai")) {
        frameworks.push("react", "prosemirror"); // Claude uses React + ProseMirror
      }
      if (HOSTNAME.includes("gemini.google.com")) {
        frameworks.push("angular"); // Gemini uses Angular
      }
      if (HOSTNAME.includes("grok.com") || HOSTNAME.includes("x.ai")) {
        frameworks.push("react"); // Grok uses React
      }

      return frameworks;
    },

    // React-specific event triggering
    triggerReactEvent(element, eventType = "change") {
      if (!element) return false;

      // Set the value directly
      if (element.value !== undefined) {
        const nativeValueSetter = Object.getOwnPropertyDescriptor(
          Object.getPrototypeOf(element),
          'value'
        )?.set;
        
        if (nativeValueSetter) {
          nativeValueSetter.call(element, element.value);
        }
      }

      // Create and dispatch comprehensive events
      const events = [
        new Event("input", { bubbles: true, cancelable: true }),
        new Event("change", { bubbles: true, cancelable: true }),
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
        new KeyboardEvent("keyup", { key: "Enter", bubbles: true, cancelable: true }),
      ];

      for (const event of events) {
        element.dispatchEvent(event);
      }

      return true;
    },

    // ProseMirror-specific interaction
    triggerProseMirrorUpdate(element, text) {
      if (!element) return false;

      try {
        // Method 1: Direct innerHTML (works for most cases)
        element.innerHTML = `<p>${this.escapeHtml(text)}</p>`;

        // Method 2: Dispatch InputEvent for proper framework sync
        const inputEvent = new InputEvent("input", {
          bubbles: true,
          cancelable: true,
          data: text,
          inputType: "insertText",
        });
        element.dispatchEvent(inputEvent);

        // Method 3: Trigger change event
        const changeEvent = new Event("change", { bubbles: true, cancelable: true });
        element.dispatchEvent(changeEvent);

        return true;
      } catch (e) {
        console.warn("ProseMirror trigger failed:", e);
        return false;
      }
    },

    // Angular-specific event triggering
    triggerAngularEvent(element, text) {
      if (!element) return false;

      try {
        // Set value
        element.value = text;
        element.textContent = text;

        // Dispatch events that Angular listens to
        const events = [
          new Event("input", { bubbles: true }),
          new Event("change", { bubbles: true }),
          new Event("blur", { bubbles: true }),
          new KeyboardEvent("keyup", { bubbles: true, key: "Enter" }),
        ];

        events.forEach(evt => element.dispatchEvent(evt));

        // Angular change detection
        if (window.ng && window.ng.probe) {
          const component = window.ng.probe(element);
          if (component && component._ngZone) {
            component._ngZone.run(() => {
              element.dispatchEvent(new Event("change", { bubbles: true }));
            });
          }
        }

        return true;
      } catch (e) {
        console.warn("Angular trigger failed:", e);
        return false;
      }
    },

    // Generic input trigger (fallback)
    triggerGenericEvent(element, text) {
      if (!element) return false;

      try {
        element.focus();

        // Attempt execCommand first (works with contentEditable)
        const success = document.execCommand("selectAll", false, null);
        if (success) {
          document.execCommand("insertText", false, text);
        }

        // Fallback: direct property assignment
        if (element.tagName === "TEXTAREA" || element.tagName === "INPUT") {
          element.value = text;
        } else {
          element.innerText = text;
        }

        // Generic event dispatch
        ["input", "change", "blur", "keyup"].forEach(eventName => {
          const event = new Event(eventName, { bubbles: true });
          element.dispatchEvent(event);
        });

        return true;
      } catch (e) {
        console.warn("Generic trigger failed:", e);
        return false;
      }
    },

    // Helper: Escape HTML to prevent injection
    escapeHtml(text) {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    },

    // Try to trigger send/submit button
    triggerSendButton(element) {
      try {
        console.log("ContextBridge: triggerSendButton called");
        
        // Method 1: Focus the element and use keyboard shortcut
        // This works even if form gets disconnected
        element.focus();
        
        // Try Enter key first (most platforms use this)
        console.log("ContextBridge: Attempting Enter key...");
        const enterEvent = new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          bubbles: true,
          cancelable: true,
        });
        element.dispatchEvent(enterEvent);
        
        const enterUpEvent = new KeyboardEvent("keyup", {
          key: "Enter",
          code: "Enter",
          bubbles: true,
          cancelable: true,
        });
        element.dispatchEvent(enterUpEvent);

        // Method 2: Try Ctrl+Enter if plain Enter doesn't work
        setTimeout(() => {
          console.log("ContextBridge: Attempting Ctrl+Enter as backup...");
          const ctrlEnterEvent = new KeyboardEvent("keydown", {
            key: "Enter",
            code: "Enter",
            ctrlKey: true,
            metaKey: true,
            bubbles: true,
            cancelable: true,
          });
          element.dispatchEvent(ctrlEnterEvent);
          
          const ctrlEnterUpEvent = new KeyboardEvent("keyup", {
            key: "Enter",
            code: "Enter",
            ctrlKey: true,
            metaKey: true,
            bubbles: true,
            cancelable: true,
          });
          element.dispatchEvent(ctrlEnterUpEvent);
        }, 200);

        // Method 3: Find and click the send button as last resort
        setTimeout(() => {
          console.log("ContextBridge: Attempting button click as last resort...");
          let sendBtn = null;

          // Platform-specific selectors
          const HOSTNAME = window.location.hostname;
          
          if (HOSTNAME.includes("grok.com")) {
            sendBtn = document.querySelector("button[aria-label*='Send']") ||
                     document.querySelector("button[title*='Send']") ||
                     document.querySelector("button[class*='send']") ||
                     document.querySelector("footer button:last-of-type");
          } else {
            sendBtn = document.querySelector("button[aria-label*='Send']") ||
                     document.querySelector("button[type='submit']");
          }

          if (sendBtn && !sendBtn.disabled) {
            console.log("ContextBridge: Found send button, clicking...");
            sendBtn.click();
          } else {
            console.warn("ContextBridge: Could not find enabled send button");
          }
        }, 500);

        return true;
      } catch (e) {
        console.error("Send button trigger failed:", e);
        return false;
      }
    },
  };

  // Smart injecter that uses framework detection
  const SmartInjecter = {
    async injectWithFrameworkDetection(element, text, shouldAutoSend = false) {
      if (!element) {
        console.warn("ContextBridge: No element to inject into");
        return false;
      }

      const HOSTNAME = window.location.hostname;

      const frameworks = FrameworkDetector.detectFramework();
      console.log("ContextBridge: Detected frameworks:", frameworks);
      
      if (frameworks.length === 0) {
        console.warn("ContextBridge: No frameworks detected, using generic injection");
        frameworks.push("generic");
      }

      element.focus();

      let injected = false;

      // Try framework-specific injectors first
      for (const framework of frameworks) {
        console.log(`ContextBridge: Attempting ${framework} injection...`);

        switch (framework) {
          case "react":
            // Set value first, then trigger events
            element.value = text;
            injected = FrameworkDetector.triggerReactEvent(element, "input");
            injected = FrameworkDetector.triggerReactEvent(element, "change") || injected;
            break;

          case "prosemirror":
            injected = FrameworkDetector.triggerProseMirrorUpdate(element, text);
            break;

          case "angular":
            injected = FrameworkDetector.triggerAngularEvent(element, text);
            break;

          case "vue":
            element.value = text;
            injected = FrameworkDetector.triggerGenericEvent(element, text);
            break;

          case "draftjs":
            injected = FrameworkDetector.triggerGenericEvent(element, text);
            break;

          case "generic":
            injected = FrameworkDetector.triggerGenericEvent(element, text);
            break;
        }

        if (injected) {
          console.log(`ContextBridge: Successfully injected via ${framework}`);
          break;
        }
      }

      // Fallback to generic injection
      if (!injected) {
        console.log("ContextBridge: Falling back to generic injection");
        injected = FrameworkDetector.triggerGenericEvent(element, text);
      }

      // Auto-send if requested
      if (injected && shouldAutoSend) {
        console.log("ContextBridge: Auto-send enabled, waiting for UI to update...");
        
        // Wait longer for UI state to update - different platforms have different timing
        let waitTime = 1000; // Default 1 second
        
        // Platform-specific wait times
        if (HOSTNAME.includes("grok.com")) {
          waitTime = 1500; // Grok needs more time
        } else if (HOSTNAME.includes("claude.ai")) {
          waitTime = 1200; // Claude also needs decent time
        }
        
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        console.log("ContextBridge: Triggering send button after " + waitTime + "ms wait...");
        const sendTriggered = FrameworkDetector.triggerSendButton(element);
        
        if (sendTriggered) {
          console.log("ContextBridge: ✅ Send triggered successfully!");
        } else {
          console.warn("ContextBridge: ⚠️ Send button trigger returned false");
        }
      }

      return injected;
    },
  };

  // Global exposure
  window.SmartInjecter = SmartInjecter;
  window.FrameworkDetector = FrameworkDetector;

  // Emit ready event
  window.dispatchEvent(new CustomEvent("smartInjector-ready", {
    detail: { SmartInjecter, FrameworkDetector }
  }));
})();
