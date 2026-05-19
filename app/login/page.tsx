'use client';

import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useStore } from '@/lib/useStore';

export default function Login() {
  const router = useRouter();
  const setLogin = useStore((state) => state.setLogin);

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // 🌟 파이어베이스에 유저 지갑(points) 정보 생성/확인
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          email: user.email,
          name: user.displayName,
          points: 50000, 
          createdAt: new Date()
        });
      }

      setLogin(true);
      alert(`${user.displayName}님 환영합니다!`);
      router.push('/');
    } catch (error) {
      console.error(error);
      alert('로그인 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-6">
      <div className="w-full max-w-md bg-[#1E1E1E] p-8 rounded-3xl border border-[#2C2C2C] shadow-2xl">
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
      </div>
    </div>
  );
}