# AI SPEC — Tutor đọc hiểu slide và trả lời có trích dẫn · Nhóm [điền tên] · Zone [điền zone]

Hướng: [x] A — VLearn  [ ] B — Trợ lý Học viên  [ ] C — Làn mở  
Loại: [x] Tối ưu tính năng có sẵn  [ ] Tính năng mới

## §1. User & Job

### Job executor + workflow

**Job executor:** Học viên đang xem slide trong buổi học và vừa gặp một slide hoặc đoạn slide chưa hiểu.

**Workflow hiện tại:**

1. Học viên xem slide trong VLearn và cần hiểu/tóm tắt một khái niệm.
2. Học viên bôi đen đoạn hoặc hỏi AI Tutor về số trang/slide.
3. Tutor trả lời lý thuyết; trong nhiều lượt, câu trả lời không xuất hiện hoặc không kèm citation nên học viên không biết thông tin có bám slide không.
4. Học viên tự dò lại slide/tài liệu, hỏi lại, hoặc chấp nhận câu trả lời không kiểm chứng được.

**Nút thắt nhóm chọn:** bước 3 — Tutor chưa đáng tin cậy để giải thích *theo slide đang học*: không đọc/hiểu slide một cách rõ ràng và không hiển thị căn cứ. Khi dùng nguồn ngoài, người học cũng không biết nguồn đó là gì.

### Core JTBD

**Hiểu và kiểm chứng nội dung của slide đang xem trong lúc học, mà không phải rời mạch bài giảng để tự tìm lại nguồn.**

### Problem statement

Học viên đang xem slide trong buổi học cần hiểu hoặc tóm tắt đúng nội dung của slide đang mở. Hiện họ không kiểm chứng được câu trả lời của Tutor với bài giảng, vì Tutor chưa trả lời dựa trên nội dung slide một cách minh bạch và nhiều phản hồi không có citation. Hệ quả là học viên phải tự dò lại tài liệu, mất mạch học và có nguy cơ học lệch trọng tâm của bài.

### Evidence

#### A. Khảo sát/quan sát thực tế của nhóm

Nhóm đã quan sát thực tế rằng AI Tutor chưa có khả năng đọc hiểu slide để tóm tắt/trả lời trực tiếp; các câu trả lời lý thuyết có thể dựa vào nguồn bên ngoài nhưng không nêu citation cụ thể.

> **Việc cần hoàn tất trước khi chốt CP1:** thêm log khảo sát đầy đủ ở `evidence/survey-slide-tutor.md`: số người ngoài nhóm `n = ___`, câu hỏi khảo sát, từng câu trả lời, tỷ lệ xác nhận. Không điền tỷ lệ khi chưa có log.

#### B. Mining chatlog VLearn

- Dataset: 1.261 lượt Tutor (369 user, 585 hội thoại), thời gian 22/07–29/07/2026.
- **582/1.261 phản hồi Tutor không có citation** (`citations = []` hoặc rỗng) = **46,2%**.
- Các 582 lượt này xuất hiện ở **255 user** và **339 hội thoại**.
- Trong nhóm không citation có **448 lượt `review_concept`** — tức Tutor đang giải thích/ôn khái niệm nhưng không cho người học căn cứ để kiểm chứng.
- Cách đếm tái lập: import `data/vlearn-pack/chatlog/chat_history_anonymized_for_hackathon.csv` → lọc `role = tutor` → đếm `citations = []` hoặc rỗng; sau đó lọc tiếp `move_used = review_concept`.

#### Năm ví dụ nguyên văn/mã hội thoại

| Mã turn | Câu hỏi học viên (nguyên văn) | Quan sát kiểm chứng được |
|---|---|---|
| T0020 | “Giải thích đoạn bôi đen ở Trang 15.” | `citations = []`, `move_used = review_concept` |
| T0769 | “giải thích nghĩa chi tiết của trang 4” | `citations = []`, `move_used = review_concept` |
| T0524 | “bạn đọc được nội dung slide ko , giải thích cho mình slide 44” | `citations = []`, `move_used = review_concept` |
| T0436 | “Giải thích slide 35” | `citations = []`, `move_used = review_concept` |
| T1261 | “giải thích kỹ cơ chế transformer” | `citations = []`, `move_used = review_concept` |

> Bản nộp chỉ dùng mã turn và trích dẫn ngắn như bảng trên; không commit file chatlog gốc.

