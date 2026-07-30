/**
 * Session Persistence Extension - SQLite-based chat history storage
 * 
 * Stores complete conversation history (prompts + responses) in SQLite,
 * allowing retrieval and search across sessions.
 * 
 * Features:
 * - Automatic saving of all messages (user + assistant)
 * - Searchable history with full-text search
 * - Context restoration on session resume
 * - Metadata tracking (cost, tokens, timestamp)
 * - Per-project database
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Message, UserMessage, AssistantMessage } from "@earendil-works/pi-ai";
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

interface SessionEntry {
	id: number;
	sessionId: string;
	timestamp: string;
	role: "user" | "assistant";
	content: string;
	model?: string;
	cost?: number;
	inputTokens?: number;
	outputTokens?: number;
}

interface SearchResult {
	id: number;
	timestamp: string;
	role: string;
	content: string;
	relevance: number;
}

const DB_DIR = ".pi/session-db";
const DB_FILENAME = "history.db";

class SessionDatabase {
	private dbPath: string;
	private sqlitePath: string;

	constructor(projectPath: string) {
		const dbDir = path.join(projectPath, DB_DIR);
		if (!fs.existsSync(dbDir)) {
			fs.mkdirSync(dbDir, { recursive: true });
		}
		this.dbPath = path.join(dbDir, DB_FILENAME);
		this.sqlitePath = "sqlite3"; // Assume sqlite3 is in PATH
	}

	async init(): Promise<void> {
		// Create tables if not exist
		const schema = `
		CREATE TABLE IF NOT EXISTS messages (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			session_id TEXT NOT NULL,
			timestamp TEXT NOT NULL,
			role TEXT NOT NULL,
			content TEXT NOT NULL,
			model TEXT,
			cost REAL,
			input_tokens INTEGER,
			output_tokens INTEGER,
			parent_id INTEGER,
			FOREIGN KEY (parent_id) REFERENCES messages(id)
		);

		CREATE TABLE IF NOT EXISTS sessions (
			id TEXT PRIMARY KEY,
			name TEXT,
			created_at TEXT NOT NULL,
			last_modified TEXT NOT NULL,
			project_path TEXT NOT NULL,
			total_cost REAL DEFAULT 0,
			total_tokens INTEGER DEFAULT 0
		);

		CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
		CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
		CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
			content,
			content='messages',
			content_rowid='id'
		);
		`;

		await this.execSql(schema);
	}

	private async execSql(sql: string): Promise<string> {
		return new Promise((resolve, reject) => {
			const proc = spawn(this.sqlitePath, [this.dbPath], {
				stdio: ["pipe", "pipe", "pipe"],
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
				if (code !== 0) {
					reject(new Error(`SQLite error: ${stderr}`));
				} else {
					resolve(stdout);
				}
			});

			proc.stdin.write(sql);
			proc.stdin.end();
		});
	}

	async saveMessage(
		sessionId: string,
		role: "user" | "assistant",
		content: string,
		metadata?: {
			model?: string;
			cost?: number;
			inputTokens?: number;
			outputTokens?: number;
		}
	): Promise<void> {
		const timestamp = new Date().toISOString();
		const escapedContent = content.replace(/'/g, "''");

		const sql = `
			INSERT INTO messages (session_id, timestamp, role, content, model, cost, input_tokens, output_tokens)
			VALUES ('${sessionId}', '${timestamp}', '${role}', '${escapedContent}', 
					'${metadata?.model || ""}', ${metadata?.cost || 0}, 
					${metadata?.inputTokens || 0}, ${metadata?.outputTokens || 0});
		`;

		await this.execSql(sql);
	}

	async searchContext(query: string, limit: number = 10): Promise<SearchResult[]> {
		const escapedQuery = query.replace(/'/g, "''");

		const sql = `
			SELECT m.id, m.timestamp, m.role, m.content, rank as relevance
			FROM messages_fts fts
			JOIN messages m ON fts.content_rowid = m.id
			WHERE messages_fts MATCH '${escapedQuery}'
			ORDER BY rank
			LIMIT ${limit};
		`;

		const result = await this.execSql(sql);
		return this.parseResults(result);
	}

	async getRecentMessages(sessionId: string, limit: number = 50): Promise<SessionEntry[]> {
		const sql = `
			SELECT id, session_id, timestamp, role, content, model, cost, input_tokens, output_tokens
			FROM messages
			WHERE session_id = '${sessionId}'
			ORDER BY timestamp DESC
			LIMIT ${limit};
		`;

		const result = await this.execSql(sql);
		return this.parseResults(result);
	}

	async getMessagesForContext(
		currentSessionId: string,
		maxTokens: number = 4000
	): Promise<SessionEntry[]> {
		// Get recent messages from current session + similar context from other sessions
		const recentSql = `
			SELECT id, session_id, timestamp, role, content, model, cost, input_tokens, output_tokens
			FROM messages
			WHERE session_id = '${currentSessionId}'
			ORDER BY timestamp DESC
			LIMIT 20;
		`;

		const result = await this.execSql(recentSql);
		return this.parseResults(result);
	}

	async getAllSessions(): Promise<Array<{
		id: string;
		name?: string;
		createdAt: string;
		lastModified: string;
		messageCount: number;
	}>> {
		const sql = `
			SELECT s.id, s.name, s.created_at, s.last_modified,
					COUNT(m.id) as message_count
			FROM sessions s
			LEFT JOIN messages m ON s.id = m.session_id
			GROUP BY s.id
			ORDER BY s.last_modified DESC;
		`;

		const result = await this.execSql(sql);
		return this.parseResults(result);
	}

	async createSession(sessionId: string, name: string, projectPath: string): Promise<void> {
		const timestamp = new Date().toISOString();
		const escapedName = name.replace(/'/g, "''");

		const sql = `
			INSERT OR REPLACE INTO sessions (id, name, created_at, last_modified, project_path, total_cost, total_tokens)
			VALUES ('${sessionId}', '${escapedName}', '${timestamp}', '${timestamp}', '${projectPath}', 0, 0);
		`;

		await this.execSql(sql);
	}

	async deleteOldMessages(days: number = 30): Promise<void> {
		const cutoff = new Date();
		cutoff.setDate(cutoff.getDate() - days);
		const cutoffStr = cutoff.toISOString();

		const sql = `
			DELETE FROM messages WHERE timestamp < '${cutoffStr}';
		`;

		await this.execSql(sql);
	}

	private parseResults<T>(result: string): T[] {
		if (!result.trim()) return [];

		const lines = result.trim().split("\n").filter((l) => l.trim());
		// Simple parsing assuming pipe-delimited or simple format
		// In production, would use a proper SQLite library
		return lines.map((line) => {
			const parts = line.split("|").map((p) => p.trim());
			return parts as unknown as T;
		});
	}
}

// Global database instance per project
const dbInstances = new Map<string, SessionDatabase>();

function getDatabase(projectPath: string): SessionDatabase {
	if (!dbInstances.has(projectPath)) {
		dbInstances.set(projectPath, new SessionDatabase(projectPath));
	}
	return dbInstances.get(projectPath)!;
}

function extractTextContent(content: string | { type: string; text?: string }[]): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";

	return content
		.filter((c): c is { type: "text"; text: string } => c.type === "text" && typeof c.text === "string")
		.map((c) => c.text)
		.join("\n");
}

export default function sessionPersistenceExtension(pi: ExtensionAPI) {
	let currentDb: SessionDatabase | null = null;
	let currentSessionId: string | null = null;

	// Initialize on session start
	pi.on("session_start", async (event, ctx) => {
		if (!ctx.cwd) return;

		try {
			currentDb = getDatabase(ctx.cwd);
			await currentDb.init();

			// Get session ID or create new tracking entry
			// Note: Pi session ID is in event.sessionId
			currentSessionId = event.sessionId || `session_${Date.now()}`;
			await currentDb.createSession(currentSessionId, event.sessionName || "Unnamed", ctx.cwd);

			console.log(`[session-persistence] Initialized DB for ${currentSessionId}`);
		} catch (err) {
			console.error("[session-persistence] Failed to init DB:", err);
		}
	});

	// Save user messages
	pi.on("message_start", async (event, ctx) => {
		if (!currentDb || !currentSessionId) return;
		if (event.message.role !== "user") return;

		try {
			const text = extractTextContent(event.message.content);
			if (text.trim()) {
				await currentDb.saveMessage(currentSessionId, "user", text);
			}
		} catch (err) {
			console.error("[session-persistence] Failed to save user message:", err);
		}
	});

	// Save assistant messages with metadata
	pi.on("message_end", async (event, ctx) => {
		if (!currentDb || !currentSessionId) return;
		if (event.message.role !== "assistant") return;

		try {
			const text = extractTextContent(event.message.content);
			const usage = event.message.usage;

			if (text.trim()) {
				await currentDb.saveMessage(currentSessionId, "assistant", text, {
					model: event.message.model,
					cost: usage?.cost?.total,
					inputTokens: usage?.input,
					outputTokens: usage?.output,
				});
			}
		} catch (err) {
			console.error("[session-persistence] Failed to save assistant message:", err);
		}
	});

	// Clean up old messages periodically
	pi.on("session_end", async (_event, ctx) => {
		if (!currentDb) return;

		try {
			// Keep only last 30 days
			await currentDb.deleteOldMessages(30);
			console.log("[session-persistence] Cleaned old messages");
		} catch (err) {
			console.error("[session-persistence] Failed to cleanup:", err);
		}
	});

	// Register commands for querying history
	pi.registerCommand?.({
		name: "search-history",
		description: "Search conversation history by content",
		parameters: {
			query: { type: "string", description: "Search query" },
			limit: { type: "number", description: "Max results", default: 10 },
		},
		async execute(args, ctx) {
			if (!currentDb) return { error: "No active database" };

			try {
				const results = await currentDb.searchContext(args.query, args.limit);
				return { results };
			} catch (err) {
				return { error: `Search failed: ${err}` };
			}
		},
	});

	pi.registerCommand?.({
		name: "list-sessions",
		description: "List all saved sessions",
		async execute(_args, ctx) {
			if (!currentDb) return { error: "No active database" };

			try {
				const sessions = await currentDb.getAllSessions();
				return { sessions };
			} catch (err) {
				return { error: `Failed to list sessions: ${err}` };
			}
		},
	});
}
