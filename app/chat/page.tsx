import { redirect } from 'next/navigation';

export default function ChatRedirect() {
  // 🌟 구(舊) 채팅방 경로로 접속하는 모든 유저를 새로운 메인 대문(/)으로 0.1초 만에 강제 이주(Redirect) 시킵니다.
  redirect('/');
}