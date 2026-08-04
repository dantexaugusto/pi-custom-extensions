/**
 * Kiro CLI Extension - Interactive integration via tmux with isolated context
 *
 * Kiro is an AWS interactive chat tool for AI-assisted development.
 * This extension integrates with kiro-cli via tmux sessions.
 *
 * Context Isolation:
 * - 'send' action: Full response enters Pi context (for collaborative work)
 * - 'query' action: Returns compact summary, Kiro context stays isolated
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { Text } from "@earendil-works/pi-tui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KiroSession {
  sessionName: string;
  createdAt: Date;
  lastActivity: Date;
  messageCount: number;
}

interface KiroDetails {
  exitCode: number;
  duration: string;
  sessionName: string;
  cwd: string;
}

// ---------------------------------------------------------------------------
// Kiro CLI Path Discovery
// ---------------------------------------------------------------------------

function findKiroExecutable(): string | null {
  const possiblePaths = [
    path.join(os.homedir(), ".local", "bin", "kiro-cli"),
    path.join(os.homedir(), ".local", "bin", "kiro"),
    "/usr/local/bin/kiro-cli",
    "/usr/local/bin/kiro",
  ];

  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        return p;
      }
    } catch {
      continue;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Tmux Integration
// ---------------------------------------------------------------------------

function execTmux(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn("tmux", args, {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code ?? 0,
      });
    });

    proc.on("error", (err) => {
      resolve({
        stdout: "",
        stderr: err.message,
        exitCode: 1,
      });
    });
  });
}

async function tmuxSessionExists(sessionName: string): Promise<boolean> {
  const result = await execTmux(["has-session", "-t", sessionName]);
  return result.exitCode === 0;
}

async function createKiroSession(sessionName: string, cwd?: string): Promise<boolean> {
  const kiroPath = findKiroExecutable();
  if (!kiroPath) {
    return false;
  }

  // Check if session already exists
  if (await tmuxSessionExists(sessionName)) {
    return true;
  }

  // Create new session with kiro-cli chat
  const args = ["new-session", "-d", "-s", sessionName, "-c", cwd || process.cwd(), kiroPath, "chat"];
  const result = await execTmux(args);
  return result.exitCode === 0;
}

async function sendToKiro(sessionName: string, text: string): Promise<void> {
  // Send the text followed by Enter
  await execTmux(["send-keys", "-t", sessionName, text]);
  await execTmux(["send-keys", "-t", sessionName, "Enter"]);
}

async function captureKiroOutput(sessionName: string, waitMs: number = 3000): Promise<string> {
  // Wait for response
  await new Promise((resolve) => setTimeout(resolve, waitMs));

  // Capture the pane content
  const result = await execTmux(["capture-pane", "-t", sessionName, "-p", "-S", "-100"]);
  return result.stdout;
}

async function killKiroSession(sessionName: string): Promise<void> {
  await execTmux(["kill-session", "-t", sessionName]);
}

async function waitForKiroReady(sessionName: string, timeoutMs: number = 10000): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    const output = await captureKiroOutput(sessionName, 500);
    // Kiro is ready when we see the input prompt or certain UI elements
    if (output.includes("What's new") || output.includes("Tip:") || output.includes("─")) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  
  return false;
}

function parseKiroOutput(output: string): { response: string; isReady: boolean } {
  // Remove ANSI codes for parsing
  const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, "");
  
  // Find the last prompt line (usually starts with > or contains certain patterns)
  const lines = cleanOutput.split("\n").filter(l => l.trim());
  
  // Try to find where the response starts (after user input)
  let responseStart = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (line.includes(">") || line.includes("What would you like") || line.includes("Ask")) {
      responseStart = i;
      break;
    }
  }

  // Extract the response
  let response: string;
  if (responseStart >= 0 && responseStart < lines.length - 1) {
    response = lines.slice(responseStart + 1).join("\n").trim();
  } else {
    // Take last meaningful content
    response = lines.slice(-10).join("\n").trim();
  }

  // Check if kiro is ready for input (has prompt)
  const isReady = output.includes(">") || output.includes("╰") || /│\s*$/.test(cleanOutput);

  return { response, isReady };
}

/**
 * Generate a compact summary of Kiro's response
 * Used by 'query' action to provide useful info without full context
 */
