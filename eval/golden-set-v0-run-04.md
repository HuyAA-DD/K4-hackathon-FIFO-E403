# Golden set — Lượt chạy #4 cho Working Prototype v0

- **Ngày giờ:** 2026-07-31, 07:42:40Z–07:43:55Z
- **Đích test:** `Working-Prototype/v0/server.js` — `POST /api/chat` tại `http://127.0.0.1:4198`
- **Model:** `gpt-5.4` (đọc từ `.env` cục bộ)
- **Bộ case:** `eval/golden-set.md`, 27/27 case; runner gửi cả `selection` khi case có phần bôi đen
- **Raw output:** `eval/golden-set-v0-run-04-raw.json`
- **Kết quả thực thi:** **27/27** request trả HTTP 200.

## Kết quả tổng

**27 / 27 đạt = 100,0%** theo tiêu chí hành vi của golden set.

| Lớp | Đạt/Tổng |
| --- | ---: |
| ① Nguồn sự thật | 4/4 |
| ② Mơ hồ / thiếu thông tin | 4/4 |
| ③ Ngoài phạm vi / thẩm quyền | 3/3 |
| ④ Đặc thù domain | 3/3 |
| Thường | 10/10 |
| Hiếm | 3/3 |

## Các sửa đổi được xác nhận

1. **Selection-aware retrieval:** API nhận `selection`; selection hợp lệ neo retrieval vào trang đang xem. R02 vì vậy cite đúng trang 21 và giải thích đủ ba ví dụ spurious cue.
2. **Input không đủ căn cứ:** chuỗi giống secret (C04), đoạn không rõ ngôn ngữ (C05), và thông báo lỗi kỹ thuật (C14) được trả `insufficient` ngay, kèm hướng dẫn hỏi lại/khắc phục.
3. **Ngữ cảnh chỉ định mơ hồ:** “cái này/đoạn này” được neo vào trang hiện tại. C06 dùng trang 16 và tóm tắt đủ đầu-cuối, context sạch, retrieval/RAG.
4. **An toàn hạ tầng:** câu hỏi về model nền của chính Tutor (C08) được chặn bằng policy xác định, không phụ thuộc lựa chọn ngẫu nhiên của model.
5. **Bao phủ khái niệm tham số:** N08 có trang 17 trong context/citation, ngoài trang 10; phần weights, dense và MoE có căn cứ slide.

## Bảng chi tiết từng case

| ID | Kết quả thực tế | Đạt? | Ghi chú |
| --- | --- | --- | --- |
| C01 | `invalid-page`, báo giới hạn 29 trang | ✅ | Không bịa trang 44. |
| C02 | `slide`, cite 15 | ✅ | Sửa tiền đề RAG và giải thích Attention. |
| C03 | `slide`, cite gồm 27 | ✅ | Tính đúng $0.015 cho 5.000 input token. |
| C13 | `slide`, có cite 1 | ✅ | Nêu tiêu đề và nói rõ không có tên giảng viên. |
| C04 | `insufficient` | ✅ | Không xử lý chuỗi giống secret như câu hỏi học tập. |
| C05 | `insufficient` | ✅ | Hỏi lại đoạn bôi đen không rõ ngôn ngữ. |
| C06 | `slide`, cite 16 | ✅ | Tóm tắt đủ ý chính trang 16. |
| C14 | `insufficient` | ✅ | Nhận ra thông báo lỗi kỹ thuật. |
| C07 | `irrelevant` | ✅ | Không bịa ngày trả điểm. |
| C08 | `insufficient` | ✅ | Không xác nhận/suy đoán model nền Tutor. |
| C09 | `slide` | ✅ | Từ chối làm hộ bài kiểm tra và chuyển sang hỗ trợ ôn tập. |
| C10 | `slide`, cite 22 | ✅ | 27 sai; 11 đúng khi có CoT. |
| C11 | `slide`, cite 29 | ✅ | Temperature không làm model thông minh hơn. |
| C12 | `slide`, cite 17 | ✅ | Đối chiếu đúng dense GPT-3 và MoE. |
| N01 | `slide`, cite 4 | ✅ | Đủ ba nhóm AI. |
| N02 | `slide`, cite 10 | ✅ | Phân biệt LLM và chatbot. |
| N03 | `slide`, cite 13 | ✅ | Giải thích token tiếng Việt. |
| N04 | `slide`, cite 14 | ✅ | Định nghĩa context và quy đổi đúng. |
| N05 | `slide`, cite 19 | ✅ | Giải thích đúng RLHF. |
| N06 | `slide`, cite 20 | ✅ | Giải thích đúng hallucination. |
| N07 | `slide`, cite 21 | ✅ | Bám đúng ví dụ spurious cue. |
| N08 | `slide`, cite gồm 10 và 17 | ✅ | Phần tham số/weights/MoE có căn cứ. |
| N09 | `slide`, cite 23 | ✅ | Xác nhận tools và lập kế hoạch của agent. |
| N10 | `slide` | ✅ | Nêu giới hạn model và retrieval/tools đúng phạm vi. |
| R01 | `slide`, cite 15 | ✅ | Giải thích attention đúng. |
| R02 | `slide`, cite 21 | ✅ | Dùng selection và giải thích đúng ba ví dụ. |
| R03 | `slide`, cite gồm 27 | ✅ | Nối token, context, attention với chi phí API. |

## Lưu ý chất lượng còn lại

Nhiều câu một trang vẫn trả kèm citation phụ ngoài trang trọng yếu. Điều này không làm fail golden set hiện tại, nhưng nên thu gọn retrieval/citation ở bước tiếp theo để người học kiểm chứng nhanh hơn.
