"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Slide = {
  id: number;
  kicker: string;
  title: string;
  subtitle: string;
  theme: "cover" | "problem" | "cycle" | "matrix" | "metrics";
  accent: string;
  points: string[];
  imageDataUrl?: string;
  localOcrText?: string;
  localOcrWords?: string[];
  source?: "demo" | "pdf";
};

type ChatMessage = { role: "user" | "assistant"; content: string };
type SlideMemory = {
  documentId: string;
  pageNumber: number;
  ocrText: string;
  ocrWords: string[];
  visualContext: string;
};
type AnalysisState = {
  status: "idle" | "scanning" | "ready" | "error";
  memory?: SlideMemory;
};

const demoSlides: Slide[] = [
  {
    id: 1,
    kicker: "AI PRODUCT • BUỔI 05",
    title: "Tư duy sản phẩm & yêu cầu",
    subtitle: "Xây agent xong — nhưng sản phẩm này dành cho ai?",
    theme: "cover",
    accent: "#55d6c7",
    points: ["Định nghĩa đúng vấn đề", "Hiểu người học", "Đo lường giá trị"],
  },
  {
    id: 2,
    kicker: "01 • PROBLEM FIRST",
    title: "Đừng bắt đầu bằng tính năng",
    subtitle: "Một sản phẩm tốt bắt đầu từ nỗi đau đủ thật và đủ cụ thể.",
    theme: "problem",
    accent: "#ff7e67",
    points: ["Ai đang gặp vấn đề?", "Vấn đề xảy ra khi nào?", "Hậu quả nếu không giải quyết?"],
  },
  {
    id: 3,
    kicker: "02 • DISCOVERY LOOP",
    title: "Quan sát → Giả thuyết → Kiểm chứng",
    subtitle: "Mỗi vòng lặp giúp đội ngũ giảm một lớp bất định.",
    theme: "cycle",
    accent: "#58a8ff",
    points: ["Quan sát hành vi", "Đặt giả thuyết", "Thiết kế thí nghiệm", "Học từ dữ liệu"],
  },
  {
    id: 4,
    kicker: "03 • REQUIREMENT QUALITY",
    title: "Yêu cầu tốt phải kiểm thử được",
    subtitle: "Nếu chưa thể hình dung cách test, yêu cầu có thể vẫn còn mơ hồ.",
    theme: "matrix",
    accent: "#ffbf4b",
    points: ["Cụ thể", "Đo lường được", "Có ngữ cảnh", "Có tiêu chí chấp nhận"],
  },
  {
    id: 5,
    kicker: "04 • SUCCESS METRICS",
    title: "Đo đầu ra, không chỉ đo hoạt động",
    subtitle: "Số lượt dùng chỉ có ý nghĩa khi gắn với thay đổi của người học.",
    theme: "metrics",
    accent: "#55d6c7",
    points: ["Activation", "Learning outcome", "Retention", "Confidence"],
  },
];

const suggestionSets: Record<number, string[]> = {
  1: ["Tư duy sản phẩm là gì?", "Tại sao agent tốt vẫn có thể thất bại?", "Tóm tắt slide này"],
  2: ["Cho một ví dụ problem-first", "Phân biệt pain point và feature", "Đặt 3 câu hỏi discovery"],
  3: ["Giải thích vòng lặp này", "Ví dụ một giả thuyết tốt", "Khi nào nên dừng thử nghiệm?"],
  4: ["Cho ví dụ yêu cầu mơ hồ", "Viết acceptance criteria", "Testability nghĩa là gì?"],
  5: ["Outcome khác output thế nào?", "Chọn metric cho chatbot học tập", "Giải thích retention"],
};

function Icon({ children }: { children: React.ReactNode }) {
  return <span aria-hidden="true">{children}</span>;
}

