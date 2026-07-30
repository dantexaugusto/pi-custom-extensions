/**
 * Minimal command test - simplest possible registerCommand
 * Purpose: Test if ANY registerCommand causes crash
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	console.log("[test-minimal] Extension loading...");

	// Absolute minimal command - no async, no args
	pi.registerCommand?.("test-minimal", {
		description: "Minimal test command",
		handler: async (_args, _ctx) => {
			console.log("[test-minimal] Command executed");
			return { success: true };
		},
	});

	console.log("[test-minimal] Command registered");
}