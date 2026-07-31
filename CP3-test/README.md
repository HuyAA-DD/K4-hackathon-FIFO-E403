# CP3-test — VLearn Tutor, prototype AI thật (mức Working)

Prototype dùng lại UI/UX của `Clickable-Prototype/v1` (layout PDF slide trái · Tutor phải · panel ẩn/hiện) nhưng thay toàn bộ phần "trả lời" bằng lời gọi AI thật qua OpenAI API, và làm hai công cụ toolbar (**Bút**, **Highlight**) hoạt động thật thay vì chỉ là nút trang trí.

## Chạy local

Yêu cầu: Node.js 18+ (đã test trên Node 26), file `.env` ở **root repo** (một cấp trên thư mục này) có `OPENAI_API_KEY=...`.

```powershell
cd CP3-test
npm install
npm start
```

Mở `http://localhost:4176`. Server đọc `../data/vlearn-pack/slides/d1-slide-hackathon.pdf` và `../.env` — không copy các file này vào `CP3-test/`.

## Cái gì THẬT, cái gì MOCK

| Phần | Trạng thái |
|---|---|
| Đọc nội dung slide (29 trang Day 1 + 29 trang Day 2) | **Thật** — trích xuất text từ chính file PDF bằng `pdfjs-dist`, không hardcode câu trả lời. Day 1 đọc sẵn lúc khởi động; Day 2 đọc **lười (lazy)** lần đầu AI cần tới. |
| Cache nhiều bộ slide | **Thật** — mỗi bộ chỉ được `pdfjs-dist` đọc/trích text từ PDF đúng 1 lần (`deckCache` trong `server.js`, cache theo Promise nên nhiều tool-call/nhiều request cùng lúc không đọc lại file); đã verify bằng log — gọi `read_slide_page` trên Day 2 tới 5 lần trong 1 câu hỏi mà chỉ có đúng 1 dòng log "đọc lần đầu". |
| Câu trả lời Tutor + trích dẫn | **Thật** — gọi OpenAI Chat Completions (`gpt-4o-mini` mặc định, đổi qua biến môi trường `OPENAI_MODEL`) với tool-calling, không có rule/keyword-match nào như `Clickable-Prototype/v0`/`v1`. |
| Công cụ **Bút** (vẽ tay) | **Thật** — vẽ nét thật trên canvas overlay theo con trỏ, lưu riêng theo từng trang, giữ nguyên khi đổi zoom. |
| Công cụ **Highlight** / **Hỏi AI** trên toolbar | **Thật** — bôi đen text thật trên slide (text layer của pdf.js, không phải iframe PDF gốc), 2 nút toolbar tác động lên đoạn đang bôi đen: Highlight chỉ tô vàng, Hỏi AI chỉ gửi câu hỏi — độc lập nhau. |
| Zoom / cuộn trang | **Thật** — render lại canvas + text layer qua `pdfjs-dist`, cuộn liên tục nhiều trang thật (không phải đổi `src` iframe). |
| UI hiển thị Day 2 | Chưa làm — UI vẫn chỉ render PDF Day 1; AI đã đọc được cả 2 bộ qua tool nhưng người dùng chưa tự chuyển bộ slide trên màn hình được. |
| Giọng nói, quiz | Chưa làm — ngoài phạm vi lát cắt CP3 này. |

## Kiến trúc AI (đọc để giải thích khi bị hỏi ngẫu nhiên — vibe-coding rule)

