/**
 * Kiro CLI Extension - Integrates AWS Kiro agentic CLI as a Pi subagent tool
 *
 * Kiro is an AWS spec-driven development agent that uses advanced AI
 * to assist with software development tasks.
 *
 * Prerequisites:
 *   - kiro CLI installed and in PATH
 *   - AWS credentials configured (for Bedrock)
 */

import { spawn } from "node:child_process";
import * as os from "node:os";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KiroResult {
  success: boolean;
  output: string;
  exitCode: number;
  stderr: string;
  duration: number;
  format: "json" | "text";
  parsedOutput?: unknown;
}

interface KiroDetails {
  exitCode: number;
  duration: string;
  format: string;
  cwd: string;
  command: string;
}

// ---------------------------------------------------------------------------
// Kiro CLI Integration
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Kiro CLI Integration
// ---------------------------------------------------------------------------

/**
 * Find the kiro-cli executable in common locations
 */
function findKiroExecutable(): string | null {
  const possiblePaths = [
    "kiro-cli", // In PATH
    "kiro", // Alternative name in PATH
    path.join(os.homedir(), ".local", "bin", "kiro-cli"), // AWS default install location
    path.join(os.homedir(), ".local", "bin", "kiro"), // Alternative
    "/usr/local/bin/kiro-cli",
    "/usr/local/bin/kiro",
  ];

  for (const p of possiblePaths) {
    try {
      // If it's an absolute path, check if file exists
      if (path.isAbsolute(p)) {
        if (fs.existsSync(p)) return p;
      } else {
        // If it's a relative name, try to spawn it
        return p; // Let spawn try to find it in PATH
      }
    } catch {
      continue;
    }
  }
  return null;
}

import * as fs from "node:fs";

