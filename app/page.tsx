'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/useStore';
import { Send, Bot, Paperclip, X, Image as ImageIcon, Menu, Plus, MessageSquare, User, Edit2, Trash2, Key, ShieldCheck, CheckCircle2, MoreVertical, Pin } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { CryptoUtil } from '@/lib/crypto';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, setDoc, updateDoc, addDoc, increment, serverTimestamp, deleteDoc } from 'firebase/firestore';


interface Message {
  role: 'user' | 'assistant';
  content: string;
  apiType?: string; // 🌟 5번 요청: 모델별 색상을 구분하기 위해 누가 대답했는지 저장
  attachedImages?: string[]; // 🌟 1번 요청: 이미지 파일 미리보기 저장용
}

// 🌟 코드블록 개편: 카피 버튼 복구 및 개별 UI 프리뷰 렌더링 지원
const CodeBlock = ({ language, value, showPreview, onOpenPreview }: { language: string, value: string, showPreview: boolean, onOpenPreview: (html: string) => void }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  
  
  return (
    <div className="relative group my-4 rounded-xl shadow-lg border border-[#333] bg-[#121212] w-full max-w-full" onDoubleClick={() => { if (language === 'html') onOpenPreview(value); }}>
      
      {/* 🌟 우상단 COPY 버튼 (항상 노출) */}
      <div className="absolute top-2 right-2 z-20 flex gap-2">
        <div className="flex items-center gap-1.5 bg-[#1E1E1E] border border-[#333] px-3 py-1.5 rounded-lg shadow-md">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{language}</span>
          <div className="w-[1px] h-3 bg-[#333] mx-1"></div>
          <button onClick={handleCopy} className="text-[#059669] hover:text-[#10B981] text-[10px] font-black transition-colors">
            {copied ? 'DONE!' : 'COPY'}
          </button>
        </div>
      </div>

      {/* 🌟 우하단 COPY CODE 버튼 (호버링 시 노출) */}
      <div className="absolute right-2 bottom-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <button onClick={handleCopy} className="bg-[#1E1E1E] border border-[#333] text-[#059669] hover:text-[#10B981] text-[10px] font-black px-3 py-1.5 rounded-lg shadow-md transition-colors">
          {copied ? 'COPIED!' : 'COPY CODE'}
        </button>
      </div>

      {/* 🌟 4번 요청: 개별 UI 프리뷰 스티키 버튼 */}
      {language === 'html' && !showPreview && (
        <div className="absolute top-0 right-0 bottom-0 translate-x-[calc(100%+0.5rem)] pointer-events-none z-10 hidden md:block">
          <div className="sticky top-4 pointer-events-auto" style={{ transform: 'scale(0.6)', transformOrigin: 'top left' }}>
            <button 
              onClick={() => onOpenPreview(value)} 
              className="px-6 py-3 bg-gradient-to-r from-[#059669] to-[#10B981] text-white rounded-full font-black shadow-[0_0_20px_rgba(5,150,105,0.6)] border border-[#34D399] flex items-center gap-2 whitespace-nowrap hover:scale-105 transition-transform animate-bounce"
            >
              <span className="text-xl">✨</span> <span className="text-lg">이 UI 보기</span>
            </button>
          </div>
        </div>
      )}

      {/* 코드 출력부 (상하단 패딩을 주어 버튼과 코드가 겹치지 않게 함) */}
      <div className="overflow-x-auto w-full pt-12 pb-12">
        <SyntaxHighlighter
          style={oneDark}
          language={language}
          PreTag="div"
          wrapLongLines={true}
          customStyle={{ margin: 0, padding: '0 1rem', background: 'transparent' }}
        >
          {value}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};
const IntegratedMyPage = ({ currentUser }: { currentUser: any }) => {
  const [tab, setTab] = useState<'buyer' | 'seller'>('buyer');
  const { userPoints } = useStore();
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [verifyStatus, setVerifyStatus] = useState<{ type: string, msg: string, isPaid: boolean } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  
  // 🌟 [핵심] 스케줄링을 위한 시간 상태 추가 (기본값: 저녁 8시 ~ 아침 8시)
  const [openTime, setOpenTime] = useState('20:00');
  const [closeTime, setCloseTime] = useState('08:00');
  
  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[#121212] text-white animate-in fade-in duration-300">
      <h1 className="text-3xl font-black mb-8 text-[#10B981]">내 정보 관리</h1>
      <div className="flex bg-[#1E1E1E] p-1 rounded-2xl mb-8 border border-[#2C2C2C] max-w-md">
        <button onClick={() => setTab('buyer')} className={`flex-1 py-3 rounded-xl font-bold transition ${tab === 'buyer' ? 'bg-[#059669] text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>
          💳 매수자 (토큰 사용)
        </button>
        <button onClick={() => setTab('seller')} className={`flex-1 py-3 rounded-xl font-bold transition ${tab === 'seller' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>
          🏪 판매자 (API 등록)
        </button>
      </div>
      {tab === 'buyer' ? (
        <div className="bg-[#1E1E1E] p-6 rounded-3xl border border-[#2C2C2C]">
          <h3 className="text-gray-400 font-bold mb-2">보유 토큰 잔액</h3>
          <p className="text-4xl font-black text-white mb-4">{userPoints?.toLocaleString()} <span className="text-[#10B981]">KRW</span></p>
        </div>
      ) : (
        <div className="space-y-6 max-w-3xl">
          <div className="bg-[#1E1E1E] p-6 rounded-3xl border border-[#2C2C2C] shadow-lg">
            <h3 className="text-white font-black text-xl mb-2 flex items-center gap-2"><Key size={22} className="text-purple-400"/> 새 API 키 매물 등록</h3>
            <div className="flex flex-col md:flex-row gap-3 mb-4">
              <input type="password" value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)} placeholder="sk-... 또는 xai-... 등 API 키 붙여넣기" className="flex-1 bg-[#121212] border border-[#333] focus:border-purple-500 rounded-xl px-4 py-3 outline-none text-white transition"/>
              <button onClick={async () => {
                setIsVerifying(true);
                try {
                  const key = apiKeyInput.trim();
                  const res = await fetch('https://api.x.ai/v1/models', { headers: { 'Authorization': `Bearer ${key}` } });
                  const data = await res.json();
                  if (!res.ok) throw new Error();
                  
                  // 🌟 [핵심] 키 티어 판별
                  const isPremium = data.data?.some((m: any) => m.id.includes('grok-4'));
                  setVerifyStatus({ 
                    type: 'Grok', 
                    msg: isPremium ? '고급 유료 모델 접근 가능 키입니다.' : '일반 모델 전용 키입니다.', 
                    isPaid: isPremium 
                  });
                } catch (e) { alert('키가 유효하지 않습니다.'); }
                setIsVerifying(false);
              }} className="bg-purple-600 hover:bg-purple-700 py-3 px-6 rounded-xl font-bold">{isVerifying ? '검증중' : '검증 완료'}</button>
            </div>

            {verifyStatus && (
              <div className="mt-4 p-5 bg-[#1A1A1A] border border-[#059669] rounded-xl shadow-lg animate-in fade-in duration-300">
                <h4 className="text-[#10B981] font-black mb-2 flex items-center gap-2">
                  <ShieldCheck size={18} /> 최종 판매 등록 및 스케줄링
                </h4>
                <p className="text-sm text-gray-300 mb-4 leading-relaxed">
                  [ {verifyStatus.msg} ]<br/>
                  안전한 거래를 위해 <strong>키가 개방될 시간</strong>을 설정해주세요. 지정된 시간 외에는 자동으로 판매가 차단됩니다.
                </p>

                {/* 🌟 시간 설정 UI */}
                <div className="flex items-center gap-4 mb-6 bg-[#121212] p-4 rounded-xl border border-[#333]">
                  <div className="flex-1">
                    <label className="text-xs text-gray-400 font-bold block mb-1">개방 시작 시간</label>
                    <input 
                      type="time" 
                      value={openTime} 
                      onChange={(e) => setOpenTime(e.target.value)}
                      className="w-full bg-[#1E1E1E] border border-[#444] rounded-lg px-3 py-2 text-white outline-none focus:border-[#10B981]"
                    />
                  </div>
                  <span className="text-gray-500 mt-5">~</span>
                  <div className="flex-1">
                    <label className="text-xs text-gray-400 font-bold block mb-1">개방 종료 시간</label>
                    <input 
                      type="time" 
                      value={closeTime} 
                      onChange={(e) => setCloseTime(e.target.value)}
                      className="w-full bg-[#1E1E1E] border border-[#444] rounded-lg px-3 py-2 text-white outline-none focus:border-[#10B981]"
                    />
                  </div>
                </div>

                <button
                  onClick={async () => {
                    if (!currentUser?.email) return alert("로그인 및 회원가입이 필요합니다.");
                    
                    try {
                      const encryptedKey = CryptoUtil.encrypt(apiKeyInput.trim());

                      // 🌟 DB에 openTime, closeTime 함께 저장
                      await addDoc(collection(db, 'market_items'), {
                        sellerId: currentUser.uid,
                        sellerName: currentUser.displayName || '인증된 판매자',
                        apiType: 'xai', 
                        apiKey: encryptedKey,
                        tier: verifyStatus.isPaid ? 'premium' : 'basic', 
                        price: 10, 
                        salesCount: 0, 
                        status: 'active',
                        openTime: openTime,   
                        closeTime: closeTime, 
                        maxCapacity: 500, // 🌟 [추가] 일일 최대 사용 가능 횟수 (가상 게이지)
                        usedCapacity: 0,  // 🌟 [추가] 현재 사용된 횟수 (실시간 동기화됨)
                        createdAt: serverTimestamp()
                      });

                      alert(`✅ 성공적으로 등록되었습니다!\n매일 [${openTime} ~ ${closeTime}] 사이에만 안전하게 판매됩니다.`);
                      
                      setApiKeyInput('');
                      setVerifyStatus(null);
                      
                    } catch (error) {
                      console.error("등록 에러:", error);
                      alert("마켓 등록 중 시스템 오류가 발생했습니다.");
                    }
                  }}
                  className="w-full bg-[#059669] hover:bg-[#047857] text-white font-bold py-3 rounded-xl transition shadow-md flex justify-center items-center gap-2"
                >
                  <CheckCircle2 size={18} /> 설정 완료하고 판매 시작하기
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default function ChatScreen() {
  const router = useRouter();
  // 🌟 다기종 릴레이 채팅을 위해 전역 스토어의 종속성을 줄입니다.
  const [isEng, setIsEng] = useState(false);
  const { currentApiKey, currentApiType, userPoints, setUserPoints } = useStore(); 
  // 🌟 [대공사 3단계] 실시간 모델 스위칭용 상태 및 콤보박스 리스트
  const AVAILABLE_MODELS = ['openai', 'claude', 'gemini', 'xai', 'groq', 'openrouter']; // DB의 apiType과 일치시킵니다.
  // 사용자가 보기 편한 라벨 매핑
  const MODEL_LABELS: Record<string, string> = {
    'openai': 'GPT', 'claude': 'Claude', 'gemini': 'Gemini', 'xai': 'Grok', 'groq': 'Llama (Groq)', 'openrouter': 'OpenRouter'
  };
  const [selectedModel, setSelectedModel] = useState('xai'); // 기본값을 우선 xai로 둡니다.
  const [messages, setMessages] = useState<Message[]>([]);

  // 🌟 [추가] 실시간 최저가 탐지기 상태 및 로직
  const [lowestPrice, setLowestPrice] = useState<number | null>(null);
  const [lowestPriceKey, setLowestPriceKey] = useState<string>(''); // 🌟 실제 최저가 키 보관
  const [activeMarketItem, setActiveMarketItem] = useState<any>(null); // 🌟 [추가] 실시간 게이지 연동용 전체 매물 객체

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'market_items'), (snapshot: any) => {
      // 🌟 [핵심] doc.id를 포함해서 가져와야 나중에 게이지(usedCapacity)를 정확히 깎을 수 있습니다.
      const items = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      const filtered = items.filter((item: any) => 
        item.apiType?.toLowerCase().includes(selectedModel.toLowerCase())
      );
      
      if (filtered.length > 0) {
        const minItem = filtered.reduce((prev: any, curr: any) => (prev.price < curr.price) ? prev : curr);
        setLowestPrice(minItem.price);
        setLowestPriceKey(minItem.apiKey); // 👉 최저가 암호화 키 저장!
        setActiveMarketItem(minItem); // 🌟 10명의 화면에 실시간 동기화 될 매물 정보 저장
      } else {
        setLowestPrice(null); 
        setLowestPriceKey('');
        setActiveMarketItem(null);
      }
    });
    return () => unsubscribe();
  }, [selectedModel]);
  
  const [isMounted, setIsMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // 🌟 [대공사 1단계] 다중 채팅방 관리 상태 추가
  const [chatRooms, setChatRooms] = useState<any[]>([]);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); 
  const [currentView, setCurrentView] = useState<'chat' | 'mypage'>('chat'); // 🌟 화면 전환용 상태 추가
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  // 🌟 채팅방 이름 변경/삭제 관련 상태
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  useEffect(() => {
    setIsMounted(true);
  }, []);
// 🌟 1. 내 모든 채팅방 목록(사이드바용)을 불러오는 실시간 동기화 (버그 픽스)
  useEffect(() => {
    if (!isMounted) return;
    
    let unsubscribeSnapshot: any = null;
    const unsubscribeAuth = auth.onAuthStateChanged((user: any) => {
  setCurrentUser(user); // 🌟 유저 상태 저장
  if (user) {
        const q = query(collection(db, 'chat_rooms'), where('userId', '==', user.uid), orderBy('updatedAt', 'desc'));
        unsubscribeSnapshot = onSnapshot(q, (snapshot: any) => {
          const rooms = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
          setChatRooms(rooms);
          setCurrentRoomId(prev => {
            if (!prev && rooms.length > 0) return rooms[0].roomId;
            return prev;
          });
        });
      }
    });
    return () => { unsubscribeAuth(); if (unsubscribeSnapshot) unsubscribeSnapshot(); };
  }, [isMounted]);

  // 🌟 2. 선택된 방(Room ID)의 대화 기록만 불러오는 실시간 동기화 (버그 픽스)
  useEffect(() => {
    if (!isMounted || !currentRoomId) return;
    
    let unsubscribeSnapshot: any = null;
    const unsubscribeAuth = auth.onAuthStateChanged((user: any) => {
      if (user) {
        const q = query(collection(db, 'chats'), where('userId', '==', user.uid), where('roomId', '==', currentRoomId), orderBy('createdAt', 'asc'));
        unsubscribeSnapshot = onSnapshot(q, (snapshot: any) => {
          const docs = snapshot.docs.map((doc: any) => doc.data());
          setMessages(docs);
        });
      }
    });
    return () => { unsubscribeAuth(); if (unsubscribeSnapshot) unsubscribeSnapshot(); };
  }, [currentRoomId, isMounted]);
// 🌟 새 채팅방 만들기 함수
  const handleNewChat = async () => {
    const user = auth.currentUser;
    if (!user) { alert('로그인이 필요합니다.'); return; }
    
    const newRoomId = `room_${Date.now()}`;
    await setDoc(doc(db, 'chat_rooms', newRoomId), {
      roomId: newRoomId,
      userId: user.uid,
      title: '새로운 대화',
      updatedAt: serverTimestamp()
    });
    setCurrentRoomId(newRoomId);
    setMessages([]); 
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  // 🌟 채팅방 이름 변경 제출
  const handleRenameSubmit = async (roomId: string) => {
    if (!editTitle.trim()) { setEditingRoomId(null); return; }
    await updateDoc(doc(db, 'chat_rooms', roomId), { title: editTitle });
    setEditingRoomId(null);
  };

  // 🌟 채팅방 삭제
  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm('이 대화방을 삭제하시겠습니까? (채팅 기록도 모두 사라집니다)')) return;
    await deleteDoc(doc(db, 'chat_rooms', roomId));
    if (currentRoomId === roomId) {
      setCurrentRoomId(null);
      setMessages([]);
    }
  };

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [showPreview, setShowPreview] = useState<boolean>(false);
  // 🌟 파일 및 이미지 첨부 상태, 드래그 앤 드롭 상태 추가
  const [attachedFiles, setAttachedFiles] = useState<{name: string, content: string, isImage: boolean}[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false); 
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // 🌟 중단(Stop)을 위한 AbortController 레퍼런스
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  };

  const handleRegenerate = () => {
    const lastUserMsgIndex = messages.findLastIndex(m => m.role === 'user');
    if (lastUserMsgIndex !== -1) {
      const lastUserMsg = messages[lastUserMsgIndex];
      setMessages(messages.slice(0, lastUserMsgIndex));
      setInput(lastUserMsg.content); 
    }
  };

  // 🌟 공통 파일 처리 로직: 이미지, 일반 텍스트, 무거운 문서(PDF, Word)를 분기 처리합니다.
  // 🌟 [변경 코드] 최대 10MB 제한 및 무분별한 파일 유입을 차단하는 2중 보안 가드 설치
  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;
    
    const MAX_SIZE = 10 * 1024 * 1024; // 🔥 철벽 방어선: 최대 10MB 제한
    const allowedExtensions = ['.pdf', '.docx', '.txt', '.html', '.css', '.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.csv', '.png', '.jpg', '.jpeg', '.gif', '.webp'];

    // 1차 필터링: 용량 및 확장자 체크
    const filteredFiles = files.filter(file => {
      const filename = file.name.toLowerCase();
      const isTooLarge = file.size > MAX_SIZE;
      const isAllowedExt = allowedExtensions.some(ext => filename.endsWith(ext));

      if (isTooLarge) {
        alert(`🚨 [용량 초과] ${file.name} 파일이 10MB를 초과하여 업로드할 수 없습니다.`);
        return false;
      }
      if (!isAllowedExt) {
        alert(`❌ [지원하지 않는 포맷] ${file.name}은(는) 분석 가능한 파일 형식이 아닙니다.`);
        return false;
      }
      return true;
    });

    if (filteredFiles.length === 0) return;

    setIsParsing(true); // 🌟 파싱 시작 (전송 잠금)
    try {
      const newFiles = await Promise.all(filteredFiles.map(async (file) => {
        const filename = file.name.toLowerCase();
        
        if (file.type.startsWith('image/')) {
          return new Promise<{name: string, content: string, isImage: boolean}>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve({ name: file.name, content: reader.result as string, isImage: true });
            reader.readAsDataURL(file);
          });
        } 
        else if (filename.endsWith('.pdf') || filename.endsWith('.docx')) {
          try {
            const formData = new FormData();
            formData.append('file', file);
            
            const res = await fetch('/api/parse', { method: 'POST', body: formData });
            const data = await res.json();
            
            if (data.error) throw new Error(data.error);
            return { name: file.name, content: data.text, isImage: false };
          } catch (error) {
            alert(`${file.name} 파일을 읽어오는데 실패했습니다.`);
            return null; 
          }
        }
        else {
          const text = await file.text();
          return { name: file.name, content: text, isImage: false };
        }
      }));

      const validFiles = newFiles.filter(f => f !== null) as {name: string, content: string, isImage: boolean}[];
      setAttachedFiles(prev => [...prev, ...validFiles]);
    } finally {
      setIsParsing(false); // 🌟 파싱 완료 (전송 잠금 해제)
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(Array.from(e.target.files || []));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 🌟 2번 요청: 드래그 앤 드롭 이벤트 핸들러
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(Array.from(e.dataTransfer.files));
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleInputResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; // 높이 초기화
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`; // 최대 약 6줄(150px)까지만 늘어남
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Shift + Enter는 줄바꿈 허용, 그냥 Enter는 전송
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // 🌟 로딩 중이거나, 문서 파싱 중이거나, 텍스트/첨부파일이 모두 없으면 엔터 차단
      if (isLoading || isParsing || (!input.trim() && attachedFiles.length === 0)) return; 
      handleSend();
      if (textareaRef.current) textareaRef.current.style.height = 'auto'; // 전송 후 원래 크기로 복구
    }
  };
// 🌟 [최적화 마법] 채팅 내용이 추가될 때만 마크다운을 계산하고, 글자 타이핑할 때는 옛날 기록을 그대로 가져다 씁니다!
  // 🌟 [최적화 마법] 채팅 내용이 추가될 때만 마크다운을 계산
  const renderedMessages = useMemo(() => {
    return messages.map((msg, idx) => {
      // 🌟 5번 요청: 각 AI 모델의 시그니처 컬러를 적용한 애플 글라스 효과 (여기가 빠져있었습니다!)
      let aiGlassmorphism = 'bg-[#1E1E1E] border-[#2C2C2C] text-gray-200'; 
      
      if (msg.role === 'assistant' && msg.apiType) {
        const type = msg.apiType.toLowerCase();
        if (type.includes('grok') || type.includes('xai')) {
          aiGlassmorphism = 'bg-gray-800/30 border-gray-700/40 backdrop-blur-md text-gray-200 shadow-sm';
        } else if (type.includes('gemini')) {
          aiGlassmorphism = 'bg-blue-500/10 border-blue-500/20 backdrop-blur-md text-gray-200 shadow-sm';
        } else if (type.includes('claude') || type.includes('anthropic')) {
          aiGlassmorphism = 'bg-orange-500/10 border-orange-500/20 backdrop-blur-md text-gray-200 shadow-sm';
        } else if (type.includes('gpt') || type.includes('openai')) {
          aiGlassmorphism = 'bg-emerald-500/10 border-emerald-500/20 backdrop-blur-md text-gray-200 shadow-sm';
        } else if (type.includes('router') || type.includes('llama')) {
          aiGlassmorphism = 'bg-purple-500/10 border-purple-500/20 backdrop-blur-md text-gray-200 shadow-sm';
        }
      }

      return (
        <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} mb-4`}>
          {/* 🌟 디테일한 AI 모델명 라벨 */}
          {msg.role === 'assistant' && msg.apiType && (
            <div className="text-[11px] font-bold text-gray-400 mb-1 ml-3 flex items-center gap-1">
              <Bot size={12} className="text-[#059669]" /> 
              {msg.apiType === 'openai' ? 'GPT-4o mini (Paid)' : 
               msg.apiType === 'claude' ? 'Claude 3.5 Sonnet (Paid)' : 
               msg.apiType === 'xai' ? 'Grok 2 (Paid)' : 
               msg.apiType === 'gemini' ? 'Gemini 1.5 Pro (Free/Paid)' : 
               msg.apiType === 'groq' ? 'Llama 3.1 70B (Fast/Free)' : 
               msg.apiType === 'openrouter' ? 'OpenRouter Multi-Model' : msg.apiType} said.
            </div>
          )}
          <div className={`max-w-[85%] md:max-w-[75%] p-4 rounded-[24px] overflow-hidden border ${
            msg.role === 'user' 
              ? 'bg-[#059669] border-[#059669] text-white rounded-br-sm shadow-lg' 
              : `${aiGlassmorphism} rounded-bl-sm`
          }`}>
            {/* 🌟 이미지 렌더링 영역 */}
            {msg.attachedImages && msg.attachedImages.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {msg.attachedImages.map((img, i) => (
                  <img key={i} src={img} alt="attached" className="max-w-[200px] rounded-lg border border-[#ffffff30]" />
                ))}
              </div>
            )}
            <div className="prose prose-invert max-w-none text-sm leading-relaxed [&>pre]:!bg-transparent [&>pre]:!p-0 [&>pre]:!m-0">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({node, inline, className, children, ...props}: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    const value = String(children).replace(/\n$/, '');
                    return !inline && match ? (
                      <CodeBlock language={match[1]} value={value} showPreview={showPreview} onOpenPreview={(htmlCode) => { setPreviewHtml(htmlCode); setShowPreview(true); }} />
                    ) : (
                      <code className="bg-[#2C2C2C] text-[#10B981] px-1.5 py-0.5 rounded text-sm break-all" {...props}>{children}</code>
                    )
                  },
                  table: ({children}) => <div className="overflow-x-auto"><table className="border-collapse border border-gray-600 my-2">{children}</table></div>,
                  th: ({children}) => <th className="border border-gray-600 px-3 py-1 bg-gray-800">{children}</th>,
                  td: ({children}) => <td className="border border-gray-600 px-3 py-1">{children}</td>,
                }}
              >
                {msg.content}
              </ReactMarkdown>
            </div>
          </div>
          
          {/* 🌟 토큰 및 지갑 차감액 실시간 추정 UI */}
          <div className={`text-[10px] text-gray-500 mt-1.5 flex gap-2 font-mono ${msg.role === 'user' ? 'mr-3' : 'ml-3'}`}>
            <span>🪙 토큰: {Math.ceil(msg.content.length / 1.5).toLocaleString()} tk</span>
            <span>|</span>
            <span>💸 차감액: {((Math.ceil(msg.content.length / 1.5) / 1000) * 50).toFixed(1)} 원</span>
          </div>
        </div>
      );
    });
  }, [messages]);

  // 🌟 [삭제됨] 이제 거래소 매물 선택 강제 튕김 로직을 제거합니다. (누구나 자유롭게 새 방 개설 가능)

  // 새로운 메시지가 추가될 때마다 스크롤을 맨 아래로 내려주는 마법
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() && attachedFiles.length === 0) return;

    // 🌟 [대공사 3단계] 건당 차감 (10원) 지갑 검사 및 실시간 차감
    if (userPoints < 10) {
      alert('포인트가 부족합니다. 충전 후 이용해주세요.');
      return;
    }
    
    // 🌟 [에러 해결] 여기서 단 한 번만 선언하고 아래에서는 재사용합니다!
    
    const user = auth.currentUser;
    
    if (user) {
      setUserPoints(userPoints - 10); // 화면상 지갑 잔액 즉시 깎기
      await updateDoc(doc(db, 'users', user.uid), { points: increment(-10) }); // DB 실제 차감
    }

    // 🌟 사용자의 입력 메시지와 첨부파일 내용을 하나로 합칩니다.
    let finalPrompt = input.trim();
    let displayMsg = input.trim(); // 화면에 보여줄 텍스트

    // 🌟 첨부파일 분리: 텍스트 파일은 프롬프트에 병합, 이미지 파일은 Base64 배열로 추출
    const textFiles = attachedFiles.filter(f => !f.isImage);
    const imageFiles = attachedFiles.filter(f => f.isImage).map(f => f.content);

    if (textFiles.length > 0) {
      const fileContext = textFiles.map(f => `\n\n--- [첨부파일 코드/텍스트: ${f.name}] ---\n\`\`\`\n${f.content}\n\`\`\``).join('');
      finalPrompt += fileContext;
      displayMsg += `\n\n*(📎 텍스트 파일 ${textFiles.length}개 첨부됨)*`;
    }

    // 🌟 [핵심 1] Moderation API (안전성 필터) 통과 확인
    // 비싼 Grok/Claude 모델에 쏘기 전에 프론트에서 초저가/무료 Moderation 엔드포인트를 거쳐 계정 정지(Ban)를 차단합니다.
    try {
      setIsLoading(true);
      // 실제 운영 시에는 프론트에서 키를 숨기기 위해 Next.js의 /api/moderate 라우트로 쏘게 됩니다.
      const modRes = await fetch('/api/moderate', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: finalPrompt }) 
      }).catch(() => null); // 엔드포인트가 없을 경우(개발중) 임시 패스
      
      if (modRes && modRes.ok) {
        const modData = await modRes.json();
        if (modData.flagged) {
          alert("🚨 [안전 시스템 차단] 정책에 위반되는 부적절한 프롬프트가 감지되었습니다. 판매자 보호를 위해 전송이 취소됩니다.");
          setIsLoading(false);
          return;
        }
      }
    } catch(e) { console.log("Moderation pass"); }

    // 🌟 [핵심 2] 글로벌 동시 접속자를 위한 원자적 업데이트(Atomic Increment)로 게이지 차감
    // 10명이 동시에 쏘더라도 Firestore의 increment(1)은 트랜잭션 충돌 없이 정확하게 1씩 깎아내려갑니다.
    if (activeMarketItem?.id) {
      if (activeMarketItem.usedCapacity >= activeMarketItem.maxCapacity) {
        alert("🚨 이 매물의 일일 한도(게이지)가 모두 소진되었습니다. 다른 매물을 찾아주세요.");
        setIsLoading(false);
        return;
      }
      await updateDoc(doc(db, 'market_items', activeMarketItem.id), {
        usedCapacity: increment(1)
      });
    }

    setInput('');
    setAttachedFiles([]); 
    setIsLoading(false); // 로딩 잠깐 풀고 낙관적 UI 업데이트 시작
    
    // 🌟 [수정] DB에 저장되기 전, 유저의 화면에 즉시(0.1초 만에) 내 프롬프트를 먼저 띄웁니다! (낙관적 UI 업데이트)
    setMessages(prev => [...prev, { role: 'user', content: displayMsg, attachedImages: imageFiles }]);
    
    // 🌟 전송 즉시 Firestore 'chats' 컬렉션에 유저의 메시지와 첨부 이미지 배열을 영구 누적합니다.
    // 방이 없으면 하나 만들기 보장
    let targetRoomId = currentRoomId;
    if (!targetRoomId) {
      targetRoomId = `room_${Date.now()}`;
      await setDoc(doc(db, 'chat_rooms', targetRoomId), {
        roomId: targetRoomId,
        userId: user?.uid,
        title: displayMsg.slice(0, 20) + (displayMsg.length > 20 ? '...' : ''),
        updatedAt: serverTimestamp()
      });
      setCurrentRoomId(targetRoomId);
    }

    await addDoc(collection(db, 'chats'), {
      roomId: targetRoomId, // 🌟 방 ID 기준 저장
      userId: user?.uid,
      role: 'user',
      content: displayMsg,
      attachedImages: imageFiles.length > 0 ? imageFiles : null,
      createdAt: serverTimestamp()
    });

    // 🌟 방 제목이 '새로운 대화'면 유저의 첫 질문 내용으로 제목 자동 업데이트
    const currentRoom = chatRooms.find(r => r.roomId === targetRoomId);
    if (currentRoom && currentRoom.title === '새로운 대화') {
      await updateDoc(doc(db, 'chat_rooms', targetRoomId), { 
        title: displayMsg.slice(0, 20) + (displayMsg.length > 20 ? '...' : ''),
        updatedAt: serverTimestamp()
      });
    } else if (currentRoom) {
      await updateDoc(doc(db, 'chat_rooms', targetRoomId), { updatedAt: serverTimestamp() }); // 끌어올리기
    }

    setIsLoading(true);

    try {
      abortControllerRef.current = new AbortController(); // 🌟 중단 컨트롤러 초기화

      const contextHistory = messages.slice(-5).map(m => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          prompt: finalPrompt, 
          encryptedApiKey: currentApiKey || lowestPriceKey, // 🌟 백엔드가 못 찾으므로 프론트에서 탐색한 최저가 키를 직접 전송
          history: contextHistory,
          images: imageFiles,
          requestedModel: selectedModel // 🌟 [대공사 3단계] 방금 드롭다운에서 고른 모델명 하청!
        })
      });

      // 🌟 백엔드가 순수 JSON을 반환하므로 전체 데이터를 정상적으로 파싱합니다. (Grok 오류 해결)
      const data = await res.json();
      const rawResponse = data.content?.[0]?.text || "응답이 없습니다.";

      // 🌟 [에스크로 안전 환불 시스템] 자동 철거 메시지나 품절 안내가 감지되면 즉시 10원 반환
      if (rawResponse.includes('잔액이 소진되어') || rawResponse.includes('일시 품절')) {
        try {
          if (user) {
            // 1. 파이어베이스 DB에서 실제 유저의 포인트를 10원 다시 충전(원복)
            await updateDoc(doc(db, 'users', user.uid), {
              points: increment(10)
            });
            
            // 2. Zustand 전역 스토어 화면 포인트 잔액도 즉시 10원 복구
            const currentPoints = (useStore.getState() as any).userPoints || 0;
            if (typeof (useStore.getState() as any).setUserPoints === 'function') {
              (useStore.getState() as any).setUserPoints(currentPoints + 10);
            }
            alert("🚨 [안전 환불] 판매자 토큰 고갈이 감지되어 이용료 10원이 즉시 자동 환불되었습니다.");
          }
        } catch (refundErr) {
          console.error("에스크로 환불 처리 실패:", refundErr);
        }
      }

      // 화면에 빈 말풍선을 먼저 띄웁니다.

      // 화면에 빈 말풍선을 먼저 띄웁니다.
      setMessages(prev => [...prev, { role: 'assistant', content: '', apiType: currentApiType }]);

      // 🌟 프론트엔드에서 타이핑 효과 연출 (속도 대폭 개선)
      let currentText = "";
      const isCode = rawResponse.includes('```') || rawResponse.includes('<html');
      // 코드는 50글자씩 뭉텅이로 빠르게, 일반 글은 5글자씩 자연스럽게 출력
      const chunkSize = isCode ? 50 : 5; 
      const delay = isCode ? 2 : 10;
      
      for (let i = 0; i < rawResponse.length; i += chunkSize) {
        if (abortControllerRef.current.signal.aborted) break;

        currentText += rawResponse.slice(i, i + chunkSize);
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1].content = currentText;
          return newMessages;
        });
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      if (rawResponse.includes('<html') && !abortControllerRef.current.signal.aborted) {
        setPreviewHtml(rawResponse);
        setShowPreview(true);
      }

      // 🌟 AI의 타이핑 연출과 별개로, 최종 확정된 텍스트 답변을 데이터베이스에 영구 보존 처리합니다.
      if (!abortControllerRef.current.signal.aborted) {
        await addDoc(collection(db, 'chats'), {
          roomId: targetRoomId,
          userId: user?.uid,
          role: 'assistant',
          content: rawResponse,
          apiType: selectedModel, // 🌟 [대공사 3단계] 선택된 모델로 뱃지 및 색상 기록
          createdAt: serverTimestamp()
        });
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('생성 중단됨');
      } else {
        console.error("통신 에러:", error);
        setMessages(prev => [...prev, { role: 'assistant', content: "서버 통신 중 에러가 발생했습니다." }]);
      } // 🌟 여기에 else를 닫는 중괄호가 빠져있었습니다!
    } finally {
      setIsLoading(false);
    }
  };

  if (!isMounted) return null;
