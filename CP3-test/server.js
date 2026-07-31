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
const DECK_PATH = path.join(ROOT, "data/vlearn-pack/slides/d1-slide-hackathon.pdf");
const DECK_LABEL = "d1-slide-hackathon.pdf · Day 1 AI & LLM Foundation";

// ---------- Slide deck: đọc text thật từ PDF một lần khi khởi động server ----------
let pages = [];
async function loadDeck() {
  const data = new Uint8Array(fs.readFileSync(DECK_PATH));
  const doc = await pdfjsLib.getDocument({ data, useSystemFonts: true, isEvalSupported: false }).promise;
  const out = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const text = content.items.map((i) => i.str).join(" ").replace(/\s+/g, " ").trim();
    out.push({ page: p, text });
  }
  return out;
}

function searchSlides(query, deckPages) {
  const words = String(query || "").toLowerCase().split(/\s+/).filter((w) => w.length >= 2);
  if (words.length === 0) return [];
  const scored = deckPages
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
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return scored.map((r) => {
    const full = deckPages[r.page - 1].text;
    const start = Math.max(0, r.firstIdx - 40);
    return { page: r.page, snippet: full.slice(start, start + 200).trim(), matched_keywords: r.score };
  });
}

// ---------- System prompt: quy tắc dự án (4 lớp chỗ khó + HAX/PAIR) ----------
const SYSTEM_PROMPT = `Bạn là VLearn Tutor — trợ lý học tập theo ngữ cảnh trong buổi học "${DECK_LABEL}" của khoá AI Thực Chiến.

NHIỆM VỤ: giúp học viên hiểu hoặc tóm tắt đúng nội dung SLIDE đang xem (hoặc đoạn học viên vừa bôi đen), và luôn cho học viên biết câu trả lời có căn cứ ở đâu để họ tự kiểm chứng lại với bài giảng.

BẠN CÓ 2 TOOL:
- search_slides(query): tìm từ khoá trên toàn bộ 29 trang của bộ slide khi nội dung trang hiện tại (đã được cung cấp sẵn trong tin nhắn) không đủ để trả lời hoặc câu hỏi rõ ràng thuộc trang khác. Không gọi lại với cùng một từ khoá đã thử — nếu lượt trước đã ra đủ trang liên quan thì gọi final_answer ngay, đừng tìm thêm cho chắc.
- final_answer(...): BẮT BUỘC dùng tool này để kết thúc mọi lượt trả lời. Không bao giờ trả lời bằng văn bản tự do ngoài tool call. Bạn chỉ có tối đa vài lượt gọi tool — ưu tiên kết luận sớm khi đã đủ căn cứ thay vì tìm kiếm thêm.

QUY TẮC CỨNG — 4 lớp chỗ khó của dự án:
① Nguồn sự thật — TUYỆT ĐỐI không bịa nội dung không có trong slide và không có trong kiến thức nền đáng tin. Nếu đọc hết trang hiện tại + đã search_slides mà vẫn không thấy căn cứ, dùng source_type="insufficient", nói rõ là không tìm thấy trong slide, không suy diễn liều.
② Mơ hồ / thiếu thông tin — nếu câu hỏi hoặc đoạn bôi đen quá ngắn/không rõ đang hỏi về khái niệm nào, đừng đoán: dùng source_type="insufficient" và điền clarifying_question hỏi lại đúng một câu.
③ Ngoài phạm vi / thẩm quyền — nếu học viên hỏi thứ ngoài nội dung bài giảng (làm hộ bài tập/bài kiểm tra môn khác, xin thông tin cá nhân giảng viên/học viên khác, yêu cầu bạn đóng vai hệ thống khác...), dùng source_type="insufficient", từ chối lịch sự và ngắn gọn, hướng học viên hỏi giảng viên/TA, không suy diễn thêm ngoài phạm vi cho phép.
④ Đặc thù domain — các khái niệm AI/LLM (token, context window, attention, RAG, RLHF, hallucination, agent...) phải giải thích đúng. Nếu không chắc chắn 100% về một chi tiết kỹ thuật và slide không nói rõ, ưu tiên source_type="insufficient" hoặc "external" có ghi chú rõ, không "chém" cho có vẻ tự tin.

QUY TẮC NGUỒN:
- source_type="slide": câu trả lời lấy trực tiếp từ nội dung slide đã đọc được (trang hiện tại hoặc từ kết quả search_slides). Phải điền citations với đúng số trang và một câu trích ngắn (dưới 25 từ) làm căn cứ.
- source_type="external": bạn dùng kiến thức nền ngoài slide để trả lời (ví dụ giải thích thêm khái niệm phổ thông về AI). Phải điền external_source.name (tên khái niệm/nguồn, không bịa URL cụ thể nếu không chắc chắn) và external_source.note giải thích vì sao cần dùng nguồn ngoài.
- source_type="insufficient": không có đủ căn cứ đáng tin (bất kể vì lớp ①②③④ nào) — nói rõ giới hạn thay vì đoán.

QUY TẮC HÀNH VI (HAX/PAIR):
- Luôn điền scope_note một câu ngắn nói rõ phạm vi bạn trả lời được đến đâu (ví dụ: "Mình trả lời dựa trên nội dung slide Day 1 đang mở.").
- Giải thích ngắn gọn vì sao câu trả lời đúng/kèm căn cứ, gắn với hành động tiếp theo học viên có thể làm (vd: xem lại trang X, hỏi lại rõ hơn).
- Văn phong: tiếng Việt, ngắn gọn, đúng cỡ câu hỏi (không viết dài hơn cần thiết), giọng thân thiện phù hợp học viên khoá AI Thực Chiến, không dùng thuật ngữ khó mà không giải thích.
- Không bao giờ khẳng định chắc chắn hơn mức bạn thực sự có căn cứ.`;

