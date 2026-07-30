import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, 'public');

try {
  const env = await fs.readFile(path.join(root, '..', '.env'), 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
} catch { /* Environment variables may already be provided by the shell. */ }

const port = Number(process.env.PORT || 3000);
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  // fs.readFile() returns a Buffer. Do not JSON-encode it or browsers will
  // receive {"type":"Buffer","data":[...]} instead of the actual HTML.
  if (Buffer.isBuffer(body) || body instanceof Uint8Array) return res.end(body);
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 200_000) throw new Error('Request quá lớn.');
  }
  return JSON.parse(raw || '{}');
}

async function chat(req, res) {
  if (!process.env.OPENAI_API_KEY) return send(res, 500, { error: 'Chưa tìm thấy OPENAI_API_KEY trong file .env.' });
  const body = await readJson(req);
  const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
  const context = typeof body.context === 'string' ? body.context.slice(0, 50_000) : '';
  if (!messages.length) return send(res, 400, { error: 'Thiếu lịch sử hội thoại.' });

  const input = [
    { role: 'system', content: [{ type: 'input_text', text: 'Bạn là VLearn Tutor, trợ giảng tiếng Việt. Trả lời ngắn gọn, rõ ràng, bám sát nội dung slide được cung cấp. Nếu tài liệu không có thông tin, nói rõ và không bịa. Khi phù hợp, trích dẫn tên file và số trang.' }] },
    ...(context ? [{ role: 'user', content: [{ type: 'input_text', text: `Nội dung slide hiện có:\n${context}` }] }] : []),
    ...messages.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: [{ type: 'input_text', text: String(m.content).slice(0, 12_000) }] }))
  ];

  const upstream = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input, temperature: 0.2 })
  });
  const data = await upstream.json();
  if (!upstream.ok) return send(res, upstream.status, { error: data.error?.message || 'OpenAI API trả về lỗi.' });
  const text = data.output_text || data.output?.flatMap(x => x.content || []).map(x => x.text).filter(Boolean).join('\n') || 'Mình chưa nhận được nội dung trả lời.';
  send(res, 200, { text, model });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/chat') return await chat(req, res);
    if (req.method !== 'GET') return send(res, 405, { error: 'Method không được hỗ trợ.' });
    const requested = req.url === '/' ? 'index.html' : decodeURIComponent(req.url.slice(1));
    const file = path.resolve(publicDir, requested);
    if (!file.startsWith(path.resolve(publicDir) + path.sep)) return send(res, 403, { error: 'Forbidden' });
    const data = await fs.readFile(file);
    send(res, 200, data, mime[path.extname(file)] || 'application/octet-stream');
  } catch (error) {
    if (error.code === 'ENOENT') return send(res, 404, { error: 'Không tìm thấy trang.' });
    console.error(error);
    send(res, 500, { error: error.message || 'Lỗi máy chủ.' });
  }
});

server.listen(port, () => console.log(`VLearn đang chạy tại http://localhost:${port}`));
