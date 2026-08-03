/**
 * Kiro CLI Extension - Check Kiro CLI installation status
 *
 * Kiro is an AWS interactive chat tool for AI-assisted development.
 * Note: kiro-cli is interactive, not a CLI task runner like Pi.
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

// ---------------------------------------------------------------------------
// Kiro CLI Integration
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

async function checkKiroInstalled(): Promise<{ installed: boolean; version?: string; path?: string; error?: string }> {
  return new Promise((resolve) => {
    const kiroPath = findKiroExecutable();
    if (!kiroPath) {
      resolve({ installed: false, error: "kiro-cli not found in ~/.local/bin/" });
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
        resolve({ installed: true, version, path: kiroPath });
      } else {
        resolve({ installed: false, error: stderr.trim() || "kiro command failed" });
      }
    });

    setTimeout(() => {
      proc.kill("SIGTERM");
      resolve({ installed: false, error: "Timeout checking kiro version" });
    }, 5000);
  });
}

// ---------------------------------------------------------------------------
// Extension Registration
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "kiro",
    label: "Kiro",
    description: [
      "Check Kiro CLI installation status.",
      "Kiro is an AWS interactive chat tool for AI-assisted development.",
      "Note: Use 'kiro-cli chat' in terminal for interactive sessions.",
    ].join(" "),
    parameters: Type.Object({
      task: Type.Optional(Type.String({ description: "Task (ignored - kiro is interactive)" })),
    }),

    async execute(_toolCallId, _params, _signal) {
      const kiroCheck = await checkKiroInstalled();

      if (!kiroCheck.installed) {
        return {
          content: [{
            type: "text",
            text: [
              "❌ Kiro CLI is not installed.",
              "",
              "To install:",
              "  curl -fsSL https://cli.kiro.dev/install | bash",
              "",
              "Then configure AWS credentials for Bedrock.",
            ].join("\n"),
          }],
          details: { error: "kiro_not_installed" },
          isError: true,
        };
      }

      return {
        content: [{
          type: "text",
          text: [
            `✅ Kiro CLI installed: ${kiroCheck.version}`,
            `📁 Path: ${kiroCheck.path}`,
            "",
            "**Note:** Kiro CLI is an interactive chat tool.",
            "To use it, run in your terminal:",
            "",
            "```bash",
            "kiro-cli chat          # Start chat",
            "kiro-cli agent list    # List agents",
            "kiro-cli doctor        # Debug issues",
            "```",
            "",
            "For delegated tasks within Pi, use other subagents (scout, worker, planner).",
          ].join("\n"),
        }],
        details: {
          installed: true,
          version: kiroCheck.version,
          path: kiroCheck.path,
        },
      };
    },

    renderCall(_toolCallId, _params, theme) {
      return {
        type: "inline",
        render(width) {
          return [`${theme.fg("accent", "⚡")} ${theme.fg("toolTitle", "kiro")} ${theme.fg("dim", "checking...")}`];
        },
        invalidate() {},
      };
    },

    renderResult(_toolCallId, _params, result, theme) {
      const isError = result.isError ?? false;
      const details = result.details as { version?: string };

      return {
        type: "inline",
        render(width) {
          const icon = isError ? theme.fg("error", "✗") : theme.fg("success", "✓");
          const status = isError ? "not installed" : `v${details.version || "?"}`;
          return [`${icon} ${theme.fg("toolTitle", "kiro")} ${theme.fg("dim", status)}`];
        },
        invalidate() {},
      };
    },
  });
}