function summarizeResponse(response: string, maxLength: number = 500): string {
  // Remove ANSI codes if any
  const clean = response.replace(/\x1b\[[0-9;]*m/g, "");
  
  // Extract key information
  const lines = clean.split("\n").filter(l => l.trim());
  
  // Summarization strategies:
  // 1. Look for specific patterns (answers, results, conclusions)
  // 2. Take first meaningful paragraph
  // 3. Fall back to truncated response
  
  // Try to find the main answer
  for (const line of lines) {
    // Look for lines that seem like answers (not UI elements)
    const trimmed = line.trim();
    if (trimmed.length > 10 && 
        !trimmed.startsWith("╭") && 
        !trimmed.startsWith("╰") &&
        !trimmed.startsWith("│") &&
        !trimmed.startsWith("─") &&
        !trimmed.startsWith("Tip:") &&
        !trimmed.includes("What would you like")) {
      // Found a substantial line, use it as the summary
      if (trimmed.length <= maxLength) {
        return trimmed;
      }
      return trimmed.slice(0, maxLength - 3) + "...";
    }
  }
  
  // Fallback: combine first few meaningful lines
  const meaningfulLines = lines.filter(l => {
    const t = l.trim();
    return t.length > 5 && !t.startsWith("╭") && !t.startsWith("╰") && !t.startsWith("│");
  }).slice(0, 5);
  
  const summary = meaningfulLines.join(" ").trim();
  if (summary.length <= maxLength) {
    return summary;
  }
  return summary.slice(0, maxLength - 3) + "...";
}

// ---------------------------------------------------------------------------
// Extension Registration
// ---------------------------------------------------------------------------

const KIRO_SESSION_NAME = "kiro-pi";

export default function (pi: ExtensionAPI) {
  const sessions = new Map<string, KiroSession>();

  pi.registerTool({
    name: "kiro",
    label: "Kiro",
    description: [
      "Interact with Kiro CLI (AWS AI assistant) via tmux session.",
      "Kiro maintains isolated context in tmux, separate from Pi.",
      "",
      "Actions:",
      "  send   → Full response enters Pi context (collaborative)",
      "  query  → Compact summary only, Kiro context isolated",
      "  start  → Start Kiro session",
      "  stop   → Stop Kiro session", 
      "  status → Check session status",
    ].join("\n"),
    parameters: Type.Object({
      action: Type.Optional(Type.String({ 
        description: "Action: send (default), query, start, stop, status",
        default: "send"
      })),
      message: Type.Optional(Type.String({ 
        description: "Message to send to Kiro (for send/query actions)" 
      })),
      waitMs: Type.Optional(Type.Number({ 
        description: "Wait time in ms before capturing response (default: 5000)",
        default: 5000
      })),
      summaryLength: Type.Optional(Type.Number({
        description: "Max length for query summary (default: 300)",
        default: 300
      })),
    }),

    async execute(_toolCallId, params, signal) {
      const action = params.action || "send";
      const message = params.message;
      const waitMs = params.waitMs || 5000;
      const summaryLength = params.summaryLength || 300;

      const kiroPath = findKiroExecutable();
      if (!kiroPath) {
        return {
          content: [{
            type: "text",
            text: [
              "❌ Kiro CLI is not installed.",
              "",
              "To install:",
              "  curl -fsSL https://cli.kiro.dev/install | bash",
            ].join("\n"),
          }],
          details: { error: "kiro_not_installed" },
          isError: true,
        };
      }

      // Handle different actions
      switch (action) {
        case "start": {
          const created = await createKiroSession(KIRO_SESSION_NAME);
          if (!created) {
            const exists = await tmuxSessionExists(KIRO_SESSION_NAME);
            if (exists) {
              return {
                content: [{
                  type: "text",
                  text: `✅ Kiro session '${KIRO_SESSION_NAME}' already running.\n\nTo attach: tmux attach -t ${KIRO_SESSION_NAME}`,
                }],
                details: { sessionName: KIRO_SESSION_NAME },
              };
            }
            return {
              content: [{
                type: "text",
                text: "❌ Failed to create Kiro tmux session.",
              }],
              isError: true,
            };
          }

          // Wait for Kiro to initialize
          const ready = await waitForKiroReady(KIRO_SESSION_NAME, 15000);
          
          sessions.set(KIRO_SESSION_NAME, {
            sessionName: KIRO_SESSION_NAME,
            createdAt: new Date(),
            lastActivity: new Date(),
            messageCount: 0,
          });

          return {
            content: [{
              type: "text",
              text: ready
                ? `✅ Kiro started in tmux session '${KIRO_SESSION_NAME}'\n\nContext: ISOLATED (won't pollute Pi context)\nTo attach: tmux attach -t ${KIRO_SESSION_NAME}\nTo stop: kiro action=stop`
                : `⚠️ Kiro session created but may not be ready.\n\nTo attach: tmux attach -t ${KIRO_SESSION_NAME}`,
            }],
            details: { sessionName: KIRO_SESSION_NAME, ready },
          };
        }

        case "stop": {
          if (await tmuxSessionExists(KIRO_SESSION_NAME)) {
            await killKiroSession(KIRO_SESSION_NAME);
            sessions.delete(KIRO_SESSION_NAME);
            return {
              content: [{
                type: "text",
                text: `✅ Kiro session '${KIRO_SESSION_NAME}' stopped.`,
              }],
            };
          }
          return {
            content: [{
              type: "text",
              text: `ℹ️ No Kiro session to stop.`,
            }],
          };
        }

        case "status": {
          const exists = await tmuxSessionExists(KIRO_SESSION_NAME);
          const session = sessions.get(KIRO_SESSION_NAME);
          
          if (!exists) {
            return {
              content: [{
                type: "text",
                text: "ℹ️ Kiro session not running.\n\nStart with: kiro action=start",
              }],
            };
          }

          const output = await captureKiroOutput(KIRO_SESSION_NAME, 500);
          const { isReady } = parseKiroOutput(output);

          return {
            content: [{
              type: "text",
              text: [
                `✅ Kiro session '${KIRO_SESSION_NAME}' is running.`,
                `📊 Status: ${isReady ? "Ready for input" : "Processing"}`,
                `🔒 Context: ISOLATED`,
                session ? `💬 Messages sent: ${session.messageCount}` : "",
                session ? `🕐 Started: ${session.createdAt.toISOString()}` : "",
                "",
                "To attach: tmux attach -t " + KIRO_SESSION_NAME,
              ].join("\n"),
            }],
            details: { sessionName: KIRO_SESSION_NAME, isReady },
          };
        }

        case "query": {
          // QUERY: Send message, return only compact summary
          // Kiro context stays isolated, minimal info enters Pi
          
          if (!message) {
            return {
              content: [{
                type: "text",
                text: "ℹ️ No message provided. Use: kiro action=query message=\"your question\"",
              }],
              isError: true,
            };
          }

          // Ensure session exists
          if (!(await tmuxSessionExists(KIRO_SESSION_NAME))) {
            await createKiroSession(KIRO_SESSION_NAME);
            await waitForKiroReady(KIRO_SESSION_NAME, 10000);
            
            sessions.set(KIRO_SESSION_NAME, {
              sessionName: KIRO_SESSION_NAME,
              createdAt: new Date(),
              lastActivity: new Date(),
              messageCount: 0,
            });
          }

          // Check for abort
          if (signal?.aborted) {
            return {
              content: [{ type: "text", text: "⚠️ Operation cancelled." }],
              details: { cancelled: true },
            };
          }

          // Send message to Kiro
          await sendToKiro(KIRO_SESSION_NAME, message);

          // Wait and capture response
          const output = await captureKiroOutput(KIRO_SESSION_NAME, waitMs);
          const { response } = parseKiroOutput(output);

          // Generate compact summary (this is what enters Pi context)
          const summary = summarizeResponse(response, summaryLength);

          // Update session
          const session = sessions.get(KIRO_SESSION_NAME);
          if (session) {
            session.lastActivity = new Date();
            session.messageCount++;
          }

          return {
            content: [{
              type: "text",
              text: `📝 ${summary}`,
            }],
            details: {
              sessionName: KIRO_SESSION_NAME,
              action: "query",
              fullResponseLength: response.length,
              summaryLength: summary.length,
            },
          };
        }

        case "send":
        default: {
          // SEND: Full response enters Pi context
          
          if (!message) {
            return {
              content: [{
                type: "text",
                text: "ℹ️ No message provided. Use: kiro message=\"your question\"",
              }],
              isError: true,
            };
          }

          // Ensure session exists
          if (!(await tmuxSessionExists(KIRO_SESSION_NAME))) {
            await createKiroSession(KIRO_SESSION_NAME);
            await waitForKiroReady(KIRO_SESSION_NAME, 10000);
            
            sessions.set(KIRO_SESSION_NAME, {
              sessionName: KIRO_SESSION_NAME,
              createdAt: new Date(),
              lastActivity: new Date(),
              messageCount: 0,
            });
          }

          // Check for abort
          if (signal?.aborted) {
            return {
              content: [{ type: "text", text: "⚠️ Operation cancelled." }],
              details: { cancelled: true },
            };
          }

          // Send message to Kiro
          await sendToKiro(KIRO_SESSION_NAME, message);

          // Wait and capture response
          const output = await captureKiroOutput(KIRO_SESSION_NAME, waitMs);
          const { response, isReady } = parseKiroOutput(output);

          // Update session activity
          const session = sessions.get(KIRO_SESSION_NAME);
          if (session) {
            session.lastActivity = new Date();
            session.messageCount++;
          }

          return {
            content: [{
              type: "text",
              text: response || "(waiting for response...)",
            }],
            details: {
              sessionName: KIRO_SESSION_NAME,
              isReady,
              action: "send",
            } as KiroDetails & { isReady: boolean; action: string },
          };
        }
      }
    },

    renderCall(_toolCallId, params, theme) {
      const action = params.action || "send";
      const message = params.message;

      if ((action === "send" || action === "query") && message) {
        const preview = message.length > 50 ? `${message.slice(0, 50)}...` : message;
        const actionLabel = action === "query" ? "query [isolated]" : "send";
        const text = theme.fg("accent", "⚡") + " " + 
          theme.fg("toolTitle", "kiro") + " " + 
          theme.fg("dim", `[${actionLabel}]`) + "\n" +
          "   " + theme.fg("muted", preview);
        return new Text(text, 0, 0);
      }

      const text = theme.fg("accent", "⚡") + " " + 
        theme.fg("toolTitle", "kiro") + " " + 
        theme.fg("dim", `[${action}]`);
      return new Text(text, 0, 0);
    },

    renderResult(_toolCallId, params, result, theme) {
      const isError = result.isError ?? false;
      const details = result.details as { isReady?: boolean; action?: string };

      const icon = isError
        ? theme.fg("error", "✗")
        : theme.fg("success", "✓");
      
      const action = details?.action || params.action || "send";
      const statusBadge = action === "query" 
        ? theme.fg("dim", "isolated")
        : action === "send" 
          ? theme.fg("dim", "full")
          : "";

      let text = `${icon} ${theme.fg("toolTitle", "kiro")} ${statusBadge}`;

      // Show first line of response
      if (!isError && result.content?.[0]?.type === "text") {
        const responseText = result.content[0].text.split("\n")[0] || "";
        const preview = responseText.slice(0, 70);
        if (preview) {
          text += `\n   ${theme.fg("dim", preview)}`;
        }
      }

      return new Text(text, 0, 0);
    },
  });

  // Register commands for manual control
  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;

    pi.registerCommand?.("kiro-start", {
      description: "Start Kiro in a tmux session (isolated context)",
      handler: async (_args, cmdCtx) => {
        cmdCtx.ui.notify?.("Starting Kiro (isolated context)...", "info");
      },
    });

    pi.registerCommand?.("kiro-stop", {
      description: "Stop the Kiro tmux session",
      handler: async (_args, cmdCtx) => {
        if (await tmuxSessionExists(KIRO_SESSION_NAME)) {
          await killKiroSession(KIRO_SESSION_NAME);
          cmdCtx.ui.notify?.("Kiro session stopped", "info");
        } else {
          cmdCtx.ui.notify?.("No Kiro session running", "warning");
        }
      },
    });

    pi.registerCommand?.("kiro-attach", {
      description: "Show command to attach to Kiro session",
      handler: async (_args, cmdCtx) => {
        cmdCtx.ui.notify?.("Run: tmux attach -t kiro-pi", "info");
      },
    });
  });

  // Cleanup on session end (optional - keep session running)
  pi.on("session_end", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    // Session persists across Pi sessions for context continuity
    // Uncomment to kill on Pi session end:
    // await killKiroSession(KIRO_SESSION_NAME);
  });
}
