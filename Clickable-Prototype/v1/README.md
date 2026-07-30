# VLearn Tutor - Clickable Prototype

Prototype web tĩnh mô phỏng màn hình VLearn: PDF slide ở trái, VLearn Tutor ở phải và panel có thể ẩn/hiện.

## Chạy local

Yêu cầu: Node.js 18+.

```powershell
cd D:\AIIA\K4-hackathon-FIFO-E403\Clickable-prototype\v1
npm start
```

Mở `http://localhost:4175`.

## Cấu trúc

```
hackathon-clickable-prototype/
├── index.html          # Layout slide viewer + Tutor
├── styles.css          # Giao diện mô phỏng VLearn
├── app.js              # Panel toggle + gửi/tạo message
├── data/rules.js       # Keyword/rule -> câu trả lời + citation
├── server.js           # Static server, route PDF từ data pack
├── package.json
└── README.md
```

## Quy tắc trả lời hiện tại

- Keyword khớp `tóm tắt`, `Transformer`, `self-attention`, `RAG`, `trích dẫn` sẽ dùng câu trả lời **Trong tài liệu**.
- Không khớp rule sẽ trả về **Nguồn ngoài** với citation riêng.
- Đây là prototype rule-based, không gọi LLM/API và không dùng dữ liệu chatlog.

> Không commit file PDF hoặc data pack vào repo nộp bài. `server.js` chỉ đọc PDF từ vị trí data pack cục bộ khi demo.
