#!/usr/bin/env node
/**
 * Thin Cognee Cloud MCP bridge (HTTP API only).
 * Avoids uvx cognee-mcp → litellm/Rust build on Windows.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const baseUrl = (process.env.COGNEE_BASE_URL || '').replace(/\/$/, '');
const apiKey = process.env.COGNEE_API_KEY || '';

function requireEnv() {
  if (!baseUrl || !apiKey) {
    throw new Error('Set COGNEE_BASE_URL and COGNEE_API_KEY in MCP env.');
  }
}

async function cogneeFetch(path, options = {}) {
  requireEnv();
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'X-Api-Key': apiKey,
      ...(options.body && !(options.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`Cognee HTTP ${res.status}: ${typeof json === 'object' ? JSON.stringify(json) : text}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

function asText(data) {
  return {
    content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }],
  };
}

const server = new McpServer({
  name: 'cognee-cloud',
  version: '1.0.0',
});

server.tool(
  'cognee_ping',
  'Ping Cognee Cloud (list datasets). Returns 200-equivalent payload if credentials work.',
  {},
  async () => asText(await cogneeFetch('/api/v1/datasets/')),
);

server.tool(
  'cognee_list_datasets',
  'List Cognee Cloud datasets.',
  {
    session_id: z.string().optional().describe('Optional session id'),
  },
  async ({ session_id }) => {
    const q = session_id ? `?session_id=${encodeURIComponent(session_id)}` : '';
    return asText(await cogneeFetch(`/api/v1/datasets/${q}`));
  },
);

server.tool(
  'cognee_recall',
  'Recall knowledge from Cognee Cloud knowledge graph.',
  {
    query: z.string().describe('Question / search query'),
    session_id: z.string().optional(),
    dataset_name: z.string().optional().describe('e.g. surfy'),
    search_type: z
      .enum(['HYBRID_COMPLETION', 'GRAPH_COMPLETION', 'CHUNKS', 'GRAPH_SUMMARY_COMPLETION'])
      .optional(),
  },
  async ({ query, session_id, dataset_name, search_type }) => {
    const body = { query };
    if (session_id) body.session_id = session_id;
    if (dataset_name) body.dataset_name = dataset_name;
    if (search_type) body.search_type = search_type;
    return asText(
      await cogneeFetch('/api/v1/recall', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    );
  },
);

server.tool(
  'cognee_remember_entry',
  'Store a QA entry into a Cognee session (session memory).',
  {
    question: z.string(),
    answer: z.string(),
    session_id: z.string().describe('Session id for this conversation'),
    dataset_name: z.string().optional().default('default_dataset'),
  },
  async ({ question, answer, session_id, dataset_name }) =>
    asText(
      await cogneeFetch('/api/v1/remember/entry', {
        method: 'POST',
        body: JSON.stringify({
          entry: { type: 'qa', question, answer },
          dataset_name: dataset_name || 'default_dataset',
          session_id,
        }),
      }),
    ),
);

server.tool(
  'cognee_remember_text',
  'Store text permanently in the knowledge graph (file upload, no session_id).',
  {
    text: z.string().describe('Plain text / markdown to ingest'),
    filename: z.string().optional().default('memory.txt'),
    dataset_name: z.string().optional().default('surfy'),
  },
  async ({ text, filename, dataset_name }) => {
    requireEnv();
    const form = new FormData();
    const blob = new Blob([text], { type: 'text/plain' });
    form.append('data', blob, filename || 'memory.txt');
    form.append('datasetName', dataset_name || 'surfy');
    const res = await fetch(`${baseUrl}/api/v1/remember`, {
      method: 'POST',
      headers: { 'X-Api-Key': apiKey },
      body: form,
    });
    const raw = await res.text();
    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      json = { raw };
    }
    if (!res.ok) {
      throw new Error(`Cognee HTTP ${res.status}: ${raw}`);
    }
    return asText(json);
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
