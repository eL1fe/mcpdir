import { spawn } from "child_process";
import { ValidationResult } from "./mcp-validator";

const DOCKER_IMAGE_NODE = "node:20-slim";
const DOCKER_IMAGE_PYTHON = "python:3.12-slim";
const TIMEOUT_MS = 60000; // 60 seconds for Docker

interface DockerValidationOptions {
  installCommand: string;
  timeout?: number;
  envVars?: Record<string, string>;
}

// Check if Docker is available
export async function isDockerAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn("docker", ["info"], { stdio: "pipe" });
    proc.on("error", () => resolve(false));
    proc.on("exit", (code) => resolve(code === 0));
  });
}

// Detect if command is Python (uvx)
function isPythonCommand(command: string): boolean {
  return command.startsWith("uvx ") || command.startsWith("python ");
}

// Validate MCP server in Docker container (Node.js)
export async function validateInDocker(
  options: DockerValidationOptions
): Promise<ValidationResult> {
  const { installCommand, timeout = TIMEOUT_MS, envVars = {} } = options;

  // Route to Python validator if uvx command
  if (isPythonCommand(installCommand)) {
    return validatePythonInDocker(options);
  }

  const startTime = Date.now();

  // Build the validation script that runs inside Docker
  const validationScript = `
const { spawn } = require('child_process');

const TIMEOUT = 45000;
let messageId = 1;

function sendRequest(proc, method, params = {}) {
  const request = { jsonrpc: "2.0", id: messageId++, method, params };
  proc.stdin.write(JSON.stringify(request) + "\\n");
}

async function validate() {
  const installCmd = process.env.MCP_INSTALL_CMD;
  if (!installCmd) {
    console.log(JSON.stringify({ success: false, error: 'MCP_INSTALL_CMD not set' }));
    process.exit(1);
  }
  const parts = installCmd.split(/\\s+/);
  const cmd = parts[0];
  const args = parts.slice(1);

  const proc = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });

  let stdout = '';
  let initDone = false, toolsDone = false, resourcesDone = false, promptsDone = false;
  const result = { success: false, tools: [], resources: [], prompts: [] };

  const timeoutId = setTimeout(() => {
    proc.kill();
    console.log(JSON.stringify({ success: false, error: 'Timeout' }));
    process.exit(1);
  }, TIMEOUT);

  proc.stdout.on('data', (data) => {
    stdout += data.toString();
    for (const line of stdout.split('\\n')) {
      try {
        const msg = JSON.parse(line);
        if (msg.jsonrpc !== '2.0') continue;

        if (msg.error && msg.id === 1) {
          clearTimeout(timeoutId);
          proc.kill();
          console.log(JSON.stringify({ success: false, error: msg.error.message }));
          process.exit(1);
        }

        if (!initDone && msg.id === 1 && msg.result) {
          initDone = true;
          result.serverInfo = msg.result.serverInfo;
          result.capabilities = msg.result.capabilities;
          proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\\n");
          sendRequest(proc, 'tools/list');
          sendRequest(proc, 'resources/list');
          sendRequest(proc, 'prompts/list');
        }

        if (msg.id === 2) { toolsDone = true; result.tools = msg.result?.tools || []; }
        if (msg.id === 3) { resourcesDone = true; result.resources = msg.result?.resources || []; }
        if (msg.id === 4) { promptsDone = true; result.prompts = msg.result?.prompts || []; }

        if (initDone && toolsDone && resourcesDone && promptsDone) {
          clearTimeout(timeoutId);
          proc.kill();
          result.success = true;
          console.log(JSON.stringify(result));
          process.exit(0);
        }
      } catch {}
    }
  });

  proc.on('error', (err) => {
    clearTimeout(timeoutId);
    console.log(JSON.stringify({ success: false, error: err.message }));
    process.exit(1);
  });

  sendRequest(proc, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'mcp-hub-validator', version: '1.0.0' }
  });
}

validate();
`;

  return new Promise((resolve) => {
    // Build Docker args with optional env vars
    const dockerArgs = [
      "run",
      "--rm",
      "--network=host", // Allow network for npm install
      "-i", // Interactive for stdin
      "--memory=512m", // Limit memory
      "--cpus=1", // Limit CPU
    ];

    // Add environment variables
    for (const [key, value] of Object.entries(envVars)) {
      dockerArgs.push("-e", `${key}=${value}`);
    }

    // Pass install command as env var (not command line arg)
    dockerArgs.push("-e", `MCP_INSTALL_CMD=${installCommand}`);

    dockerArgs.push(
      DOCKER_IMAGE_NODE,
      "bash",
      "-c",
      `npm install -g ${installCommand.replace(/^npx -y /, "")} > /dev/null 2>&1 && node -e '${validationScript.replace(/'/g, "'\\''")}'`
    );

    const proc = spawn("docker", dockerArgs, { stdio: ["pipe", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";

    const timeoutId = setTimeout(() => {
      proc.kill("SIGKILL");
      resolve({
        success: false,
        error: `Docker timeout after ${timeout / 1000}s`,
        durationMs: Date.now() - startTime,
      });
    }, timeout);

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("error", (err) => {
      clearTimeout(timeoutId);
      resolve({
        success: false,
        error: `Docker error: ${err.message}`,
        durationMs: Date.now() - startTime,
      });
    });

    proc.on("exit", (code) => {
      clearTimeout(timeoutId);
      const durationMs = Date.now() - startTime;

      // Try to parse the JSON output
      try {
        const lines = stdout.trim().split("\n");
        const lastLine = lines[lines.length - 1];
        const result = JSON.parse(lastLine);
        resolve({
          ...result,
          durationMs,
        });
      } catch {
        resolve({
          success: false,
          error: code === 0 ? "No output from validator" : `Exit code ${code}: ${stderr.slice(0, 200)}`,
          durationMs,
        });
      }
    });
  });
}

// Validate Python MCP server in Docker container
async function validatePythonInDocker(
  options: DockerValidationOptions
): Promise<ValidationResult> {
  const { installCommand, timeout = TIMEOUT_MS, envVars = {} } = options;
  const startTime = Date.now();

  // Python validation script
  const pythonScript = `
import subprocess
import sys
import os
import json
import threading

TIMEOUT = 45

def send_request(proc, message_id, method, params=None):
    request = {"jsonrpc": "2.0", "id": message_id, "method": method}
    if params:
        request["params"] = params
    proc.stdin.write(json.dumps(request) + "\\n")
    proc.stdin.flush()

def validate():
    install_cmd = os.environ.get('MCP_INSTALL_CMD')
    if not install_cmd:
        print(json.dumps({"success": False, "error": "MCP_INSTALL_CMD not set"}))
        sys.exit(1)
    cmd = install_cmd.split()
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

    result = {"success": False, "tools": [], "resources": [], "prompts": []}
    message_id = 1
    init_done = tools_done = resources_done = prompts_done = False

    def read_output():
        nonlocal init_done, tools_done, resources_done, prompts_done, message_id
        buffer = ""
        while True:
            line = proc.stdout.readline()
            if not line:
                break
            try:
                msg = json.loads(line)
                if msg.get("jsonrpc") != "2.0":
                    continue

                if msg.get("error") and msg.get("id") == 1:
                    result["error"] = msg["error"].get("message", "Unknown error")
                    return

                if not init_done and msg.get("id") == 1 and msg.get("result"):
                    init_done = True
                    result["serverInfo"] = msg["result"].get("serverInfo")
                    result["capabilities"] = msg["result"].get("capabilities")
                    proc.stdin.write(json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized"}) + "\\n")
                    proc.stdin.flush()
                    message_id += 1
                    send_request(proc, message_id, "tools/list")
                    message_id += 1
                    send_request(proc, message_id, "resources/list")
                    message_id += 1
                    send_request(proc, message_id, "prompts/list")

                if msg.get("id") == 2:
                    tools_done = True
                    result["tools"] = msg.get("result", {}).get("tools", [])
                if msg.get("id") == 3:
                    resources_done = True
                    result["resources"] = msg.get("result", {}).get("resources", [])
                if msg.get("id") == 4:
                    prompts_done = True
                    result["prompts"] = msg.get("result", {}).get("prompts", [])

                if init_done and tools_done and resources_done and prompts_done:
                    result["success"] = True
                    return
            except json.JSONDecodeError:
                continue

    thread = threading.Thread(target=read_output)
    thread.start()

    send_request(proc, message_id, "initialize", {
        "protocolVersion": "2024-11-05",
        "capabilities": {},
        "clientInfo": {"name": "mcp-hub-validator", "version": "1.0.0"}
    })

    thread.join(timeout=TIMEOUT)
    proc.terminate()

    print(json.dumps(result))

if __name__ == "__main__":
    validate()
`;

  return new Promise((resolve) => {
    // Extract package name from uvx command
    const packageName = installCommand.replace(/^uvx\s+/, "").split(/\s+/)[0];

    // Build Docker args
    const dockerArgs = [
      "run",
      "--rm",
      "--network=host",
      "-i",
      "--memory=512m",
      "--cpus=1",
    ];

    // Add environment variables
    for (const [key, value] of Object.entries(envVars)) {
      dockerArgs.push("-e", `${key}=${value}`);
    }

    // Pass install command as env var (not command line arg)
    dockerArgs.push("-e", `MCP_INSTALL_CMD=${installCommand}`);

    dockerArgs.push(
      DOCKER_IMAGE_PYTHON,
      "bash",
      "-c",
      `pip install uv > /dev/null 2>&1 && uv tool install ${packageName} > /dev/null 2>&1 && python3 -c '${pythonScript.replace(/'/g, "'\\''")}'`
    );

    const proc = spawn("docker", dockerArgs, { stdio: ["pipe", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";

    const timeoutId = setTimeout(() => {
      proc.kill("SIGKILL");
      resolve({
        success: false,
        error: `Docker timeout after ${timeout / 1000}s`,
        durationMs: Date.now() - startTime,
      });
    }, timeout);

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("error", (err) => {
      clearTimeout(timeoutId);
      resolve({
        success: false,
        error: `Docker error: ${err.message}`,
        durationMs: Date.now() - startTime,
      });
    });

    proc.on("exit", (code) => {
      clearTimeout(timeoutId);
      const durationMs = Date.now() - startTime;

      try {
        const lines = stdout.trim().split("\n");
        const lastLine = lines[lines.length - 1];
        const result = JSON.parse(lastLine);
        resolve({
          ...result,
          durationMs,
        });
      } catch {
        resolve({
          success: false,
          error: code === 0 ? "No output from validator" : `Exit code ${code}: ${stderr.slice(0, 200)}`,
          durationMs,
        });
      }
    });
  });
}

// Hybrid validator: use Docker if available, otherwise direct spawn
export async function validateMcpServerSafe(
  installCommand: string,
  envVars?: Record<string, string>
): Promise<ValidationResult> {
  const dockerAvailable = await isDockerAvailable();

  if (dockerAvailable) {
    return validateInDocker({ installCommand, envVars });
  } else {
    // Python requires Docker (no fallback)
    if (isPythonCommand(installCommand)) {
      return {
        success: false,
        error: "Python validation requires Docker",
        durationMs: 0,
      };
    }
    // Fallback to direct validation for Node.js (less safe)
    const { validateMcpServer } = await import("./mcp-validator");
    return validateMcpServer(installCommand);
  }
}
