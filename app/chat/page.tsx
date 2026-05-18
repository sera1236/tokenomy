'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/useStore';
import { Send, ChevronLeft, Bot, Paperclip, X, Image as ImageIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  apiType?: string; // 🌟 5번 요청: 모델별 색상을 구분하기 위해 누가 대답했는지 저장
  attachedImages?: string[]; // 🌟 1번 요청: 이미지 파일 미리보기 저장용
}

// 🌟 코드블록 개편: 카피 버튼 복구 및 개별 UI 프리뷰 렌더링 지원
const CodeBlock = ({ language, value, isEng, showPreview, onOpenPreview }: { language: string, value: string, isEng: boolean, showPreview: boolean, onOpenPreview: (html: string) => void }) => {
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
              <span className="text-xl">✨</span> <span className="text-lg">{isEng ? 'Open UI' : '이 UI 보기'}</span>
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

export default function ChatScreen() {
  const router = useRouter();
  const { currentApiKey, currentApiType } = useStore();
  
  // 🌟 1번 요청: 영어 모드 상태
  const [isEng, setIsEng] = useState(false);

  // 🌟 하이드레이션 에러 완벽 해결: 처음엔 빈 배열로 시작해 서버와 싱크를 맞추고, 마운트 직후에 기록을 불러옵니다.
  const [messages, setMessages] = useState<Message[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const saved = sessionStorage.getItem('chat_history');
    if (saved) {
      try { setMessages(JSON.parse(saved)); } catch(e) {}
    }
  }, []);

  useEffect(() => {
    if (isMounted) {
      sessionStorage.setItem('chat_history', JSON.stringify(messages));
    }
  }, [messages, isMounted]);

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
  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;
    
    setIsParsing(true); // 🌟 파싱 시작 (전송 잠금)
    try {
      const newFiles = await Promise.all(files.map(async (file) => {
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
                      <CodeBlock language={match[1]} value={value} isEng={isEng} showPreview={showPreview} onOpenPreview={(htmlCode) => { setPreviewHtml(htmlCode); setShowPreview(true); }} />
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

  // 🌟 거래소에서 매물을 선택하지 않고 강제로 들어오면 튕겨냅니다.
  useEffect(() => {
    if (!currentApiKey) {
      alert('거래소에서 매물을 먼저 선택해주세요!');
      router.push('/');
    }
  }, [currentApiKey, router]);

  // 새로운 메시지가 추가될 때마다 스크롤을 맨 아래로 내려주는 마법
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if ((!input.trim() && attachedFiles.length === 0) || !currentApiKey) return;

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

    setInput('');
    setAttachedFiles([]); 
    
    // 🌟 이미지가 있으면 메시지 객체에 이미지 정보 포함하여 저장 (화면에 표시)
    setMessages(prev => [...prev, { role: 'user', content: displayMsg, attachedImages: imageFiles.length > 0 ? imageFiles : undefined }]);
    setIsLoading(true);

    try {
      abortControllerRef.current = new AbortController(); // 🌟 중단 컨트롤러 초기화

      const contextHistory = messages.slice(-5).map(m => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal, // 🌟 중단 신호 연결
        body: JSON.stringify({
          prompt: finalPrompt, 
          encryptedApiKey: currentApiKey,
          history: contextHistory,
          images: imageFiles
        })
      });

      // 🌟 백엔드가 순수 JSON을 반환하므로 전체 데이터를 정상적으로 파싱합니다. (Grok 오류 해결)
      const data = await res.json();
      const rawResponse = data.content?.[0]?.text || "응답이 없습니다.";

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
return (
    // 🌟 1, 2번 요청 해결: fixed inset-0 와 h-[100dvh]를 조합하여 화면 바깥으로 절대 벗어나지 않게 자물쇠를 채웁니다.
    <div 
      className="fixed inset-0 flex h-[100dvh] bg-[#121212] text-white overflow-hidden"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
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
            <button onClick={() => router.back()} className="p-2 mr-2 text-gray-400 hover:text-white transition">
              <ChevronLeft size={24} />
            </button>
            <div>
              <h1 className="text-lg font-black text-white flex items-center gap-2">
                {currentApiType} 
                <span className="text-[#059669] text-sm">{isEng ? 'Secured' : '보안 연결됨'}</span>
                {/* 🌟 마케팅 포인트: 100% 공식 API 직결 인증 마크 (모델 바꿔치기 사기 방어) */}
                <span className="px-2 py-0.5 bg-blue-500/20 border border-blue-400 text-blue-300 text-[10px] rounded-full uppercase tracking-widest hidden md:inline-block shadow-[0_0_10px_rgba(59,130,246,0.3)]">
                  100% Official API 직결 (속임수 불가)
                </span>
              </h1>
              <p className="text-xs text-[#AAAAAA] font-mono">Key: {currentApiKey.slice(0, 20)}...</p>
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

        {/* 🌟 수정됨: pb-28을 추가하여 RootLayout의 하단 네비게이션(h-20) 위로 입력창을 안전하게 끌어올림 */}
        {/* 🌟 여백 대폭 축소 (p-4 -> px-4 pt-2 pb-20), gap-2 -> gap-1.5 */}
        <div className="bg-[#121212] px-4 pt-2 pb-20 border-t border-[#2C2C2C] shrink-0 relative z-[60]">
          
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
            
            {/* 🌟 재생성 버튼 추가 */}
            {messages.length > 0 && !isLoading && (
              <button 
                onClick={handleRegenerate}
                className="whitespace-nowrap px-3 py-1 rounded-full bg-[#2C2C2C] text-[11px] text-[#10B981] font-bold hover:bg-[#333] transition ml-2"
              >
                🔄 {isEng ? 'Regenerate' : '재생성'}
              </button>
            )}
          </div>
          

          {/* 🌟 첨부된 파일 미리보기 칩 영역 */}
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

          <div className="max-w-4xl mx-auto flex gap-3 items-end relative">
            {/* 🌟 숨겨진 파일 입력창 (PDF, DOCX 추가 확장) */}
            <input 
              type="file" 
              multiple 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
              accept="image/*,.txt,.html,.css,.js,.jsx,.ts,.tsx,.json,.md,.csv,.pdf,.docx" 
            />
            
            {/* 🌟 파일 첨부 클립 버튼 */}
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="bg-[#1E1E1E] border border-[#333] text-gray-400 hover:text-white p-4 rounded-2xl hover:border-[#059669] transition-all flex items-center justify-center h-[56px] shrink-0"
              title="코드 또는 텍스트 파일 첨부"
            >
              <Paperclip size={20} />
            </button>

            <textarea 
              ref={textareaRef} 
              rows={1}
              value={input}
              onChange={handleInputResize}
              onKeyDown={handleKeyDown}
              placeholder={isEng ? "Ask AI anything (Shift+Enter for new line)" : "AI에게 질문해보세요 (Shift+Enter로 줄바꿈)"}
              className="flex-1 bg-[#1E1E1E] border border-[#333] focus:border-[#059669] rounded-2xl px-6 py-4 outline-none transition text-white shadow-inner resize-none min-h-[56px] max-h-[150px] overflow-y-auto no-scrollbar"
            />
            {/* 🌟 로딩 중이면 중단(Stop) 버튼, 아니면 전송 버튼 */}
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