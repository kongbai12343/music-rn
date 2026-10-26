import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { apiConfig } from '@/config/apiConfig';
import { queryClient } from '@/config/queryClient';
import { neteaseApi } from '@/api/neteaseApi';
import { ApiError, configureSessionAccessors } from '@/api/apiRequest';
import type { UserProfile } from '@/api/musicTypes';

interface AccountState {
  /** 可能是游客凭据；是否拥有用户身份需检查 profile，不能只看 Cookie 是否存在。 */
  cookie: string | null;
  profile: UserProfile | null;
  /** 启动时的会话恢复是否已结束，不代表用户已经登录。 */
  hydrated: boolean;
  /** 恢复并校验原生端保存的凭据，无凭据时尝试获取游客会话。 */
  restore: () => Promise<void>;
  /** 接收登录流程验证后的凭据与资料，清除旧账号缓存，再保存并发布新会话。 */
  setSession: (cookie: string, profile: UserProfile) => Promise<void>;
  /** 清理登录会话并尝试刷新游客凭据，不删除本地搜索和播放历史。 */
  signOut: () => Promise<void>;
}

const secureSessionKey = 'cloud-listening-session';
// 登录、退出或凭据失效都会递增版本；旧异步任务不得覆盖较新的会话。
let sessionRevision = 0;
let pendingRestore: Promise<void> | null = null;
let pendingStorageWrite: Promise<void> = Promise.resolve();

// 串行执行凭据写入与删除，避免较慢的旧写入在退出后重新保存凭据。
function serializeStorageOperation(operation: () => Promise<void>): Promise<void> {
  const result = pendingStorageWrite.catch(() => {}).then(operation);
  pendingStorageWrite = result;
  return result;
}

async function clearAccountQueries() {
  // 先取消请求再删除缓存，避免旧账号的在途响应重新填回个人数据。
  await queryClient.cancelQueries({ queryKey: ['account'] });
  queryClient.removeQueries({ queryKey: ['account'] });
}

export const useAccountStore = create<AccountState>((set, get) => ({
  cookie: null,
  profile: null,
  hydrated: false,
  restore: () => {
    // 根布局重复触发恢复时共享同一任务，避免重复读取存储和申请游客会话。
    if (pendingRestore) return pendingRestore;
    if (get().hydrated) return Promise.resolve();
    const requestedRevision = sessionRevision;
    pendingRestore = (async () => {
      let restoredCookie: string | null = null;
      let restoredProfile: UserProfile | null = null;
      try {
        // 原生端使用安全存储；Web 凭据仅保存在内存，不写入浏览器持久存储。
        if (Platform.OS !== 'web') {
          const storedSession = await SecureStore.getItemAsync(secureSessionKey);
          if (storedSession) {
            const stored: unknown = JSON.parse(storedSession);
            if (
              stored &&
              typeof stored === 'object' &&
              'cookie' in stored &&
              typeof stored.cookie === 'string'
            )
              restoredCookie = stored.cookie;
          }
        }
        if (restoredCookie && apiConfig.isApiConfigured) {
          try {
            restoredProfile = await neteaseApi.getLoginStatusForCookie(restoredCookie);
          } catch (error) {
            // 临时网络故障不等于凭据失效，不能因此删除已保存的登录凭据。
            if (!(error instanceof ApiError && [301, 401].includes(error.code))) return;
          }
          if (!restoredProfile) {
            restoredCookie = null;
            if (Platform.OS !== 'web')
              await serializeStorageOperation(async () => {
                if (requestedRevision === sessionRevision)
                  await SecureStore.deleteItemAsync(secureSessionKey);
              });
          }
        }
        if (!restoredCookie && apiConfig.isApiConfigured)
          restoredCookie = await neteaseApi.getGuestCookie();
        if (requestedRevision === sessionRevision)
          set({ cookie: restoredCookie, profile: restoredProfile });
      } catch {
        // 存储或游客注册失败不阻塞应用启动，公开接口仍可尝试无客户端凭据访问。
      } finally {
        if (requestedRevision === sessionRevision) set({ hydrated: true });
        pendingRestore = null;
      }
    })();
    return pendingRestore;
  },
  setSession: async (cookie, profile) => {
    if (!cookie || !Number.isSafeInteger(profile.id) || profile.id <= 0)
      throw new Error('登录凭证或用户资料无效');
    const requestedRevision = ++sessionRevision;
    await clearAccountQueries();
    if (Platform.OS !== 'web')
      await serializeStorageOperation(async () => {
        if (requestedRevision === sessionRevision)
          await SecureStore.setItemAsync(secureSessionKey, JSON.stringify({ cookie }));
      });
    if (requestedRevision === sessionRevision) set({ cookie, profile, hydrated: true });
  },
  signOut: async () => {
    const requestedRevision = ++sessionRevision;
    // 先用旧凭据发出退出请求，再立即清空本地会话；网络失败不应阻止本地退出。
    const logoutRequest = neteaseApi.logout().catch(() => {});
    set({ cookie: null, profile: null, hydrated: true });
    await clearAccountQueries();
    if (Platform.OS !== 'web')
      await serializeStorageOperation(async () => {
        if (requestedRevision === sessionRevision)
          await SecureStore.deleteItemAsync(secureSessionKey);
      });
    await logoutRequest;
    if (requestedRevision !== sessionRevision || !apiConfig.isApiConfigured) return;
    try {
      const guestCookie = await neteaseApi.getGuestCookie();
      if (requestedRevision === sessionRevision) set({ cookie: guestCookie });
    } catch {
      // 游客凭据刷新失败不改变已完成的本地退出结果。
    }
  },
}));

configureSessionAccessors({
  getCookie: () => useAccountStore.getState().cookie,
  onSessionExpired: (expiredCookie) => {
    // 只清理此次失败请求使用的会话，防止旧请求把刚登录的新账号登出。
    if (useAccountStore.getState().cookie !== expiredCookie) return;
    const requestedRevision = ++sessionRevision;
    useAccountStore.setState({ cookie: null, profile: null, hydrated: true });
    void clearAccountQueries();
    if (Platform.OS !== 'web')
      void serializeStorageOperation(async () => {
        if (requestedRevision === sessionRevision)
          await SecureStore.deleteItemAsync(secureSessionKey);
      }).catch(() => {});
  },
});
