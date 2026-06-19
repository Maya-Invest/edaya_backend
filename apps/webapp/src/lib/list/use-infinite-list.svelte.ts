const DEFAULT_PAGE_SIZE = 50;

/** Réponse paginée cursor — à brancher sur le BFF quand `nextCursor` est exposé. */
export type CursorPage<T> = {
	items: T[];
	nextCursor: string | null;
};

export type CursorFetcher<T> = (cursor: string | null) => Promise<CursorPage<T>>;

/**
 * Windowing client-side (Phase 3 par défaut).
 * Remplacer par `useCursorInfiniteList` quand l'API liste expose `nextCursor`.
 */
export function useInfiniteList<T>(source: () => T[], pageSize = DEFAULT_PAGE_SIZE) {
	let limit = $state(pageSize);

	const items = $derived(source());
	const visible = $derived(items.slice(0, limit));
	const hasMore = $derived(limit < items.length);

	$effect(() => {
		items.length;
		limit = pageSize;
	});

	function loadMore() {
		limit = Math.min(limit + pageSize, items.length);
	}

	return {
		get visible() {
			return visible;
		},
		get hasMore() {
			return hasMore;
		},
		get total() {
			return items.length;
		},
		loadMore,
	};
}

/**
 * Pagination cursor API — stub prêt pour branchement BFF.
 * Aujourd'hui : charge la première page uniquement ; `loadMore` enchaîne via `nextCursor`.
 */
export function useCursorInfiniteList<T>(fetchPage: CursorFetcher<T>, pageSize = DEFAULT_PAGE_SIZE) {
	let items = $state<T[]>([]);
	let nextCursor = $state<string | null>(null);
	let loading = $state(false);
	let initialized = $state(false);

	async function fetchNext(cursor: string | null) {
		loading = true;
		try {
			const page = await fetchPage(cursor);
			items = cursor ? [...items, ...page.items] : page.items;
			nextCursor = page.nextCursor;
		}
		finally {
			loading = false;
		}
	}

	$effect(() => {
		if (initialized)
			return;
		initialized = true;
		void fetchNext(null);
	});

	function loadMore() {
		if (!nextCursor || loading)
			return;
		void fetchNext(nextCursor);
	}

	return {
		get visible() {
			return items;
		},
		get hasMore() {
			return nextCursor !== null;
		},
		get total() {
			return items.length;
		},
		get loading() {
			return loading;
		},
		loadMore,
		pageSize,
	};
}
