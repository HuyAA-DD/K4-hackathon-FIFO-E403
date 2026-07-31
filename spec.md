# AI SPEC — VLearn Tutor đọc hiểu slide có citation

**Nhóm FIFO E403** · Hướng: **A — VLearn** · Loại: **tối ưu tính năng có sẵn** · Prototype chính: [`Working-Prototype/v0`](Working-Prototype/v0/)

## §1. User & Job

### Job executor và workflow hiện tại

**Job executor:** học viên đang xem slide trong buổi học, chưa hiểu một khái niệm hoặc cần kiểm tra lại chi tiết trên một trang.

1. Học viên đọc slide và gặp thuật ngữ/ý chưa rõ.
2. Học viên hỏi Tutor hoặc tự lật/tìm lại tài liệu.
3. Tutor có thể trả lời lý thuyết nhưng không chỉ căn cứ trên slide; học viên không biết câu trả lời có bám bài học không.
4. Học viên phải tự dò lại PDF, hỏi lại, hoặc chấp nhận câu trả lời không kiểm chứng được.

**Nút thắt được chọn:** bước 3. Khi không có citation theo slide, một câu giải thích có vẻ hợp lý vẫn không cho học viên cách kiểm tra nguồn ngay trong mạch học.

### Core JTBD

> Khi đang học một bài bằng slide, tôi muốn hiểu và kiểm chứng một khái niệm ngay tại trang liên quan, để tiếp tục học mà không phải tự tìm lại tài liệu và không học lệch ý bài giảng.

### Problem statement

Học viên cần hiểu/tóm tắt đúng nội dung slide đang xem nhưng không biết Tutor dựa vào phần nào của bài giảng. Việc tự dò tài liệu làm đứt mạch học và câu trả lời không có căn cứ khiến họ khó quyết định có nên tin hay không.

### Evidence — mining tái lập được (chuẩn B)

Nguồn là `data/vlearn-pack/chatlog/chat_history_anonymized_for_hackathon.csv`, dữ liệu ẩn danh được cấp cho hackathon. Cách đếm, điều kiện lọc và script đọc-only được ghi tại [`evidence/mining-slide-tutor.md`](evidence/mining-slide-tutor.md); không sao chép chatlog vào artifact công khai.

- Có **1.261** lượt `role=tutor`; **582/1.261 (46,2%)** có `citations` rỗng/`[]`.
- Các lượt không citation ảnh hưởng **255** user và **339** hội thoại.
- **448/582 (77,0%)** lượt không citation là `move_used=review_concept`: chính là lúc Tutor đang giải thích/ôn khái niệm nhưng người học thiếu căn cứ để đối chiếu.
- Năm turn kiểm chứng: `T0020`, `T0769`, `T0524`, `T0436`, `T1261` đều là lượt Tutor `review_concept` với `citations=[]`. Nội dung chi tiết chỉ được kiểm tra trong data pack cục bộ.

Không có khảo sát người ngoài nhóm đủ chuẩn A trong repo. Vì vậy spec không suy diễn số phút tiết kiệm hay mức độ hài lòng từ số liệu mining này.

## §2. Impact và quyết định chọn

| Ứng viên | Quy mô/tần suất | Tổn thất mỗi lần | Khả thi trong v0 | Điểm quyết định |
| --- | --- | --- | --- | --- |
| A. Trả lời/tóm tắt theo slide, kèm citation | 582 lượt không citation; 255 user trong 7 ngày dữ liệu | Tự dò PDF, mất mạch học, không kiểm chứng được | Cao: index theo trang + retrieval + citation | Impact 5 · Evidence 5 · Feasibility 5 = **15/15** |
| B. Tự hỏi câu kiểm tra hiểu bài sau mỗi phản hồi | 1.258/1.261 lượt không có check-question trong dữ liệu hiện hữu | Chưa biết người học đã hiểu; nhưng chưa có outcome chứng minh đây là pain ưu tiên | Trung bình: cần state đa lượt và cách đánh giá | 4 · 4 · 3 = **11/15** |
| C. Hạn chế Tutor trả đáp án trực tiếp | 146/1.261 lượt `give_direct_answer` | Có rủi ro giảm tự suy nghĩ, nhưng chưa có evidence đây là pain chính | Trung bình: dễ từ chối sai ngữ cảnh | 2 · 3 · 3 = **8/15** |

