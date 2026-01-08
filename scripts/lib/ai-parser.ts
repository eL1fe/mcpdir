import Anthropic from "@anthropic-ai/sdk";

export interface ParsedTool {
  name: string;
  description: string;
}

export interface ParsedResource {
  uri: string;
  name: string;
  description: string;
}

export interface ParsedPrompt {
  name: string;
  description: string;
}

export interface ParsedServerData {
  tools: ParsedTool[];
  resources: ParsedResource[];
  prompts: ParsedPrompt[];
  enhancedDescription: string;
  suggestedCategories: string[];
  features: string[];
}

const SYSTEM_PROMPT = `You are an expert at analyzing MCP (Model Context Protocol) servers. Extract structured metadata from READMEs.

MCP servers provide:
- Tools: Functions the server exposes. Look for sections titled "Tools", "Available Tools", "API", or tables/lists with function names.
- Resources: Data endpoints with URI patterns (e.g., "file:///{path}", "db://tables/{name}")
- Prompts: Pre-defined prompt templates

CRITICAL RULES:
1. ONLY extract tools that are EXPLICITLY listed in the README. Never invent or hallucinate tool names.
2. Tool names are usually in code format like \`get_file_contents\`, \`search_files\`, \`create_issue\`.
3. Look carefully in markdown tables, <details> sections, bullet lists, and code blocks.
4. If a README lists 50+ tools, extract ALL of them - don't summarize or skip.
5. If you can't find explicit tool names, return an empty array. DO NOT GUESS.

Return ONLY valid JSON, no markdown, no explanation.`;

const USER_PROMPT = `Analyze this MCP server and extract structured data.

Server Name: {name}
Description: {description}

README Content:
{readme}

Extract and return this JSON structure:
{
  "tools": [{"name": "tool_name", "description": "what it does"}],
  "resources": [{"uri": "uri://pattern", "name": "Resource Name", "description": "what it provides"}],
  "prompts": [{"name": "prompt_name", "description": "what it does"}],
  "enhancedDescription": "A clear 1-2 sentence description of what this MCP server does",
  "suggestedCategories": ["category1", "category2"],
  "features": ["feature 1", "feature 2", "feature 3"]
}

Valid categories: databases, file-systems, apis-services, dev-tools, ai-ml, productivity, data-analytics, communication, other

Return ONLY the JSON object, nothing else.`;

// Lazy init for Anthropic client
let anthropicClient: Anthropic | null = null;
function getAnthropicClient(): Anthropic | null {
  if (anthropicClient) return anthropicClient;
  if (process.env.ANTHROPIC_API_KEY) {
    anthropicClient = new Anthropic();
    return anthropicClient;
  }
  return null;
}

// Call via OpenRouter (OpenAI-compatible API)
async function callOpenRouter(
  systemPrompt: string,
  userPrompt: string
): Promise<string | null> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://mcpdir.com",
      "X-Title": "MCP Directory",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      max_tokens: 8000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || null;
}

// Call via direct Anthropic API
async function callAnthropic(
  systemPrompt: string,
  userPrompt: string
): Promise<string | null> {
  const client = getAnthropicClient();
  if (!client) return null;

  const response = await client.messages.create({
    model: "claude-3-haiku-20240307",
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") return null;
  return content.text;
}

export async function parseServerWithAI(
  name: string,
  description: string,
  readme: string
): Promise<ParsedServerData | null> {
  const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;

  if (!hasOpenRouter && !hasAnthropic) {
    return null;
  }

  try {
    const truncatedReadme = readme.slice(0, 100000); // Gemini handles huge context
    const userPrompt = USER_PROMPT
      .replace("{name}", name)
      .replace("{description}", description || "No description provided")
      .replace("{readme}", truncatedReadme);

    let responseText: string | null = null;

    if (hasOpenRouter) {
      responseText = await callOpenRouter(SYSTEM_PROMPT, userPrompt);
    } else {
      responseText = await callAnthropic(SYSTEM_PROMPT, userPrompt);
    }

    if (!responseText) return null;

    // Extract JSON from response (handle potential markdown wrapping)
    let jsonStr = responseText.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```$/g, "").trim();
    }

    // Sanitize common JSON issues from AI responses
    jsonStr = jsonStr
      .replace(/[\x00-\x1F\x7F]/g, " ") // Remove control characters
      .replace(/,(\s*[}\]])/g, "$1"); // Remove trailing commas

    let parsed: ParsedServerData;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      // Try to extract just the JSON object if there's extra text
      const match = jsonStr.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        throw new Error("Could not extract valid JSON");
      }
    }

    // Validate structure
    return {
      tools: Array.isArray(parsed.tools) ? parsed.tools : [],
      resources: Array.isArray(parsed.resources) ? parsed.resources : [],
      prompts: Array.isArray(parsed.prompts) ? parsed.prompts : [],
      enhancedDescription: parsed.enhancedDescription || description || "",
      suggestedCategories: Array.isArray(parsed.suggestedCategories)
        ? parsed.suggestedCategories
        : [],
      features: Array.isArray(parsed.features) ? parsed.features : [],
    };
  } catch (error) {
    console.error(`AI parsing failed for ${name}:`, error);
    return null;
  }
}

// Estimate token count (rough approximation)
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Calculate approximate cost
export function estimateCost(inputTokens: number, outputTokens: number): number {
  // Claude 3 Haiku pricing: $0.25/1M input, $1.25/1M output
  const inputCost = (inputTokens / 1_000_000) * 0.25;
  const outputCost = (outputTokens / 1_000_000) * 1.25;
  return inputCost + outputCost;
}
