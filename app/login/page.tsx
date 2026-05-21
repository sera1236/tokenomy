'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useStore } from '@/lib/useStore';

export default function Login() {
  const router = useRouter();
  const setLogin = useStore((state) => state.setLogin);

  // 🌟 회원가입 온보딩 상태 관리
  const [isNewUser, setIsNewUser] = useState(false);
  const [tempUser, setTempUser] = useState<any>(null);
  const [nickname, setNickname] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showTermsDetail, setShowTermsDetail] = useState(false); // 🌟 약관 아코디언 상태
const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        // 🌟 신규 유저면 즉시 DB에 넣지 않고, 닉네임/약관 설정 화면으로 넘깁니다.
        setTempUser(user);
        setIsNewUser(true);
      } else {
        // 🌟 기존 유저면 바로 로그인 완료 처리
        setLogin(true);
        router.push('/');
      }
    } catch (error) {
      console.error(error);
      alert('로그인 중 오류가 발생했습니다.');
    }
  };

  // 🌟 닉네임 설정 및 약관 동의 후 최종 가입 처리 함수
  const handleCompleteRegistration = async () => {
    if (!nickname.trim()) return alert('사용하실 닉네임을 입력해주세요.');
    if (!agreeTerms) return alert('서비스 이용약관에 동의하셔야 가입이 가능합니다.');
    if (!tempUser) return;

    try {
      const userRef = doc(db, 'users', tempUser.uid);
      await setDoc(userRef, {
        email: tempUser.email,
        name: nickname, // 구글 본명 대신 유저가 입력한 닉네임을 저장
        points: 50000, 
        agreedToTerms: true, // 🌟 법적 방어막 (약관 동의 완료 증명)
        createdAt: new Date()
      });

      setLogin(true);
      alert(`${nickname}님, 토큰 마켓 가입을 환영합니다! 🎉`);
      router.push('/');
    } catch (error) {
      console.error(error);
      alert('회원가입 처리 중 서버 오류가 발생했습니다.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-6">
      <div className="w-full max-w-md bg-[#1E1E1E] p-8 rounded-3xl border border-[#2C2C2C] shadow-2xl">
        {!isNewUser ? (
          // 🌟 기존 로그인 화면
          <>
            <h1 className="text-3xl font-black text-white mb-2 text-center">로그인</h1>
            <p className="text-gray-400 text-sm text-center mb-8">AI 토큰 마켓에 오신 것을 환영합니다</p>

            <div className="space-y-4">
              <button 
                onClick={handleGoogleLogin}
                className="w-full bg-white hover:bg-gray-100 text-black font-black py-4 rounded-xl transition shadow-lg flex items-center justify-center gap-3"
              >
                <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-6 h-6" />
                <span>구글 계정으로 시작하기</span>
              </button>
            </div>
          </>
        ) : (
          // 🌟 신규 유저 온보딩(회원가입) 화면
          <div className="animate-in fade-in zoom-in duration-300">
            <h1 className="text-2xl font-black text-white mb-2 text-center">환영합니다! 🎉</h1>
            <p className="text-[#AAAAAA] text-sm text-center mb-6">시작하기 전에 프로필을 설정해주세요.</p>
            
            <div className="space-y-4">
              <div>
                <label className="text-[#059669] font-bold text-sm ml-1 mb-1 block">사용할 닉네임</label>
                <input 
                  type="text" 
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="예: AI토큰마스터" 
                  maxLength={10}
                  className="w-full bg-[#121212] border border-[#333] focus:border-[#059669] rounded-xl py-4 px-4 text-white outline-none transition"
                />
              </div>
              
              <div className="mt-4 bg-[#121212] rounded-xl border border-[#333] overflow-hidden transition-all">
                <div className="flex items-center justify-between p-4">
                  <label className="flex items-center gap-3 cursor-pointer flex-1">
                    <input 
                      type="checkbox" 
                      checked={agreeTerms}
                      onChange={(e) => setAgreeTerms(e.target.checked)}
                      className="w-5 h-5 accent-[#059669] shrink-0"
                    />
                    <span className="text-[13px] text-gray-300 font-bold">
                      [필수] 서비스 이용약관 및 개인정보 처리방침 동의
                    </span>
                  </label>
                  <button 
                    onClick={() => setShowTermsDetail(!showTermsDetail)}
                    className="p-1 text-gray-500 hover:text-white transition"
                  >
                    {showTermsDetail ? '▲ 닫기' : '▼ 보기'}
                  </button>
                </div>
                
                {showTermsDetail && (
                  <div className="px-4 pb-4 border-t border-[#333] bg-[#1A1A1A]">
                    <div className="h-32 overflow-y-auto whitespace-pre-wrap text-[11px] text-gray-400 p-2 mt-2 font-mono">
                      {`제1조 (목적)\n본 약관은 토크노미 서비스(이하 "서비스")를 이용함에 있어 회사와 회원 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.\n\n제2조 (포인트 및 결제)\n1. 회원은 서비스를 통해 AI 모델 API를 호출할 때마다 규정된 포인트를 차감당합니다.\n2. 서비스 생태계는 사용자의 디지털 뇌 부담(digital burden on the brain)을 완화하는 건전한 지식 소비를 지향합니다.\n\n제3조 (판매자 등록 및 책임)\n1. 자신의 API 키를 등록하여 수익을 창출하는 판매자는 해당 키의 안정성에 대한 1차적 책임을 집니다.`}
                    </div>
                  </div>
                )}
              </div>

              <button 
                onClick={handleCompleteRegistration}
                className="w-full bg-[#059669] hover:bg-[#047857] text-white font-bold py-4 rounded-xl transition shadow-lg mt-4"
              >
                가입 완료하고 시작하기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}