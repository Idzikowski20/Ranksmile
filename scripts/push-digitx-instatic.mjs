import fs from 'node:fs';

const payload = JSON.parse(fs.readFileSync('scripts/digitx-instatic-payload.json', 'utf8'));

const res = await fetch('https://instatic-latest.onrender.com/_instatic/mcp', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    Authorization: 'Bearer imcp_ZWabUT50NzJ0JyKsxREG8HkgsENHe_VzpUveB-TK5vA',
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'site_replace_node_html',
      arguments: {
        nodeId: payload.parentId,
        html: payload.html,
      },
    },
  }),
});

const text = await res.text();
console.log(res.status);
console.log(text.slice(0, 8000));
