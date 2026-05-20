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
              
              <label className="flex items-center gap-3 cursor-pointer mt-4 bg-[#121212] p-4 rounded-xl border border-[#333]">
                <input 
                  type="checkbox" 
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="w-5 h-5 accent-[#059669] shrink-0"
                />
                <span className="text-[13px] text-gray-300 leading-snug">
                  [필수] 만 14세 이상이며, 서비스 이용약관 및 개인정보 처리방침에 동의합니다.
                </span>
              </label>

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