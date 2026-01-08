import { spawn, ChildProcess } from "child_process";

export interface ValidationResult {
  success: boolean;
  serverInfo?: {
    name: string;
    version?: string;
  };
  capabilities?: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
  };
  tools?: { name: string; description?: string }[];
  resources?: { uri: string; name?: string; description?: string }[];
  prompts?: { name: string; description?: string }[];
  error?: string;
  durationMs: number;
}

interface JsonRpcResponse {
  jsonrpc: string;
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

const TIMEOUT_MS = 45000; // 45 second timeout (some servers are slow to start)

const CONFIG_PATTERNS = [
  /requires?\s+(an?\s+)?api[_\s]?key/i,
  /set\s+.*_API_KEY/i,
  /OPENAI_API_KEY/i,
  /ANTHROPIC_API_KEY/i,
  /DATABASE_URL/i,
  /requires?\s+authentication/i,
  /you\s+(need|must)\s+to\s+(configure|set|provide)/i,
  /environment\s+variable/i,
  /--api-key/i,
];

export function detectRequiresConfig(readme: string): boolean {
  return CONFIG_PATTERNS.some((pattern) => pattern.test(readme));
}

function parseJsonRpcMessages(buffer: string): JsonRpcResponse[] {
  const messages: JsonRpcResponse[] = [];
  const lines = buffer.split("\n").filter((l) => l.trim());

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.jsonrpc === "2.0" && "id" in parsed) {
        messages.push(parsed);
      }
    } catch {
      // Not valid JSON, skip
    }
  }

  return messages;
}

export async function validateMcpServer(
  installCommand: string
): Promise<ValidationResult> {
  const startTime = Date.now();

  // Parse command: "npx -y @package/name" → ["npx", "-y", "@package/name"]
  const parts = installCommand.split(/\s+/);
  const cmd = parts[0];
  const args = parts.slice(1);

  return new Promise((resolve) => {
    let proc: ChildProcess | null = null;
    let stdout = "";
    let stderr = "";
    let resolved = false;
    let messageId = 1;

    const finish = (result: ValidationResult) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      if (proc && !proc.killed) {
        proc.kill("SIGTERM");
        setTimeout(() => proc?.kill("SIGKILL"), 1000);
      }
      resolve(result);
    };

    const timeout = setTimeout(() => {
      finish({
        success: false,
        error: `Timeout after ${TIMEOUT_MS / 1000}s`,
        durationMs: Date.now() - startTime,
      });
    }, TIMEOUT_MS);

    const sendRequest = (method: string, params: Record<string, unknown> = {}) => {
      const request = {
        jsonrpc: "2.0",
        id: messageId++,
        method,
        params,
      };
      proc?.stdin?.write(JSON.stringify(request) + "\n");
    };

    try {
      proc = spawn(cmd, args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, NODE_ENV: "production" },
      });

      let initDone = false;
      let toolsDone = false;
      let resourcesDone = false;
      let promptsDone = false;

      const result: ValidationResult = {
        success: false,
        durationMs: 0,
      };

      proc.stdout?.on("data", (data) => {
        stdout += data.toString();
        const messages = parseJsonRpcMessages(stdout);

        for (const msg of messages) {
          // Handle errors - only fail on initialize error
          if (msg.error) {
            if (msg.id === 1) {
              // Initialize failed - this is fatal
              finish({
                success: false,
                error: `MCP initialize error: ${msg.error.message}`,
                durationMs: Date.now() - startTime,
              });
              return;
            }
            // For tools/list, resources/list, prompts/list - "Method not found" is OK
            // It just means the server doesn't implement that method
            if (msg.id === 2) {
              toolsDone = true;
              result.tools = [];
            } else if (msg.id === 3) {
              resourcesDone = true;
              result.resources = [];
            } else if (msg.id === 4) {
              promptsDone = true;
              result.prompts = [];
            }
          }

          // Initialize response
          if (!initDone && msg.id === 1 && msg.result) {
            initDone = true;
            const res = msg.result as {
              serverInfo?: { name?: string; version?: string };
              capabilities?: Record<string, unknown>;
            };

            result.serverInfo = {
              name: res.serverInfo?.name ?? "unknown",
              version: res.serverInfo?.version,
            };
            result.capabilities = {
              tools: !!res.capabilities?.tools,
              resources: !!res.capabilities?.resources,
              prompts: !!res.capabilities?.prompts,
            };

            // Send initialized notification (required by MCP spec)
            proc?.stdin?.write(
              JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n"
            );

            // Request tools/resources/prompts
            sendRequest("tools/list");
            sendRequest("resources/list");
            sendRequest("prompts/list");
          }

          // Tools response
          if (!toolsDone && msg.id === 2 && msg.result) {
            toolsDone = true;
            const res = msg.result as { tools?: { name: string; description?: string }[] };
            result.tools = res.tools ?? [];
          }

          // Resources response
          if (!resourcesDone && msg.id === 3 && msg.result) {
            resourcesDone = true;
            const res = msg.result as {
              resources?: { uri: string; name?: string; description?: string }[];
            };
            result.resources = res.resources ?? [];
          }

          // Prompts response
          if (!promptsDone && msg.id === 4 && msg.result) {
            promptsDone = true;
            const res = msg.result as { prompts?: { name: string; description?: string }[] };
            result.prompts = res.prompts ?? [];
          }

          // All done
          if (initDone && toolsDone && resourcesDone && promptsDone) {
            result.success = true;
            result.durationMs = Date.now() - startTime;
            finish(result);
          }
        }
      });

      proc.stderr?.on("data", (data) => {
        stderr += data.toString();
        // Log but don't fail - MCP servers write logs to stderr
      });

      proc.on("error", (err) => {
        finish({
          success: false,
          error: `Spawn error: ${err.message}`,
          durationMs: Date.now() - startTime,
        });
      });

      proc.on("exit", (code) => {
        if (!resolved) {
          if (code !== 0 && code !== null) {
            finish({
              success: false,
              error: `Process exited with code ${code}. stderr: ${stderr.slice(0, 500)}`,
              durationMs: Date.now() - startTime,
            });
          }
        }
      });

      // Send initialize request
      sendRequest("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "mcp-hub-validator", version: "1.0.0" },
      });
    } catch (err) {
      finish({
        success: false,
        error: `Exception: ${err}`,
        durationMs: Date.now() - startTime,
      });
    }
  });
}
