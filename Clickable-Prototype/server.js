const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const slidePdf = path.resolve(
  root,
  "../data/vlearn-pack/slides/d1-slide-hackathon.pdf"
);
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function sendFile(res, filePath, contentType) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(error.code === "ENOENT" ? 404 : 500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(error.code === "ENOENT" ? "Không tìm thấy tài liệu." : "Không thể đọc tài liệu.");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
}

const port = Number(process.env.PORT || 4174);

http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  if (pathname === "/slides/d1-slide-hackathon.pdf") {
    return sendFile(res, slidePdf, "application/pdf");
  }

  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = path.resolve(root, relativePath);
  if (!filePath.startsWith(root + path.sep) && filePath !== path.join(root, "index.html")) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  return sendFile(res, filePath, mimeTypes[path.extname(filePath)] || "application/octet-stream");
}).listen(port, () => {
  console.log(`Prototype: http://localhost:${port}`);
});
