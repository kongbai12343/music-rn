import { useMutation, useQuery } from '@tanstack/react-query';
import { useAccountStore } from './accountStore';
import { apiConfig } from '@/config/apiConfig';
import { queryClient } from '@/config/queryClient';
import { neteaseApi } from '@/api/neteaseApi';

/** 查询结果的 data 为当前账号喜欢的歌曲 ID 列表（非歌曲详情）；缓存按用户 ID 隔离。 */
export function useLikedSongs() {
  const profile = useAccountStore((state) => state.profile);
  return useQuery({
    queryKey: ['account', profile?.id, 'likes'],
    queryFn: ({ signal }) => neteaseApi.getLikedIds(profile!.id, signal),
    enabled: apiConfig.isApiConfigured && Boolean(profile),
  });
}

/** 查询当前账号创建和收藏的歌单；缺少用户资料或有效 API 地址时不发起请求。 */
export function useUserPlaylists() {
  const profile = useAccountStore((state) => state.profile);
  return useQuery({
    queryKey: ['account', profile?.id, 'playlists'],
    queryFn: ({ signal }) => neteaseApi.getUserPlaylists(profile!.id, signal),
    enabled: apiConfig.isApiConfigured && Boolean(profile),
  });
}

/** 提交歌曲的目标喜欢状态：liked 为 true 表示喜欢，false 表示取消；失败时回滚缓存。 */
export function useToggleLike() {
  const profile = useAccountStore((state) => state.profile);
  return useMutation({
    mutationFn: async ({ id, liked }: { id: number; liked: boolean }) => {
      if (!profile || profile.id !== useAccountStore.getState().profile?.id)
        throw new Error('账号已改变，请重试');
      await neteaseApi.likeSong(id, liked);
    },
    onMutate: async ({ id, liked }) => {
      // 乐观更新前取消旧查询，避免较晚返回的列表覆盖用户刚切换的喜欢状态。
      const userId = profile?.id;
      const queryKey = ['account', userId, 'likes'] as const;
      await queryClient.cancelQueries({ queryKey });
      const previousLikes = queryClient.getQueryData<number[]>(queryKey);
      if (userId === useAccountStore.getState().profile?.id && previousLikes)
        queryClient.setQueryData(
          queryKey,
          liked
            ? [...new Set([...previousLikes, id])]
            : previousLikes.filter((songId) => songId !== id),
        );
      return { userId, queryKey, previousLikes };
    },
    onError: (_mutationError, _variables, context) => {
      // 失败时回滚快照，但若用户已切换账号，则不能再修改当前账号的数据。
      if (context?.userId === useAccountStore.getState().profile?.id && context?.previousLikes)
        queryClient.setQueryData(context.queryKey, context.previousLikes);
    },
    onSettled: async (_response, _mutationError, _variables, context) => {
      if (context?.userId !== useAccountStore.getState().profile?.id) return;
      await queryClient.invalidateQueries({ queryKey: context?.queryKey });
      await queryClient.invalidateQueries({
        queryKey: ['account', context?.userId, 'liked-details'],
      });
    },
  });
}
