# VLearn Tutor — Working Prototype v0

Đây là **bản chính** của repository. Tutor trả lời câu hỏi về slide Day 1, gắn citation theo trang ở backend và chỉ mở rộng ra web khi có URL citation xác minh được.

## Cài đặt và chạy

Yêu cầu Node.js 18+ và Python 3.10+.

```powershell
cd Working-Prototype/v0
Copy-Item .env.example .env
# điền OPENAI_API_KEY vào .env
python -m pip install pypdf
npm run index
npm start
```

Mở <http://localhost:4180>. Nếu cần cổng khác: `$env:PORT=4181; npm start`.

`.env` và `data/slide-index.json` là file local đã Git ignore. Không để API key vào browser, commit, log hoặc ảnh demo. Sau khi thay file PDF Day 1, chạy lại `npm run index`.

## Các lệnh

```powershell
npm test       # policy/retrieval deterministic, không gọi OpenAI
npm run index  # tạo page-level index từ PDF đã cấp
npm run eval   # chạy 27 case golden set, cần OPENAI_API_KEY
npm start      # chạy app tại port 4180
```

## Hợp đồng hành vi

| Route | Khi nào | Kết quả |
| --- | --- | --- |
| `slide` | Câu hỏi có căn cứ trong index, nêu trang, chọn text hoặc “slide này” | Model chỉ nhận context slide đã chọn; server trả citation theo trang |
| `external` | Người học chủ động yêu cầu mở rộng kiến thức liên quan | Gọi Web Search; chỉ trả lời khi có ít nhất một URL citation |
| `insufficient` | Thiếu căn cứ, input nhạy cảm/không rõ, lỗi kỹ thuật hoặc web không có nguồn | Nêu giới hạn/hướng dẫn hỏi lại, không đoán |
| `irrelevant` | Ngoài phạm vi bài học | Từ chối lịch sự để giữ mạch học |
| `invalid-page` | Trang yêu cầu không tồn tại | Nêu phạm vi trang hợp lệ |

## Cấu trúc

```text
public/                 UI PDF viewer và Tutor panel
src/retrieval.js        keyword retrieval trên page index
src/chat-policy.js      routing/safety policy
src/providers/openai.js OpenAI Responses API và Web Search adapter
scripts/build_slide_index.py
scripts/run-golden-set-v0.mjs
tests/run-tests.js      kiểm thử deterministic
server.js               static server, PDF và API
```

Đánh giá và AI spec ở root repository: [`../../eval/`](../../eval/), [`../../spec.md`](../../spec.md). Bản `lumi-slide-tutor` là thử nghiệm phụ, không thay thế v0.
