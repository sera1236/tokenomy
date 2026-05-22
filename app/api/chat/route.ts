import { NextResponse } from 'next/server';
import { CryptoUtil } from '@/lib/crypto';
import { Pinecone } from '@pinecone-database/pinecone';

export async function POST(req: Request) {
  try {
    // 🌟 [RAG 통합 보정] req.json()을 bodyData 객체로 안전하게 한 번만 받아서 하단 저장 로직까지 에러 없이 공유합니다.
    const bodyData = await req.json();
    // 🌟 [추가] 프론트에서 넘겨줄 이전 그림 URL(referenceImageUrl)을 추가로 받습니다.
    const { prompt: rawPrompt, encryptedApiKey, history = [], images = [], requestedModel, roomId, userId, referenceImageUrl } = bodyData;
    const apiKey = CryptoUtil.decrypt(encryptedApiKey).trim();

    let prompt = rawPrompt;

    // 🌟 1. 과거 대화 기록(Context) 세팅
    const baseMessages = history.map((m: any) => ({ 
      role: m.role === 'assistant' ? 'assistant' : 'user', 
      content: m.content 
    }));

    // 🌟 2. [Vision API] OpenAI 계열 (GPT, OpenRouter, Groq, xAI) 전용 배열
    let openAiCurrentContent: any = prompt;
    if (images.length > 0) {
      openAiCurrentContent = [{ type: 'text', text: prompt }];
      images.forEach((img: string) => {
        openAiCurrentContent.push({ type: 'image_url', image_url: { url: img } }); // Base64 전체 URL 사용
      });
    }
    const openAiMessages = [...baseMessages, { role: 'user', content: openAiCurrentContent }];

    // 🌟 3. [Vision API] Claude 전용 배열 (Claude는 Base64 헤더를 분리해야 인식합니다)
    let claudeCurrentContent: any = prompt;
    if (images.length > 0) {
      claudeCurrentContent = [{ type: 'text', text: prompt }];
      images.forEach((img: string) => {
        const matches = img.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
        if (matches) {
          claudeCurrentContent.push({
            type: 'image',
            source: { type: 'base64', media_type: matches[1], data: matches[2] }
          });
        }
      });
    }
    const claudeMessages = [...baseMessages, { role: 'user', content: claudeCurrentContent }];

    // 🌟 4. [Vision API] Gemini 전용 배열 (Gemini는 구조가 가장 특이합니다)
    const geminiMessages = history.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
    const geminiCurrentParts: any[] = [{ text: prompt }];
    if (images.length > 0) {
      images.forEach((img: string) => {
        const matches = img.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
        if (matches) {
          geminiCurrentParts.push({ inlineData: { mimeType: matches[1], data: matches[2] } });
        }
      });
    }
    geminiMessages.push({ role: 'user', parts: geminiCurrentParts });
    
    // 🖥️ 인텐트 자동 감지 로직 (UI 요청이 최우선이 되도록 코딩 키워드 대폭 강화)
    // 🖥️ 인텐트 자동 감지 로직
    // 🖥️ 인텐트 자동 감지 로직
    const isUIRequest = rawPrompt.startsWith('/화면') || rawPrompt.startsWith('/ui') || 
                        (/(만들어|짜줘|웹사이트|페이지|화면|컴포넌트|코드|코딩|앱|html|css)/i.test(rawPrompt));
    
    const hasRecentImage = history.slice(-3).some((m: any) => m.role === 'assistant' && m.content.includes('!['));
    const isImageRequest = rawPrompt.startsWith('/그림 ') || (!isUIRequest && (/(그려|이미지|사진|배경화면)/i.test(rawPrompt) || (hasRecentImage && /(변경|바꿔|해줘|색으로)/i.test(rawPrompt))));

    // 🌟 [RAG 시스템 가동] 코딩/UI 요청일 경우에만 Pinecone 벡터 DB를 검색하여 과거 문맥을 소환합니다.
    let ragContext = "";
    if (isUIRequest) {
      try {
        const { roomId, userId } = await req.json().catch(() => ({ roomId: 'unknown', userId: 'unknown' })); // 프론트에서 넘어온 메타데이터 확보
        
        // 1. 현재 유저의 질문을 벡터로 임베딩 (🌟 수정: 오픈라우터 주소 및 1024 차원 적용)
        const embedRes = await fetch('https://openrouter.ai/api/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_EMBEDDING_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            input: rawPrompt, 
            model: "openai/text-embedding-3-small",
            dimensions: 1024 // 🌟 파인콘 1024 차원에 맞춤
          })
        });
        const embedData = await embedRes.json();
        const queryVector = embedData.data[0].embedding;

        // 2. Pinecone DB에서 현재 유저의 동일 방(roomId) 내 가장 유사한 과거 대화 3개 검색
        const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
        const index = pc.index(process.env.PINECONE_INDEX_NAME!);
        const queryResponse = await index.query({
          vector: queryVector,
          topK: 3,
          includeMetadata: true,
          filter: { roomId: { $eq: roomId } } // 다른 방 대화가 섞이지 않도록 방어
        });

        // 3. 검색된 과거 대화 조각들을 모아서 문맥 생성
        if (queryResponse.matches && queryResponse.matches.length > 0) {
           ragContext = queryResponse.matches.map(m => m.metadata?.text).join('\n---\n');
           console.log("🔍 [RAG 시스템] Pinecone에서 과거 문맥 소환 성공:", ragContext.slice(0, 100) + "...");
        }
      } catch (e) {
        console.log("RAG 검색 실패 (패스):", e);
      }

      const cleanPrompt = rawPrompt.replace(/^\/(화면|ui)\s+/, '');
      // 🌟 [RAG 증강] 검색된 과거 문맥(ragContext)을 AI의 시스템 프롬프트처럼 주입합니다.
      prompt = `다음 요구사항을 바탕으로 즉시 브라우저에서 렌더링 가능한 단일 HTML 파일 코드를 작성해.
      
[과거 유저의 선호도 및 연관 대화 기록]
${ragContext ? ragContext : "관련 기록 없음"}

[유저의 현재 요구사항]
${cleanPrompt}

과거 기록을 참고하여 유저의 스타일(색상, 프레임워크 선호도 등)을 반영하되, 현재 요구사항에 맞춰 코드를 생성해. Tailwind CSS와 필요한 경우 라이브러리(Mermaid, Three.js 등)를 CDN으로 포함하고, 결과물은 어떠한 부가 설명도 없이 오직 <html> 태그로 시작해서 </html>로 끝나는 순수 코드만 출력해.`;
    }

    // 🌟 [수정] 위에서 이미 선언했으므로 여기서 중복 선언하는 코드를 완전히 삭제했습니다.

    let apiUrl = '';
    let headers: any = {};
    let body: any = {};
    let customImageMessage = ''; // 🌟 [추가] Grok이 건네는 자연스러운 한국어 멘트를 담을 변수

    // 🌟 [핵심] 키 접두사(startsWith)는 위조될 수 있으므로 완전히 무시하고, 프론트가 명령한 'requestedModel' 하나로만 분기합니다.
    if (requestedModel === 'claude') {
      // 🌟 [에이전트 협업 파이프라인 시동]
      // 하나의 API 키로 3단계 내부 릴레이 회의를 거치게 만듭니다.
      const anthropicHeaders = { 
        'x-api-key': apiKey, 
        'anthropic-version': '2023-06-01', 
        'Content-Type': 'application/json' 
      };

      // 1단계: 개발자 에이전트가 코드를 짭니다.
      const devRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: anthropicHeaders,
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20240620',
          max_tokens: 3000,
          system: "당신은 세계 최고의 수석 소프트웨어 엔지니어입니다. 유저의 요구사항에 맞는 완벽한 코드만 작성하세요.",
          messages: claudeMessages
        })
      });
      const devData = await devRes.json();
      const devCode = devData.content?.[0]?.text || "";

      // 2단계: 코드 검수자 에이전트가 방금 짠 코드를 받아 버그와 보안을 샅샅이 뒤집니다.
      const QAWithPrompt = [...claudeMessages, { 
        role: 'user', 
        content: `다음 작성된 코드를 엄격하게 검수하고, 발견된 버그나 하이드레이션 에러를 수정하여 보완된 최종 코드만 출력해줘.\n\n[작성된 코드]\n${devCode}` 
      }];

      const qasRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: anthropicHeaders,
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20240620',
          max_tokens: 4096,
          system: "당신은 코드의 안정성과 하이드레이션 에러를 전문으로 잡아내는 QA 마스터입니다. 부가 설명 없이 수정된 최종 코드 본문만 출력하세요.",
          messages: QAWithPrompt
        })
      });
      
      const qaData = await qasRes.json();
      
      // 🌟 [에러 해결] 아래의 공통 fetch 로직을 타지 않고, 클로드 에이전트의 최종 합작품을 즉시 프론트로 반환합니다!
      return NextResponse.json({ 
        content: [{ text: qaData.content?.[0]?.text || "검수된 응답이 없습니다." }] 
      });
    }
    else if (requestedModel === 'openrouter') {
      apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
      headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
      body = { model: 'meta-llama/llama-3.1-70b-instruct', messages: openAiMessages }; // 🌟 범용 Vision 장착
    }
    else if (requestedModel === 'groq') {
      apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
      headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
      body = { model: 'llama-3.1-70b-versatile', messages: openAiMessages }; // 🌟 범용 Vision 장착
    }
    else if (requestedModel === 'openai') {
      if (rawPrompt.startsWith('/그림 ') || (!isUIRequest && (rawPrompt.includes('그려') || rawPrompt.includes('이미지') || rawPrompt.includes('사진') || rawPrompt.includes('배경화면')))) {
        // ... (DALL-E 로직도 그대로 둡니다) ...
      } else {
        apiUrl = 'https://api.openai.com/v1/chat/completions';
        headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
        body = { model: 'gpt-4o-mini', messages: openAiMessages }; // 🌟 범용 Vision 장착
      }
    }
    else if (requestedModel === 'gemini') {
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${apiKey}`;
      headers = { 'Content-Type': 'application/json' };
      body = { contents: geminiMessages }; // 🌟 Gemini Vision 장착
    }
    else if (requestedModel === 'xai') {
      if (isImageRequest) {
        const userImagePrompt = prompt.replace('/그림 ', '');
        const translationHistory = history.map((m: any) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        }));
        
        // 🌟 [핵심] JSON 포맷으로 "텍스트 답변"과 "그림 프롬프트"를 동시에 받아옵니다.
        translationHistory.push({
          role: 'user',
          content: `이전 문맥을 파악하여 유저의 그림(수정) 요청을 처리해. 1) 유저에게 건넬 친절한 한국어 답변(예: "알았어! ~그려줄게")과 2) AI 이미지 생성기용 고품질 영어 프롬프트를 JSON으로 출력해. 반드시 {"message": "한국어 답변", "prompt": "영어 프롬프트"} 형태의 순수 JSON만 출력해. 요청: ${userImagePrompt}`
        });

        const translateRes = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'grok-4.3', messages: translationHistory })
        });
        const translateData = await translateRes.json();
        let contentStr = translateData.choices?.[0]?.message?.content || '{}';
        contentStr = contentStr.replace(/```json/g, '').replace(/```/g, '').trim(); // 마크다운 찌꺼기 제거
        
        let englishPrompt = 'a beautiful scenery';
        try {
          const parsed = JSON.parse(contentStr);
          customImageMessage = parsed.message || '이미지를 생성해볼게!';
          englishPrompt = parsed.prompt || englishPrompt;
        } catch(e) {
          englishPrompt = contentStr;
          customImageMessage = '이미지를 생성해볼게!';
        }

        console.log("🎨 [Grok 번역 프롬프트]:", englishPrompt);

        headers = { 
          'Authorization': `Key d8cc860f-af9d-4cfb-b1ef-baa4cdc106a5:c219d12ea454478092123931288bdfa6`, 
          'Content-Type': 'application/json' 
        };

        // 🌟 [핵심] 이전 그림 URL이 넘어왔다면 '수정(Image-to-Image)' 엔진으로, 아니면 '새로 그리기(Text-to-Image)' 엔진으로 자동 분기!
        if (referenceImageUrl) {
          apiUrl = 'https://fal.run/fal-ai/flux/dev/image-to-image'; 
          body = { 
            prompt: englishPrompt, 
            image_url: referenceImageUrl, // 🌟 밑그림으로 깔아줄 원본 이미지
            strength: 0.85, // 🌟 (0.0 ~ 1.0) 낮을수록 원본 형태(Shape)를 강하게 유지합니다. 0.85가 형태 유지+색상 변경의 황금비율!
            image_size: "landscape_4_3" 
          };
          console.log("🔄 [수정 모드 가동] 원본 이미지 유지(Inpainting) 엔진 사용");
        } else {
          apiUrl = 'https://fal.run/fal-ai/flux/schnell'; 
          body = { prompt: englishPrompt, image_size: "landscape_4_3", num_inference_steps: 4 };
        }
      } else {
        // 💬 평범한 대화는 원래대로 xAI(Grok)로 전송 (🌟 수정: openAiMessages로 변경하여 대화 기록 유지)
        apiUrl = 'https://api.x.ai/v1/chat/completions';
        headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
        body = { model: 'grok-4.3', max_tokens: 4096, messages: openAiMessages }; 
      }
    }
    else if (apiKey.startsWith('gsk_')) {
      apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
      headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
      body = { model: 'llama-3.1-70b-versatile', messages: [{ role: 'user', content: prompt }] };
    }
    else if (requestedModel === 'openai') {
      // ⚠️ 코딩/UI 요청(isUIRequest)일 때는 그림 생성기가 낚아채지 않도록 철벽 방어!
      if (rawPrompt.startsWith('/그림 ') || (!isUIRequest && (rawPrompt.includes('그려') || rawPrompt.includes('이미지') || rawPrompt.includes('사진') || rawPrompt.includes('배경화면')))) {
        apiUrl = 'https://api.openai.com/v1/images/generations';
        headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
        body = { model: 'dall-e-3', prompt: prompt.replace('/그림 ', ''), n: 1, size: '1024x1024' };
      } else {
        apiUrl = 'https://api.openai.com/v1/chat/completions';
        headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
        body = { model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }] };
      }
    }
    else if (requestedModel === 'gemini') {
      // 🤖 [안정화] 괄호 문법 에러를 방지하고, 구글 API에서 가장 확실히 인식하는 'gemini-1.5-pro-latest' 엔드포인트를 사용합니다.
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${apiKey}`;
      headers = { 'Content-Type': 'application/json' };
      // 🌟 [수정] 단일 프롬프트가 아니라 누적된 geminiMessages 배열을 전송하도록 수정
      body = { contents: geminiMessages }; 
    }
    else {
      return NextResponse.json({ content: [{ text: "지원하지 않는 키 형식입니다." }] });
    }

    // 🔍 [검증 로그] 서버 터미널에 어떤 주소로 쏘는지 출력합니다. 
    console.log("🚀 현재 호출 중인 API 주소:", apiUrl);

    const response = await fetch(apiUrl, { method: 'POST', headers, body: JSON.stringify(body) });
    const data = await response.json();
    console.log("🔥 [API 원본 응답 데이터]:", data);
