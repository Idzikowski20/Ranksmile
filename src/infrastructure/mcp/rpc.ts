/**
 * Minimal MCP (JSON-RPC 2.0) dispatch for the Streamable HTTP transport.
 *
 * Hand-rolled rather than pulled from @modelcontextprotocol/sdk: the surface we need is
 * initialize + tools/list + tools/call, and the SDK's transport wants a Node server it
 * owns, which a Next 12 API route does not give it. ~80 lines here beats a dependency
 * plus an ESM interop fight.
 */
import { findTool, MCP_TOOLS, McpToolError } from '@/src/infrastructure/mcp/tools';

/** Newest revision we implement. An older client's version is echoed back instead. */
export const LATEST_PROTOCOL_VERSION = '2025-06-18';
export const SUPPORTED_PROTOCOL_VERSIONS = ['2024-11-05', '2025-03-26', LATEST_PROTOCOL_VERSION] as const;

export function isSupportedProtocolVersion(v: string): boolean {
   return (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(v);
}

export const SERVER_INFO = { name: 'ranksmile', title: 'Ranksmile', version: '1.0.0' } as const;

export type JsonRpcId = string | number | null;

export type JsonRpcRequest = {
   jsonrpc?: string;
   id?: JsonRpcId;
   method?: string;
   params?: Record<string, unknown>;
};

export type JsonRpcResponse = {
   jsonrpc: '2.0';
   id: JsonRpcId;
   result?: unknown;
   error?: { code: number; message: string };
};

const ok = (id: JsonRpcId, result: unknown): JsonRpcResponse => ({ jsonrpc: '2.0', id, result });
const fail = (id: JsonRpcId, code: number, message: string): JsonRpcResponse => ({ jsonrpc: '2.0', id, error: { code, message } });

/** A tool result: MCP wants human-readable content, agents want the JSON. Send both. */
function toolContent(value: unknown, isError = false): Record<string, unknown> {
   return {
      content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
      ...(isError ? { isError: true } : { structuredContent: value }),
   };
}

/**
 * Handle one JSON-RPC message. Returns null for notifications (no response is owed),
 * which the transport turns into a bare 202.
 */
export async function handleRpc(userId: string, msg: JsonRpcRequest): Promise<JsonRpcResponse | null> {
   const method = typeof msg.method === 'string' ? msg.method : '';
   const id = msg.id ?? null;
   if (method.startsWith('notifications/')) return null;

   switch (method) {
      case 'initialize': {
         // Spec: echo the client's version when we speak it, otherwise answer with the
         // newest one we do — the client then decides whether it can continue.
         const asked = msg.params?.protocolVersion;
         const version = typeof asked === 'string' && isSupportedProtocolVersion(asked) ? asked : LATEST_PROTOCOL_VERSION;
         return ok(id, {
            protocolVersion: version,
            capabilities: { tools: { listChanged: false } },
            serverInfo: SERVER_INFO,
            instructions:
               'Read-only diagnostics for a Ranksmile account. Start with workspace__list and article__list, '
               + 'then article__score to see why an article scores low and article__optimize_log to see what Auto-Optimize did.',
         });
      }

      case 'ping':
         return ok(id, {});

      case 'tools/list':
         return ok(id, {
            tools: MCP_TOOLS.map((t) => ({
               name: t.name,
               title: t.title,
               description: t.description,
               inputSchema: t.inputSchema,
               // Declaring outputSchema lets a host generate typed stubs and run tools
               // programmatically instead of pushing every intermediate result through
               // the model's context.
               outputSchema: t.outputSchema,
               annotations: t.annotations,
            })),
         });

      case 'tools/call': {
         const name = typeof msg.params?.name === 'string' ? msg.params.name : '';
         const tool = findTool(name);
         if (!tool) return fail(id, -32602, `Unknown tool: ${name}`);
         const rawArgs = msg.params?.arguments;
         const args = rawArgs && typeof rawArgs === 'object' ? (rawArgs as Record<string, unknown>) : {};
         try {
            return ok(id, toolContent(await tool.handler(userId, args)));
         } catch (err) {
            // A bad id or a denied article is the agent's problem to fix, so it comes back
            // as a tool result it can read — not a protocol error that aborts the call.
            if (err instanceof McpToolError) return ok(id, toolContent({ error: err.message }, true));
            // Anything else is our bug, not the caller's. The detail goes to the server
            // log; the agent gets a generic message so internals do not leak outward.
            console.error(`[mcp] tool ${name} failed:`, err);
            return fail(id, -32603, 'Tool execution failed');
         }
      }

      // Declared-empty so a host that probes them gets a valid answer instead of an error.
      case 'resources/list':
         return ok(id, { resources: [] });
      case 'resources/templates/list':
         return ok(id, { resourceTemplates: [] });
      case 'prompts/list':
         return ok(id, { prompts: [] });

      default:
         return fail(id, -32601, `Method not found: ${method}`);
   }
}
