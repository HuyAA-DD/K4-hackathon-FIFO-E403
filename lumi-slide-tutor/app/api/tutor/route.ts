type SlidePayload = {
  id: number;
  kicker: string;
  title: string;
  subtitle: string;
  points: string[];
  theme: string;
  source?: "demo" | "pdf";
};

type SlideMemory = {
  documentId: string;
  pageNumber: number;
  ocrText: string;
  ocrWords: string[];
  visualContext: string;
};

type FirstTurnResult = {
  memory: SlideMemory;
  answer: string;
};

const demoContexts: Record<number, string> = {
  1: "Slide mở đầu đặt câu hỏi trung tâm của tư duy sản phẩm AI: xây được agent mới chỉ chứng minh tính khả thi kỹ thuật; đội ngũ còn phải xác định người dùng, vấn đề và giá trị học tập cần tạo ra.",
  2: "Slide trình bày nguyên tắc problem-first. Cần làm rõ người gặp vấn đề, bối cảnh xuất hiện và hậu quả trước khi đề xuất tính năng.",
  3: "Sơ đồ thể hiện vòng lặp khám phá: quan sát, đặt giả thuyết, thiết kế thí nghiệm và học từ dữ liệu.",
  4: "Slide liên hệ chất lượng yêu cầu với khả năng kiểm thử: cụ thể, đo lường được, có bối cảnh và tiêu chí chấp nhận.",
  5: "Biểu đồ nhấn mạnh đo outcome thay vì chỉ output qua activation, learning outcome, retention và confidence.",
};

