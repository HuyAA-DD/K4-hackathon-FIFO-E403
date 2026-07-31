# Bối cảnh dự án — Mini Hackathon AI Batch 03, Hướng A (VLearn)

> File này tóm tắt toàn bộ kiến thức cần thiết để làm việc trong repo mà không phải đọc lại `01-de-bai.md` / `02-guide.md` / `03-template-ai-spec.md` / `04-rubric.md` mỗi phiên. Đọc các file gốc đó khi cần chi tiết đầy đủ; file này chỉ giữ phần cốt lõi + trạng thái hiện tại của nhóm.

## 1. Đề tài đã chọn

- **Hướng A — VLearn**, loại **"Tối ưu tính năng có sẵn"** (AI Tutor trong trang học).
- **Chủ đề cụ thể:** Tutor đọc hiểu **slide** đang xem và trả lời/tóm tắt **kèm trích dẫn** (số trang/đoạn); nếu dùng nguồn ngoài slide thì phải dẫn nguồn rõ ràng, không được bịa.
- **Job executor:** học viên đang xem slide trong buổi học, gặp đoạn chưa hiểu.
- **Core JTBD:** hiểu và kiểm chứng nội dung slide đang xem trong lúc học, không rời mạch bài để tự tìm lại nguồn.
- **Nút thắt đã chọn:** Tutor hiện trả lời lý thuyết nhưng phần lớn **không kèm citation** → học viên không kiểm chứng được có bám slide hay không.
- **Lát cắt MỘT CÂU** (đã chốt ở canvas CP1):
  > Học viên đang xem slide trong buổi học · cần hiểu hoặc tóm tắt đúng nội dung slide đang xem · AI quyết định trả lời từ slide và trích dẫn trang/đoạn, chỉ dùng nguồn ngoài khi slide không có thông tin và phải dẫn nguồn rõ ràng · để học viên kiểm chứng được câu trả lời và học đúng theo bài giảng.
- **Automation mức nào:** chưa chốt chính thức trong spec, nhưng canvas/spec nghiêng về **Conditional** (đọc slide + trả lời có citation khi có căn cứ; nói rõ giới hạn/hỏi lại khi không có căn cứ, không tự bịa).

## 2. Bằng chứng đã có (Evidence)

**B — Mining chatlog** (đạt chuẩn, đã có số đếm + phương pháp + ≥5 ví dụ):
- Dataset: `chat_history_anonymized_for_hackathon.csv` — 1.261 lượt Tutor (369 user, 585 hội thoại), 22/07–29/07/2026.
- **582/1.261 phản hồi Tutor không có citation (`citations = []`) = 46,2%**, trải trên 255 user / 339 hội thoại.
- Trong đó **448 lượt là `review_concept`** (Tutor đang giải thích/ôn khái niệm mà không cho căn cứ).
- Cách đếm tái lập: lọc `role = tutor` → đếm `citations = []` hoặc rỗng → lọc tiếp `move_used = review_concept`.
- 5 mã turn ví dụ: T0020, T0769, T0524, T0436, T1261 (xem `spec.md` §1 để có nguyên văn).

**A — Khảo sát người ngoài nhóm: CHƯA CÓ LOG.** `spec.md` đang ghi placeholder "việc cần hoàn tất trước khi chốt CP1" — đây là một lỗ hổng cần điền: cần `evidence/survey-slide-tutor.md` với n≥20, ≥50% xác nhận, log đầy đủ câu hỏi + từng câu trả lời.

**3 ứng viên đã so — chọn A (tutor đọc slide + citation), loại B (hỏi kiểm tra hiểu bài — 99,8% lượt thiếu check-question nhưng scope quá rộng cho 1,5 ngày) và C (chặn đáp án trực tiếp — chỉ 11,6% lượt, evidence yếu).** Chi tiết bảng điểm ở `spec.md` §2.

## 3. Trạng thái spec.md — CHỈ MỚI CÓ §1 VÀ §2

