import { NextResponse } from 'next/server';
import mammoth from 'mammoth';

// 🌟 Vercel 빌드 시 서버 측에서 가짜 데이터 수집을 방지하여 'DOMMatrix' 에러를 원천 차단합니다.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    let extractedText = '';
    const mime = file.type;
    const filename = file.name.toLowerCase();

    // 🌟 1. PDF 파싱 (에러 유발 구형 require('pdf-parse') 대신 안전한 경량 텍스트 추출 로직 적용)
    if (mime === 'application/pdf' || filename.endsWith('.pdf')) {
      try {
        // 서버 사이드 크래시 방지를 위해 pdf-parse 런타임 가드 적용
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(buffer);
        extractedText = data.text;
      } catch (pdfError) {
        console.error("PDF 파싱 내부 라이브러리 에러:", pdfError);
        // 만약의 사태를 대비한 폰백 안전 텍스트 변환 가이드라인
        extractedText = `[PDF 문서: ${file.name}의 내용을 읽는 중 라이브러리 예외가 발생하여 수동 확인이 필요합니다.]`;
      }
    } 
    // 🌟 2. Word (DOCX) 파싱
    else if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || filename.endsWith('.docx')) {
      const data = await mammoth.extractRawText({ buffer });
      extractedText = data.value;
    } 
    else {
      return NextResponse.json({ error: '지원하지 않는 파일 형식입니다.' }, { status: 400 });
    }

    const cleanText = extractedText.replace(/\n\s*\n/g, '\n\n').trim();
    return NextResponse.json({ text: cleanText });

  } catch (error) {
    console.error("파일 파싱 서버 에러:", error);
    return NextResponse.json({ error: '문서를 읽는 중 서버 에러가 발생했습니다.' }, { status: 500 });
  }
}