import { QueryClient } from '@tanstack/react-query'

// Fora do main.tsx para que libs (ex.: avatarUpload) invalidem cache sem import circular.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
})
