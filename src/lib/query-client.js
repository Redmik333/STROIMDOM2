import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			staleTime: 5 * 60 * 1000, // 5 min — don't re-fetch if data is fresh
			cacheTime: 30 * 60 * 1000, // keep in cache 30 min
		},
	},
});