Template đầy đủ có §1–§9 (`03-template-ai-spec.md`). File `spec.md` hiện tại **dừng ở §2**. Còn thiếu, cần viết tiếp:
- §3 Giải pháp tương tự đã nghiên cứu (mỗi thành viên thử 1 sản phẩm gần giống, 4 câu hỏi mỗi cái)
- §4 Thiết kế: non-goals (≥3), mức prototype (Sketch/Mock/Working), automation + lý do cost-of-error, §4b bảng ≥4 nguyên tắc HAX/PAIR trỏ vào chỗ cụ thể trong prototype
- §5 Kiểu lỗi: 4 lớp chỗ khó (①nguồn sự thật ②mơ hồ ③ngoài phạm vi ④đặc thù domain) + ≥8 kịch bản (mỗi lớp ≥2 case)
- §6 4 đường đi trải nghiệm (happy / low-confidence / failure-không-căn-cứ / correction) + case ngoài phạm vi + case đặc thù domain
- §7 Kiểm thử: định nghĩa "tốt" theo từng chiều chất lượng, golden set ≥20 case (≥2/lớp chỗ khó + 8-10 thường + 2-4 hiếm + ≥10 từ chatlog thật) trong `eval/`, quality bar bằng số (**chốt 23:59 N1, không đổi sau đó**), bảng % kết quả chạy
- §8 Phân công có tên + ≥3 willing users có tên thật + kế hoạch validation CP5
- §9 Changelog

**⚠️ Deadline cứng: spec.md commit trước 23:59 ngày 1 (N1) — quality bar khoá từ thời điểm đó.**

## 4. Trạng thái prototype

- `Clickable-Prototype/v0/` và `v1/` — web tĩnh (Node + static server), layout PDF slide bên trái + panel Tutor bên phải, toggle ẩn/hiện. **v1 là bản refactor mới nhất** (chạy `npm start` → `localhost:4175`).
- **Hiện tại 100% rule-based** (`data/rules.js`): match keyword (`tóm tắt`, `Transformer`, `self-attention`, `RAG`, `trích dẫn`) → trả câu trả lời "Trong tài liệu" có sẵn; không khớp → trả "Nguồn ngoài". **Không gọi LLM/API thật, không đọc chatlog.**
- **Đây là điểm nghẽn quan trọng nhất còn lại:** rubric R5 (8đ) + CP3 yêu cầu **≥1 lời gọi AI chạy thật ở quyết định trung tâm** (không hardcode). Prototype hiện tại chưa đáp ứng — cần tích hợp gọi LLM thật (Gemini free tier qua Google AI Studio, hoặc API key khoá cấp) để đọc slide + sinh câu trả lời + trích dẫn, thay cho `rules.js`.
- Thư mục `codebase/` (chuẩn nộp bài, có `codebase/lib`, `codebase/uploads`) và `CP3-test/` ở root hiện **rỗng** — chưa di chuyển/hợp nhất prototype vào cấu trúc nộp bài chuẩn (xem §6 cấu trúc repo bên dưới).

## 5. Data pack (`data/vlearn-pack/`)

- `chatlog/chat_history_anonymized_for_hackathon.csv` — 2.522 dòng hội thoại thật (đã ẩn danh U/C/T/M) + `chatlog/DATA_DICTIONARY.md`.
- `transcript/` — 6 transcript bài giảng sạch, có mã trích dẫn `[Txx-NNN]` (Day 1 Foundation, Day 2 xác định bài toán ×3, + 2 buổi chủ đề).
- `slides/` — 2 bộ slide bản hackathon (Day 1 AI & LLM Foundation, Day 2 Xác định bài toán), 29 trang/bộ, có watermark, một số trang giữ số trang gốc để đối chiếu citation.
- **Luật bảo mật cứng (vi phạm ảnh hưởng điểm nhóm):** chỉ dùng trong phạm vi hackathon; không chia sẻ ra ngoài khoá; **không commit file data pack gốc / PDF slide / chatlog gốc vào repo nộp bài** — chỉ trích ngắn + mã đoạn/mã hội thoại; cẩn trọng khi đưa vào tool AI ngoài (free tier có thể dùng để train — chỉ đưa phần tối thiểu, ưu tiên data giả khi thử nghiệm ở LLM ngoài); không suy ngược danh tính từ mã ẩn danh; xoá bản sao sau sự kiện nếu được yêu cầu.

## 6. Cấu trúc repo nộp bài (bắt buộc)

```
repo/
├── README.md          ← thành viên (mã HV + tên) + phân công có tên từng phần
├── spec.md            ← đang có §1-§2, cần hoàn thiện §3-§9
├── demo-slides.pdf    ← slide 6 trang (chưa có)
├── codebase/          ← prototype thật (ghi rõ phần nào mock) — hiện rỗng, cần đưa Clickable-Prototype/v1 vào + AI call thật
├── eval/              ← golden set + bảng kết quả các lượt chạy (chưa có)
├── validation/        ← feedback log vòng user test (chưa có)
└── reflection/        ← mỗi người 1 file (chưa có)
```

## 7. Timeline 6 mốc (Khoá 4 — theo lịch trong `README.md`)