function SlideArtwork({ slide, compact = false }: { slide: Slide; compact?: boolean }) {
  if (slide.imageDataUrl) {
    return (
      <div className={`slide-art uploaded-slide ${compact ? "compact" : ""}`}>
        <img src={slide.imageDataUrl} alt={`Trang ${slide.id}: ${slide.title}`} />
      </div>
    );
  }

  return (
    <div className={`slide-art slide-${slide.theme} ${compact ? "compact" : ""}`} style={{ "--accent": slide.accent } as React.CSSProperties}>
      <div className="slide-no">0{slide.id}</div>
      <div className="slide-brand"><span className="brand-gem" /> LUMI LEARNING LAB</div>
      <div className="slide-copy">
        <span className="slide-kicker">{slide.kicker}</span>
        <h2>{slide.title}</h2>
        <p>{slide.subtitle}</p>
      </div>
      {slide.theme === "cover" && (
        <div className="cover-visual" aria-hidden="true">
          <span className="orbit orbit-a" /><span className="orbit orbit-b" />
          <div className="cover-node">AI</div>
          <div className="cover-pill">WHO?</div>
        </div>
      )}
      {slide.theme === "problem" && (
        <div className="problem-visual" aria-hidden="true">
          <span>Vấn đề</span><i>→</i><span>Bối cảnh</span><i>→</i><strong>Giá trị</strong>
        </div>
      )}
      {slide.theme === "cycle" && (
        <div className="cycle-visual" aria-hidden="true">
          {slide.points.map((point, index) => <span key={point} style={{ "--i": index } as React.CSSProperties}>{index + 1}<small>{point}</small></span>)}
          <div>HỌC</div>
        </div>
      )}
      {slide.theme === "matrix" && (
        <div className="matrix-visual" aria-hidden="true">
          {slide.points.map((point, index) => <span key={point}><b>0{index + 1}</b>{point}</span>)}
        </div>
      )}
      {slide.theme === "metrics" && (
        <div className="metrics-visual" aria-hidden="true">
          {[42, 68, 84, 61].map((value, index) => <span key={value} style={{ "--h": `${value}%` } as React.CSSProperties}><i />{slide.points[index]}</span>)}
        </div>
      )}
      <div className="slide-footer">
        <span>Product Thinking 2026</span><span>lumi.edu.vn</span>
      </div>
    </div>
  );
}

function renderSlideToImage(slide: Slide) {
  if (slide.imageDataUrl) return slide.imageDataUrl;
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const gradient = ctx.createLinearGradient(0, 0, 1280, 720);
  gradient.addColorStop(0, "#071a35");
  gradient.addColorStop(1, "#123b69");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1280, 720);
  ctx.fillStyle = slide.accent;
  ctx.fillRect(80, 86, 88, 8);
  ctx.font = "600 22px Arial";
  ctx.fillText(slide.kicker, 80, 140);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 66px Arial";
  const words = slide.title.split(" ");
  let line = "";
  let y = 260;
  words.forEach((word, index) => {
    const test = `${line}${word} `;
    if (ctx.measureText(test).width > 690 && index > 0) {
      ctx.fillText(line, 80, y);
      line = `${word} `;
      y += 80;
    } else line = test;
  });
  ctx.fillText(line, 80, y);
  ctx.fillStyle = "#bed0e8";
  ctx.font = "32px Arial";
  ctx.fillText(slide.subtitle.slice(0, 62), 80, y + 80);
  ctx.fillStyle = slide.accent;
  ctx.beginPath();
  ctx.arc(1015, 324, 150, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#071a35";
  ctx.font = "800 62px Arial";
  ctx.textAlign = "center";
  ctx.fillText(slide.theme === "cover" ? "WHO?" : `0${slide.id}`, 1015, 345);
  ctx.textAlign = "left";
  ctx.fillStyle = "#dce9f7";
  ctx.font = "24px Arial";
  slide.points.forEach((point, index) => ctx.fillText(`• ${point}`, 80 + index * 280, 630));
  return canvas.toDataURL("image/jpeg", 0.86);
}