1. **Cache nhiều bộ slide** (`DECKS`, `deckCache`, `getDeck()` trong `server.js`): mỗi bộ (`d1` = Day 1, `d2` = Day 2) được `pdfjs-dist` trích text đúng **1 lần** rồi giữ trong `Map<deckId, Promise<{pages,...}>>` — cache theo Promise nên gọi đồng thời/nhiều lần vẫn dùng lại đúng 1 lượt đọc file, không bao giờ parse lại PDF. Day 1 warm sẵn lúc server khởi động (UI cần ngay); Day 2 chỉ đọc khi AI thật sự gọi tool cần tới nó (lazy).
2. Mỗi câu hỏi từ client gửi kèm: `question`, `page` (trang Day 1 đang xem), `selection` (đoạn bôi đen nếu có), `history` (vài lượt hội thoại gần nhất). Deck đang xem trên UI luôn là `d1`.
3. Server ghép **system prompt** (quy tắc 4 lớp chỗ khó ①②③④ + HAX G1/G2/G10/G11 — xem hằng số `SYSTEM_PROMPT`) + nội dung trang hiện tại + trang lân cận (cùng bộ) + đoạn bôi đen (nếu có) + câu hỏi, gửi cho OpenAI kèm **4 tool**:
   - `list_slide_decks()` — liệt kê các bộ slide đang có + số trang, để model biết còn bộ nào khác ngoài bộ đang mở.
   - `search_slides({ deck?, query })` — tìm từ khoá trong một bộ (mặc định bộ đang mở); trả top 5 trang kèm đoạn trích ngắn.
   - `read_slide_page({ deck?, page })` — đọc **toàn văn** một trang cụ thể của một bộ, dùng khi cần đối chiếu/so sánh kỹ nhiều trang hoặc **giữa 2 buổi học** với nhau (multi-slide).
   - `final_answer(...)` — model **bắt buộc** gọi tool này để trả lời, buộc output có cấu trúc: `source_type` (`slide` / `external` / `insufficient`), `citations` (mỗi citation có `deck` + trang + trích ngắn, có thể trộn cả `d1` và `d2`), `external_source`, `clarifying_question`, `scope_note`.
4. Server lặp tối đa 6 lượt gọi model (tool-calling loop); lượt cuối ép `tool_choice = final_answer` để không bao giờ treo không có câu trả lời. Nếu vẫn thất bại, trả về `source_type: "insufficient"` — **không bao giờ bịa**.
5. Toàn bộ các lượt gọi tool (kèm deck đã dùng) được trả về client trong `trace` để hiển thị trong khối "Vì sao Tutor trả lời vậy?" (minh bạch, phục vụ HAX G11). Client (`DECK_LABELS` trong `app.js`) chỉ cho bấm "→ Xem trang N" với citation thuộc `d1` vì UI chưa render PDF Day 2.

## Đã kiểm thử tay (curl) trước khi bàn giao

- Câu hỏi bám đúng trang đang mở → `source_type: "slide"` kèm trích dẫn đúng số trang, không gọi tool thừa.
- Câu hỏi thuộc trang khác trang đang mở (VD hỏi RLHF khi đang ở trang 1) → model tự gọi `search_slides`, tìm ra trang 18-19, trả lời có trích dẫn đúng.
- Câu hỏi thuộc **bộ slide khác** (VD hỏi "Problem Statement khác gì JTBD?" trong khi đang xem Day 1 trang 1) → model tự `search_slides(deck:"d2")` + `read_slide_page(deck:"d2",...)` nhiều lần, trả lời có trích dẫn đúng trang của Day 2, `scope_note` nêu rõ đã dùng Day 2. Verify bằng log server: dù gọi tool chạm Day 2 tới 5 lần trong 1 câu hỏi, chỉ có đúng 1 dòng "đọc lần đầu" — cache hoạt động.
- Câu hỏi ngoài phạm vi (VD "làm hộ bài tập môn khác") → từ chối lịch sự, `source_type: "insufficient"`.
- Câu hỏi mơ hồ (VD "cái đó là sao vậy") → hỏi lại đúng 1 câu qua `clarifying_question`, không đoán liều.
- Bôi đen một đoạn cụ thể rồi hỏi → câu trả lời bám đúng đoạn đã bôi đen, trích dẫn đúng trang.

Chưa kiểm thử bằng trình duyệt thật (không có công cụ browser/automation trong phiên làm việc này) — phần vẽ tay/bôi đen/canvas cần người mở `http://localhost:4176` xác nhận trực quan trước demo CP3.

## Việc còn thiếu để lên chuẩn nộp bài (`04-rubric.md` R4)

- Golden set ≥20 case trong `eval/` + bảng % kết quả (thư mục này mới là bước "AI chạy thật", chưa phải bước "đo bằng golden set").
- Copy/di chuyển thư mục này vào `codebase/` theo cấu trúc nộp bài chuẩn khi chốt.
