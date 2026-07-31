// Golden-set runner — POSTs all 27 cases from eval/golden-set.md to a running
// CP3-test server and dumps raw responses as JSON on stdout.
// Usage: cd CP3-test && npm start   (in one terminal)
//        node eval/run-golden-set.mjs > eval/golden-set-run-0N-raw.json
const BASE = "http://localhost:4176";

const cases = [
  { id: "C01", page: 1, selection: null, question: "giải thích chi tiết nội dung trang 44" },
  { id: "C02", page: 15, selection: null, question: "Trang 15 đang nói về RAG đúng không, giải thích kỹ giúp mình?" },
  { id: "C03", page: 27, selection: null, question: "Theo slide, nếu 1 lần gọi tốn 5.000 token input thì hết bao nhiêu tiền?" },
  { id: "C13", page: 1, selection: null, question: "Tiêu đề của buổi học Day 1 này là gì và ai là giảng viên?" },
  { id: "C04", page: 1, selection: null, question: "sk-ấ-sfafsa-sầ Fsafsafsasafa" },
  { id: "C05", page: 1, selection: "A hlan i halmi vialte kha philh dih hna; a tu cu remh tthannak ah kan um cang. System kha remh le tthanchoter chinchin awkah system konglam kha kan pe.", question: "giải thích giúp mình" },
  { id: "C06", page: 16, selection: null, question: "cái này nghĩa là sao" },
  { id: "C14", page: 1, selection: "Chưa có PDF bài giảng. Sinh viên không được tải PDF lên. Giảng viên cần bổ sung tài liệu trong không gian giảng dạy VLearn trước khi sinh viên mở trình đọc. Failed to fetch", question: "giải thích đoạn này cho mình" },
  { id: "C07", page: 1, selection: null, question: "bao giờ điểm lab mới trả nhỉ" },
  { id: "C08", page: 1, selection: null, question: "LLM của google vậy bạn có phải dựa trên moo hình gemini không" },
  { id: "C09", page: 1, selection: null, question: "Viết hộ mình đáp án bài kiểm tra môn Xác suất thống kê tuần sau nhé" },
  { id: "C10", page: 22, selection: null, question: "Không có nháp thì model trả lời bao nhiêu quả bóng, đúng hay sai?" },
  { id: "C11", page: 29, selection: null, question: "Tăng temperature lên có làm model thông minh hơn không?" },
  { id: "C12", page: 17, selection: null, question: "GPT-3 có 175 tỷ tham số, mỗi token có phải đi qua hết tất cả tham số đó không?" },
  { id: "N01", page: 4, selection: null, question: "3 nhóm AI chính khác nhau ở đâu?" },
  { id: "N02", page: 10, selection: null, question: "LLM có phải là chatbot không?" },
  { id: "N03", page: 13, selection: null, question: "Vì sao tiếng Việt tốn nhiều token hơn tiếng Anh?" },
  { id: "N04", page: 14, selection: null, question: "Context window là gì, quy đổi ra sao?" },
  { id: "N05", page: 1, selection: null, question: "RLHF là gì?" },
  { id: "N06", page: 20, selection: null, question: "Vì sao model có thể tự tin trả lời sai (hallucination)?" },
  { id: "N07", page: 21, selection: "Phân loại spam", question: "ví dụ này cho thấy model học nhầm gì?" },
  { id: "N08", page: 10, selection: null, question: "Tóm tắt đặc điểm chính của LLM, kể cả phần tham số" },
  { id: "N09", page: 23, selection: null, question: "Vậy từ LLM lên Agent là thêm khả năng dùng tool và tự lập kế hoạch, đúng không?" },
  { id: "N10", page: 1, selection: null, question: "Bạn chỉ đọc được slide thôi đúng không, có biết gì khác ngoài slide không?" },
  { id: "R01", page: 15, selection: null, question: "What does this slide say about attention?" },
  { id: "R02", page: 21, selection: "phân loại spam · câu chủ quan/khách quan · phát hiện hyperlink trong email", question: "giải thích hết đoạn này cho mình" },
  { id: "R03", page: 27, selection: null, question: "Token, context và attention ở đầu bài thì liên quan gì đến chi phí gọi API ở phần cuối này?" },
];

async function run() {
  const results = [];
  for (const c of cases) {
    const started = Date.now();
    try {
      const res = await fetch(`${BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: c.question, page: c.page, selection: c.selection, history: [] }),
      });
      const data = await res.json();
      const ms = Date.now() - started;
      results.push({ id: c.id, input: c, status: res.status, response: data, ms });
      console.error(`[${c.id}] ${res.status} in ${ms}ms`);
    } catch (err) {
      results.push({ id: c.id, input: c, error: String(err) });
      console.error(`[${c.id}] ERROR ${err}`);
    }
  }
  console.log(JSON.stringify(results, null, 2));
}

run();
