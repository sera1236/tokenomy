'use client';

import { useState, useEffect } from 'react';
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

  // 🌟 파이어베이스 실시간 데이터 연동
  useEffect(() => {
    const q = query(collection(db, 'market_items'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as TokenItem[];
      setMarketItems(data);
    });
    return () => unsubscribe();
  }, []);

  const handleBuyClick = (apiType: string, apiKey: string) => {
    setApiInfo(apiType, apiKey);
    router.push('/chat');
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
            {marketItems.map((item) => (
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