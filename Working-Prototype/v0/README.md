# VLearn Tutor — Working Prototype v0

Prototype dùng **GPT-5.4** cho cả trả lời dựa trên slide và phần mở rộng có tìm web.

## Chạy local

```bash
cd /d/AIIA/K4-hackathon-FIFO-E403/Working-Prototype/v0
npm start
```

Mở `http://localhost:4180`. Nếu cổng đã được dùng: `PORT=4181 npm start`.

## Cấu hình OpenAI

1. Tạo `.env` từ `.env.example`.
2. Điền API key trả phí của bạn:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.4
```

3. Nếu chưa có index slide, chạy:

```bash
python -m pip install pypdf
python scripts/build_slide_index.py
```

API key chỉ được đọc ở backend. Không commit `.env`; `slide-index.json` cũng bị gitignore vì chứa nội dung trích xuất từ data pack.

## Hành vi chatbot

- Câu hỏi có căn cứ trong slide: server chọn tối đa 3 trang phù hợp, gửi chúng làm ngữ cảnh cho GPT-5.4, rồi **server** gắn citation số trang từ page-index.
- `slide 7`, `trang 7`, `page 7`: mở đúng trang được nêu; nếu trang không tồn tại, Tutor báo số trang hợp lệ.
- “Làm rõ hơn”: dùng chủ đề trước đó để tìm lại slide và vẫn trích dẫn trang slide.
- “Mở rộng hơn” hoặc khái niệm AI/LLM liên quan nhưng chưa có trong slide: gọi OpenAI Web Search. Chỉ hiển thị câu trả lời khi API trả về URL citation.
- Câu hỏi mơ hồ: GPT-5.4 chỉ phân loại `slide` / `external` / `irrelevant` trước; các câu rõ ràng ngoài bài học vẫn bị từ chối ngay, không gọi model.

## Test nhanh

1. Hỏi `LLM là gì?` → phải có citation số trang slide.
2. Hỏi tiếp `Mở rộng hơn về Transformer` → phải có các URL nguồn ngoài.
3. Hỏi `Thời tiết hôm nay thế nào?` → phải bị từ chối là không liên quan.

## Cấu trúc

```text
v0/
├── public/                  # UI
├── src/retrieval.js         # keyword search trên page index cục bộ
├── src/chat-policy.js       # route slide / web / từ chối
├── src/providers/openai.js  # Responses API + Web Search adapter
├── data/slide-index.json    # page → text → keywords (gitignored)
├── server.js                # static server + PDF + chat API
└── .env.example
```
