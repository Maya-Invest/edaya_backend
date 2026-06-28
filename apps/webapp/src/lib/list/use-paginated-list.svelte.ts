import { DEFAULT_LIST_PAGE_SIZE } from '$lib/api/entity-list-filters';
import type { OffsetPageFetcher } from '$lib/list/use-infinite-list.svelte';

/**
 * Server-side offset pagination — loads one page at a time (replaces on page change).
 */
export function useOffsetPaginatedList<T>(
	fetchPage: OffsetPageFetcher<T>,
	getPage: () => number,
	pageSize = DEFAULT_LIST_PAGE_SIZE,
) {
	let items = $state<T[]>([]);
	let total = $state(0);
	let loading = $state(false);

	$effect(() => {
		const currentPage = Math.max(1, Math.trunc(getPage()));
		const offset = (currentPage - 1) * pageSize;
		let cancelled = false;

		loading = true;
		void fetchPage(offset, pageSize)
			.then((page) => {
				if (cancelled)
					return;
				items = page.items;
				total = page.total;
			})
			.finally(() => {
				if (!cancelled)
					loading = false;
			});

		return () => {
			cancelled = true;
		};
	});

	const pageCount = $derived(Math.max(1, Math.ceil(total / pageSize)));

	return {
		get items() {
			return items;
		},
		get total() {
			return total;
		},
		get loading() {
			return loading;
		},
		get pageCount() {
			return pageCount;
		},
		pageSize,
	};
}