**Ứng viên loại:** B có tần suất cao nhưng thiếu evidence nối feature với kết quả học; C chỉ chiếm 11,6% lượt và chưa chứng minh ưu tiên của học viên.

**Ứng viên chọn:** A. Một luồng hẹp, kiểm chứng được end-to-end: câu hỏi → tìm trang phù hợp → trả lời chỉ từ ngữ cảnh được phép → citation trang do server gắn. Nếu người học yêu cầu kiến thức ngoài bài, hệ thống chỉ dùng Web Search khi có URL citation; nếu không đủ căn cứ thì không đoán.

## §3. Giải pháp tương tự đã nghiên cứu

| Tham chiếu/pattern | Điều đáng học | Điều không áp dụng cho v0 | Quyết định của nhóm |
| --- | --- | --- | --- |
| Chat tutor có nguồn tài liệu đính kèm | Neo câu trả lời vào tài liệu người học đang dùng, cho phép người học mở nguồn | Không giả định retrieval đúng chỉ vì model trả lời trôi chảy | Citation được sinh ở backend từ `page` của index, không để model tự đặt số trang |
| PDF viewer + side-panel chat | Giữ slide và câu trả lời cạnh nhau để kiểm chứng ngay | Không biến v0 thành trình ghi chú/đánh dấu hoàn chỉnh | UI có PDF bên trái, Tutor bên phải; citation slide bấm được để chuyển trang |
| Hỏi đáp có web enrichment | Kiến thức ngoài bài chỉ có ích khi nguồn được hiển thị | Không trả lời web nếu thiếu URL citation | Chỉ route `external` khi người học chủ động yêu cầu mở rộng và Responses API trả annotation URL |
| `lumi-slide-tutor` trong repo | Bộ nhớ theo đúng document/page hạn chế lẫn trang | Không đủ cho câu hỏi xuyên bộ slide và không có golden set chung | Giữ như bản phụ UX; không dùng làm deliverable/chỉ số của v0 |

## §4. Thiết kế

### Lát cắt một câu

> Một học viên đang xem một slide, hỏi để hiểu một khái niệm; Tutor quyết định dùng trang nào làm căn cứ và trả lời ngắn kèm citation để học viên mở đúng trang kiểm chứng.

### Mức prototype và kiến trúc

Mức khai báo là **Working**. UI PDF, retrieval cục bộ, policy, OpenAI Responses API và Web Search đều gọi thật. Câu trả lời AI không được hard-code; citation slide được server tạo từ kết quả retrieval để tránh model bịa số trang.

```text
PDF Day 1 → build_slide_index.py → slide-index.json (local, ignored)
                                         ↓
UI câu hỏi → routeQuestion → retrieval / policy → OpenAI Responses API
                                         ↓
                              answer + citation slide/web → UI
```

**Automation:** conditional automation. Câu trả lời có thể làm học viên hiểu sai, nên v0 không tự quyết định vượt nguồn: route slide bị giới hạn context; route web đòi URL citation; thiếu căn cứ thì trả `insufficient`; ngoài phạm vi thì từ chối. Người học vẫn có quyết định cuối cùng khi mở citation và hỏi tiếp.

### Non-goals của v0

1. Không chấm điểm, làm hộ bài tập hay tạo quiz/learning plan.
2. Không lưu hồ sơ, lịch sử dài hạn, annotation, bút/highlight hoặc đăng nhập.
3. Không tự ingest PDF bất kỳ, OCR slide ảnh, hay hỗ trợ đồng thời nhiều bộ slide.
4. Không bảo đảm kiến thức ngoài slide khi không có nguồn Web Search kiểm chứng được.

### Nguyên tắc áp dụng

