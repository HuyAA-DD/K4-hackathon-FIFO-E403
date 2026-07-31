# User validation protocol

Mục tiêu là kiểm tra liệu citation theo trang có giúp người học tự kiểm chứng câu trả lời và biết phải làm gì khi Tutor thiếu căn cứ hay không. Đây là validation với người ngoài nhóm, không phải golden-set tự động.

## Điều kiện tối thiểu

- Ít nhất 5 người ngoài nhóm; ghi vai trò/bối cảnh học ở mức không định danh.
- Ít nhất 2 người đã được mời làm willing user từ CP1.
- Mỗi người thử: một câu hỏi có căn cứ trong slide, một câu ngoài phạm vi hoặc thiếu căn cứ.
- Chỉ dùng slide/data được cấp; không ghi API key, ảnh màn hình có dữ liệu nhạy cảm, hay tên thật nếu người thử không đồng ý.

## Kịch bản 10 phút mỗi người

1. Mở `Working-Prototype/v0`, chọn một trang và hỏi một khái niệm trên trang đó.
2. Yêu cầu người thử bấm citation và nói liệu họ có kiểm chứng được ý chính không.
3. Hỏi một câu ngoài nội dung bài hoặc mơ hồ để quan sát cách Tutor từ chối/hỏi lại.
4. Hỏi ba câu trong bảng dưới, ghi **nguyên văn** câu trả lời khi có đồng ý.

| Câu hỏi | Điều cần quan sát |
| --- | --- |
| Bạn có mở đúng trang từ citation và kiểm chứng được ý chính không? | Citation có thể hành động được |
| So với tự dò PDF, citation làm bạn thay đổi bước nào? | Tín hiệu về giảm ma sát, không ép ước lượng phút |
| Khi Tutor thiếu căn cứ/từ chối, bạn có biết phải hỏi lại thế nào không? | Tính hữu ích của failure path |

## Cách ghi và ra quyết định

Điền từng phiên vào [`feedback-log.md`](feedback-log.md). Không điền phản hồi mẫu, không gộp nhiều người thành một quote, và không sửa các quote để trông tích cực hơn. Sau khi có ít nhất 5 phiên, nhóm chỉ thay đổi v0 khi feedback lặp lại ở từ 2 người trở lên hoặc một lỗi nghiêm trọng được tái hiện; ghi quyết định vào `spec.md` §9.

Hiện chưa có feedback người dùng đã xác minh trong repo. Đây là trạng thái cố ý, trung thực; không dùng bảng trống để tuyên bố v0 đã qua validation.
