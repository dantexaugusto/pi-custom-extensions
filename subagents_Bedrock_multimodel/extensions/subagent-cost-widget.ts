/**
 * Subagent Cost Tracker Widget - Persist usage and cost statistics across sessions
 * 
 * FIXED: Command registration moved to session_start (was causing autocomplete crash)
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { Container, Text } from "@earendil-works/pi-tui";

interface SubagentUsage {
	agent: string;
	invocations: number;
	inputTokens: number;
	outputTokens: number;
	cacheRead: number;
	cacheWrite: number;
	cost: number;
	lastUsed: string;
}

interface SessionStats {
	agents: Map<string, SubagentUsage>;
	totalCost: number;
	totalInvocations: number;
	startTime: string;
}

const WIDGET_NAME = "subagent-cost-tracker";

function formatTokens(count: number): string {
	if (count < 1000) return count.toString();
	if (count < 1000000) return `${(count / 1000).toFixed(1)}k`;
	return `${(count / 1000000).toFixed(2)}M`;
}

function formatCost(cost: number): string {
	if (cost < 0.001) return "$<0.001";
	if (cost < 0.01) return `$${cost.toFixed(4)}`;
	if (cost < 1) return `$${cost.toFixed(3)}`;
	return `$${cost.toFixed(2)}`;
}

function formatDuration(startTime: string): string {
	const start = new Date(startTime);
	const now = new Date();
	const diff = now.getTime() - start.getTime();
	const minutes = Math.floor(diff / 60000);
	const hours = Math.floor(minutes / 60);
	
	if (hours > 0) return `${hours}h ${minutes % 60}m`;
	return `${minutes}m`;
}

export default function subagentCostWidgetExtension(pi: ExtensionAPI) {
	const stats: SessionStats = {
		agents: new Map(),
		totalCost: 0,
		totalInvocations: 0,
		startTime: new Date().toISOString(),
	};

	const updateStats = (agent: string, usage: {
		input: number;
		output: number;
		cacheRead?: number;
		cacheWrite?: number;
		cost?: number;
	}) => {
		const existing = stats.agents.get(agent) || {
			agent,
			invocations: 0,
			inputTokens: 0,
			outputTokens: 0,
			cacheRead: 0,
			cacheWrite: 0,
			cost: 0,
			lastUsed: new Date().toISOString(),
		};

		existing.invocations++;
		existing.inputTokens += usage.input || 0;
		existing.outputTokens += usage.output || 0;
		existing.cacheRead += usage.cacheRead || 0;
		existing.cacheWrite += usage.cacheWrite || 0;
		existing.cost += usage.cost || 0;
		existing.lastUsed = new Date().toISOString();

		stats.agents.set(agent, existing);
		stats.totalCost += usage.cost || 0;
		stats.totalInvocations++;
	};

	const renderWidget = (_tui: unknown, theme: Theme) => {
		const lines: string[] = [];

		// Header
		lines.push(
			theme.fg("accent", "┌─ ") +
			theme.fg("accent", theme.bold("SUBAGENT COST TRACKER")) +
			theme.fg("accent", ` ─ ${formatDuration(stats.startTime)}`.padEnd(41) + "┐")
		);

		// Session summary
		lines.push(
			theme.fg("accent", "│") +
			" " +
			theme.fg("muted", `Total: ${stats.totalInvocations} calls · ${formatCost(stats.totalCost)}`) +
			" ".repeat(76 - String(stats.totalInvocations).length - String(formatCost(stats.totalCost)).length - 16) +
			theme.fg("accent", "│")
		);

		lines.push(theme.fg("accent", "├" + "─".repeat(76) + "┤"));

		// Column headers
		const header = `${theme.fg("muted", "Agent").padEnd(12)} ${theme.fg("muted", "Calls").padStart(6)} ${theme.fg("muted", "Input").padStart(8)} ${theme.fg("muted", "Output").padStart(8)} ${theme.fg("muted", "Cost").padStart(10)}`;
		lines.push(theme.fg("accent", "│ ") + header + theme.fg("accent", " │"));

		// Agent rows
		const sortedAgents = Array.from(stats.agents.values()).sort((a, b) => b.cost - a.cost);
		for (const agent of sortedAgents.slice(0, 8)) {
			const row = [
				theme.fg("toolTitle", agent.agent.slice(0, 12).padEnd(12)),
				theme.fg("dim", String(agent.invocations).padStart(6)),
				theme.fg("dim", formatTokens(agent.inputTokens).padStart(8)),
				theme.fg("dim", formatTokens(agent.outputTokens).padStart(8)),
				theme.fg("warning", formatCost(agent.cost).padStart(10)),
			].join(" ");
			lines.push(theme.fg("accent", "│ ") + row + theme.fg("accent", " │"));
		}

		// Fill empty rows if needed
		const remainingRows = 8 - Math.min(sortedAgents.length, 8);
		for (let i = 0; i < remainingRows; i++) {
			lines.push(theme.fg("accent", "│") + " ".repeat(76) + theme.fg("accent", "│"));
		}

		// Footer
		lines.push(theme.fg("accent", "└" + "─".repeat(76) + "┘"));

		const container = new Container();
		container.addChild(new Text(lines.join("\n"), 0, 0));
		return container;
	};

	// FIXED: All UI operations moved into session_start handlers
	// This prevents autocomplete crash (TypeError: value.startsWith)
	pi.on("session_start", async (_event, ctx) => {
		if (!ctx.hasUI) return;
		
		// ✅ SAFE: Register command AFTER session_start
		// Format: pi.registerCommand("name", { description, handler })
		pi.registerCommand?.("toggle-cost-widget", {
			description: "Toggle the subagent cost tracker widget",
			handler: async (_args, cmdCtx) => {
				cmdCtx.ui.notify?.("Cost widget active", "info");
			},
		});

		// Reset stats for new session
		stats.agents.clear();
		stats.totalCost = 0;
		stats.totalInvocations = 0;
		stats.startTime = new Date().toISOString();
		
		// Initialize widget
		ctx.ui.setWidget(WIDGET_NAME, renderWidget);
		
		// Set status line
		ctx.ui.setStatus("subagent-cost", ctx.ui.theme.fg("dim", "💰 $0.00"));
	});

	// Listen for subagent tool results
	pi.on("tool_result_end", (event, ctx) => {
		if (!ctx.hasUI) return;
		
		// Check if this is a subagent tool result
		if (event.toolName !== "subagent") return;
		
		const result = event.result;
		if (!result?.details?.results) return;

		// Process each subagent result
		for (const r of result.details.results) {
			updateStats(r.agent, {
				input: r.usage?.input || 0,
				output: r.usage?.output || 0,
				cacheRead: r.usage?.cacheRead || 0,
				cacheWrite: r.usage?.cacheWrite || 0,
				cost: r.usage?.cost || 0,
			});
		}
		
		// Update widget using ctx from event
		ctx.ui.setWidget(WIDGET_NAME, renderWidget);
		
		// Update status line
		ctx.ui.setStatus("subagent-cost", ctx.ui.theme.fg("accent", `💰 ${formatCost(stats.totalCost)}`));
	});

	// Clear widget when session ends
	pi.on("session_end", (_event, ctx) => {
		if (!ctx.hasUI) return;
		
		ctx.ui.setWidget(WIDGET_NAME, undefined);
		ctx.ui.setStatus("subagent-cost", undefined);
	});
}