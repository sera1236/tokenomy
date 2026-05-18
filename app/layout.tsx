import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { ShoppingCart, MessageSquare, User } from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Token Market",
  description: "안전한 인공지능 토큰 공유 경제",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className={`${inter.className} bg-[#121212] text-white min-h-screen relative`}>
        {/* 안드로이드의 NavHost 역할을 하는 구역 */}
        <div className="pb-24">
          {children}
        </div>

        {/* 🌟 [핵심] 하단 네비게이션 바 (안드로이드의 BottomBar) */}
        <nav className="fixed bottom-0 left-0 right-0 h-20 bg-[#1E1E1E] border-t border-[#2C2C2C] flex justify-around items-center z-50">
          <Link href="/" className="flex flex-col items-center text-gray-400 hover:text-[#059669]">
            <ShoppingCart size={24} />
            <span className="text-[10px] font-bold mt-1">거래소</span>
          </Link>
          <Link href="/chat" className="flex flex-col items-center text-gray-400 hover:text-[#059669]">
            <MessageSquare size={24} />
            <span className="text-[10px] font-bold mt-1">채팅 기록</span>
          </Link>
          <Link href="/mypage" className="flex flex-col items-center text-gray-400 hover:text-[#059669]">
            <User size={24} />
            <span className="text-[10px] font-bold mt-1">마이페이지</span>
          </Link>
        </nav>
      </body>
    </html>
  );
}