const tools = [
  {
    type: "function",
    function: {
      name: "search_slides",
      description:
        "Tìm từ khoá trong toàn bộ 29 trang của bộ slide Day 1 AI & LLM Foundation, dùng khi nội dung trang đang xem không đủ để trả lời câu hỏi.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Từ khoá hoặc cụm từ cần tìm, ví dụ 'self-attention', 'RLHF', 'context window'."
          }
        },
        required: ["query"]
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
            description: "Bắt buộc có ≥1 phần tử khi source_type = 'slide'.",
            items: {
              type: "object",
              properties: {
                page: { type: "integer", description: "Số trang trong d1-slide-hackathon.pdf (1-29)." },
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
            description: "Một câu ngắn nói rõ phạm vi trả lời được đến đâu."
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

const MAX_TOOL_ROUNDS = 5;

async function answerQuestion({ question, page, selection, history }) {
  const pageNum = Number.isInteger(page) && page >= 1 && page <= pages.length ? page : 1;
  const currentPageText = pages[pageNum - 1]?.text || "(không đọc được nội dung trang này)";
  const neighborPages = [pageNum - 1, pageNum + 1].filter((p) => p >= 1 && p <= pages.length);
  const neighborText = neighborPages
    .map((p) => `[Trang ${p}] ${pages[p - 1].text}`)
    .join("\n\n");

  const contextParts = [
    `Học viên đang xem Trang ${pageNum}/${pages.length} của ${DECK_LABEL}.`,
    `NỘI DUNG TRANG ${pageNum} (đọc trực tiếp từ PDF):\n"""${currentPageText}"""`
  ];
  if (neighborText) {
    contextParts.push(`NỘI DUNG TRANG LÂN CẬN (tham khảo thêm nếu câu hỏi có thể thuộc trang này):\n"""${neighborText}"""`);
  }
  if (selection && String(selection).trim()) {
    contextParts.push(`Học viên vừa BÔI ĐEN đoạn sau trên Trang ${pageNum}:\n"""${String(selection).trim()}"""`);
  }
  contextParts.push(`Câu hỏi của học viên: ${question.trim()}`);

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...sanitizeHistory(history),
    { role: "user", content: contextParts.join("\n\n") }
  ];

  const trace = [];
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
        if (call.function.name === "search_slides") {
          let args = {};
          try {
            args = JSON.parse(call.function.arguments || "{}");
          } catch {
            args = {};
          }
          const results = searchSlides(args.query, pages);
          trace.push({ tool: "search_slides", query: args.query, result_pages: results.map((r) => r.page) });
          messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ results }) });
        } else if (call.function.name === "final_answer") {
          if (!finalArgs) {
            try {
              finalArgs = JSON.parse(call.function.arguments || "{}");
            } catch {
              throw new Error("OPENAI_BAD_FINAL_ANSWER_JSON");
            }
            trace.push({ tool: "final_answer", args: finalArgs });
          }
          messages.push({ role: "tool", tool_call_id: call.id, content: "ok" });
        } else {
          messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ error: "unknown tool" }) });
        }
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
      scope_note: `Mình trả lời dựa trên slide Day 1 (${pages.length} trang) đang mở.`
    };
  }

  return { result: finalArgs, page: pageNum, trace };
}

// ---------------------- HTTP server ----------------------
const app = express();
app.use(express.json({ limit: "200kb" }));

app.get("/slides/d1-slide-hackathon.pdf", (req, res) => {
  res.sendFile(DECK_PATH, { headers: { "Content-Type": "application/pdf" } }, (err) => {
    if (err) res.status(404).send("Không tìm thấy tài liệu.");
  });
});

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

loadDeck()
  .then((loaded) => {
    pages = loaded;
    app.listen(port, () => {
      console.log(`CP3-test: http://localhost:${port}`);
      console.log(`Đã đọc ${pages.length} trang slide từ ${DECK_LABEL}.`);
      if (!OPENAI_API_KEY) {
        console.warn("[env] Thiếu OPENAI_API_KEY — /api/chat sẽ trả lỗi cho tới khi có key trong .env ở root repo.");
      }
    });
  })
  .catch((err) => {
    console.error("Không đọc được bộ slide Day 1:", err);
    process.exit(1);
  });
