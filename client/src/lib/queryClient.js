// src/lib/queryClient.js
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,                    // retry failed requests once
      staleTime: 1000 * 60 * 5,   // cache data for 5 minutes
    },
  },
});