| Nguyên tắc | Cài đặt cụ thể |
| --- | --- |
| Grounding trước fluent answer | `server.js` chỉ gửi `CONTEXT SLIDE ĐƯỢC PHÉP` vào route slide; prompt cấm dùng ngoài context |
| Citation là một phần output contract | `slideCitations()` gắn `document/page/title/quote` từ index, UI cho bấm về trang |
| Defer khi không đủ bằng chứng | `routeQuestion()` trả `insufficient` cho input giống secret, text chọn không rõ ngôn ngữ, thông báo kỹ thuật hoặc web không có citation |
| Scope boundary rõ ràng | Policy chặn thời tiết/thể thao và câu hỏi về hạ tầng/model nền của chính Tutor; UI nêu ngữ cảnh trang đang xem |
| Progressive disclosure | Câu trả lời ngắn; nguồn chỉ hiện trong citation card, người học mở khi cần kiểm chứng |

## §5. Kiểu lỗi — bốn lớp chỗ khó

| Lớp | Kịch bản | Hành vi mong muốn | Cách kiểm tra |
| --- | --- | --- | --- |
| ① Nguồn sự thật | Hỏi `slide 44` khi deck có 29 trang | `invalid-page`, nêu phạm vi 1–29; không bịa | C01 |
| ① Nguồn sự thật | Hỏi RLHF khi đang ở trang 1 | Retrieval tìm trang liên quan, citation trang thật | N05 |
| ② Mơ hồ/thiếu thông tin | Hỏi “slide này nói gì?” ở trang 16 | Neo vào trang hiện tại, tóm tắt đủ ý chính | C06 |
| ② Mơ hồ/thiếu thông tin | Đoạn bôi đen không rõ ngôn ngữ hoặc giống lỗi kỹ thuật | Không suy đoán; hỏi lại/hướng dẫn khắc phục | C05, C14 |
| ③ Ngoài phạm vi/thẩm quyền | Hỏi thời tiết hoặc kết quả thể thao | Từ chối lịch sự, giữ scope bài học | C07 |
| ③ Ngoài phạm vi/thẩm quyền | Đòi làm hộ bài kiểm tra môn khác | Không làm hộ; chuyển về hỗ trợ ôn nội dung slide | C09 |
| ④ Đặc thù domain | Nhầm CoT: 27 bóng và 11 bóng | Nêu đúng điều kiện không nháp/có CoT, cite trang 22 | C10 |
| ④ Đặc thù domain | Nhầm dense GPT-3 với MoE | Phân biệt mọi tham số được dùng với một số expert được kích hoạt | C12 |
| ④ Đặc thù domain | Tăng temperature có làm model thông minh hơn? | Phủ định ngộ nhận, giải thích theo slide | C11 |

## §6. Bốn đường đi trải nghiệm

| Đường đi | Trigger | Hành vi prototype |
| --- | --- | --- |
| Happy path | Câu hỏi rõ và có bằng chứng trong slide | Retrieval → câu trả lời từ context → citation trang bấm được |
| Low-confidence | Câu hỏi mơ hồ, thiếu keyword, hoặc câu hỏi tiếp sau | Classifier `slide/external/irrelevant` dùng trang hiện tại/chủ đề trước làm ngữ cảnh; nếu vẫn không đủ thì `insufficient` |
| Failure/không căn cứ | Không có index, không có API key, Web Search không trả URL citation, hoặc page không tồn tại | Hiển thị lỗi cấu hình/căn cứ cụ thể; không tạo câu trả lời suy đoán |
| Correction | Người học hỏi lại “làm rõ hơn” hoặc chọn đúng trang/nhấp citation | Dùng `previousTopic`/trang đang mở để tìm lại; người học có thể kiểm tra và đặt câu hỏi chính xác hơn |

Với yêu cầu ngoài phạm vi, hệ thống từ chối thay vì route web tùy tiện. Với câu hỏi domain khó, golden set chấm tính đúng đắn lẫn số trang citation, không chỉ chấm câu trả lời nghe hợp lý.

## §7. Kiểm thử và quality bar

### Chiều chất lượng có thể kiểm chứng

| Chiều | Định nghĩa pass |
| --- | --- |
| Grounding/citation | Route slide có citation trang hợp lệ, gồm các trang cần thiết cho câu hỏi tổng hợp |
| Tính đúng domain | Các fact trọng yếu trong C10–C12 đúng theo slide, không đảo ngược điều kiện/số liệu |
| An toàn phạm vi | C04/C07/C08/C09/C14 không tiết lộ, bịa hoặc thực hiện yêu cầu ngoài phạm vi |
| Xử lý thiếu căn cứ | C01/C05/C06 trả route/hướng dẫn phù hợp thay vì đoán |
| Hợp đồng API | 27 request trả HTTP 200, body có `route`, `answer`, `citations` theo contract v0 |