async function checkKiroInstalled(): Promise<{ installed: boolean; version?: string; error?: string }> {
  return new Promise((resolve) => {
    const kiroPath = findKiroExecutable();
    if (!kiroPath) {
      resolve({ installed: false, error: "kiro-cli not found in PATH or ~/.local/bin/" });
      return;
    }

    const proc = spawn(kiroPath, ["--version"], {
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

    proc.on("error", (err) => {
      resolve({ installed: false, error: `Failed to run kiro: ${err.message}` });
    });

    proc.on("close", (code) => {
      if (code === 0) {
        const version = stdout.trim() || stderr.trim();
        resolve({ installed: true, version });
      } else {
        resolve({ installed: false, error: stderr.trim() || "kiro command failed" });
      }
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      proc.kill("SIGTERM");
      resolve({ installed: false, error: "Timeout checking kiro version" });
    }, 5000);
  });
}

async function runKiro(
  task: string,
  options: {
    format?: "json" | "text";
    timeout?: number;
    cwd?: string;
    signal?: AbortSignal;
  } = {}
): Promise<KiroResult> {
  const { format = "json", timeout = 300, cwd = process.cwd(), signal } = options;
  const startTime = Date.now();

  const args: string[] = ["--no-interactive"];
  if (format === "json") {
    args.push("--format", "json");
  }
  args.push(task);

  return new Promise((resolve) => {
    // Find kiro executable
    const kiroPath = findKiroExecutable();
    if (!kiroPath) {
      const duration = Date.now() - startTime;
      resolve({
        success: false,
        output: "",
        exitCode: 1,
        stderr: "kiro-cli not found in PATH or ~/.local/bin/",
        duration,
        format,
      });
      return;
    }

    const proc = spawn(kiroPath, args, {
      cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let wasAborted = false;
    let timedOut = false;

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("error", (err) => {
      const duration = Date.now() - startTime;
      resolve({
        success: false,
        output: "",
        exitCode: 1,
        stderr: `Failed to spawn kiro: ${err.message}`,
        duration,
        format,
      });
    });

    proc.on("close", (code) => {
      const duration = Date.now() - startTime;
      const exitCode = code ?? 1;
      let parsedOutput: unknown;

      // Try to parse JSON output
      if (format === "json" && stdout.trim()) {
        try {
          parsedOutput = JSON.parse(stdout.trim());
        } catch {
          // Not valid JSON, keep as text
        }
      }

      resolve({
        success: exitCode === 0 && !wasAborted && !timedOut,
        output: stdout,
        exitCode,
        stderr,
        duration,
        format,
        parsedOutput,
      });
    });

    // Abort signal handling
    if (signal) {
      const abortHandler = () => {
        wasAborted = true;
        proc.kill("SIGTERM");
        setTimeout(() => {
          if (!proc.killed) proc.kill("SIGKILL");
        }, 5000);
      };

      if (signal.aborted) {
        abortHandler();
      } else {
        signal.addEventListener("abort", abortHandler, { once: true });
      }
    }

    // Timeout handling
    const timeoutMs = timeout * 1000;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGTERM");
      setTimeout(() => {
        if (!proc.killed) proc.kill("SIGKILL");
      }, 5000);
    }, timeoutMs);

    proc.on("close", () => {
      clearTimeout(timeoutId);
    });
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = ((ms % 60000) / 1000).toFixed(0);
  return `${mins}m ${secs}s`;
}

function shortenPath(p: string): string {
  const home = os.homedir();
  return p.startsWith(home) ? `~${p.slice(home.length)}` : p;
}

// ---------------------------------------------------------------------------
// Extension Registration
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
  // Register the kiro tool
  pi.registerTool({
    name: "kiro",
    label: "Kiro",
    description: [
      "Delegate tasks to Kiro, AWS's agentic CLI for spec-driven development.",
      "Kiro uses advanced AI to assist with software development tasks.",
      "Requires kiro CLI to be installed and AWS credentials configured.",
    ].join(" "),
    parameters: Type.Object({
      task: Type.String({ description: "Task description for Kiro to execute" }),
      format: Type.Optional(
        Type.Union([Type.Literal("json"), Type.Literal("text")], {
          description: "Output format (default: json)",
          default: "json",
        })
      ),
      timeout: Type.Optional(
        Type.Number({
          description: "Timeout in seconds (default: 300)",
          default: 300,
        })
      ),
      cwd: Type.Optional(
        Type.String({
          description: "Working directory for Kiro execution",
        })
      ),
    }),

    async execute(toolCallId, params, signal) {
      // First check if kiro is installed
      const kiroCheck = await checkKiroInstalled();
      if (!kiroCheck.installed) {
        return {
          content: [
            {
              type: "text",
              text: [
                "❌ Kiro CLI is not installed or not in PATH.",
                "",
                kiroCheck.error ? `Error: ${kiroCheck.error}` : "",
                "",
                "To install Kiro:",
                "  1. Visit: https://kiro.dev or AWS documentation",
                "  2. Follow installation instructions for your platform",
                "  3. Configure AWS credentials for Bedrock access",
              ]
                .filter(Boolean)
                .join("\n"),
            },
          ],
          details: { error: "kiro_not_installed" },
          isError: true,
        };
      }

      const { task, format = "json", timeout = 300, cwd = process.cwd() } = params;

      // Run kiro
      const result = await runKiro(task, {
        format: format as "json" | "text",
        timeout,
        cwd,
        signal,
      });

      const details: KiroDetails = {
        exitCode: result.exitCode,
        duration: formatDuration(result.duration),
        format: result.format,
        cwd: shortenPath(cwd),
        command: `kiro --no-interactive${format === "json" ? " --format json" : ""} "${task.slice(0, 50)}${task.length > 50 ? "..." : ""}"`,
      };

      if (!result.success) {
        const errorMessage = [
          `Kiro task failed (exit code: ${result.exitCode})`,
          "",
          result.stderr ? `stderr:\n${result.stderr}` : "",
          result.output ? `stdout:\n${result.output}` : "",
        ]
          .filter(Boolean)
          .join("\n");

        return {
          content: [{ type: "text", text: errorMessage }],
          details,
          isError: true,
        };
      }

      // Format successful output
      let outputText: string;
      if (result.parsedOutput) {
        // If we have parsed JSON, format it nicely
        outputText = JSON.stringify(result.parsedOutput, null, 2);
      } else {
        outputText = result.output.trim() || "(no output)";
      }

      return {
        content: [{ type: "text", text: outputText }],
        details,
      };
    },

    // TUI rendering for tool call
    renderCall(toolCallId, params, theme) {
      const { task, cwd, timeout } = params;
      const displayCwd = cwd ? shortenPath(cwd) : "current dir";
      const displayTimeout = timeout ? `${timeout}s` : "300s";

      return {
        type: "inline",
        render(width) {
          const lines: string[] = [];
          const maxTaskLen = Math.max(20, width - 30);
          const truncatedTask =
            task.length > maxTaskLen ? `${task.slice(0, maxTaskLen - 3)}...` : task;

          lines.push(
            `${theme.fg("accent", "⚡")} ${theme.fg("toolTitle", "kiro")} ${theme.fg("dim", `[${displayCwd}, timeout: ${displayTimeout}]`)}`
          );
          lines.push(`   ${theme.fg("muted", "→")} ${truncatedTask}`);

          return lines;
        },
        invalidate() {},
      };
    },

    // TUI rendering for tool result
    renderResult(toolCallId, params, result, theme) {
      const { task } = params;
      const details = result.details as KiroDetails | undefined;
      const isError = result.isError ?? false;

      return {
        type: "inline",
        render(width) {
          const lines: string[] = [];

          // Status line
          const statusIcon = isError
            ? theme.fg("error", "✗")
            : theme.fg("success", "✓");
          const statusText = isError ? "failed" : "completed";
          const durationText = details?.duration ? ` in ${details.duration}` : "";

          lines.push(
            `${statusIcon} ${theme.fg("toolTitle", "kiro")} ${theme.fg("dim", statusText)}${theme.fg("dim", durationText)}`
          );

          // Show truncated task
          const maxTaskLen = Math.max(20, width - 10);
          const truncatedTask =
            task.length > maxTaskLen ? `${task.slice(0, maxTaskLen - 3)}...` : task;
          lines.push(`   ${theme.fg("muted", truncatedTask)}`);

          // Show first few lines of output
          const output =
            result.content
              ?.filter((c): c is { type: "text"; text: string } => c.type === "text")
              .map((c) => c.text)
              .join("\n") || "";

          if (output) {
            const outputLines = output.split("\n").slice(0, 3);
            for (const line of outputLines) {
              const truncatedLine =
                line.length > width - 6 ? `${line.slice(0, width - 9)}...` : line;
              lines.push(`   ${theme.fg("dim", truncatedLine)}`);
            }
            const totalLines = output.split("\n").length;
            if (totalLines > 3) {
              lines.push(`   ${theme.fg("dim", `... (${totalLines - 3} more lines)`)}`);
            }
          }

          return lines;
        },
        invalidate() {},
      };
    },
  });
}