| Mốc | Giờ | Cần show |
|---|---|---|
| CP1 Canvas | 15:00 N1 | ✅ đã có (`canvas-cp1-vlearn-ai-tutor.txt`) — còn thiếu tên người thử + phân công |
| CP2 Bấm được | 17:00 N1 | Flow chính bấm hết được (đã có v0/v1 rule-based) |
| CP3 AI thật + đo lượt đầu | 10:30 N2 | **Cần AI call thật** (chưa có) + golden set ≥20 (chưa có) + bảng % lượt 1 |
| CP4 Chốt tiến độ — **spec.md hạn cứng 23:59 N1** | 12:00 N2 | spec §1-§9 gần đủ, quality bar bằng số |
| CP5 Validation + dry run | 14:00 N2 | Feedback log ≥5 người + changelog + dry run |
| CP6 Demo | 15:00 N2 | Slide 6 trang, demo live 1 case chuẩn + 1 case chỗ khó |

## 8. Rubric — trọng số cần nhớ khi ưu tiên việc

100đ = 25đ nộp checkpoint (5đ/mốc CP1–CP5, đúng hạn mới có) + 75đ chấm bài:

| Khối | Điểm | File chấm |
|---|---|---|
| R1 Bằng chứng & impact | 15 | spec §1-§2 — **thiếu khảo sát A**, cần bổ sung |
| R2 Lát cắt & thiết kế | 15 | spec §4 — **chưa viết** |
| R3 Chỗ khó & kịch bản | 11 | spec §5-§6 — **chưa viết** |
| R4 Kiểm thử | 15 | spec §7 + eval/ — **chưa có gì** |
| R5 Prototype chạy được | 8 | codebase/ — **chưa có AI call thật** |
| R6 Validation user | 8 | validation/ — **chưa có** |
| R7 Quy trình & repo | 3 | cấu trúc repo — **codebase/eval/validation/reflection đang rỗng** |

→ **Việc gấp nhất theo điểm:** (1) viết spec §4-§9 (15+11+15=41đ liên quan), (2) thay `rules.js` bằng lời gọi LLM thật + dựng golden set trong `eval/`, (3) chạy khảo sát ≥20 người cho evidence A.

## 9. Nguyên tắc thiết kế bắt buộc tham chiếu (HAX/PAIR) — chọn ≥4, mỗi cái phải trỏ vào chỗ cụ thể trong prototype

Bắt buộc: **G10** (thu hẹp phạm vi khi nghi ngờ — không bịa khi slide không có thông tin) + ≥1 trong G8 (gạt bỏ dễ)/G9 (sửa dễ)/G11 (giải thích vì sao, gắn hành động tiếp theo). Cộng ≥1 nhóm khởi đầu: G1 (làm rõ hệ thống làm được gì) / G2 (làm rõ nó tốt đến đâu). Xem `02-guide.md` §2.4 để tra đầy đủ.

## 10. Luật an toàn khi build

- Không commit API key/.env — dùng biến môi trường.
- Chỉ dùng data trong `data/` hoặc data giả tự sinh.
- Repo public: soát kỹ trước khi push — không key, không thông tin cá nhân, không đổ nguyên data pack.
- Vibe-coding rule: mỗi thành viên phải giải thích được phần code có tên mình khi bị hỏi ngẫu nhiên (CP5/CP6) — không giải thích được = 0 điểm phần đó.

## 11. Việc cần làm tiếp (checklist ngắn cho phiên tới)

- [ ] Chạy khảo sát ≥20 người ngoài nhóm cho evidence A → `evidence/survey-slide-tutor.md`
- [ ] Viết spec.md §3–§9 (dùng `03-template-ai-spec.md` làm khung, `02-guide.md` để tự trả lời câu hỏi trước khi điền)
- [ ] Thay `rules.js` (keyword-match) bằng lời gọi LLM thật đọc slide + sinh câu trả lời có citation (Gemini free tier hoặc API key khoá cấp) — đưa vào `codebase/`
- [ ] Dựng golden set ≥20 case (đủ cơ cấu theo §2.6 guide) trong `eval/`, chốt quality bar bằng % trước 23:59 N1
- [ ] Chạy vòng validation ≥5 người (ưu tiên 3 willing users đã khai CP1) → `validation/`
- [ ] Soạn `demo-slides.pdf` (6 trang theo `02-guide.md` §5.1)
- [ ] Mỗi thành viên viết `reflection/` riêng
- [ ] Điền tên thật vào canvas CP1 (người thử + phân công) và README (thành viên + phân công)
