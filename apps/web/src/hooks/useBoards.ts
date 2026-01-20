import { useQuery } from '@tanstack/react-query'
import { fetchBoards, type Board } from '../api/boards'

const boardsQueryKey = ['boards']

export const useBoards = () =>
  useQuery<Board[]>({
    queryKey: boardsQueryKey,
    queryFn: fetchBoards,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    retry: 1,
  })
