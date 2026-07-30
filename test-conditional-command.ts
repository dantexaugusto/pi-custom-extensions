/**
 * Test conditional command registration
 * Potential workarounds:
 * 1. Delay registration until after first turn
 * 2. Check if pi is in TUI mode before registering
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	console.log("[test-conditional] Loading...");

	// Try registering after session starts
	pi.on("session_start", () => {
		console.log("[test-conditional] Session started, registering command");
		pi.registerCommand?.("delayed-command", {
			description: "Delayed test command",
			handler: async (_args, _ctx) => {
				console.log("[test-conditional] Executed");
				return { success: true };
			},
		});
		console.log("[test-conditional] Command registered after session_start");
	});

	console.log("[test-conditional] Extension loaded");
}