// ContextBridge Smart Context Condenser
// Intelligent summarization with local AI (Gemini Nano) or smart compaction

(() => {
  "use strict";

  // Core condensing algorithms
  const ContextCondenser = {
    // Option A: Use Chrome's local LLM API (Gemini Nano) for premium summarization
    async summarizeWithLocalAI(transcript) {
      try {
        if (!window.ai || !window.ai.assistant) {
          return null; // Local AI not available
        }

        const rawText = transcript.map(m => `${m.role}: ${m.text}`).join("\n\n");
        
        const session = await window.ai.assistant.create({
          signal: AbortSignal.timeout(30000), // 30 second timeout
        });

        const systemPrompt = `You are a conversational AI context summarizer. Distill the conversation into a dense, structured "State File" that includes:
1. **Core Goal**: The primary objective discussed
2. **Key Constraints**: Limitations or requirements defined
3. **Decisions Made**: Important choices and their reasoning
4. **Last Active Topic**: Current focus area
5. **Code Snippets**: Any code segments being worked on (with language)
6. **Open Questions**: Unresolved items to address
7. **Next Steps**: Recommended continuation

Format the output as structured markdown with clear sections. Be concise but complete.`;

        const summary = await session.prompt(systemPrompt + "\n\n" + rawText);
        session.destroy();

        return {
          mode: "ai",
          content: summary,
          metadata: {
            compressed: true,
            localAI: true,
            timestamp: new Date().toISOString(),
          }
        };
      } catch (error) {
        console.warn("ContextBridge: Local AI summarization failed", error);
        return null;
      }
    },

    // Option B: Smart compaction algorithm - retains key info, removes filler
    compactTranscript(messages) {
      if (messages.length === 0) return [];

      const result = [];

      // STAGE 1: Always include the first message (establishes goal)
      result.push(messages[0]);

      // STAGE 2: Extract code snippets and technical decisions
      const codeBlocks = [];
      const techDecisions = [];
      const codeBlockRegex = /```[\s\S]*?```/g;
      
      for (let i = 1; i < messages.length - 1; i++) {
        const msg = messages[i];
        
        // Extract code
        const matches = msg.text.match(codeBlockRegex);
        if (matches) {
          matches.forEach(code => {
            if (!codeBlocks.some(cb => cb === code)) {
              codeBlocks.push(code);
            }
          });
        }

        // Detect technical decisions (contains words like "decided", "implemented", "fixed", "changed")
        if (/decided|implemented|fixed|changed|refactored|optimized|rewrote|switched|moved|added|removed/i.test(msg.text)) {
          const summary = msg.text
            .split('\n')[0] // Take first line only
            .substring(0, 200); // Max 200 chars
          
          if (!techDecisions.some(d => d === summary)) {
            techDecisions.push(summary);
          }
        }
      }

      // STAGE 3: Add extracted code and decisions as system messages
      if (codeBlocks.length > 0) {
        result.push({
          role: "system",
          text: `[Technical Context: Active code snippets]\n\n${codeBlocks.slice(0, 5).join("\n\n")}`
        });
      }

      if (techDecisions.length > 0) {
        result.push({
          role: "system",
          text: `[Decision Log]\n${techDecisions.slice(0, 5).map(d => `• ${d}`).join("\n")}`
        });
      }

      // STAGE 4: Include last 3 conversational turns (current context)
      const lastIdx = Math.max(1, messages.length - 3);
      for (let i = lastIdx; i < messages.length; i++) {
        result.push(messages[i]);
      }

      return result;
    },

    // Compression ratio calculation
    getCompressionRatio(original, condensed) {
      const origSize = original.reduce((sum, m) => sum + m.text.length, 0);
      const condSize = condensed.reduce((sum, m) => sum + m.text.length, 0);
      return ((1 - condSize / origSize) * 100).toFixed(1);
    },

    // Create structured state file for export
    createStateFile(messages, mode = "compact") {
      const timestamp = new Date().toISOString();
      
      let transcript;
      if (mode === "compact") {
        transcript = this.compactTranscript(messages);
      } else {
        transcript = messages;
      }

      const stateFile = {
        version: "1.0",
        format: "ContextBridge State File",
        exportedAt: timestamp,
        statistics: {
          originalTurns: messages.length,
          condensedTurns: transcript.length,
          compressionMode: mode,
        },
        transcript: transcript,
      };

      return JSON.stringify(stateFile, null, 2);
    },

    // Build final prompt with all context
    buildContextPrompt(messages, mode, preamble) {
      const systemPreamble = preamble || `[System Instruction: You are continuing a conversation that began with another AI. Below is the structured transcript of that conversation. Please read carefully, absorb all context and goals, and then continue responding as the assistant.]`;

      let transcript = "";

      if (mode === "compact") {
        const compacted = this.compactTranscript(messages);
        compacted.forEach((msg) => {
          if (msg.role === "system") {
            transcript += `${msg.text}\n\n`;
          } else {
            const label = msg.role === "user" ? "User" : "Assistant";
            transcript += `${label}: ${msg.text}\n---\n`;
          }
        });
      } else {
        // Full mode
        messages.forEach((msg) => {
          const label = msg.role === "user" ? "User" : "Assistant";
          transcript += `${label}: ${msg.text}\n---\n`;
        });
      }

      return `${systemPreamble}

=== CONVERSATION TRANSCRIPT START ===
${transcript.trim()}
=== CONVERSATION TRANSCRIPT END ===

Please continue the conversation based on the context above.`;
    },

    // Check if conversation is long enough to benefit from compression
    shouldCompress(messages) {
      return messages.length > 10; // If more than 10 turns, compression is beneficial
    },
  };

  // Global exposure
  window.ContextCondenser = ContextCondenser;

  // Also emit events for other scripts
  window.dispatchEvent(new CustomEvent("contextCondenser-ready", {
    detail: ContextCondenser
  }));
})();