## §2. Impact & quyết định chọn

### Ba ứng viên đã so sánh

| Ứng viên | Ai bị ảnh hưởng · tần suất quan sát | Tốn gì mỗi lần | Khả thi trong hackathon | Điểm số quyết định |
|---|---|---|---|---|
| **A. Tutor đọc slide, trả lời/tóm tắt kèm citation** | 255 user; 582/1.261 lượt Tutor không citation (46,2%) trong 7 ngày data | Mất mạch học để tự dò slide; rủi ro không kiểm chứng được nội dung. Thời gian/phút: **chưa đo, sẽ xác nhận bằng survey** | Cao: dùng slide/transcript được cấp, retrieval + citation + UI prototype | **Impact 5/5 · Evidence 5/5 · Feasibility 5/5 = 15/15** |
| B. Tutor hỏi câu kiểm tra hiểu bài sau phản hồi | 367 user; 1.258/1.261 lượt không có check-question (99,8%) | Không biết học viên có hiểu sau câu trả lời không; chưa đo tác động lên quiz | Trung bình: cần thiết kế sư phạm đa lượt và đo hiệu quả học, scope rộng hơn | Impact 4/5 · Evidence 4/5 · Feasibility 3/5 = 11/15 |
| C. Hạn chế Tutor trả lời đáp án trực tiếp | 92 user; 146/1.261 lượt `give_direct_answer` (11,6%) | Có thể làm giảm việc tự suy nghĩ; chưa có evidence rằng học viên coi đây là pain chính | Trung bình: cần phân biệt câu cần đáp án với câu cần gợi ý, rủi ro từ chối sai | Impact 2/5 · Evidence 3/5 · Feasibility 3/5 = 8/15 |

### Ứng viên đã loại

- **B — Kiểm tra hiểu bài sau phản hồi:** tín hiệu xuất hiện rất rộng (99,8% lượt không có check-question), nhưng nhóm chưa có evidence nối trực tiếp feature này với kết quả học tập. Feature còn đòi hỏi thiết kế state đa lượt, quiz/checkpoint và cách đánh giá, vượt phạm vi 1,5 ngày.
- **C — Hạn chế trả lời đáp án trực tiếp:** chỉ chiếm 11,6% lượt Tutor; dữ liệu hiện tại chưa chứng minh đây là pain ưu tiên của học viên. Nếu chặn không đúng lúc, Tutor có thể trở nên kém hữu ích.

### Ứng viên chọn và lý do

Nhóm chọn **A — Tutor đọc hiểu slide, tóm tắt/trả lời kèm citation; nếu dùng nguồn ngoài thì phải dẫn nguồn rõ ràng**.

Lý do bằng số:

1. **Quy mô:** 582 lượt không citation, tương đương 46,2% trong 1.261 phản hồi Tutor; ảnh hưởng 255/369 user trong tập dữ liệu.
2. **Phù hợp pain khảo sát:** nhóm đã quan sát trực tiếp Tutor không đọc/hiểu slide và không nêu nguồn cụ thể, nên học viên không đối chiếu được với bài giảng.
3. **Khả thi:** MVP chỉ cần một luồng hẹp: nhận câu hỏi + nội dung slide → truy xuất slide → trả lời/tóm tắt kèm số trang/đoạn; fallback nêu rõ không có căn cứ. Tất cả đều dùng data slide/transcript được cấp.
4. **Rủi ro lỗi thấp hơn các ứng viên còn lại:** khi không tìm được thông tin trong slide, hệ thống không bịa; nếu dùng nguồn ngoài, phải hiển thị tên/link nguồn. Điều này có thể kiểm thử rõ bằng golden set.

### Impact cần xác nhận ở vòng validation

Nhóm không tuyên bố số phút tiết kiệm khi chưa đo. Ở CP5, nhóm sẽ hỏi ít nhất 5 người thử:

1. “Ở câu trả lời có citation, bạn có kiểm chứng được thông tin nằm ở slide nào không?”
2. “So với Tutor hiện tại, bạn có phải tự dò lại slide ít hơn không? Nếu có, ước lượng giảm bao nhiêu phút/lần?”
3. “Nếu Tutor dùng nguồn ngoài, citation có đủ để bạn quyết định tin/không tin câu trả lời không?”
Kết quả sẽ thay thế phần “chưa đo” trong bảng impact; không hồi tố sửa quality bar sau hạn chốt.