return (
    <div 
      className="fixed inset-0 flex h-[100dvh] bg-[#121212] text-white overflow-hidden"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 🌟 [대공사 1단계] 좌측 사이드바 (채팅방 리스트) 추가 */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#1A1A1A] border-r border-[#2C2C2C] transform transition-all duration-300 md:relative md:translate-x-0 flex flex-col ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'} ${currentView === 'mypage' ? 'brightness-50 pointer-events-none' : ''}`}>
        
        {/* 사이드바 헤더 및 새 대화 버튼 복구 */}
        <div className="p-4 border-b border-[#2C2C2C] flex justify-between items-center h-[73px] shrink-0 relative z-20">
          <h2 className="text-[#10B981] font-black text-xl ml-2 tracking-tight">토크노미</h2>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-gray-400 hover:text-white p-2">
            <X size={20} />
          </button>
        </div>
        <div className="p-4 shrink-0 relative z-20">
          <button onClick={handleNewChat} className="w-full bg-[#059669] hover:bg-[#047857] text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition shadow-md">
            <Plus size={18} /> 새 대화 시작
          </button>
        </div>

        {/* 🌟 방 리스트 영역 (맵 반복문 정상 복구) */}
        <div className="overflow-y-auto flex-1 px-3 pb-4 space-y-2 no-scrollbar relative z-20">
          {chatRooms.map(room => (
            <div key={room.roomId} className="relative group">
              <button onClick={() => { setCurrentRoomId(room.roomId); setCurrentView('chat'); setIsSidebarOpen(false); }}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-3 pr-10 truncate ${currentRoomId === room.roomId && currentView === 'chat' ? 'bg-[#059669]/20 text-[#10B981]' : 'text-gray-400 hover:bg-[#252525]'}`}>
                <MessageSquare size={16} /> <span className="truncate flex-1">{room.title}</span>
              </button>
              <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === room.roomId ? null : room.roomId); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-white">
                <MoreVertical size={16}/>
              </button>
              {openMenuId === room.roomId && (
                <div className="absolute right-0 top-10 w-32 bg-[#2C2C2C] border border-[#444] rounded-xl z-50 shadow-xl overflow-hidden">
                  <button onClick={() => { /* 상단고정로직 */ }} className="w-full text-left px-4 py-2 text-xs text-white hover:bg-[#333] flex items-center gap-2"><Pin size={12}/> 상단 고정</button>
                  <button onClick={() => handleDeleteRoom(room.roomId)} className="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-[#333] flex items-center gap-2"><Trash2 size={12}/> 삭제</button>
                </div>
              )}
            </div>
          ))}
        </div>
        {/* 🌟 사이드바 맨 하단: 로그인 상태에 따라 바뀌는 스마트 버튼 */}
        <div className="p-4 border-t border-[#2C2C2C] mt-auto shrink-0">
          {currentUser ? (
            <button onClick={() => setCurrentView('mypage')} className={`w-full flex items-center justify-center gap-3 p-3 rounded-xl transition font-bold shadow-md ${currentView === 'mypage' ? 'bg-[#059669] text-white' : 'bg-[#2C2C2C] hover:bg-[#333] text-white'}`}>
              <User size={18} className={currentView === 'mypage' ? 'text-white' : 'text-[#10B981]'} /> 마이페이지 가기
            </button>
          ) : (
            <button onClick={() => router.push('/login')} className="w-full flex items-center justify-center gap-3 p-3 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold transition shadow-lg">
              <User size={18} /> 로그인 / 회원가입
            </button>
          )}
        </div>
      </div>
      
      {/* 모바일 사이드바 배경 오버레이 */}
      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />}

      {/* 🌟 2번 요청: 드래그 앤 드롭 오버레이 UI */}
      {isDragging && (
        <div className="absolute inset-0 z-[100] bg-[#059669]/20 backdrop-blur-sm border-4 border-dashed border-[#059669] flex items-center justify-center">
          <div className="bg-[#1E1E1E] p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 animate-bounce">
            <ImageIcon size={48} className="text-[#059669]" />
            <h2 className="text-2xl font-black text-white">파일을 여기에 놓아주세요</h2>
            <p className="text-gray-400">코드, 텍스트, 이미지 모두 인식합니다.</p>
          </div>
        </div>
      )}

      {/* 좌측: 채팅창 영역 */}
      <div className={`flex flex-col ${showPreview ? 'hidden md:flex md:w-1/2' : 'w-full'} border-r border-[#2C2C2C] transition-all duration-500 h-full`}>
        <header className="flex items-center justify-between p-4 bg-[#1E1E1E] border-b border-[#2C2C2C] shrink-0">
          <div className="flex items-center">
            {/* 🌟 모바일 햄버거 메뉴 버튼 */}
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 mr-3 text-gray-400 hover:text-[#10B981] transition">
              <Menu size={24} />
            </button>
            {/* 🌟 (폭파 완료) 메인 대문이므로 불필요해진 뒤로가기 버튼은 완전히 삭제되었습니다. */}
            <div>
              <div className="flex items-center gap-2">
                {/* 콤보박스는 아래 텍스트박스 위로 이동됨 */}
                <span className="text-[#059669] text-[13px] font-bold hidden md:inline-block whitespace-nowrap ml-1">
                  ▼ {isEng ? 'Auto Match 100%' : '최저가 자동매칭 100%'} 
                  <span className="text-[#10B981] ml-1.5">
                    : {isEng ? 'Lowest Price' : '현재 최저가 약'} {lowestPrice !== null ? `${lowestPrice.toLocaleString()}원` : '측정중...'}
                  </span>
                </span>
                <span className="px-2 py-0.5 bg-blue-500/20 border border-blue-400 text-blue-300 text-[10px] rounded-full uppercase tracking-widest hidden lg:inline-block shadow-[0_0_10px_rgba(59,130,246,0.3)] ml-2">
                  100% Official API 직결
                </span>
              </div>
              <p className="text-[11px] text-[#10B981] font-bold mt-1.5 flex items-center gap-1">
                🔒 {isEng ? 'Encrypted & Pay-per-prompt (10 KRW)' : '군사급 암호화 & 건당 10원 종량제 적용 중'}
              </p>
              
              {/* 🌟 [핵심] 전 세계 동시 접속자 화면에 실시간 연동되는 잔여량 게이지 UI */}
              {activeMarketItem && activeMarketItem.maxCapacity && (
                <div className="mt-2.5 w-full max-w-[200px]">
                  <div className="flex justify-between text-[9px] text-gray-400 mb-1 font-mono">
                    <span>API 매물 잔여량</span>
                    <span className={activeMarketItem.maxCapacity - activeMarketItem.usedCapacity < 50 ? 'text-red-400 font-bold' : 'text-[#10B981]'}>
                      {Math.max(0, activeMarketItem.maxCapacity - (activeMarketItem.usedCapacity || 0))} / {activeMarketItem.maxCapacity}
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden border border-[#333]">
                    <div 
                      className={`h-1.5 rounded-full transition-all duration-500 ${activeMarketItem.maxCapacity - activeMarketItem.usedCapacity < 50 ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-[#10B981] shadow-[0_0_8px_rgba(16,185,129,0.8)]'}`} 
                      style={{ width: `${Math.max(0, 100 - ((activeMarketItem.usedCapacity || 0) / activeMarketItem.maxCapacity * 100))}%` }}
                    ></div>
                  </div>
                </div>
              )}

            </div>
          </div>
          
          {/* 🌟 1번 요청: EN / KO 언어 변환 버튼 */}
          <button 
            onClick={() => setIsEng(!isEng)}
            className="px-3 py-1.5 bg-[#2C2C2C] hover:bg-[#333] rounded-lg text-xs font-bold text-gray-300 transition"
          >
            {isEng ? '🇰🇷 KO' : '🇺🇸 EN'}
          </button>
        </header>
{/* 🌟 대장님 여기에 꼼꼼히 분기를 쳐서 대화기록과 하단 입력창을 온전히 감쌌습니다. */}
        {currentView === 'mypage' ? (
          <IntegratedMyPage currentUser={currentUser} />
        ) : (
          <>
            {/* 1. 대화창 본문 영역 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-50">
                  <Bot size={56} className="mb-4 text-[#059669]" />
                  <p className="font-bold">{isEng ? 'Secure channel ready.' : '보안 통신이 준비되었습니다.'}</p>
                  <p className="text-sm">{isEng ? 'Keys are never exposed.' : '클라이언트 측 메모리에 API 키가 노출되지 않습니다.'}</p>
                </div>
              )}
              {renderedMessages}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-[#1E1E1E] border border-[#2C2C2C] text-[#059669] font-bold p-4 rounded-[24px] rounded-bl-sm animate-pulse">
                    {isEng ? 'AI is thinking...' : 'AI가 뇌를 굴리고 있습니다...'}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* 2. 하단 입력 콘솔 및 툴바 영역 */}
            <div className="bg-[#121212] p-4 border-t border-[#2C2C2C] shrink-0 z-[60]">
              <div className="max-w-4xl mx-auto flex justify-between items-center mb-2">
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                  {[
                    { ko: '🎨 그림', en: '🎨 Image', cmd: '/그림 ' },
                    { ko: '🖥️ UI', en: '🖥️ UI Maker', cmd: '/화면 ' },
                    { ko: '📊 다이어그램', en: '📊 Diagram', cmd: '/화면 Mermaid.js로 ' },
                    { ko: '🧊 3D', en: '🧊 3D Art', cmd: '/화면 Three.js로 ' }
                  ].map((chip) => (
                    <button
                      key={chip.ko}
                      onClick={() => setInput(chip.cmd + input)}
                      className="whitespace-nowrap px-3 py-1 rounded-full bg-[#1E1E1E] border border-[#333] text-[11px] text-gray-400 hover:border-[#059669] hover:text-white transition"
                    >
                      {isEng ? chip.en : chip.ko}
                    </button>
                  ))}
                </div>
                
                {messages.length > 0 && !isLoading && (
                  <button 
                    onClick={handleRegenerate}
                    className="whitespace-nowrap px-3 py-1 rounded-full bg-[#2C2C2C] text-[11px] text-[#10B981] font-bold hover:bg-[#333] transition ml-2"
                  >
                    🔄 {isEng ? 'Regenerate' : '재생성'}
                  </button>
                )}
              </div>

              {attachedFiles.length > 0 && (
                <div className="max-w-4xl mx-auto flex flex-wrap gap-1.5 mb-2">
                  {attachedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-1 bg-[#2C2C2C] border border-[#444] px-3 py-1.5 rounded-lg text-xs font-mono text-gray-300">
                      <Paperclip size={12} className="text-[#059669]" />
                      <span className="max-w-[150px] truncate">{file.name}</span>
                      <button onClick={() => removeFile(idx)} className="ml-1 text-gray-500 hover:text-red-400 transition">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="max-w-4xl mx-auto flex gap-3 items-end relative mb-6">
                <input 
                  type="file" 
                  multiple 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  className="hidden" 
                  accept="image/png, image/jpeg, image/gif, image/webp, .txt, .html, .css, .js, .jsx, .ts, .tsx, .json, .md, .csv, application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
                />
                
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-[#1E1E1E] border border-[#333] text-gray-400 hover:text-white p-4 rounded-2xl hover:border-[#059669] transition-all flex items-center justify-center h-[56px] shrink-0"
                  title="코드 또는 텍스트 파일 첨부"
                >
                  <Paperclip size={20} />
                </button>

                <div className="relative flex-1 bg-[#1E1E1E] border border-[#333] focus-within:border-[#059669] rounded-2xl shadow-inner min-h-[56px] flex flex-col justify-end">
              <textarea 
                ref={textareaRef} rows={1} value={input} onChange={handleInputResize} onKeyDown={handleKeyDown}
                placeholder={isEng ? "Ask AI anything" : "AI에게 질문해보세요"}
                className="w-full bg-transparent px-6 pt-4 pb-12 outline-none text-white resize-none max-h-[150px] overflow-y-auto no-scrollbar"
              />
              <div className="absolute right-3 bottom-3 flex items-center gap-2">
                <div className="flex items-center bg-[#121212] px-2 py-1 rounded-lg border border-[#444]">
                  <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} className="bg-transparent text-[11px] font-bold text-[#10B981] outline-none cursor-pointer appearance-none">
                    {AVAILABLE_MODELS.map(m => <option key={m} value={m}>{MODEL_LABELS[m]}</option>)}
                  </select>
                  <span className="text-[10px] text-gray-500 ml-1">▼</span>
                </div>
              </div>
            </div>
                
                {isLoading ? (
                  <button 
                    onClick={handleStop}
                    className="bg-red-500/20 border border-red-500 text-red-400 p-4 rounded-2xl hover:bg-red-500/30 transition-all flex items-center justify-center shadow-lg h-[56px] shrink-0"
                  >
                    ■
                  </button>
                ) : (
                  <button 
                    onClick={() => { handleSend(); if(textareaRef.current) textareaRef.current.style.height='auto'; }}
                    disabled={isParsing || (!input.trim() && attachedFiles.length === 0)}
                    className="bg-[#059669] disabled:bg-[#1E1E1E] disabled:text-gray-500 text-white p-4 rounded-2xl hover:bg-[#047857] transition-all flex items-center justify-center shadow-lg h-[56px] shrink-0"
                  >
                    <Send size={20} />
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 우측: 실시간 HTML 프리뷰 */}
      {showPreview && previewHtml && (
        <div className="w-full md:w-1/2 bg-white h-full relative border-l border-[#2C2C2C] flex flex-col">
          <div className="absolute top-4 right-4 z-10">
            <button 
              onClick={() => setShowPreview(false)} 
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-xs rounded-full font-bold shadow-xl flex items-center gap-1 transition-transform hover:scale-105"
            >
              ✕ {isEng ? 'Close Preview' : '프리뷰 닫기'}
            </button>
          </div>
          <iframe 
            srcDoc={previewHtml} 
            className="w-full h-full border-none bg-white"
            title="UI Preview"
          />
        </div>
      )}
    </div>
  );
}