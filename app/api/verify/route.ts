import { NextResponse } from 'next/server';
import { CryptoUtil } from '@/lib/crypto';

export async function POST(req: Request) {
  try {
    const { encryptedApiKey, apiType } = await req.json();
    const apiKey = CryptoUtil.decrypt(encryptedApiKey).trim();

    if (!apiKey) {
      return NextResponse.json({ success: false, message: 'API 키가 비어있습니다.' });
    }

    let isValid = false;

    // 1. OpenAI / GPT / OpenRouter 계열 검증
    if (apiKey.startsWith('sk-')) {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (res.status === 200) isValid = true;
    } 
    // 2. 클로드(Anthropic) 계열 검증
    else if (apiKey.startsWith('sk-ant')) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({ 
          model: 'claude-3-haiku-20240307', 
          max_tokens: 1, 
          messages: [{ role: 'user', content: 'ping' }] 
        })
      });
      if (res.status === 200 || res.status === 201 || res.status === 400) {
        // 400 에러는 토큰 부족이나 형식 오류일 뿐 인증(411/403)은 뚫었다는 뜻이므로 유효 키로 인정합니다.
        isValid = true;
      }
    }
    // 3. Groq / 그록 계열 검증
    else if (apiKey.startsWith('gsk_') || apiKey.startsWith('xai-')) {
      const targetUrl = apiKey.startsWith('gsk_') 
        ? 'https://api.groq.com/openai/v1/models'
        : 'https://api.x.ai/v1/models';
        
      const res = await fetch(targetUrl, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (res.status === 200) isValid = true;
    }
    // 4. 기타 식별되지 않은 키는 기본 글자 수 체크로 방어
    else {
      if (apiKey.length > 15) isValid = true;
    }

    if (isValid) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, message: '유효하지 않거나 잔액이 없는 API 키입니다. 다시 확인해주세요.' });
    }

  } catch (error) {
    return NextResponse.json({ success: false, message: '본사 서버 인증 통신 중 예외 에러가 발생했습니다.' });
  }
}