function outputText(response: unknown) {
  const body = response as {
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
  return body.output
    ?.flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text")
    .map((item) => item.text ?? "")
    .join("\n")
    .trim() || null;
}

async function callOpenAI(input: unknown, maxOutputTokens = 700) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
      input,
      reasoning: { effort: "low" },
      text: { verbosity: "low" },
      max_output_tokens: maxOutputTokens,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${detail.slice(0, 800)}`);
  }

  return outputText(await response.json());
}

function stripJsonFence(raw: string) {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function tokenize(text: string) {
  return text.match(/\S+/gu) ?? [];
}

async function analyzeAndAnswerFirstTurn(args: {
  imageDataUrl: string;
  documentId: string;
  pageNumber: number;
  question: string;
  localOcrText?: string;
  localOcrWords?: string[];
}): Promise<FirstTurnResult | null> {
  const hasLocalOcr = Boolean(args.localOcrWords?.length);
  const trustedOcr = hasLocalOcr
    ? `PDF_TEXT_LAYER_WORDS:\n${JSON.stringify(args.localOcrWords)}`
    : "PDF_TEXT_LAYER_WORDS: unavailable; perform faithful OCR from the image.";

  const prompt = `Phân tích duy nhất hình ảnh slide được cung cấp và trả lời câu hỏi trong cùng một lần.

${trustedOcr}

QUESTION:
${args.question}

Trả về đúng một JSON object, không markdown:
{
  "ocrText": "chỉ điền khi PDF_TEXT_LAYER_WORDS unavailable; nếu đã có text layer thì để chuỗi rỗng",
  "visualContext": "mô tả ngắn chủ đề, bố cục, sơ đồ, biểu đồ và quan hệ không gian",
  "answer": "câu trả lời trực tiếp bằng tiếng Việt, tối đa 180 từ"
}

Quy tắc:
- Nếu có PDF_TEXT_LAYER_WORDS, xem đó là bằng chứng chữ nguyên văn và không tự sửa từ.
- Nếu không có text layer, OCR trung thành với ảnh; không đoán chữ không đọc được.
- Chỉ dùng nội dung của ảnh và text layer hiện tại, không dùng slide hoặc reasoning trước.
- Phân biệt điều nhìn thấy với giải thích bổ sung.`;

  const raw = await callOpenAI([{
      role: "user",
      content: [
        { type: "input_text", text: prompt },
        {
          type: "input_image",
          image_url: args.imageDataUrl,
          detail: hasLocalOcr ? "auto" : "original",
        },
      ],
  }], 1400);

  if (!raw) return null;

  let ocrText = args.localOcrText?.trim() ?? "";
  let visualContext = "";
  let answer = "";
  try {
    const parsed = JSON.parse(stripJsonFence(raw)) as {
      ocrText?: unknown;
      visualContext?: unknown;
      answer?: unknown;
    };
    if (!ocrText && typeof parsed.ocrText === "string") ocrText = parsed.ocrText.trim();
    if (typeof parsed.visualContext === "string") visualContext = parsed.visualContext.trim();
    if (typeof parsed.answer === "string") answer = parsed.answer.trim();
  } catch {
    visualContext = "Model đã đọc trực tiếp hình ảnh của slide hiện tại.";
    answer = raw.trim();
  }

  const ocrWords = hasLocalOcr ? args.localOcrWords! : tokenize(ocrText);
  return {
    memory: {
      documentId: args.documentId,
      pageNumber: args.pageNumber,
      ocrText,
      ocrWords,
      visualContext,
    },
    answer,
  };
}

function buildFallbackMemory(args: {
  documentId: string;
  slide: SlidePayload;
  localOcrText?: string;
  localOcrWords?: string[];
}): SlideMemory {
  return {
    documentId: args.documentId,
    pageNumber: args.slide.id,
    ocrText: args.localOcrText?.trim() ?? "",
    ocrWords: args.localOcrWords ?? tokenize(args.localOcrText ?? ""),
    visualContext: args.slide.source === "demo"
      ? demoContexts[args.slide.id] ?? `Slide ${args.slide.id}: ${args.slide.title}`
      : `Trang ${args.slide.id} của tài liệu PDF ${args.slide.subtitle}.`,
  };
}

function memoryPrompt(memory: SlideMemory) {
  return `Bạn là Lumi Tutor, trợ giảng cho sinh viên Việt Nam.

Chỉ sử dụng bộ nhớ của đúng tài liệu và trang hiện tại. Không dùng nội dung từ trang khác, tài liệu khác hoặc reasoning trước đó.

DOCUMENT_ID: ${memory.documentId}
PAGE_NUMBER: ${memory.pageNumber}
OCR_WORDS_IN_READING_ORDER:
${JSON.stringify(memory.ocrWords)}

VISUAL_CONTEXT:
${memory.visualContext}

Quy tắc:
- Dùng OCR_WORDS làm bằng chứng chữ nguyên văn.
- Dùng VISUAL_CONTEXT để hiểu sơ đồ và quan hệ không gian.
- Nếu bằng chứng không đủ, nói rõ giới hạn; không lấy thông tin từ slide khác.
- Trả lời trực tiếp, dễ học, tối đa 180 từ.`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      action: "chat";
      documentId: string;
      imageDataUrl?: string;
      localOcrText?: string;
      localOcrWords?: string[];
      slide: SlidePayload;
      memory?: SlideMemory;
      question?: string;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
    };

    const question = body.question?.trim() ?? "";
    const memoryMatchesCurrentSlide =
      body.memory?.documentId === body.documentId
      && body.memory?.pageNumber === body.slide.id;

    let memory = memoryMatchesCurrentSlide ? body.memory : undefined;
    let answer = "";
    let scannedNow = false;
    let liveMode = false;

    if (!memory && body.imageDataUrl) {
      const firstTurn = await analyzeAndAnswerFirstTurn({
        imageDataUrl: body.imageDataUrl,
        documentId: body.documentId,
        pageNumber: body.slide.id,
        question,
        localOcrText: body.localOcrText,
        localOcrWords: body.localOcrWords,
      });
      if (firstTurn) {
        memory = firstTurn.memory;
        answer = firstTurn.answer;
        liveMode = true;
      }
      scannedNow = true;
    }

    memory ??= buildFallbackMemory({
      documentId: body.documentId,
      slide: body.slide,
      localOcrText: body.localOcrText,
      localOcrWords: body.localOcrWords,
    });

    if (!answer) {
      const history = (body.history ?? []).slice(-6).map((message) => ({
        role: message.role,
        content: message.content,
      }));
      const live = await callOpenAI([
        { role: "developer", content: memoryPrompt(memory) },
        ...history,
      ]);
      if (live) {
        answer = live;
        liveMode = true;
      }
    }

    if (!answer) {
      answer = `Dựa trên trang ${body.slide.id}: ${memory.visualContext}\n\nCâu hỏi: “${question}”`;
    }

    return Response.json({
      answer,
      memory,
      scannedNow,
      mode: liveMode ? "live" : "demo",
    });
  } catch (error) {
    console.error("[tutor-api]", error instanceof Error ? error.message : "Unknown error");
    return Response.json(
      { error: error instanceof Error ? error.message : "Đã có lỗi xảy ra" },
      { status: 500 },
    );
  }
}