export default function Home() {
  const [slides, setSlides] = useState<Slide[]>(demoSlides);
  const [selected, setSelected] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [dark, setDark] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);
  const [analyses, setAnalyses] = useState<Record<string, AnalysisState>>({});
  const [chats, setChats] = useState<Record<string, ChatMessage[]>>({});
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState("");
  const [documentName, setDocumentName] = useState("ai-product-thinking.pdf");
  const [documentId, setDocumentId] = useState("demo:ai-product-thinking");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const slide = slides[selected];
  const slideKey = `${documentId}:${slide.id}`;
  const analysis = analyses[slideKey] ?? { status: "idle" };
  const messages = chats[slideKey] ?? [];
  const availableOcrWords = analysis.memory?.ocrWords ?? slide.localOcrWords ?? [];

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, sending]);

  const progress = useMemo(() => Math.round(((selected + 1) / slides.length) * 100), [selected, slides.length]);
  const slideSuggestions = slide.source === "pdf"
    ? ["Tóm tắt trang này", "Giải thích ý chính dễ hiểu hơn", "Tạo 3 câu hỏi ôn tập"]
    : suggestionSets[slide.id];

  const chooseSlide = (index: number) => {
    setSelected(index);
    setDraft("");
    if (window.innerWidth < 820) setSidebarOpen(false);
  };

  const uploadPdf = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setUploadError("Vui lòng chọn đúng tệp PDF.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadError("");
    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
      if (document.numPages > 80) {
        throw new Error("PDF hiện hỗ trợ tối đa 80 trang để đảm bảo trình duyệt hoạt động ổn định.");
      }

      const importedSlides: Slide[] = [];
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const localOcrText = textContent.items
          .flatMap((item) => {
            if (!("str" in item)) return [];
            const suffix = "hasEOL" in item && item.hasEOL ? "\n" : " ";
            return [`${item.str}${suffix}`];
          })
          .join("")
          .trim();
        const localOcrWords = localOcrText.match(/\S+/gu) ?? [];
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(2, 1600 / baseViewport.width);
        const viewport = page.getViewport({ scale });
        const canvas = window.document.createElement("canvas");
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("Trình duyệt không thể tạo ảnh cho trang PDF.");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        importedSlides.push({
          id: pageNumber,
          kicker: `PDF • TRANG ${pageNumber}`,
          title: `Trang ${pageNumber}`,
          subtitle: `Nguồn: ${file.name}`,
          theme: "cover",
          accent: "#55d6c7",
          points: [],
          imageDataUrl: canvas.toDataURL("image/jpeg", 0.88),
          localOcrText,
          localOcrWords,
          source: "pdf",
        });
        setUploadProgress(Math.round((pageNumber / document.numPages) * 100));
        page.cleanup();
      }

      setSlides(importedSlides);
      setDocumentName(file.name);
      setDocumentId(crypto.randomUUID());
      setSelected(0);
      setZoom(100);
      setAnalyses({});
      setChats({});
      setDraft("");
      setToast(`Đã tải ${document.numPages} trang PDF`);
      window.setTimeout(() => setToast(""), 2400);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Không thể mở tệp PDF này.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const sendMessage = async (preset?: string) => {
    const question = (preset ?? draft).trim();
    if (!question || sending) return;
    const requestSlideKey = slideKey;
    const needsScan = !analysis.memory;
    const userMessage: ChatMessage = { role: "user", content: question };
    const nextHistory = [...messages, userMessage];
    setChats((prev) => ({ ...prev, [requestSlideKey]: nextHistory }));
    setDraft("");
    setSending(true);
    if (needsScan) {
      setAnalyses((prev) => ({ ...prev, [requestSlideKey]: { status: "scanning" } }));
    }
    try {
      const response = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "chat",
          documentId,
          question,
          imageDataUrl: needsScan ? renderSlideToImage(slide) : undefined,
          localOcrText: needsScan ? slide.localOcrText : undefined,
          localOcrWords: needsScan ? slide.localOcrWords : undefined,
          slide: {
            id: slide.id,
            kicker: slide.kicker,
            title: slide.title,
            subtitle: slide.subtitle,
            theme: slide.theme,
            points: slide.points,
            source: slide.source ?? "demo",
          },
          memory: analysis.memory,
          history: nextHistory.slice(-6),
        }),
      });
      const data = await response.json() as { answer?: string; memory?: SlideMemory };
      if (!response.ok || !data.answer) throw new Error();
      if (data.memory) {
        setAnalyses((prev) => ({
          ...prev,
          [requestSlideKey]: { status: "ready", memory: data.memory },
        }));
      }
      setChats((prev) => ({
        ...prev,
        [requestSlideKey]: [...(prev[requestSlideKey] ?? []), { role: "assistant", content: data.answer! }],
      }));
    } catch {
      if (needsScan) {
        setAnalyses((prev) => ({ ...prev, [requestSlideKey]: { status: "error" } }));
      }
      setChats((prev) => ({
        ...prev,
        [requestSlideKey]: [...(prev[requestSlideKey] ?? []), {
          role: "assistant",
          content: "Mình chưa thể phân tích và trả lời slide này lúc này. Hãy thử gửi lại câu hỏi.",
        }],
      }));
    } finally {
      setSending(false);
    }
  };

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  };

  return (
    <main className={dark ? "app dark" : "app"}>
      <header className="topbar">
        <div className="brand">
          <div className="logo-mark"><span /><span /></div>
          <div><strong>Lumi Slide</strong><small>Không gian học tập theo ngữ cảnh</small></div>
        </div>
        <div className="document-title">
          <div className="file-icon">▤</div>
          <div><strong>{documentName}</strong><span>{slides.length} trang · PDF lecture materials</span></div>
        </div>
        <div className="top-actions">
          <input
            ref={fileInputRef}
            className="file-input"
            type="file"
            accept=".pdf,application/pdf"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) uploadPdf(file);
            }}
          />
          <button className="upload-top" onClick={() => fileInputRef.current?.click()}>
            <Icon>↑</Icon> Tải PDF
          </button>
          <button className="language">VI</button>
          <button onClick={() => setDark((value) => !value)} aria-label="Đổi giao diện"><Icon>{dark ? "☀" : "☾"}</Icon></button>
          <button className="avatar" aria-label="Tài khoản">AN</button>
        </div>
      </header>

      <div className={`workspace ${sidebarOpen ? "" : "sidebar-collapsed"} ${chatOpen ? "" : "chat-collapsed"}`}>
        <aside className="slide-sidebar">
          <div className="side-head">
            <div><strong>Nội dung bài học</strong><span>{slides.length} slides · 28 phút</span></div>
            <button onClick={() => setSidebarOpen(false)} aria-label="Đóng danh sách">‹</button>
          </div>
          <div className="course-progress">
            <div><span>Tiến độ bài học</span><strong>{progress}%</strong></div>
            <i><b style={{ width: `${progress}%` }} /></i>
          </div>
          <button className="upload-card" onClick={() => fileInputRef.current?.click()}>
            <span>↑</span>
            <div><strong>Tải slide của bạn</strong><small>PDF · tối đa 80 trang</small></div>
          </button>
          {uploadError && <div className="upload-error">{uploadError}</div>}
          <nav className="thumbnails" aria-label="Danh sách slide">
            {slides.map((item, index) => (
              <button key={item.id} className={selected === index ? "thumb active" : "thumb"} onClick={() => chooseSlide(index)}>
                <span className="thumb-number">{String(item.id).padStart(2, "0")}</span>
                <div className="thumb-preview"><SlideArtwork slide={item} compact /></div>
                <span className="thumb-label">{item.title}</span>
                {analyses[`${documentId}:${item.id}`]?.status === "ready" && <span className="thumb-ready">✓</span>}
              </button>
            ))}
          </nav>
          <div className="sidebar-foot"><span>◉</span><div><strong>AI đang theo dõi ngữ cảnh</strong><small>Mỗi slide có bộ nhớ riêng</small></div></div>
        </aside>

        {!sidebarOpen && <button className="open-sidebar floating-control" onClick={() => setSidebarOpen(true)} aria-label="Mở danh sách slide">▤</button>}

        <section className="viewer">
          <div className="toolbar">
            <div className="tool-group">
              <button className="active"><Icon>↖</Icon> Chọn</button>
              <button onClick={() => notify("Chế độ ghi chú sẵn sàng")}><Icon>✎</Icon> Bút</button>
              <button onClick={() => notify("Chế độ highlight sẵn sàng")}><Icon>◒</Icon> Highlight</button>
            </div>
            <div className="page-chip">Trang {slide.id} / {slides.length}</div>
            <div className="zoom-control">
              <button onClick={() => setZoom((value) => Math.max(70, value - 10))}>−</button>
              <span>{zoom}%</span>
              <button onClick={() => setZoom((value) => Math.min(130, value + 10))}>+</button>
            </div>
            <div className="tool-group right">
              <button onClick={() => notify("Đã thêm ghi chú mới")} aria-label="Thêm ghi chú">＋</button>
              <button onClick={() => notify("Đã lưu tiến độ")} aria-label="Lưu">⇩</button>
              <button onClick={() => notify("Đã sao chép liên kết slide")} aria-label="Chia sẻ">⌁</button>
            </div>
          </div>

          <div className="stage">
            <div className="stage-top"><span>SLIDE {String(slide.id).padStart(2, "0")}</span><span>{documentName}</span></div>
            <div className="slide-shell" style={{ transform: `scale(${zoom / 100})` }}>
              <SlideArtwork slide={slide} />
              {analysis.status === "scanning" && (
                <div className="scan-overlay">
                  <div className="scan-frame"><i /><i /><i /><i /></div>
                  <span className="scan-line" />
                  <div className="scan-status"><b><span className="spark">✦</span> Đang hiểu slide...</b><small>Nhận diện bố cục, biểu đồ, quan hệ và hàm ý</small></div>
                </div>
              )}
            </div>
          </div>

          <div className="viewer-footer">
            <button onClick={() => chooseSlide(Math.max(0, selected - 1))} disabled={selected === 0}>←</button>
            <div>
              <span>{String(slide.id).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}</span>
              <i><b style={{ width: `${progress}%` }} /></i>
            </div>
            <button onClick={() => chooseSlide(Math.min(slides.length - 1, selected + 1))} disabled={selected === slides.length - 1}>→</button>
          </div>
        </section>

        <aside className="tutor-panel">
          <div className="tutor-head">
            <div className="tutor-avatar"><span>✦</span></div>
            <div><strong>Lumi Tutor</strong><span><i /> Trợ giảng theo ngữ cảnh</span></div>
            <button onClick={() => setChats((prev) => ({ ...prev, [slideKey]: [] }))} aria-label="Làm mới hội thoại">↻</button>
            <button onClick={() => setChatOpen(false)} aria-label="Đóng trợ giảng">›</button>
          </div>
          <div className="context-strip">
            <span>NGỮ CẢNH HIỆN TẠI</span>
            <strong>
              Slide {slide.id}
              {availableOcrWords.length
                ? ` · ${availableOcrWords.length} từ ${analysis.memory ? "OCR" : "PDF"}`
                : ""}
            </strong>
            <em className={`status-${analysis.status}`}>
              {analysis.status === "scanning"
                ? "Đang phân tích"
                : analysis.status === "ready"
                  ? "Đã hiểu slide"
                  : analysis.status === "error"
                    ? "Cần thử lại"
                    : "Chưa quét"}
            </em>
          </div>

          <div className="conversation">
            <>
              {messages.length === 0 && (
                <>
                <div className="welcome-message">
                  <div className="mini-spark">✦</div>
                  <div>
                    <strong>
                      {analysis.status === "ready"
                        ? `Mình đã hiểu slide ${slide.id}`
                        : `Sẵn sàng đọc slide ${slide.id}`}
                    </strong>
                    <p>
                      {analysis.memory?.visualContext
                        ?? (slide.localOcrWords?.length
                          ? `Đã lấy sẵn ${slide.localOcrWords.length} từ từ PDF. Khi bạn hỏi, Lumi chỉ cần hiểu sơ đồ và trả lời.`
                          : "Hãy gửi câu hỏi đầu tiên. Lumi sẽ đọc hình ảnh và trả lời trong cùng một lượt.")}
                    </p>
                  </div>
                </div>
                <div className="suggestions">
                  <span>Có thể bạn muốn hỏi</span>
                  {slideSuggestions.map((suggestion) => (
                    <button key={suggestion} onClick={() => sendMessage(suggestion)}>{suggestion}<i>↗</i></button>
                  ))}
                </div>
                </>
              )}
              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`message ${message.role}`}>
                  {message.role === "assistant" && <span className="message-avatar">✦</span>}
                  <div>{message.content}</div>
                </div>
              ))}
              {analysis.status === "scanning" ? (
                <div className="scan-chat-card">
                  <span className="message-avatar">✦</span>
                  <div>
                    <strong>Đang hiểu slide và soạn câu trả lời</strong>
                    <p>{slide.localOcrWords?.length ? "Text PDF đã sẵn sàng · đang đọc sơ đồ" : "Đang đọc chữ và bố cục hình ảnh"}</p>
                    <div className="analysis-steps">
                      <span className={slide.localOcrWords?.length ? "done" : "active"}>Đọc nội dung</span>
                      <span className="active">Hiểu sơ đồ</span>
                      <span>Soạn trả lời</span>
                    </div>
                  </div>
                </div>
              ) : sending ? (
                <div className="message assistant"><span className="message-avatar">✦</span><div className="typing"><i /><i /><i /></div></div>
              ) : null}
              <div ref={chatEndRef} />
            </>
          </div>

          <div className="chat-input-wrap">
            <div className="context-badge">
              <span>✦</span>{" "}
              {analysis.status === "ready"
                ? `Dùng ngữ cảnh slide ${slide.id}`
                : `Sẽ quét slide ${slide.id} khi bạn gửi câu hỏi`}
            </div>
            <div className="chat-input">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={sending ? "Lumi đang đọc và trả lời..." : "Hỏi bất cứ điều gì về slide này..."}
                disabled={sending}
                rows={1}
              />
              <button onClick={() => sendMessage()} disabled={!draft.trim() || sending} aria-label="Gửi câu hỏi">➤</button>
            </div>
            <small>Enter để gửi · Shift + Enter để xuống dòng</small>
          </div>
        </aside>

        {!chatOpen && <button className="open-chat floating-control" onClick={() => setChatOpen(true)} aria-label="Mở trợ giảng">✦</button>}
      </div>
      {uploading && (
        <div className="upload-overlay" role="status" aria-live="polite">
          <div className="upload-modal">
            <div className="pdf-loader">PDF<span>↗</span></div>
            <h2>Đang chuẩn bị slide của bạn</h2>
            <p>Render từng trang thành ảnh để Lumi có thể nhìn và phân tích đầy đủ bố cục.</p>
            <div className="upload-progress"><i style={{ width: `${uploadProgress}%` }} /></div>
            <strong>{uploadProgress}%</strong>
            <small>Không đóng tab trong lúc xử lý</small>
          </div>
        </div>
      )}
      {toast && <div className="toast">✓ {toast}</div>}
    </main>
  );
}
