import CryptoJS from 'crypto-js';

// 🌟 주의: 이 키는 나중에 .env.local로 옮기는 것이 좋지만, 우선 테스트를 위해 하드코딩합니다.
const MASTER_KEY = "Your-Very-Secret-Master-Key-12345"; 

export const CryptoUtil = {
  // 🔐 암호화 (브라우저/서버 공용)
  encrypt: (text: string) => {
    try {
      if (!text) return "";
      // AES 알고리즘으로 암호화하여 문자열로 반환
      return CryptoJS.AES.encrypt(text, MASTER_KEY).toString();
    } catch (e) {
      console.error("암호화 에러:", e);
      return text;
    }
  },

  // 🔓 해독 (브라우저/서버 공용)
  decrypt: (cipherText: string) => {
    try {
      if (!cipherText) return "";
      // 금고를 열어서 원문을 추출
      const bytes = CryptoJS.AES.decrypt(cipherText, MASTER_KEY);
      const originalText = bytes.toString(CryptoJS.enc.Utf8);
      return originalText || cipherText;
    } catch (e) {
      console.error("해독 에러:", e);
      return cipherText;
    }
  }
};