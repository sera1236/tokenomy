import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      {/* 🌟 이제 모든 페이지에서 sig-gradient와 sig-solid 변수를 쓸 수 있습니다. */}
      <body className={`${inter.className} bg-[#121212] text-white min-h-screen relative`}>
        <div className="layout-root">
          {children}
        </div>
      </body>
    </html>
  );
}