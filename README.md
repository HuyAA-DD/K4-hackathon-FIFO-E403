# VLearn Tutor — Slide-grounded AI Tutor

VLearn Tutor giúp học viên hỏi và hiểu nội dung của slide đang học, với câu trả lời được gắn **citation theo trang slide**. Đây là bài nộp hướng A — VLearn của Mini Hackathon AI.

> Bản chính để chạy, demo và chấm: [`Working-Prototype/v0`](Working-Prototype/v0/). Thư mục [`lumi-slide-tutor`](lumi-slide-tutor/) là bản phụ thử nghiệm trải nghiệm đọc từng slide PDF; không phải bản dùng để đánh giá golden set hoặc triển khai chính.

## Demo trực tuyến

Mở bản triển khai chính tại **[k4-hackathon-fifo-e403.vercel.app](https://k4-hackathon-fifo-e403.vercel.app/)**.

Deployment này dùng cấu hình `vercel.json` ở root và trỏ tới `Working-Prototype/v0/server.js`.

## Thành viên và phân công

| Thành viên | Phần phụ trách |
| --- | --- |
| Bùi Minh Long — 2A202601462 | Product/spec, evidence và demo flow |
| Nguyễn Quang Huy — 2A202601120 | Backend retrieval, policy, OpenAI integration và evaluation |
| Nguyễn Mai Huy — 2A2026001712 | UI/UX prototype, validation và presentation |

## Bắt đầu nhanh

Yêu cầu: Node.js 18+ và Python 3.10+ (chỉ để tạo chỉ mục slide lần đầu). Muốn nhận câu trả lời AI thật cần OpenAI API key có billing.

```powershell
cd Working-Prototype/v0
Copy-Item .env.example .env
# sửa .env và điền OPENAI_API_KEY
python -m pip install pypdf
npm run index
npm start
```

Mở <http://localhost:4180>. Nếu cổng đã dùng, chạy `$env:PORT=4181; npm start`.

`slide-index.json` được tạo từ PDF cung cấp trong `data/vlearn-pack/slides/`, chỉ dùng cục bộ và đã bị Git ignore. Đừng commit `.env`, API key, hoặc nội dung trích xuất từ data pack.

## Bản chính: Working Prototype v0

Luồng chính:

1. Người học chọn/truy cập một trang slide và đặt câu hỏi.
2. Backend tìm các trang liên quan trong index cục bộ, hoặc neo câu hỏi vào trang được nêu rõ.
3. Model chỉ được dùng ngữ cảnh slide đã chọn để trả lời; backend gắn citation trang một cách xác định.
4. Khi người học chủ động yêu cầu mở rộng kiến thức, backend chỉ trả lời nếu Web Search trả về URL citation; câu hỏi ngoài bài học bị từ chối lịch sự.

| Thành phần | Trạng thái |
| --- | --- |
| Xem PDF Day 1, điều hướng trang, tìm slide | Thật, chạy local |
| Retrieval từ index theo trang và citation slide | Thật, xác định ở backend |
| Phân tuyến slide / web / ngoài phạm vi và trả lời tutor | Thật, gọi OpenAI Responses API khi có key |
| Web Search cho câu hỏi mở rộng | Thật, chỉ hiển thị nguồn có URL citation |
| Bút, highlight, đăng nhập, lưu lịch sử dài hạn, quiz | Không thuộc v0 |

Các lệnh hữu ích trong `Working-Prototype/v0`:

```powershell
npm test       # unit tests cho retrieval/policy, không gọi API
npm run index  # tạo lại slide index sau khi thay PDF
npm run eval   # chạy 27 case golden set; cần API key hợp lệ
npm start      # chạy ứng dụng
```

Kết quả tham chiếu gần nhất được lưu tại [`eval/golden-set-v0-run-04.md`](eval/golden-set-v0-run-04.md): 27/27 HTTP request hoàn tất và được chấm đạt theo tiêu chí của bộ golden set. Đây là kết quả của một lần chạy với model/key cục bộ; không thay thế việc chạy lại trước demo.

## Cấu trúc repo

```text
├── spec.md                         # AI spec, quality bar và changelog
├── evidence/                       # mining log tái lập được, không sao chép chatlog gốc
├── validation/                     # protocol và log feedback (không bịa dữ liệu)
├── eval/                           # golden set, raw response và báo cáo các lần chạy
├── Working-Prototype/v0/           # bản chính
│   ├── public/                     # UI PDF viewer + Tutor
│   ├── src/                        # retrieval, policy, OpenAI adapter
│   ├── scripts/build_slide_index.py
│   └── tests/                      # unit tests không cần API key
├── lumi-slide-tutor/               # bản phụ/thử nghiệm độc lập
├── Clickable-Prototype/            # prototype tĩnh giai đoạn trước
└── data/vlearn-pack/               # data pack được cấp cho hackathon
```

## Bản phụ: `lumi-slide-tutor`

`lumi-slide-tutor` thử nghiệm một giao diện đọc từng trang PDF: lượt hỏi đầu có thể phân tích ảnh slide/OCR, các lượt sau tái dùng bộ nhớ của đúng trang. Nó có toolchain Vinext/Cloudflare riêng, cần Node.js 22.13+ và không dùng chung contract API, evaluation hay deployment của v0. Vì vậy, chỉ chạy nó khi muốn khảo sát UI/UX thay thế:

```powershell
cd lumi-slide-tutor
npm install
npm run dev
```

Không thay `vercel.json` ở root để deploy bản phụ; cấu hình hiện tại trỏ tới `Working-Prototype/v0/server.js`.

## Tài liệu và giới hạn dữ liệu

- [AI Spec](spec.md) mô tả JTBD, design, rủi ro, golden set, quality bar và kế hoạch validation.
- [Mining evidence](evidence/mining-slide-tutor.md) nêu cách đếm tái lập số liệu từ chatlog đã ẩn danh.
- [Validation protocol](validation/README.md) và [feedback log](validation/feedback-log.md) được giữ tách biệt với kết quả test tự động.
- Data pack chỉ dành cho hackathon. Không xuất bản lại CSV/PDF, không cố gắng tái nhận diện người học, và không đưa dữ liệu nhạy cảm vào prompt hay commit công khai.