// 에러 발생 시 진짜 에러 이유를 출력 및 낚아채기
    if (data.error || !response.ok) {
      console.error("❌ API 서버 에러 상세:", data?.error?.message || JSON.stringify(data));
      
      const errorStr = JSON.stringify(data).toLowerCase();
      // 🌟 429(잔액부족), 401(권한없음) 또는 관련 에러 메시지 감지
      if (response.status === 429 || response.status === 401 || errorStr.includes('credit') || errorStr.includes('quota') || errorStr.includes('rate limit') || errorStr.includes('balance')) {
        
        // 🚨 [추가된 로직] 파이어베이스에서 해당 매물 즉시 철거 (블라인드)
        try {
          const { db } = require('@/lib/firebase');
          const { collection, query, where, getDocs, deleteDoc } = require('firebase/firestore');
          
          const q = query(collection(db, 'market_items'), where('apiKey', '==', encryptedApiKey));
          const querySnapshot = await getDocs(q);
          
          querySnapshot.forEach(async (docSnap: any) => {
            await deleteDoc(docSnap.ref);
          });
          console.log("🚨 잔액 고갈 매물 시장에서 자동 철거 완료");
        } catch (dbErr) {
          console.error("자동 매물 철거 중 오류:", dbErr);
        }

        return NextResponse.json({ 
          content: [{ text: "🚨 **[안내]** 판매자의 API 잔액이 소진되어 대화가 중단되었습니다. 본 매물은 상점에서 즉시 자동 철거되었으며, 다른 매물을 이용해 주시기 바랍니다." }] 
        });
      }

      return NextResponse.json({ content: [{ text: `에러 발생: ${data?.error?.message || '서버 통신 오류'}` }] });
    }

    let replyText = "응답을 파싱할 수 없습니다.";
    
    if (requestedModel === 'claude') {
      replyText = data.content?.[0]?.text;
    } 
    // 🌟 1. xAI(Grok) 전용 파싱 로직 (텍스트 vs Fal.ai 그림)
    else if (requestedModel === 'xai') {
      if (apiUrl.includes('fal.run')) {
        // 🎨 JSON에서 빼온 한국어 멘트(customImageMessage)와 그림을 합쳐서 출력합니다!
        const imageUrl = data.images?.[0]?.url;
        replyText = imageUrl ? `${customImageMessage}\n\n![Grok(Flux)가 그린 그림](${imageUrl})` : "이미지 생성 실패 (Fal API 키나 잔액을 확인하세요)";
      } else {
        replyText = data.choices?.[0]?.message?.content;
      }
    }
    // 🌟 2. 나머지(OpenRouter, Groq, OpenAI) 파싱 로직
    else if (requestedModel === 'openrouter' || requestedModel === 'groq' || requestedModel === 'openai') {
      if (apiUrl.includes('images/generations')) {
        // 🎨 OpenAI(DALL-E 3)에서 받아온 이미지 포장
        const imageUrl = data.data?.[0]?.url;
        replyText = imageUrl ? `![GPT가 그린 그림](${imageUrl})` : "이미지 생성 실패";
      } else {
        replyText = data.choices?.[0]?.message?.content;
      }
    } 
    else if (requestedModel === 'gemini') {
      replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    }
    

    return NextResponse.json({ content: [{ text: replyText }] });

  } catch (error) {
    console.error("Server API Error:", error);
    return NextResponse.json({ content: [{ text: "서버 통신 에러" }] }, { status: 500 });
  }
}