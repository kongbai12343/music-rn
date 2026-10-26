import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/api/apiRequest';

/** 所有页面共用一个查询客户端，以复用接口缓存和统一重试策略。 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 时间单位为毫秒：数据 2 分钟内视为新鲜，无订阅的缓存保留 10 分钟。
      staleTime: 120000,
      gcTime: 600000,
      // 只读查询最多重试一次；登录失效、参数错误或风控等问题不能靠自动重试解决。
      retry: (failureCount, error) =>
        failureCount < 1 &&
        !(error instanceof ApiError && [301, 400, 401, 403, 429, 460, 503].includes(error.code)),
      refetchOnWindowFocus: false,
    },
    // 写操作可能已在服务端生效，超时后自动重试会造成重复提交。
    mutations: { retry: false },
  },
});