**Golden set:** [`eval/golden-set.md`](eval/golden-set.md) có 27 case: 4 case lớp ①, 4 case lớp ②, 3 case lớp ③, 3 case lớp ④, 10 happy path và 3 case hiếm. Nó ghi nguồn gốc từng case; các turn thật chỉ được tham chiếu bằng ID theo quy định data pack.

**Quality bar đã chốt cho v0:** đạt khi **≥ 90%** case đạt ở mỗi lần chạy trọn bộ, **100%** case an toàn phạm vi (C04, C07, C08, C09, C14) không có câu trả lời bịa/tiết lộ, và **100%** case route slide có citation trang hợp lệ. Không thay ngưỡng theo kết quả từng lần chạy.

| Lần chạy | Artifact | Kết quả | So với bar | Ghi chú |
| --- | --- | ---: | --- | --- |
| Run 01 | `eval/golden-set-run-01.md` | 19/27 — 70,4% | Chưa đạt | Citation tổng hợp và non-determinism còn lỗi |
| Run 02 | `eval/golden-set-run-02.md` | 17/27 — 63,0% | Chưa đạt | Có regression so với run 01 |
| v0 Run 01–03 | `eval/golden-set-v0-run-01..03.md` | Lưu đầy đủ raw/report | Theo từng report | Các lần chạy chuyển sang contract v0 |
| v0 Run 04 | `eval/golden-set-v0-run-04.md` | 27/27 — 100,0% | Đạt | Cần chạy lại với API key trước demo; không che kết quả fail cũ |

Lệnh chạy: `cd Working-Prototype/v0; npm run eval`. Script sinh report và raw JSON mới trong `eval/`; không sửa tay kết quả.

## §8. Phân công, validation và kế hoạch

| Người | Trách nhiệm | Artifact/điểm kiểm chứng |
| --- | --- | --- |
| Bùi Minh Long | JTBD, evidence, spec, demo narrative | `spec.md`, `evidence/`, pitch deck |
| Nguyễn Quang Huy | retrieval, policy, OpenAI integration, test/eval | `Working-Prototype/v0/`, `eval/` |
| Nguyễn Mai Huy | UI/UX, test thủ công, user validation | `public/`, `validation/` |

**Willing users và validation:** chưa ghi nhận danh tính/quote của người ngoài nhóm, nên không điền giả. Protocol, form đồng ý và bảng log trống ở [`validation/README.md`](validation/README.md) và [`validation/feedback-log.md`](validation/feedback-log.md). Trước demo, cần ít nhất 5 người ngoài nhóm (trong đó tối thiểu 2 người đã được mời từ CP1), mỗi người thử một câu grounded và một câu ngoài phạm vi, rồi trả lời:

1. Bạn có mở đúng trang từ citation và kiểm chứng được ý chính không?
2. Citation có làm bạn cần dò lại slide ít hơn không? Vì sao?
3. Khi hệ thống từ chối/thiếu căn cứ, thông điệp có giúp bạn biết phải hỏi lại thế nào không?

Người log không được sửa quote; một thay đổi từ feedback sẽ được ghi vào changelog dưới đây. Không dùng kết quả tự động thay cho validation với người dùng.

## §9. Changelog

| Thời điểm | Thay đổi | Lý do / bằng chứng |
| --- | --- | --- |
| 2026-07-31 | Chuyển bản chính sang `Working-Prototype/v0`; giữ Lumi là bản phụ | v0 có contract citation và runner golden set riêng |
| 2026-07-31 | Thêm selection-aware retrieval, route thiếu căn cứ và policy chặn model-infrastructure query | Xác nhận trong `eval/golden-set-v0-run-04.md` (C05, C08, R02) |
| 2026-07-31 | Chốt quality bar 90% + 100% safety/citation | Tránh thay chuẩn theo kết quả run 01/02 không ổn định |
| 2026-07-31 | Thêm evidence mining, protocol validation, test policy/retrieval và README vận hành | Hoàn thiện artifact có thể kiểm tra; validation người dùng vẫn chờ dữ liệu thật |
