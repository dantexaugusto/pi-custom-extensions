/**
 * Subagent Cost Tracker Widget - Persist usage and cost statistics across sessions
 * 
 * FIXED v2: Now uses responsive width and ANSI-safe rendering
 * - Uses truncateToWidth() and visibleWidth() from pi-tui
 * - Never exceeds the width parameter in render()
 * - Implements render cache for performance
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

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

/**
 * Safely pad a styled string to a target visible width
 * Handles ANSI codes correctly by using visibleWidth()
 */
function safePadEnd(text: string, targetWidth: number): string {
	const vis = visibleWidth(text);
	const padding = Math.max(0, targetWidth - vis);
	return text + " ".repeat(padding);
}

function safePadStart(text: string, targetWidth: number): string {
	const vis = visibleWidth(text);
	const padding = Math.max(0, targetWidth - vis);
	return " ".repeat(padding) + text;
}

/**
 * Create a horizontal line that respects width
 */
function horizontalLine(char: string, width: number): string {
	return char.repeat(Math.max(0, width));
}

export default function subagentCostWidgetExtension(pi: ExtensionAPI) {
	const stats: SessionStats = {
		agents: new Map(),
		totalCost: 0,
		totalInvocations: 0,
		startTime: new Date().toISOString(),
	};

	// Render cache for performance
	let cachedLines: string[] = [];
	let cachedWidth = 0;
	let cacheVersion = 0;
	let lastRenderedVersion = -1;

	const invalidateCache = () => {
		cacheVersion++;
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
		
		invalidateCache();
	};

	const createWidget = (_tui: unknown, theme: Theme) => {
		return {
			render(width: number): string[] {
				// Use cache if valid
				if (width === cachedWidth && lastRenderedVersion === cacheVersion) {
					return cachedLines;
				}

				const lines: string[] = [];
				// Reserve 2 chars for box borders
				const innerWidth = Math.max(10, width - 2);

				// Header - must be exactly (innerWidth + 2) chars total
				// Structure: "┌─ " (3) + TITLE + " ─ DURATION " + "─" × remaining + "┐" (1)
				const title = theme.bold("SUBAGENT COST TRACKER");
				const duration = formatDuration(stats.startTime);
				const titleVisible = visibleWidth(title);
				
				// "┌─ " = 3 chars, "┐" = 1 char
				// Header: ┌─ TITLE ─ 5m ────────┐  (total = innerWidth + 2)
				const durationText = ` ─ ${duration} `;
				const durationVisible = visibleWidth(durationText);
				
				// Remaining space for decorative dashes: innerWidth + 2 - 3 - title - duration - 1
				const headerDecoSpace = Math.max(0, innerWidth - titleVisible - durationVisible - 2);
				
				// Build header: "┌─ " + TITLE + " ─ 5m " + "─" × deco + "┐"
				const headerLine = theme.fg("accent", "┌─ ") +
					theme.fg("accent", title) +
					theme.fg("accent", durationText) +
					theme.fg("accent", horizontalLine("─", headerDecoSpace) + "┐");
				lines.push(truncateToWidth(headerLine, width));

				// Session summary line
				const summaryText = `Total: ${stats.totalInvocations} calls · ${formatCost(stats.totalCost)}`;
				const summaryColored = theme.fg("muted", summaryText);
				const summaryPadded = safePadEnd(summaryColored, innerWidth - 1);
				const summaryLine = theme.fg("accent", "│") + " " + summaryPadded + theme.fg("accent", "│");
				lines.push(truncateToWidth(summaryLine, width));

				// Separator
				const sepLine = theme.fg("accent", "├" + horizontalLine("─", innerWidth) + "┤");
				lines.push(truncateToWidth(sepLine, width));

				// Calculate dynamic column widths based on available space
				// Minimum: Agent(8) + Calls(5) + Input(6) + Output(6) + Cost(8) + spaces(4) = 37
				const minColsWidth = 37;
				const availableForCols = Math.max(minColsWidth, innerWidth - 2); // -2 for padding
				
				// Dynamic column sizing
				const agentColWidth = Math.min(16, Math.max(8, Math.floor(availableForCols * 0.28)));
				const callsColWidth = Math.max(5, Math.floor(availableForCols * 0.12));
				const inputColWidth = Math.max(6, Math.floor(availableForCols * 0.18));
				const outputColWidth = Math.max(6, Math.floor(availableForCols * 0.18));
				const costColWidth = Math.max(8, Math.floor(availableForCols * 0.20));

				// Column headers
				const headerAgent = safePadEnd(theme.fg("muted", "Agent"), agentColWidth);
				const headerCalls = safePadStart(theme.fg("muted", "Calls"), callsColWidth);
				const headerInput = safePadStart(theme.fg("muted", "Input"), inputColWidth);
				const headerOutput = safePadStart(theme.fg("muted", "Output"), outputColWidth);
				const headerCost = safePadStart(theme.fg("muted", "Cost"), costColWidth);
				
				const colHeaderContent = `${headerAgent} ${headerCalls} ${headerInput} ${headerOutput} ${headerCost}`;
				const colHeaderPadded = safePadEnd(colHeaderContent, innerWidth - 1);
				const colHeaderLine = theme.fg("accent", "│ ") + colHeaderPadded + theme.fg("accent", "│");
				lines.push(truncateToWidth(colHeaderLine, width));

				// Agent rows
				const sortedAgents = Array.from(stats.agents.values()).sort((a, b) => b.cost - a.cost);
				const maxRows = Math.min(8, Math.max(1, Math.floor((width > 60 ? 8 : 4))));
				
				for (const agent of sortedAgents.slice(0, maxRows)) {
					const agentName = agent.agent.slice(0, agentColWidth - 1);
					const colAgent = safePadEnd(theme.fg("toolTitle", agentName), agentColWidth);
					const colCalls = safePadStart(theme.fg("dim", String(agent.invocations)), callsColWidth);
					const colInput = safePadStart(theme.fg("dim", formatTokens(agent.inputTokens)), inputColWidth);
					const colOutput = safePadStart(theme.fg("dim", formatTokens(agent.outputTokens)), outputColWidth);
					const colCost = safePadStart(theme.fg("warning", formatCost(agent.cost)), costColWidth);
					
					const rowContent = `${colAgent} ${colCalls} ${colInput} ${colOutput} ${colCost}`;
					const rowPadded = safePadEnd(rowContent, innerWidth - 1);
					const rowLine = theme.fg("accent", "│ ") + rowPadded + theme.fg("accent", "│");
					lines.push(truncateToWidth(rowLine, width));
				}

				// Fill empty rows if needed
				const renderedRows = Math.min(sortedAgents.length, maxRows);
				const remainingRows = maxRows - renderedRows;
				for (let i = 0; i < remainingRows; i++) {
					const emptyLine = theme.fg("accent", "│") + " ".repeat(innerWidth) + theme.fg("accent", "│");
					lines.push(truncateToWidth(emptyLine, width));
				}

				// Footer
				const footerLine = theme.fg("accent", "└" + horizontalLine("─", innerWidth) + "┘");
				lines.push(truncateToWidth(footerLine, width));

				// Update cache
				cachedLines = lines;
				cachedWidth = width;
				lastRenderedVersion = cacheVersion;

				return lines;
			},
			invalidate() {
				invalidateCache();
			}
		};
	};

	// FIXED: All UI operations moved into session_start handlers
	// This prevents autocomplete crash (TypeError: value.startsWith)
	pi.on("session_start", async (_event, ctx) => {
		if (!ctx.hasUI) return;
		
		// ✅ SAFE: Register command AFTER session_start
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
		invalidateCache();
		
		// Initialize widget with responsive renderer
		ctx.ui.setWidget(WIDGET_NAME, createWidget);
	});

	// Listen for subagent tool results - using tool_result (not tool_result_end)
	pi.on("tool_result", (event, ctx) => {
		if (!ctx.hasUI) return;
		
		// Check if this is a subagent tool result
		if (event.toolName !== "subagent") return;
		
		const details = event.details;
		if (!details?.results) return;

		// Process each subagent result
		for (const r of details.results) {
			updateStats(r.agent, {
				input: r.usage?.input || 0,
				output: r.usage?.output || 0,
				cacheRead: r.usage?.cacheRead || 0,
				cacheWrite: r.usage?.cacheWrite || 0,
				cost: r.usage?.cost || 0,
			});
		}
		
		// Update widget
		ctx.ui.setWidget(WIDGET_NAME, createWidget);
	});

	// Clear widget when session ends
	pi.on("session_end", (_event, ctx) => {
		if (!ctx.hasUI) return;
		
		ctx.ui.setWidget(WIDGET_NAME, undefined);
	});
}
