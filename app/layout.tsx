import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "토크노미 (Tokenomy)",
  description: "세계 최초 실시간 AI 토큰 거래소 및 릴레이 챗",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className={`${inter.className} bg-[#121212] text-white min-h-screen relative`}>
        {/* 🌟 탭바를 철거하고 불필요한 하단 여백(pb-24)도 완전히 날렸습니다. */}
        <div>
          {children}
        </div>
      </body>
    </html>
  );
}