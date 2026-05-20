import { NextResponse } from 'next/server';
import { CryptoUtil } from '@/lib/crypto';

export async function POST(req: Request) {
  try {
    const { encryptedApiKey, apiType } = await req.json();
    const apiKey = CryptoUtil.decrypt(encryptedApiKey).trim();

    // 🌟 1. xAI (Grok) 키 엑스레이 검증! (대장님 특별 지시사항)
    if (apiType === 'xai') {
      const res = await fetch('https://api.x.ai/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });

      if (!res.ok) {
        return NextResponse.json({ success: false, message: '❌ 유효하지 않은 xAI API 키입니다.' });
      }

      const data = await res.json();
      const models = data.data.map((m: any) => m.id);

      // grok-4.3 접근 권한이 있는지 모델 리스트에서 검사
      if (models.includes('grok-4.3') || models.includes('grok-4.3-latest')) {
        return NextResponse.json({ 
          success: true, 
          message: '✅ [유료 인증] grok-4.3 접근이 가능한 최고급 키입니다!' 
        });
      } else {
        return NextResponse.json({ 
          success: false, 
          message: '🚨 [등록 거부] 해당 키는 grok-4.3 접근이 불가능한 무료/저티어 키입니다. 프리미엄 매물로 등록할 수 없습니다.' 
        });
      }
    }
    
    // 🌟 2. OpenAI / OpenRouter / Groq 모델 핑 테스트
    else if (apiType === 'openai' || apiType === 'openrouter' || apiType === 'groq') {
      const baseUrl = apiType === 'openrouter' ? 'https://openrouter.ai/api/v1/models' :
                      apiType === 'groq' ? 'https://api.groq.com/openai/v1/models' : 
                      'https://api.openai.com/v1/models';
      
      const res = await fetch(baseUrl, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (!res.ok) return NextResponse.json({ success: false, message: '❌ 유효하지 않거나 잔액이 부족한 키입니다.' });
      return NextResponse.json({ success: true, message: '✅ 키 유효성 검증 완료!' });
    }

    // 🌟 3. Claude (Anthropic) 핑 테스트
    else if (apiType === 'claude') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-3-5-sonnet-20240620', max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] })
      });
      if (!res.ok) return NextResponse.json({ success: false, message: '❌ 유효하지 않은 Claude 키입니다.' });
      return NextResponse.json({ success: true, message: '✅ 키 유효성 검증 완료!' });
    }

    // 🌟 4. Gemini 핑 테스트
    else if (apiType === 'gemini') {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (!res.ok) return NextResponse.json({ success: false, message: '❌ 유효하지 않은 Gemini 키입니다.' });
      return NextResponse.json({ success: true, message: '✅ 키 유효성 검증 완료!' });
    }

    return NextResponse.json({ success: true, message: '✅ 알 수 없는 API이지만 형식은 통과했습니다.' });

  } catch (error) {
    console.error('Verify Error:', error);
    return NextResponse.json({ success: false, message: '서버 에러가 발생했습니다.' });
  }
}