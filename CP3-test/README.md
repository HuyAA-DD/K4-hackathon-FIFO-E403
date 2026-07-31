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
| Đọc nội dung slide (29 trang Day 1) | **Thật** — trích xuất text từ chính file PDF bằng `pdfjs-dist` khi server khởi động, không hardcode câu trả lời. |
| Câu trả lời Tutor + trích dẫn | **Thật** — gọi OpenAI Chat Completions (`gpt-4o-mini` mặc định, đổi qua biến môi trường `OPENAI_MODEL`) với tool-calling, không có rule/keyword-match nào như `Clickable-Prototype/v0`/`v1`. |
| Công cụ **Bút** (vẽ tay) | **Thật** — vẽ nét thật trên canvas overlay theo con trỏ, lưu riêng theo từng trang, giữ nguyên khi đổi zoom. |
| Công cụ **Highlight** | **Thật** — bôi đen chọn text thật trên slide (text layer của pdf.js, không phải iframe PDF gốc), bấm "Hỏi Tutor về đoạn này" sẽ lưu vệt highlight vàng trên trang **và** gửi đúng đoạn đã chọn cho AI làm căn cứ trả lời. |
| Zoom / chuyển trang | **Thật** — render lại canvas + text layer qua `pdfjs-dist`, không phải đổi `src` iframe. |
| Giọng nói, quiz, các slide Day 2 | Chưa làm — ngoài phạm vi lát cắt CP3 này. |

## Kiến trúc AI (đọc để giải thích khi bị hỏi ngẫu nhiên — vibe-coding rule)

1. **`server.js`** đọc toàn bộ text của 29 trang PDF một lần khi khởi động (`pdfjs-dist/legacy/build/pdf.mjs`, không cần package `canvas`).
2. Mỗi câu hỏi từ client gửi kèm: `question`, `page` (trang đang xem), `selection` (đoạn bôi đen nếu có), `history` (vài lượt hội thoại gần nhất).
3. Server ghép **system prompt** (quy tắc 4 lớp chỗ khó ①②③④ + HAX G1/G2/G10/G11 của dự án — xem hằng số `SYSTEM_PROMPT` trong `server.js`) + nội dung trang hiện tại + trang lân cận + đoạn bôi đen (nếu có) + câu hỏi, gửi cho OpenAI kèm 2 tool:
   - `search_slides(query)` — model tự gọi khi câu hỏi có thể thuộc trang khác; server tìm bằng keyword-match trên toàn bộ 29 trang đã trích xuất, trả top 5 trang kèm đoạn trích.
   - `final_answer(...)` — model **bắt buộc** gọi tool này để trả lời, buộc output có cấu trúc: `source_type` (`slide` / `external` / `insufficient`), `citations` (trang + trích ngắn), `external_source`, `clarifying_question`, `scope_note`.
4. Server lặp tối đa 5 lượt gọi model (tool-calling loop); lượt cuối ép `tool_choice = final_answer` để không bao giờ treo không có câu trả lời. Nếu vẫn thất bại, trả về `source_type: "insufficient"` — **không bao giờ bịa**.
5. Toàn bộ các lượt gọi tool được trả về client trong `trace` để hiển thị trong khối "Vì sao Tutor trả lời vậy?" (minh bạch, phục vụ HAX G11).

## Đã kiểm thử tay (curl) trước khi bàn giao

- Câu hỏi bám đúng trang đang mở → `source_type: "slide"` kèm trích dẫn đúng số trang.
- Câu hỏi thuộc trang khác trang đang mở (VD hỏi RLHF khi đang ở trang 1) → model tự gọi `search_slides`, tìm ra trang 18-19, trả lời có trích dẫn đúng.
- Câu hỏi ngoài phạm vi (VD "làm hộ bài tập môn khác") → từ chối lịch sự, `source_type: "insufficient"`.
- Câu hỏi mơ hồ (VD "cái đó là sao vậy") → hỏi lại đúng 1 câu qua `clarifying_question`, không đoán liều.
- Bôi đen một đoạn cụ thể rồi hỏi → câu trả lời bám đúng đoạn đã bôi đen, trích dẫn đúng trang.

Chưa kiểm thử bằng trình duyệt thật (không có công cụ browser/automation trong phiên làm việc này) — phần vẽ tay/bôi đen/canvas cần người mở `http://localhost:4176` xác nhận trực quan trước demo CP3.

## Việc còn thiếu để lên chuẩn nộp bài (`04-rubric.md` R4)

- Golden set ≥20 case trong `eval/` + bảng % kết quả (thư mục này mới là bước "AI chạy thật", chưa phải bước "đo bằng golden set").
- Copy/di chuyển thư mục này vào `codebase/` theo cấu trúc nộp bài chuẩn khi chốt.
