import { NextResponse } from 'next/server';
const pdf = require('pdf-parse');
import mammoth from 'mammoth';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 });
    }

    // 파일을 버퍼(메모리 덩어리)로 변환
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    let extractedText = '';
    const mime = file.type;
    const filename = file.name.toLowerCase();

    // 🌟 1. PDF 파싱
    if (mime === 'application/pdf' || filename.endsWith('.pdf')) {
      const data = await pdf(buffer);
      extractedText = data.text;
    } 
    // 🌟 2. Word (DOCX) 파싱
    else if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || filename.endsWith('.docx')) {
      const data = await mammoth.extractRawText({ buffer });
      extractedText = data.value;
    } 
    else {
      return NextResponse.json({ error: '지원하지 않는 파일 형식입니다.' }, { status: 400 });
    }

    // 너무 긴 공백이나 줄바꿈 정리
    const cleanText = extractedText.replace(/\n\s*\n/g, '\n\n').trim();

    return NextResponse.json({ text: cleanText });

  } catch (error) {
    console.error("파일 파싱 에러:", error);
    return NextResponse.json({ error: '문서를 읽는 중 서버 에러가 발생했습니다.' }, { status: 500 });
  }
}