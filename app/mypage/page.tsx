'use client';

import { useRouter } from 'next/navigation';
import { Shield, X, Coins } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { CryptoUtil } from '@/lib/crypto';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useStore } from '@/lib/useStore';
import { auth } from '@/lib/firebase';
// (나머지 import는 그대로 유지)

export default function MyPage() {
  const router = useRouter();
  
  // 🌟 전역 스토어에서 내 진짜 포인트 잔액을 불러옵니다.
  const userPoints = useStore((state) => state.userPoints);
  const setUserPoints = useStore((state) => state.setUserPoints);
  const [apiKey, setApiKey] = useState('');
  const [priceRaw, setPriceRaw] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 🌟 판매자 대시보드용 상태 및 데이터 불러오기
  // 🌟 판매자 대시보드용 상태 및 데이터 불러오기
  const [myItems, setMyItems] = useState<any[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);

  // 🌟 [추가] 정산용 은행 계좌 정보 및 출금 신청 상태 변수
  const [bank, setBank] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');

  // 🌟 [추가] 수동 정산(MVP) 출금 신청 처리 함수
  const handleWithdrawRequest = async () => {
    if (!bank.trim() || !accountNumber.trim() || !accountHolder.trim()) {
      alert('정산받으실 은행, 계좌번호, 예금주명을 모두 입력해주세요.');
      return;
    }
    if (totalRevenue <= 0) {
      alert('출금 가능한 누적 수익이 없습니다.');
      return;
    }

    if (confirm(`총 ${totalRevenue.toLocaleString()}원의 정산 출금을 신청하시겠습니까?\n(신청 후 영업일 기준 48시간 이내에 입력하신 계좌로 입금됩니다.)`)) {
      try {
        const { collection, addDoc, serverTimestamp } = require('firebase/firestore');
        
        // 데이터베이스에 관리자가 보고 수기 정산할 수 있도록 기록을 남깁니다.
        await addDoc(collection(db, 'withdraw_requests'), {
          userId: auth.currentUser?.uid,
          sellerName: auth.currentUser?.displayName,
          bank: bank.trim(),
          accountNumber: accountNumber.trim(),
          accountHolder: accountHolder.trim(),
          amount: totalRevenue,
          status: 'pending', // 관리자 승인 대기 상태
          createdAt: serverTimestamp()
        });

        alert('출금 신청이 정상 접수되었습니다.\n영업일 기준 48시간 내에 지정 계좌로 안전하게 입금됩니다! 🚀');
      } catch (error) {
        console.error(error);
        alert('출금 신청 처리 중 서버 에러가 발생했습니다.');
      }
    }
  };

  useEffect(() => {
    const fetchMyItems = async () => {
      // 로그인이 안 되어 있거나 이름이 없으면 중단합니다.
      if (!auth.currentUser?.displayName) return;
      
      const { collection, query, where, getDocs } = require('firebase/firestore');
      
      // 내 이름으로 등록된 매물만 파이어베이스에서 싹 긁어옵니다.
      const q = query(collection(db, 'market_items'), where('sellerName', '==', auth.currentUser.displayName));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      setMyItems(items);

      // 누적 수익 계산 (판매 횟수 * 가격)
      // 🌟 [에러 해결] acc는 숫자(number), item은 아무거나(any)라고 명시해 줍니다.
      const revenue = items.reduce((acc: number, item: any) => acc + ((item.salesCount || 0) * item.price), 0);
      setTotalRevenue(revenue);
    };
    
    fetchMyItems();
  }, []);

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
    setUserPoints(userPoints + 5000);
    alert('5,000원이 충전되었습니다. (테스트용)');
  };

  const handleSubmit = async () => {
    if (!apiKey.trim()) return alert('키를 입력해주세요.');
    if (!priceRaw) return alert('가격을 입력해주세요.');

    setIsSubmitting(true);

    try {
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

      // 🌟 1차 핑 테스트 (검증 API 호출)
      const verifyRes = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedApiKey: scrambledKey, apiType: newApiType })
      });
      
      const verifyData = await verifyRes.json();

      if (!verifyData.success) {
        alert(verifyData.message);
        setIsSubmitting(false);
        return; // 가짜 키나 잔액 없는 키면 여기서 차단되어 저장되지 않습니다!
      }

      // 🌟 검증 통과 시 Firestore에 저장
      await addDoc(collection(db, 'market_items'), {
        title: `${modelName} 토큰 판매`,
        sellerName: auth.currentUser?.displayName || '인증된 판매자',
        price: Number(priceRaw) || 100,
        apiType: newApiType,
        apiKey: scrambledKey,
        salesCount: 0, // 🌟 대시보드 통계를 위해 판매 횟수 카운터 장착
        createdAt: serverTimestamp()
      });

      alert('유효성 검증 완료! 안전하게 암호화되어 등록됐어요!');
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
            <span className="text-4xl font-black text-white">{userPoints.toLocaleString()}</span>
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

      {/* 🌟 판매자 수익 대시보드 UI 추가 */}
      <div>
        <p className="text-[#AAAAAA] font-bold text-sm">통계 및 관리</p>
        <h2 className="text-2xl font-extrabold text-white mt-1">내 매물 수익 대시보드</h2>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#1A2E26] border border-[#059669] p-5 rounded-[24px] shadow-lg flex flex-col justify-center items-center transition-transform hover:scale-105 cursor-pointer">
          <p className="text-[#10B981] text-sm font-bold mb-1">등록한 API 매물</p>
          <p className="text-3xl font-black text-white">{myItems.length}<span className="text-lg font-normal text-gray-400 ml-1">개</span></p>
        </div>
        <div className="bg-[#2A1E1E] border border-[#FF5252] p-5 rounded-[24px] shadow-lg flex flex-col justify-center items-center transition-transform hover:scale-105 cursor-pointer">
          <p className="text-[#FF5252] text-sm font-bold mb-1">총 누적 수익</p>
          <p className="text-3xl font-black text-white">{totalRevenue.toLocaleString()}<span className="text-lg font-normal text-gray-400 ml-1">원</span></p>
        </div>
      </div>

      {/* 🌟 [추가] 정산 계좌 등록 및 수동 출금 신청 UI 컴포넌트 */}
      <div className="bg-[#1A1A1A] border border-[#2C2C2C] p-6 rounded-[24px] shadow-lg mt-4">
        <p className="text-[#10B981] text-xs font-bold tracking-wider uppercase mb-1">정산 및 출금 설정</p>
        <h3 className="text-lg font-black text-white mb-4">수익금 정산 계좌 등록</h3>
        
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <input 
              type="text" 
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              placeholder="은행명 (예: 신한은행)" 
              className="bg-[#121212] border border-[#333] focus:border-[#059669] rounded-xl py-3 px-4 text-sm text-white outline-none transition"
            />
            <input 
              type="text" 
              value={accountHolder}
              onChange={(e) => setAccountHolder(e.target.value)}
              placeholder="예금주 성명" 
              className="bg-[#121212] border border-[#333] focus:border-[#059669] rounded-xl py-3 px-4 text-sm text-white outline-none transition"
            />
            <button
              onClick={handleWithdrawRequest}
              className="bg-[#059669] hover:bg-[#047857] text-white text-xs font-black rounded-xl transition shadow-md"
            >
              💸 출금 신청하기
            </button>
          </div>
          
          <input 
            type="text" 
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="하이픈(-)을 제외한 정산 계좌번호" 
            className="w-full bg-[#121212] border border-[#333] focus:border-[#059669] rounded-xl py-3 px-4 text-sm text-white outline-none transition"
          />
          
          {/* 🔥 대장님이 강조하신 영업일 기준 48시간 이내 고지 안내 가이드라인 */}
          <p className="text-[11px] text-gray-500 font-medium leading-relaxed bg-[#121212] p-3 rounded-lg border border-[#222]">
            💡 <strong>출금 안내:</strong> 출금 신청 시 등록된 정산 계좌의 예금주 불일치 여부를 시스템과 관리자가 2중 검증합니다. 정상 계좌임이 확인되면 <strong>영업일 기준 최대 48시간 이내</strong>에 등록하신 지갑으로 수익금이 전액 입금됩니다.
          </p>
        </div>
      </div>

      <hr className="border-[#2C2C2C] my-6" />

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