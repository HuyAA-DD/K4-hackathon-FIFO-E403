window.TUTOR_RULES = [
  {
    keywords: ["tóm tắt", "slide này", "nội dung"],
    answer: "Slide Day 1 giới thiệu nền tảng AI/LLM: mô hình ngôn ngữ tạo phản hồi bằng cách dự đoán token tiếp theo; Transformer dùng self-attention để xét ngữ cảnh giữa các token.",
    sourceType: "Trong tài liệu",
    citation: "d1-slide-hackathon.pdf · Day 1 Foundation · phần AI/LLM và Transformer"
  },
  {
    keywords: ["transformer", "self-attention", "attention"],
    answer: "Transformer là kiến trúc xử lý chuỗi. Self-attention cho phép mô hình đánh giá token nào liên quan nhất với token hiện tại để hiểu ngữ cảnh trước khi dự đoán token tiếp theo.",
    sourceType: "Trong tài liệu",
    citation: "d1-slide-hackathon.pdf · Day 1 Foundation · phần Transformer & self-attention"
  },
  {
    keywords: ["rag", "citation", "trích dẫn", "nguồn"],
    answer: "RAG truy xuất các đoạn liên quan từ kho tài liệu trước khi tạo câu trả lời. Trong prototype này, citation cho biết câu trả lời lấy từ slide nào; nếu không tìm thấy trong slide, Tutor sẽ gắn nguồn ngoài riêng biệt.",
    sourceType: "Trong tài liệu",
    citation: "d1-slide-hackathon.pdf · Day 1 Foundation · phần hallucination và RAG"
  }
];

window.EXTERNAL_FALLBACK = {
  answer: "Mình chưa tìm thấy nội dung này trong slide Day 1. Đây là kiến thức tham khảo ngoài tài liệu: hãy kiểm tra lại với giảng viên nếu bạn cần áp dụng vào bài tập của khoá.",
  sourceType: "Nguồn ngoài",
  citation: "Wikipedia · Large language model · https://en.wikipedia.org/wiki/Large_language_model"
};
