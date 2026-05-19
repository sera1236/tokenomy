'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { useStore } from '@/lib/useStore';
import { Settings, X, Flame, Play } from 'lucide-react';

interface TokenItem {
  id: string;
  sellerName: string;
  title: string;
  price: number;
  apiType: string;
  apiKey: string;
  isHotDeal?: boolean;
}

export default function TokenMarketScreen() {
  const router = useRouter();
  const setApiInfo = useStore((state) => state.setCurrentApi);
  const [marketItems, setMarketItems] = useState<TokenItem[]>([]);

  // 🌟 [추가] 사용자가 선택한 필터(모델명)와 정렬(가격순) 상태
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [sortOrder, setSortOrder] = useState('latest');

  // 🌟 [추가] 선택된 조건에 맞춰 실시간으로 매물을 걸러내고 순서를 바꿉니다.
  const displayedItems = useMemo(() => {
    let items = [...marketItems];

    // 1. 모델별 필터링
    if (selectedFilter !== 'All') {
      items = items.filter(item => {
        const type = item.apiType.toLowerCase();
        if (selectedFilter === 'GPT') return type.includes('openai');
        if (selectedFilter === 'Claude') return type.includes('claude');
        if (selectedFilter === 'Gemini') return type.includes('gemini');
        if (selectedFilter === 'Grok') return type.includes('xai');
        if (selectedFilter === 'Llama') return type.includes('groq') || type.includes('openrouter');
        return true;
      });
    }

    // 2. 가격순 정렬
    if (sortOrder === 'price_asc') items.sort((a, b) => a.price - b.price);
    else if (sortOrder === 'price_desc') items.sort((a, b) => b.price - a.price);
    
    return items;
  }, [marketItems, selectedFilter, sortOrder]);

  // 🌟 파이어베이스 실시간 데이터 연동

  // 🌟 파이어베이스 실시간 데이터 연동
  useEffect(() => {
    const q = query(collection(db, 'market_items'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as TokenItem[];
      setMarketItems(data);
    });
    return () => unsubscribe();
  }, []);

  const userPoints = useStore((state) => state.userPoints);
  const setUserPoints = useStore((state) => state.setUserPoints);

  const handleBuyClick = (apiType: string, apiKey: string) => {
    const ticketPrice = 50; 
    
    if (userPoints < ticketPrice) {
      alert(`포인트가 부족합니다! (현재 잔액: ${userPoints}원)`);
      return;
    }
    
    if (confirm(`입장료 ${ticketPrice}원이 차감됩니다. 입장하시겠습니까?`)) {
      setUserPoints(userPoints - ticketPrice); 
      setApiInfo(apiType, apiKey);
      router.push('/chat');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('이 매물을 삭제하시겠습니까?')) {
      await deleteDoc(doc(db, 'market_items', id));
    }
  };

  return (
    <main className="min-h-screen bg-[#121212] text-white flex flex-col mb-24">
      {/* 🌟 상단 바 */}
      <header className="flex justify-between items-center p-6 sticky top-0 bg-[#121212]/90 backdrop-blur-md z-40">
        <h1 className="text-2xl font-black text-white tracking-tight">토큰 거래소</h1>
        <button className="text-gray-400 hover:text-white transition">
          <Settings size={24} />
        </button>
      </header>

      {/* 🌟 거래소 리스트 영역 */}
      <div className="flex-1 px-6">
        {marketItems.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-500">현재 활성화된 매물이 없습니다.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {/* 🌟 매물 필터 및 정렬 컨트롤 패널 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 bg-[#1A1A1A] p-4 rounded-2xl border border-[#2C2C2C] shadow-lg">
        <div className="flex gap-2 overflow-x-auto no-scrollbar w-full md:w-auto pb-1 md:pb-0">
          {['All', 'GPT', 'Claude', 'Gemini', 'Grok', 'Llama'].map((model) => (
            <button
              key={model}
              onClick={() => setSelectedFilter(model)}
              className={`px-4 py-2 rounded-full text-xs font-black whitespace-nowrap transition-all ${
                selectedFilter === model 
                  ? 'bg-[#059669] text-white shadow-md transform scale-105' 
                  : 'bg-[#2C2C2C] text-gray-400 hover:text-white hover:bg-[#333]'
              }`}
            >
              {model}
            </button>
          ))}
        </div>
        
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className="bg-[#2C2C2C] text-white text-xs font-bold px-4 py-2.5 rounded-xl outline-none border border-[#333] focus:border-[#059669] w-full md:w-auto cursor-pointer"
        >
          <option value="latest">⏱ 최신 등록순</option>
          <option value="price_asc">📉 가격 낮은순</option>
          <option value="price_desc">📈 가격 높은순</option>
        </select>
      </div>

      {displayedItems.length === 0 && (
        <div className="text-center py-16 bg-[#1E1E1E] rounded-3xl border border-[#2C2C2C]">
          <span className="text-4xl mb-4 block">텅~</span>
          <p className="text-gray-400 font-bold">해당 조건에 맞는 매물이 아직 없습니다.</p>
        </div>
      )}

      {/* 🌟 전체 매물 대신, 필터링이 완료된 매물(displayedItems)을 그려줍니다. */}
      {displayedItems.map((item) => (
              <TokenCard 
                key={item.id} 
                item={item} 
                onBuyClick={() => handleBuyClick(item.apiType, item.apiKey)}
                onDeleteClick={() => handleDelete(item.id)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

// 🌟 매물 카드 컴포넌트
function TokenCard({ item, onBuyClick, onDeleteClick }: { item: TokenItem, onBuyClick: () => void, onDeleteClick: () => void }) {
  return (
    <div className="relative bg-[#1E1E1E] rounded-[32px] w-full transform transition-all duration-300 hover:scale-[0.98] hover:shadow-2xl active:scale-95 group border border-[#2C2C2C] hover:border-[#059669]">
      
      {/* 매물 삭제 버튼 */}
      <button 
        onClick={onDeleteClick}
        className="absolute top-4 right-4 p-2 text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity z-10"
      >
        <X size={20} />
      </button>

      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <span className="text-gray-400 text-sm font-bold">{item.sellerName}님의 API</span>
            
            {(item.isHotDeal || item.price <= 30000) && (
              <div className="ml-2 bg-[#3B1212] flex items-center px-2 py-1 rounded-xl">
                <Flame size={12} className="text-[#FF5252]" />
                <span className="text-[#FF5252] text-[10px] font-black ml-1">급처분</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between items-end">
          <div className="flex-1 pr-4">
            <h2 className="text-[22px] font-black text-white leading-snug">{item.title}</h2>
            <p className="text-sm text-[#059669] font-bold mt-1 uppercase tracking-wider">{item.apiType}</p>
          </div>

          <button 
            onClick={onBuyClick}
            className="flex items-center h-14 bg-gradient-to-r from-[#064E3B] to-[#059669] px-6 rounded-full hover:brightness-110 active:brightness-90 transition-all shadow-lg"
          >
            <Play size={18} fill="currentColor" className="text-white mr-2" />
            <span className="text-white font-black text-[15px]">
              {item.price.toLocaleString()}원 입장
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}