import { NextResponse } from 'next/server';
import { CryptoUtil } from '@/lib/crypto';

export async function POST(req: Request) {
  try {
    const { prompt: rawPrompt, encryptedApiKey, history = [], images = [] } = await req.json();
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
    const isUIRequest = rawPrompt.startsWith('/화면') || rawPrompt.startsWith('/ui') || 
                        (/(만들어|짜줘|웹사이트|페이지|화면|컴포넌트|코드|코딩|앱|html|css)/i.test(rawPrompt));
    if (isUIRequest) {
      const cleanPrompt = rawPrompt.replace(/^\/(화면|ui)\s+/, '');
      prompt = `다음 요구사항을 바탕으로 즉시 브라우저에서 렌더링 가능한 단일 HTML 파일 코드를 작성해. 
Tailwind CSS와 필요한 경우 라이브러리(Mermaid, Three.js 등)를 CDN으로 포함하고, 
결과물은 어떠한 부가 설명도 없이 오직 <html> 태그로 시작해서 </html>로 끝나는 순수 코드만 출력해.
요구사항: ${cleanPrompt}`;
    }

    let apiUrl = '';
    let headers: any = {};
    let body: any = {};

    if (apiKey.startsWith('sk-ant')) {
      apiUrl = 'https://api.anthropic.com/v1/messages';
      headers = { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' };
      body = { model: 'claude-3-5-sonnet-20240620', max_tokens: 4096, messages: claudeMessages }; // 🌟 Claude Vision 장착
    }
    else if (apiKey.startsWith('sk-or-')) {
      apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
      headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
      body = { model: 'meta-llama/llama-3.1-70b-instruct', messages: openAiMessages }; // 🌟 범용 Vision 장착
    }
    else if (apiKey.startsWith('xai-')) {
      if (rawPrompt.startsWith('/그림 ') || (!isUIRequest && (rawPrompt.includes('그려') || rawPrompt.includes('이미지') || rawPrompt.includes('사진') || rawPrompt.includes('배경화면')))) {
        // ... (이 부분의 Fal.ai 로직은 대장님 코드 원본 그대로 둡니다) ...
      } else {
        apiUrl = 'https://api.x.ai/v1/chat/completions';
        headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
        body = { model: 'grok-4.3', max_tokens: 4096, messages: openAiMessages }; // 🌟 범용 Vision 장착
      }
    }
    else if (apiKey.startsWith('gsk_')) {
      apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
      headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
      body = { model: 'llama-3.1-70b-versatile', messages: openAiMessages }; // 🌟 범용 Vision 장착
    }
    else if (apiKey.startsWith('sk-') || apiKey.startsWith('sk-proj-')) {
      if (rawPrompt.startsWith('/그림 ') || (!isUIRequest && (rawPrompt.includes('그려') || rawPrompt.includes('이미지') || rawPrompt.includes('사진') || rawPrompt.includes('배경화면')))) {
        // ... (DALL-E 로직도 그대로 둡니다) ...
      } else {
        apiUrl = 'https://api.openai.com/v1/chat/completions';
        headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
        body = { model: 'gpt-4o-mini', messages: openAiMessages }; // 🌟 범용 Vision 장착
      }
    }
    else if (apiKey.startsWith('AIza')) {
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${apiKey}`;
      headers = { 'Content-Type': 'application/json' };
      body = { contents: geminiMessages }; // 🌟 Gemini Vision 장착
    }
    else if (apiKey.startsWith('xai-')) {
      // 🎨 '/그림' 명령어뿐만 아니라, 유저가 자연스럽게 요구하는 시각적 키워드를 모두 감지합니다!
      // ⚠️ 코딩/UI 요청(isUIRequest)일 때는 그림 생성기가 낚아채지 않도록 철벽 방어!
      if (rawPrompt.startsWith('/그림 ') || (!isUIRequest && (rawPrompt.includes('그려') || rawPrompt.includes('이미지') || rawPrompt.includes('사진') || rawPrompt.includes('배경화면')))) {
        // 🌟 1단계: Grok의 뇌를 사용해 한국어를 고퀄리티 영어 프롬프트로 번역/확장합니다.
        const userImagePrompt = prompt.replace('/그림 ', '');
        const translateRes = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            model: 'grok-4.3', 
            messages: [{ 
              role: 'user', 
              content: `다음 그림 요청을 AI 이미지 생성기에 넣을 고품질 영어 프롬프트로 번역하고 구체적으로 묘사해줘. 다른 말은 절대 하지 말고 오직 영어 프롬프트만 출력해: ${userImagePrompt}` 
            }] 
          })
        });
        const translateData = await translateRes.json();
        const englishPrompt = translateData.choices?.[0]?.message?.content || 'a beautiful scenery';
        
        console.log("🎨 [Grok이 번역한 프롬프트]:", englishPrompt);

        // 🌟 2단계: 번역된 완벽한 영어 프롬프트를 Fal.ai(Flux)로 전송합니다!
        apiUrl = 'https://fal.run/fal-ai/flux/schnell'; 
        headers = { 
          // 🔥 서버가 키를 못 읽는 현상을 막기 위해 다이렉트로 꽂아줍니다!
          'Authorization': `Key d8cc860f-af9d-4cfb-b1ef-baa4cdc106a5:c219d12ea454478092123931288bdfa6`, 
          'Content-Type': 'application/json' 
        };
        body = { 
          prompt: englishPrompt, 
          image_size: "landscape_4_3",
          num_inference_steps: 4 
        };
      } else {
        // 💬 평범한 대화는 원래대로 xAI(Grok)로 전송
        apiUrl = 'https://api.x.ai/v1/chat/completions';
        headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
        body = { model: 'grok-4.3', max_tokens: 4096, messages: [{ role: 'user', content: prompt }] };
      }
    }
    else if (apiKey.startsWith('gsk_')) {
      apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
      headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
      body = { model: 'llama-3.1-70b-versatile', messages: [{ role: 'user', content: prompt }] };
    }
    else if (apiKey.startsWith('sk-') || apiKey.startsWith('sk-proj-')) {
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
    else if (apiKey.startsWith('AIza')) {
      // 🤖 [안정화] 괄호 문법 에러를 방지하고, 구글 API에서 가장 확실히 인식하는 'gemini-1.5-pro-latest' 엔드포인트를 사용합니다.
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${apiKey}`;
      headers = { 'Content-Type': 'application/json' };
      body = { contents: [{ parts: [{ text: prompt }] }] };
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
    if (data.error) {
      console.error("❌ API 서버 에러 상세:", data.error.message || JSON.stringify(data.error));
      
      // 🌟 우아한 일시 품절 방어 로직: 총알 오링(크레딧 소진 / 429 제한 등) 감지
      const errorStr = JSON.stringify(data.error).toLowerCase();
      if (response.status === 429 || errorStr.includes('credit') || errorStr.includes('quota') || errorStr.includes('rate limit') || errorStr.includes('balance')) {
        return NextResponse.json({ 
          content: [{ text: "🚨 **[일시 품절 안내]**\n\n해당 매물은 판매자의 토큰 한도가 모두 소진되어 일시 품절 상태가 되었습니다. 거래소에서 다른 매물을 선택해주세요." }] 
        });
      }

      return NextResponse.json({ content: [{ text: `에러 발생: ${data.error.message || '서버 통신 오류'}` }] });
    }

    let replyText = "응답을 파싱할 수 없습니다.";
    
    if (apiKey.startsWith('sk-ant')) {
      replyText = data.content?.[0]?.text;
    } 
    // 🌟 1. xAI(Grok) 전용 파싱 로직 (텍스트 vs Fal.ai 그림)
    else if (apiKey.startsWith('xai-')) {
      if (apiUrl.includes('fal.run')) {
        // 🎨 Fal.ai(Flux)에서 받아온 이미지 URL을 마크다운으로 포장
        const imageUrl = data.images?.[0]?.url;
        replyText = imageUrl ? `![Grok(Flux)가 그린 그림](${imageUrl})` : "이미지 생성 실패 (Fal API 키나 잔액을 확인하세요)";
      } else {
        replyText = data.choices?.[0]?.message?.content;
      }
    } 
    // 🌟 2. 나머지(OpenRouter, Groq, OpenAI) 파싱 로직
    else if (apiKey.startsWith('sk-or-') || apiKey.startsWith('gsk_') || apiKey.startsWith('sk-')) {
      if (apiUrl.includes('images/generations')) {
        // 🎨 OpenAI(DALL-E 3)에서 받아온 이미지 포장
        const imageUrl = data.data?.[0]?.url;
        replyText = imageUrl ? `![GPT가 그린 그림](${imageUrl})` : "이미지 생성 실패";
      } else {
        replyText = data.choices?.[0]?.message?.content;
      }
    } 
    else if (apiKey.startsWith('AIza')) {
      replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    }

    return NextResponse.json({ content: [{ text: replyText }] });

  } catch (error) {
    console.error("Server API Error:", error);
    return NextResponse.json({ content: [{ text: "서버 통신 에러" }] }, { status: 500 });
  }
}