import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

try {
  process.loadEnvFile(path.join(ROOT, ".env"));
} catch {
  console.warn("[env] Không đọc được .env ở root repo — cần OPENAI_API_KEY trong biến môi trường trước khi chạy.");
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const DECKS = {
  d1: {
    id: "d1",
    file: "d1-slide-hackathon.pdf",
    label: "Day 1 · AI & LLM Foundation",
    path: path.join(ROOT, "data/vlearn-pack/slides/d1-slide-hackathon.pdf")
  },
  d2: {
    id: "d2",
    file: "d2-slide-hackathon.pdf",
    label: "Day 2 · Xác định bài toán cho AI",
    path: path.join(ROOT, "data/vlearn-pack/slides/d2-slide-hackathon.pdf")
  }
};
const DECK_IDS = Object.keys(DECKS);
const DEFAULT_DECK = "d1"; // bộ đang hiển thị trong UI

// ---------- Cache: mỗi bộ slide chỉ đọc + trích text từ PDF một lần (lười tải), dùng lại cho mọi request/tool-call sau ----------
const deckCache = new Map(); // deckId -> Promise<{ id, label, pages: [{page,text}], numPages }>

async function extractDeckPages(deck) {
  const data = new Uint8Array(fs.readFileSync(deck.path));
  const doc = await pdfjsLib.getDocument({ data, useSystemFonts: true, isEvalSupported: false }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const text = content.items.map((i) => i.str).join(" ").replace(/\s+/g, " ").trim();
    pages.push({ page: p, text });
  }
  return { id: deck.id, label: deck.label, pages, numPages: doc.numPages };
}

function getDeck(deckId) {
  const deck = DECKS[deckId];
  if (!deck) return Promise.reject(new Error(`UNKNOWN_DECK_${deckId}`));
  if (!deckCache.has(deckId)) {
    console.log(`[deck-cache] Đọc "${deck.label}" (${deck.file}) lần đầu...`);
    deckCache.set(
      deckId,
      extractDeckPages(deck).then((loaded) => {
        console.log(`[deck-cache] Đã cache ${loaded.numPages} trang cho "${deck.label}".`);
        return loaded;
      })
    );
  }
  return deckCache.get(deckId);
}

function resolveDeckId(requested, fallback) {
  return DECKS[requested] ? requested : fallback;
}

// ---------- Cache trích dẫn nguồn ngoài: cùng một chủ đề luôn được cite lại y hệt, không đổi lời mỗi lần hỏi ----------
const externalCitationCache = new Map(); // normalizedTopic -> { name, note, cited_at, hits }

function normalizeTopic(topic) {
  return String(topic || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function citeExternalSource({ topic, claim }) {
  const key = normalizeTopic(topic);
  if (!key) return { error: "missing_topic" };
  if (externalCitationCache.has(key)) {
    const cached = externalCitationCache.get(key);
    cached.hits += 1;
    return { name: cached.name, note: cached.note, cached: true };
  }
  const entry = {
    name: String(topic).trim(),
    note: String(claim || "Kiến thức nền phổ biến về AI/LLM, không có trong slide.").trim(),
    cited_at: new Date().toISOString(),
    hits: 1
  };
  externalCitationCache.set(key, entry);
  return { name: entry.name, note: entry.note, cached: false };
}

// "slide 5" / "trang 12" / "page 3" / bare "5" -> số trang tường minh, KHÔNG phải từ khoá text-search.
// (Bug cũ: filter `word.length >= 2` âm thầm loại số 1 chữ số như "5"/"6", khiến "slide 5".."slide 9"
// đều rơi về tìm-chữ-"slide"-suông và luôn ra cùng 1 trang bất kể số nào được hỏi.)
function extractExplicitPageNumber(query) {
  const m = String(query || "")
    .trim()
    .match(/^(?:slide|trang|page)?\s*#?\s*(\d{1,3})$/i);
  return m ? Number(m[1]) : null;
}

function searchInPages(pages, query) {
  const explicitPage = extractExplicitPageNumber(query);
  if (explicitPage && explicitPage >= 1 && explicitPage <= pages.length) {
    const p = pages[explicitPage - 1];
    return [{ page: p.page, snippet: p.text.slice(0, 260).trim(), matched_keywords: 1, matched_as: "explicit_page_number" }];
  }

  const words = String(query || "")
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 2 || /^\d+$/.test(w));
  if (words.length === 0) return [];

  const scored = pages
    .map((p) => {
      const textNorm = p.text.toLowerCase();
      let score = 0;
      let firstIdx = -1;
      for (const word of words) {
        const idx = textNorm.indexOf(word);
        if (idx !== -1) {
          score += 1;
          if (firstIdx === -1) firstIdx = idx;
        }
      }
      return { page: p.page, score, firstIdx };
    })
    .filter((r) => r.score > 0);

  // Ưu tiên trang khớp ĐỦ mọi từ khoá (AND); chỉ rơi về khớp-một-phần nếu không có trang nào khớp đủ.
  const fullMatches = scored.filter((r) => r.score === words.length);
  const pool = (fullMatches.length > 0 ? fullMatches : scored).sort((a, b) => b.score - a.score).slice(0, 5);

  return pool.map((r) => {
    const full = pages[r.page - 1].text;
    const start = Math.max(0, r.firstIdx - 40);
    return { page: r.page, snippet: full.slice(start, start + 200).trim(), matched_keywords: r.score };
  });
}

// ---------- System prompt: quy tắc dự án (4 lớp chỗ khó + HAX/PAIR) ----------
const DECK_LIST_TEXT = Object.values(DECKS)
  .map((d) => `"${d.id}" = ${d.label}`)
  .join("; ");

const SYSTEM_PROMPT = `Bạn là VLearn Tutor — trợ lý học tập theo ngữ cảnh trong khoá AI Thực Chiến, có quyền đọc ${DECK_IDS.length} bộ slide bài giảng: ${DECK_LIST_TEXT}.

NHIỆM VỤ: giúp học viên hiểu hoặc tóm tắt đúng nội dung SLIDE đang xem (hoặc đoạn học viên vừa bôi đen), và luôn cho học viên biết câu trả lời có căn cứ ở trang/bộ slide nào để họ tự kiểm chứng lại với bài giảng.

BẠN CÓ 5 TOOL:
- list_slide_decks(): xem danh sách bộ slide đang có + số trang mỗi bộ. Chỉ gọi khi thật sự cần biết có bộ nào khác ngoài bộ đang mở (ví dụ câu hỏi có vẻ thuộc buổi học khác với slide đang xem).
- search_slides({ deck?, query }): tìm từ khoá/khái niệm trong một bộ slide (bỏ trống deck = tìm trong bộ đang mở). Dùng cho tìm khái niệm, KHÔNG dùng để tìm theo số trang — nếu đã biết rõ số trang/slide cần xem, gọi thẳng read_slide_page.
- read_slide_page({ deck?, page }): đọc TOÀN VĂN một trang cụ thể (không bị cắt ngắn như search_slides). Nếu học viên hoặc câu hỏi nêu rõ một số trang/slide cụ thể (vd "slide 5", "trang 12"), gọi tool này NGAY với page = số đó — đừng đưa số trang vào search_slides làm từ khoá.
- cite_external_source({ topic, claim }): gọi tool này TRƯỚC khi dùng source_type="external" trong final_answer, để đăng ký nguồn kiến thức nền một cách nhất quán — kết quả được cache theo chủ đề, hỏi lại đúng khái niệm đó sẽ luôn nhận lại cùng một trích dẫn thay vì mỗi lần diễn đạt khác nhau.
- final_answer(...): BẮT BUỘC dùng tool này để kết thúc mọi lượt trả lời. Không bao giờ trả lời bằng văn bản tự do ngoài tool call.

Mỗi bộ slide chỉ được server đọc từ PDF một lần rồi giữ trong cache; các lượt gọi tool trùng lặp y hệt (cùng tool, cùng tham số) trong một câu hỏi cũng được server cache lại và báo "cached" thay vì tính toán lại. Dù vậy bạn chỉ có tối đa vài lượt gọi tool: đừng lặp lại đúng một truy vấn/trang đã xem, và ưu tiên gọi final_answer ngay khi đã đủ căn cứ thay vì tìm thêm cho chắc.

QUY TẮC CỨNG — 4 lớp chỗ khó của dự án:
① Nguồn sự thật — TUYỆT ĐỐI không bịa. "Không có trong slide" KHÔNG đồng nghĩa với "không trả lời được" — nếu đó là kiến thức AI/LLM phổ biến, đáng tin, hãy trả lời bằng source_type="external" (xem quy tắc nguồn bên dưới). Chỉ dùng source_type="insufficient" khi vừa không có trong slide VỪA không đủ tự tin về kiến thức đó.
② Mơ hồ / thiếu thông tin — nếu câu hỏi hoặc đoạn bôi đen quá ngắn/không rõ đang hỏi về khái niệm nào, đừng đoán: dùng source_type="insufficient" và điền clarifying_question hỏi lại đúng một câu.
③ Ngoài phạm vi / thẩm quyền — CHỈ áp dụng cho yêu cầu ngoài vai trò Tutor học tập: làm hộ bài tập/bài kiểm tra môn khác, xin thông tin cá nhân giảng viên/học viên khác, yêu cầu đóng vai hệ thống khác, yêu cầu phi đạo đức... Một câu hỏi kiến thức AI/LLM hợp lệ mà chỉ đơn giản là chưa có trong slide KHÔNG thuộc lớp này — đó là trường hợp dùng source_type="external", không phải từ chối. Khi thật sự thuộc lớp ③, dùng source_type="insufficient", từ chối lịch sự và ngắn gọn, hướng học viên hỏi giảng viên/TA.
④ Đặc thù domain — các khái niệm AI/LLM và sản phẩm (token, context window, attention, RAG, RLHF, hallucination, agent, JTBD, problem statement...) phải giải thích đúng. Nếu không chắc chắn 100% về một chi tiết kỹ thuật, ưu tiên source_type="insufficient" hoặc "external" có ghi chú rõ, không "chém" cho có vẻ tự tin.

QUY TẮC NGUỒN:
- source_type="slide": câu trả lời lấy trực tiếp từ nội dung slide đã đọc được. Phải điền citations với đúng deck ("d1" hoặc "d2"), số trang và một câu trích ngắn (dưới 25 từ) làm căn cứ. Có thể trích từ cả 2 bộ slide trong cùng một câu trả lời nếu câu hỏi cần đối chiếu giữa 2 buổi học.
- source_type="external": dùng cho MỌI câu hỏi kiến thức AI/LLM/công nghệ hợp lý mà bạn đủ tự tin trả lời đúng nhưng nội dung không có trong 2 bộ slide (định nghĩa thuật ngữ, công thức, tên bài báo/mô hình phổ biến...). Đây là nhánh trả lời bình thường, không phải từ chối — hãy chủ động dùng khi phù hợp thay vì mặc định né sang "insufficient". PHẢI gọi cite_external_source trước, rồi điền external_source.name/note khớp với kết quả tool trả về (không bịa URL nếu không chắc).
- source_type="insufficient": chỉ dùng khi mơ hồ (②), thật sự ngoài thẩm quyền (③ đúng nghĩa), hoặc không đủ tự tin về kiến thức domain (④) — không dùng chỉ vì "không có trong slide" khi bạn thực ra biết câu trả lời.

QUY TẮC HÀNH VI (HAX/PAIR):
- Luôn điền scope_note một câu ngắn nói rõ phạm vi bạn trả lời được đến đâu, nêu rõ đã dùng bộ slide nào.
- Giải thích ngắn gọn vì sao câu trả lời đúng/kèm căn cứ, gắn với hành động tiếp theo học viên có thể làm (vd: xem lại trang X, hỏi lại rõ hơn).
- Văn phong: tiếng Việt, ngắn gọn, đúng cỡ câu hỏi, giọng thân thiện phù hợp học viên khoá AI Thực Chiến, không dùng thuật ngữ khó mà không giải thích.
- Không bao giờ khẳng định chắc chắn hơn mức bạn thực sự có căn cứ.`;

const tools = [
  {
    type: "function",
    function: {
      name: "list_slide_decks",
      description: "Liệt kê các bộ slide bài giảng hiện có (id, tên, số trang) để biết còn bộ nào khác ngoài bộ đang mở.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "search_slides",
      description:
        "Tìm từ khoá trong một bộ slide, dùng khi nội dung trang đang xem (đã cung cấp sẵn trong tin nhắn) không đủ để trả lời.",
      parameters: {
        type: "object",
        properties: {
          deck: { type: "string", enum: DECK_IDS, description: "id bộ slide cần tìm. Bỏ trống = bộ học viên đang mở." },
          query: { type: "string", description: "Từ khoá hoặc cụm từ cần tìm, ví dụ 'self-attention', 'JTBD', 'problem statement'." }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_slide_page",
      description:
        "Đọc toàn văn (không cắt ngắn) một trang cụ thể của một bộ slide — dùng khi cần đối chiếu/so sánh kỹ nội dung nhiều trang hoặc nhiều bộ slide với nhau.",
      parameters: {
        type: "object",
        properties: {
          deck: { type: "string", enum: DECK_IDS, description: "id bộ slide cần đọc. Bỏ trống = bộ học viên đang mở." },
          page: { type: "integer", description: "Số trang cần đọc toàn văn." }
        },
        required: ["page"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "cite_external_source",
      description:
        "Đăng ký một trích dẫn nguồn ngoài slide TRƯỚC khi trả lời với source_type='external'. Kết quả được cache theo chủ đề nên hỏi lại cùng khái niệm sẽ luôn ra cùng một trích dẫn.",
      parameters: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            description:
              "Tên khái niệm/nguồn kiến thức nền, ví dụ 'Kiến trúc Transformer (Vaswani et al. 2017)' hoặc 'Kiến thức phổ thông về gradient descent'. Không bịa URL cụ thể nếu không chắc."
          },
          claim: {
            type: "string",
            description: "Câu trả lời/khẳng định bạn định dùng nguồn này để hỗ trợ."
          }
        },
        required: ["topic"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "final_answer",
      description:
        "Gửi câu trả lời cuối cùng cho học viên. Bắt buộc gọi tool này để kết thúc lượt trả lời.",
      parameters: {
        type: "object",
        properties: {
          source_type: {
            type: "string",
            enum: ["slide", "external", "insufficient"],
            description:
              "slide = có căn cứ trực tiếp trong slide; external = dùng kiến thức nền ngoài slide; insufficient = không đủ căn cứ đáng tin, không nên đoán."
          },
          answer: { type: "string", description: "Câu trả lời tiếng Việt, ngắn gọn, đúng cỡ câu hỏi." },
          citations: {
            type: "array",
            description: "Bắt buộc có ≥1 phần tử khi source_type = 'slide'. Có thể trộn cả deck 'd1' và 'd2'.",
            items: {
              type: "object",
              properties: {
                deck: { type: "string", enum: DECK_IDS, description: "Bộ slide chứa căn cứ. Bỏ trống = bộ đang mở." },
                page: { type: "integer", description: "Số trang trong bộ slide đó." },
                quote: { type: "string", description: "Trích ngắn nguyên văn làm căn cứ (dưới 25 từ)." }
              },
              required: ["page", "quote"]
            }
          },
          external_source: {
            type: "object",
            description: "Bắt buộc điền khi source_type = 'external'.",
            properties: {
              name: { type: "string", description: "Tên nguồn/khái niệm kiến thức nền, không bịa URL nếu không chắc." },
              note: { type: "string", description: "Vì sao cần dùng nguồn ngoài slide." }
            }
          },
          clarifying_question: {
            type: "string",
            description: "Chỉ điền khi source_type = 'insufficient' và nguyên nhân là câu hỏi/đoạn bôi đen chưa đủ rõ."
          },
          scope_note: {
            type: "string",
            description: "Một câu ngắn nói rõ phạm vi trả lời được đến đâu, và đã dùng bộ slide nào."
          }
        },
        required: ["source_type", "answer"]
      }
    }
  }
];

async function callOpenAI(messages, forceFinal) {
  if (!OPENAI_API_KEY) {
    throw new Error("MISSING_API_KEY");
  }
  const body = {
    model: MODEL,
    messages,
    tools,
    tool_choice: forceFinal ? { type: "function", function: { name: "final_answer" } } : "auto",
    temperature: 0.2
  };
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OPENAI_HTTP_${response.status}: ${errText.slice(0, 500)}`);
  }
  return response.json();
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-6)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1000) }));
}

// Key ổn định cho một lời gọi tool (tên + tham số) — dùng để cache lại kết quả trong CÙNG một câu hỏi,
// tránh gọi lại y hệt (VD: đọc trang 22 hai lần) tốn thêm lượt round-trip với model.
function canonicalToolKey(name, args) {
  const entries = Object.entries(args || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => [k, String(v).toLowerCase().trim()])
    .sort(([a], [b]) => a.localeCompare(b));
  return `${name}::${JSON.stringify(entries)}`;
}

const MAX_TOOL_ROUNDS = 6;

async function answerQuestion({ question, page, selection, history }) {
  const deckId = DEFAULT_DECK; // UI hiện chỉ hiển thị bộ Day 1; AI có thể tự mở rộng sang bộ khác qua tool
  const deck = await getDeck(deckId);
  const pageNum = Number.isInteger(page) && page >= 1 && page <= deck.pages.length ? page : 1;
  const currentPageText = deck.pages[pageNum - 1]?.text || "(không đọc được nội dung trang này)";
  const neighborPages = [pageNum - 1, pageNum + 1].filter((p) => p >= 1 && p <= deck.pages.length);
  const neighborText = neighborPages.map((p) => `[Trang ${p}] ${deck.pages[p - 1].text}`).join("\n\n");

  const contextParts = [
    `Học viên đang xem Trang ${pageNum}/${deck.pages.length} của bộ slide "${deck.label}" (deck id = "${deck.id}").`,
    `NỘI DUNG TRANG ${pageNum} (đọc trực tiếp từ PDF):\n"""${currentPageText}"""`
  ];
  if (neighborText) {
    contextParts.push(`NỘI DUNG TRANG LÂN CẬN CÙNG BỘ (tham khảo thêm nếu câu hỏi có thể thuộc trang này):\n"""${neighborText}"""`);
  }
  if (selection && String(selection).trim()) {
    contextParts.push(`Học viên vừa BÔI ĐEN đoạn sau trên Trang ${pageNum} (deck "${deck.id}"):\n"""${String(selection).trim()}"""`);
  }
  contextParts.push(`Câu hỏi của học viên: ${question.trim()}`);

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...sanitizeHistory(history),
    { role: "user", content: contextParts.join("\n\n") }
  ];

  const trace = [];
  const toolCallCache = new Map(); // key(tool+args) -> { traceEntry, content } — cache trong phạm vi 1 câu hỏi
  let finalArgs = null;
  let round = 0;

  while (round < MAX_TOOL_ROUNDS && !finalArgs) {
    const forceFinal = round === MAX_TOOL_ROUNDS - 1;
    const completion = await callOpenAI(messages, forceFinal);
    const msg = completion.choices?.[0]?.message;
    if (!msg) throw new Error("OPENAI_NO_MESSAGE");

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      messages.push(msg);
      for (const call of msg.tool_calls) {
        const name = call.function.name;
        let args = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          args = {};
        }

        if (name === "final_answer") {
          if (!finalArgs) {
            try {
              finalArgs = JSON.parse(call.function.arguments || "{}");
            } catch {
              throw new Error("OPENAI_BAD_FINAL_ANSWER_JSON");
            }
            trace.push({ tool: "final_answer", args: finalArgs });
          }
          messages.push({ role: "tool", tool_call_id: call.id, content: "ok" });
          continue;
        }

        const cacheKey = canonicalToolKey(name, args);
        const cachedCall = toolCallCache.get(cacheKey);
        if (cachedCall) {
          trace.push({ ...cachedCall.traceEntry, cached: true });
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ ...JSON.parse(cachedCall.content), note: "Kết quả giống hệt lượt gọi trước — không có thông tin mới." })
          });
          continue;
        }

        let traceEntry;
        let content;

        if (name === "list_slide_decks") {
          const decksLoaded = await Promise.all(DECK_IDS.map((id) => getDeck(id)));
          const listing = decksLoaded.map((d) => ({ deck: d.id, label: d.label, num_pages: d.numPages }));
          traceEntry = { tool: "list_slide_decks" };
          content = JSON.stringify({ decks: listing });
        } else if (name === "search_slides") {
          const targetDeckId = resolveDeckId(args.deck, deckId);
          const targetDeck = await getDeck(targetDeckId);
          const results = searchInPages(targetDeck.pages, args.query);
          traceEntry = { tool: "search_slides", deck: targetDeckId, query: args.query, result_pages: results.map((r) => r.page) };
          content = JSON.stringify({ deck: targetDeckId, results });
        } else if (name === "read_slide_page") {
          const targetDeckId = resolveDeckId(args.deck, deckId);
          const targetDeck = await getDeck(targetDeckId);
          const p = Number.isInteger(args.page) ? args.page : null;
          const found = p && p >= 1 && p <= targetDeck.pages.length ? targetDeck.pages[p - 1] : null;
          traceEntry = { tool: "read_slide_page", deck: targetDeckId, page: p, found: Boolean(found) };
          content = found
            ? JSON.stringify({ deck: targetDeckId, page: found.page, text: found.text })
            : JSON.stringify({ error: `page_not_found (bộ "${targetDeckId}" có ${targetDeck.pages.length} trang)` });
        } else if (name === "cite_external_source") {
          const cited = citeExternalSource({ topic: args.topic, claim: args.claim });
          traceEntry = { tool: "cite_external_source", topic: args.topic, reused_citation: Boolean(cited.cached) };
          content = JSON.stringify(cited);
        } else {
          traceEntry = { tool: name, unknown: true };
          content = JSON.stringify({ error: "unknown tool" });
        }

        toolCallCache.set(cacheKey, { traceEntry, content });
        trace.push(traceEntry);
        messages.push({ role: "tool", tool_call_id: call.id, content });
      }
    } else if (msg.content) {
      messages.push(msg);
      messages.push({
        role: "user",
        content: "Hãy gọi tool final_answer để trả lời có cấu trúc — không trả lời bằng văn bản tự do."
      });
    } else {
      break;
    }
    round++;
  }

  if (!finalArgs) {
    finalArgs = {
      source_type: "insufficient",
      answer: "Mình chưa xác định chắc chắn được câu trả lời có căn cứ trong slide sau vài lượt thử. Bạn hỏi cụ thể hơn giúp mình nhé.",
      clarifying_question: "Bạn có thể nói rõ hơn bạn đang hỏi về phần nào trong slide không?",
      scope_note: `Mình trả lời dựa trên bộ slide "${deck.label}" (${deck.pages.length} trang) đang mở.`
    };
  }

  // An toàn phòng model quên gọi cite_external_source dù prompt yêu cầu: server tự đăng ký/chuẩn hoá
  // citation ngoài slide vào cache, đảm bảo tính nhất quán không phụ thuộc việc model có tuân thủ hay không.
  if (finalArgs.source_type === "external" && finalArgs.external_source?.name) {
    const alreadyCited = trace.some((t) => t.tool === "cite_external_source" && normalizeTopic(t.topic) === normalizeTopic(finalArgs.external_source.name));
    if (!alreadyCited) {
      const cited = citeExternalSource({ topic: finalArgs.external_source.name, claim: finalArgs.external_source.note || finalArgs.answer });
      finalArgs.external_source = { name: cited.name, note: cited.note };
      trace.push({ tool: "cite_external_source", topic: cited.name, reused_citation: Boolean(cited.cached), auto: true });
    }
  }

  return { result: finalArgs, page: pageNum, deck: deckId, trace };
}

// ---------------------- HTTP server ----------------------
const app = express();
app.use(express.json({ limit: "200kb" }));

for (const deck of Object.values(DECKS)) {
  app.get(`/slides/${deck.file}`, (req, res) => {
    res.sendFile(deck.path, { headers: { "Content-Type": "application/pdf" } }, (err) => {
      if (err) res.status(404).send("Không tìm thấy tài liệu.");
    });
  });
}

app.use("/vendor/pdfjs", express.static(path.join(__dirname, "node_modules/pdfjs-dist/build")));
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/chat", async (req, res) => {
  const { question, page, selection, history } = req.body || {};
  if (typeof question !== "string" || !question.trim()) {
    return res.status(400).json({ error: "Thiếu câu hỏi." });
  }
  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: "Server chưa cấu hình OPENAI_API_KEY (.env)." });
  }
  try {
    const data = await answerQuestion({ question, page, selection, history });
    res.json(data);
  } catch (err) {
    console.error("[/api/chat]", err);
    res.status(502).json({ error: "Không gọi được AI lúc này. Thử lại sau." });
  }
});

const port = Number(process.env.PORT || 4176);

getDeck(DEFAULT_DECK)
  .then((deck) => {
    app.listen(port, () => {
      console.log(`CP3-test: http://localhost:${port}`);
      console.log(`Đã đọc & cache ${deck.pages.length} trang từ "${deck.label}" (mặc định).`);
      console.log(`Các bộ khác (${DECK_IDS.filter((id) => id !== DEFAULT_DECK).join(", ")}) sẽ được đọc + cache khi AI cần tới qua tool.`);
      if (!OPENAI_API_KEY) {
        console.warn("[env] Thiếu OPENAI_API_KEY — /api/chat sẽ trả lỗi cho tới khi có key trong .env ở root repo.");
      }
    });
  })
  .catch((err) => {
    console.error(`Không đọc được bộ slide mặc định (${DEFAULT_DECK}):`, err);
    process.exit(1);
  });
