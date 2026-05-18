// 🌟 lib/useStore.ts (위치를 lib으로 옮겼습니다!)
import { create } from 'zustand';

interface ChatState {
  isLoggedIn: boolean;
  currentApiKey: string;
  currentApiType: string;
  setLogin: (status: boolean) => void;
  setCurrentApi: (type: string, key: string) => void;
}

export const useStore = create<ChatState>((set) => ({
  isLoggedIn: false,
  currentApiKey: '',
  currentApiType: 'Claude',
  setLogin: (status) => set({ isLoggedIn: status }),
  setCurrentApi: (type, key) => set({ currentApiType: type, currentApiKey: key }),
}));