'use client';

import { useRouter } from 'next/navigation';
import { Shield, X, Coins } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { CryptoUtil } from '@/lib/crypto';
import { useState, useEffect, useRef, useMemo } from 'react';
// (나머지 import는 그대로 유지)

// 🌟 바로 이 녀석(export default function)이 없어서 난 에러입니다!
export default function MyPage() {
  const router = useRouter();

  const [walletBalance, setWalletBalance] = useState(0);
  const [apiKey, setApiKey] = useState('');
  const [priceRaw, setPriceRaw] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  let detectedModel = '';
  if (!apiKey) detectedModel = '';
  else if (apiKey.startsWith('AIza')) detectedModel = '제미나이군요! 🤖';
  else if (apiKey.startsWith('mn-')) detectedModel = '마누스군요! 🤖';
  else if (apiKey.startsWith('sk-ant')) detectedModel = '클로드군요! 🤖';
  else if (apiKey.startsWith('sk-or')) detectedModel = '오픈라우터군요! 🤖';
  else if (apiKey.startsWith('sk-proj') || apiKey.startsWith('sk-')) detectedModel = 'GPT군요! 🤖';
  else if (apiKey.startsWith('gsk_')) detectedModel = '그록이군요! 🤖';
  else detectedModel = '알 수 없는 API입니다.';

  const handleRecharge = () => {
    setWalletBalance(prev => prev + 5000);
    alert('5,000원이 충전되었습니다.');
  };

  const handleSubmit = async () => {
    alert("출입증 확인: " + process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
    if (!apiKey.trim()) return alert('키를 입력해주세요.');
    if (!priceRaw) return alert('가격을 입력해주세요.');

    setIsSubmitting(true);

    try {
      // 🌟 API 키 첫 글자만 보고 어떤 AI인지 귀신같이 알아내는 감지기
      let newApiType = 'unknown';
      let modelName = 'AI 모델';

      if (apiKey.startsWith('sk-ant')) { newApiType = 'claude'; modelName = 'Claude Sonnet 4-6'; }
      else if (apiKey.startsWith('sk-or-')) { newApiType = 'openrouter'; modelName = 'OpenRouter Llama'; }
      else if (apiKey.startsWith('xai-')) { newApiType = 'xai'; modelName = 'Grok 4.3 (Official)'; }
      else if (apiKey.startsWith('gsk_')) { newApiType = 'groq'; modelName = 'Groq Llama (Fast)'; }
      else if (apiKey.startsWith('sk-')) { newApiType = 'openai'; modelName = 'GPT-4o'; }
      else if (apiKey.startsWith('AIza')) {
        newApiType = 'gemini';
        modelName = 'Gemini 3.1 Pro (Ultimate)';
      }
      const scrambledKey = CryptoUtil.encrypt(apiKey.trim());

      await addDoc(collection(db, 'market_items'), {
        title: `${modelName} 토큰 판매`,
        sellerName: 'AI 전문가',
        price: Number(priceRaw) || 100,
        apiType: newApiType,
        apiKey: scrambledKey,
        createdAt: serverTimestamp()
      });

      alert('안전하게 암호화되어 등록됐어요!');
      setApiKey('');
      setPriceRaw('');
      router.push('/');

    } catch (error) {
      console.error(error);
      alert('등록 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="p-6 max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500 mb-20">
      <h1 className="text-2xl font-extrabold text-white">마이페이지</h1>

      <div className="bg-[#1E1E1E] p-6 rounded-[32px] shadow-lg">
        <p className="text-[#AAAAAA] text-sm mb-3">토큰페이 잔액</p>
        <div className="flex justify-between items-center">
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-black text-white">{walletBalance.toLocaleString()}</span>
            <span className="text-lg text-white">원</span>
          </div>
          <button
            onClick={handleRecharge}
            className="bg-[#059669] text-white px-5 py-2.5 rounded-full font-bold flex items-center gap-2 hover:bg-[#047857] transition"
          >
            <Coins size={18} />
            충전하기
          </button>
        </div>
      </div>

      <hr className="border-[#2C2C2C]" />

      <div>
        <p className="text-[#AAAAAA] font-bold text-sm">판매자 설정</p>
        <h2 className="text-2xl font-extrabold text-white mt-1">나의 AI 토큰 판매하기</h2>
      </div>

      <div className="bg-[#1E1E1E] p-6 rounded-[32px] space-y-6 shadow-lg">
        <p className={`text-center font-extrabold text-lg ${detectedModel.includes('군요') ? 'text-[#10B981]' : 'text-gray-500'}`}>
          {apiKey ? detectedModel : '입력하시면 자동으로 분류해드려요'}
        </p>

        <div className="space-y-2">
          <label className="text-[#059669] font-bold text-sm ml-2">API Key 등록</label>
          <div className="relative">
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="(나의 API 복붙하기)"
              className="w-full bg-transparent border border-[#333] focus:border-[#059669] rounded-full py-4 pl-6 pr-12 text-white outline-none transition"
            />
            {apiKey && (
              <button
                onClick={() => setApiKey('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[#059669] font-bold text-sm ml-2">1프롬프트(1k 토큰)당 가격</label>
          <div className="relative">
            <input
              type="number"
              value={priceRaw}
              onChange={(e) => setPriceRaw(e.target.value)}
              placeholder="예: 50"
              className="w-full bg-transparent border border-[#333] focus:border-[#059669] rounded-full py-4 pl-6 pr-12 text-white outline-none transition"
            />
            <span className="absolute right-6 top-1/2 -translate-y-1/2 text-white font-bold">원</span>
          </div>
          <p className="text-[11px] text-[#AAAAAA] ml-2">권장 시세: 프롬프트당 30원 ~ 50원</p>
        </div>

        <div className="bg-[#1A2E26] border border-[#059669] p-5 rounded-3xl mt-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield size={18} className="text-[#10B981]" />
            <span className="text-[#10B981] font-bold text-sm">100% 안전 보장 시스템</span>
          </div>
          <ul className="text-[12px] text-gray-300 space-y-1 ml-1 list-disc list-inside">
            <li>군사급 암호화 파이프라인으로 안전하게 보관됩니다.</li>
            <li>OpenAI 대시보드에서 'Project Key' 발급을 권장합니다.</li>
            <li>판매 기간 종료 즉시 서버에서 영구 삭제(Hard Drop)됩니다.</li>
          </ul>
        </div>

        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full bg-[#059669] hover:bg-[#047857] disabled:opacity-50 text-white font-bold py-5 rounded-full text-lg mt-6 transition shadow-lg"
        >
          {isSubmitting ? '안전하게 등록 중...' : '판매 게시글 등록'}
        </button>
      </div>
    </main>
  );
}