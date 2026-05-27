/**
 * Web Search extension - registers `web_search` and `web_fetch` tools.
 *
 * Supports multiple search backends via env vars (first found wins):
 *   - TAVILY_API_KEY  → Tavily Search API (recommended, free tier available)
 *   - BRAVE_API_KEY   → Brave Search API (free tier available)
 *   - SERP_API_KEY    → SerpAPI (Google results)
 *
 * `web_fetch` fetches a URL and returns text content (no API key needed).
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

interface SearchResult {
	title: string;
	url: string;
	snippet: string;
}

import fs from "fs";
import path from "path";

function getSecretValue(envVarName: string): string | undefined {
	// First check environment variables
	if (process.env[envVarName]) return process.env[envVarName];
	
	// Then try reading from the global user secrets
	try {
        const secretPath = path.join("/home/ubuntu/.secrets", envVarName);
		if (fs.existsSync(secretPath)) {
			return fs.readFileSync(secretPath, "utf-8").trim();
		}
	} catch (e) {
		// Ignore file read errors
	}
	return undefined;
}

// ---------------------------------------------------------------------------
// Search backends
// ---------------------------------------------------------------------------

async function searchTavily(query: string, maxResults: number, signal?: AbortSignal): Promise<SearchResult[]> {
	const apiKey = getSecretValue("TAVILY_API_KEY");
	if (!apiKey) throw new Error("TAVILY_API_KEY not set");

	const res = await fetch("https://api.tavily.com/search", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			api_key: apiKey,
			query,
			max_results: maxResults,
			search_depth: "basic",
		}),
		signal,
	});

	if (!res.ok) throw new Error(`Tavily API error: ${res.status} ${await res.text()}`);
	const data = await res.json();
	return (data.results || []).map((r: Record<string, string>) => ({
		title: r.title || "",
		url: r.url || "",
		snippet: r.content || "",
	}));
}

async function searchBrave(query: string, maxResults: number, signal?: AbortSignal): Promise<SearchResult[]> {
	const apiKey = getSecretValue("BRAVE_API_KEY");
	if (!apiKey) throw new Error("BRAVE_API_KEY not set");

	const params = new URLSearchParams({ q: query, count: String(maxResults) });
	const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
		headers: { "X-Subscription-Token": apiKey, Accept: "application/json" },
		signal,
	});

	if (!res.ok) throw new Error(`Brave API error: ${res.status} ${await res.text()}`);
	const data = await res.json();
	return (data.web?.results || []).map((r: Record<string, string>) => ({
		title: r.title || "",
		url: r.url || "",
		snippet: r.description || "",
	}));
}

async function searchSerp(query: string, maxResults: number, signal?: AbortSignal): Promise<SearchResult[]> {
	const apiKey = getSecretValue("SERP_API_KEY");
	if (!apiKey) throw new Error("SERP_API_KEY not set");

	const params = new URLSearchParams({ q: query, api_key: apiKey, num: String(maxResults), engine: "google" });
	const res = await fetch(`https://serpapi.com/search.json?${params}`, { signal });

	if (!res.ok) throw new Error(`SerpAPI error: ${res.status} ${await res.text()}`);
	const data = await res.json();
	return (data.organic_results || []).map((r: Record<string, string>) => ({
		title: r.title || "",
		url: r.link || "",
		snippet: r.snippet || "",
	}));
}

function getSearchBackend(): { name: string; fn: typeof searchTavily } | null {
	if (getSecretValue("TAVILY_API_KEY")) return { name: "Tavily", fn: searchTavily };
	if (getSecretValue("BRAVE_API_KEY")) return { name: "Brave", fn: searchBrave };
	if (getSecretValue("SERP_API_KEY")) return { name: "SerpAPI", fn: searchSerp };
	return null;
}

// ---------------------------------------------------------------------------
// Web fetch with text extraction
// ---------------------------------------------------------------------------

async function fetchUrl(url: string, signal?: AbortSignal): Promise<string> {
	const res = await fetch(url, {
		headers: {
			"User-Agent": "Mozilla/5.0 (compatible; pi-agent/1.0)",
			Accept: "text/html,application/xhtml+xml,text/plain,application/json",
		},
		signal,
		redirect: "follow",
	});

	if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

	const contentType = res.headers.get("content-type") || "";
	const text = await res.text();

	if (contentType.includes("application/json")) {
		return text;
	}

	if (contentType.includes("text/html")) {
		return stripHtml(text);
	}

	return text;
}

function stripHtml(html: string): string {
	let text = html;
	// Remove script and style blocks
	text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
	text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
	text = text.replace(/<nav[\s\S]*?<\/nav>/gi, "");
	text = text.replace(/<footer[\s\S]*?<\/footer>/gi, "");
	// Remove tags
	text = text.replace(/<[^>]+>/g, " ");
	// Decode common entities
	text = text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
	// Collapse whitespace
	text = text.replace(/[ \t]+/g, " ").replace(/\n\s*\n/g, "\n\n").trim();
	// Truncate if very long
	const MAX_CHARS = 15000;
	if (text.length > MAX_CHARS) {
		text = text.slice(0, MAX_CHARS) + "\n\n... (truncated)";
	}
	return text;
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "web_search",
		label: "Web Search",
		description: [
			"Search the web and return results with title, URL, and snippet.",
			"Requires one of: TAVILY_API_KEY, BRAVE_API_KEY, or SERP_API_KEY.",
			"Use for finding documentation, APIs, libraries, error solutions, or current information.",
		].join(" "),
		parameters: Type.Object({
			query: Type.String({ description: "Search query" }),
			max_results: Type.Optional(Type.Number({ description: "Max results to return (default 5, max 10)", default: 5 })),
		}),
		async execute(_toolCallId, params, signal) {
			const backend = getSearchBackend();
			if (!backend) {
				return {
					content: [{ type: "text", text: "No search API key configured. Set one of: TAVILY_API_KEY, BRAVE_API_KEY, or SERP_API_KEY." }],
					details: {},
					isError: true,
				};
			}

			const maxResults = Math.min(params.max_results ?? 5, 10);

			try {
				const results = await backend.fn(params.query, maxResults, signal);
				if (results.length === 0) {
					return { content: [{ type: "text", text: `No results found for: ${params.query}` }], details: {} };
				}

				const formatted = results
					.map((r, i) => `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet}`)
					.join("\n\n");

				return {
					content: [{ type: "text", text: `Search results (${backend.name}) for: ${params.query}\n\n${formatted}` }],
					details: { provider: backend.name, count: results.length },
				};
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				return { content: [{ type: "text", text: `Search failed: ${msg}` }], details: {}, isError: true };
			}
		},
	});

	pi.registerTool({
		name: "web_fetch",
		label: "Web Fetch",
		description: [
			"Fetch a URL and return its text content.",
			"HTML is stripped to plain text. JSON is returned as-is.",
			"Use for reading documentation pages, API responses, or any web content.",
		].join(" "),
		parameters: Type.Object({
			url: Type.String({ description: "URL to fetch" }),
		}),
		async execute(_toolCallId, params, signal) {
			try {
				const content = await fetchUrl(params.url, signal);
				return {
					content: [{ type: "text", text: content }],
					details: { url: params.url },
				};
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				return { content: [{ type: "text", text: `Fetch failed: ${msg}` }], details: {}, isError: true };
			}
		},
	});
}
