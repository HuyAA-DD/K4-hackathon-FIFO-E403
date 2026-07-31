import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lumi Slide — Trợ giảng hiểu từng slide",
  description: "Trình xem slide tích hợp AI vision, tự tạo ngữ cảnh riêng cho từng trang và trả lời câu hỏi của người học.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "Lumi Slide",
    description: "Hiểu từng slide. Hỏi sâu mọi ý.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Lumi Slide contextual AI tutor" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lumi Slide",
    description: "Hiểu từng slide. Hỏi sâu mọi ý.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}
