# Lumi Slide Tutor — bản phụ thử nghiệm

Đây là một hướng thử nghiệm độc lập cho trải nghiệm **hỏi đáp trên đúng một trang PDF**. Nó không phải deliverable chính của repo; bản cần chạy và được đánh giá là [`../Working-Prototype/v0`](../Working-Prototype/v0/).

## Chức năng đang có

- Hiển thị slide mẫu hoặc PDF do người dùng chọn.
- Với câu hỏi đầu tiên trên một trang, API có thể gửi ảnh slide cùng PDF text layer tới OpenAI để tạo OCR/visual context và câu trả lời.
- Những câu hỏi sau chỉ dùng bộ nhớ của cùng `documentId` và `pageNumber`; không tự lấy thông tin từ trang khác.
- Nếu không có `OPENAI_API_KEY`, UI vẫn hoạt động ở chế độ demo/fallback.

## Chạy local

Yêu cầu Node.js `>=22.13.0`.

```powershell
cd lumi-slide-tutor
npm install
Copy-Item .env.example .env.local
npm run dev
```

`.env.local` là file local, ví dụ:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.4-mini
```

Không commit file môi trường hay API key. Lệnh `npm run build` kiểm tra build; `npm run lint` kiểm tra TypeScript/ESLint.

## Giới hạn và quan hệ với v0

Lumi dùng Vinext/Cloudflare Worker và contract `/api/tutor` riêng; nó không có retrieval toàn bộ slide, citation theo trang do backend gắn, hay bộ golden set của `Working-Prototype/v0`. Vì thế không dùng kết quả của thư mục này để tuyên bố chỉ số chất lượng của sản phẩm chính hoặc thay đổi `vercel.json` ở root.

Các file `db/`, `drizzle/`, `examples/d1/` và cấu hình Cloudflare là hạ tầng starter còn giữ lại cho hướng phát triển sau, chưa được v0 sử dụng.
