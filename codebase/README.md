# VLearn working template

## Chạy local

```powershell
cd codebase
npm start
```

Mở `http://localhost:3000`. Server tự đọc `../.env` của project và dùng `OPENAI_API_KEY` ở backend; không đưa key xuống trình duyệt.

Hỗ trợ upload PDF (render từng trang + trích text), PPTX (trích text XML), ảnh, TXT và Markdown. File chỉ tồn tại trong bộ nhớ trình duyệt, không được upload lên server.
