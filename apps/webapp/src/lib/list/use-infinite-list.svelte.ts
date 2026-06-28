const DEFAULT_PAGE_SIZE = 50;

/** Réponse paginée cursor — à brancher sur le BFF quand `nextCursor` est exposé. */
export interface CursorPage<T> {
	items: T[];
	nextCursor: string | null;
}

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
		void items.length;
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

export type OffsetPageFetcher<T> = (offset: number, limit: number) => Promise<{ items: T[]; total: number }>;

/**
 * Server-side offset pagination — loads pages via `$limit` / `$offset` and appends on scroll.
 */
export function useOffsetInfiniteList<T>(
	fetchPage: OffsetPageFetcher<T>,
	pageSize = DEFAULT_PAGE_SIZE,
) {
	let items = $state<T[]>([]);
	let total = $state(0);
	let offset = $state(0);
	let loading = $state(false);
	let initialized = $state(false);

	async function loadAt(nextOffset: number, append: boolean) {
		loading = true;
		try {
			const page = await fetchPage(nextOffset, pageSize);
			items = append ? [...items, ...page.items] : page.items;
			total = page.total;
			offset = nextOffset + page.items.length;
		}
		finally {
			loading = false;
		}
	}

	$effect(() => {
		if (initialized) {
			return;
		}
		initialized = true;
		void loadAt(0, false);
	});

	function loadMore() {
		if (loading || items.length >= total) {
			return;
		}
		void loadAt(offset, true);
	}

	return {
		get visible() {
			return items;
		},
		get hasMore() {
			return items.length < total;
		},
		get total() {
			return total;
		},
		get loading() {
			return loading;
		},
		loadMore,
		pageSize,
	};
}
