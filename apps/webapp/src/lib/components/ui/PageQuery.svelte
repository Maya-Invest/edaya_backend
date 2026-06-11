<script lang="ts" generics="T extends PageLoadMeta">
	import type { PageLoadMeta } from '$lib/page/load-state';
	import type { Snippet } from 'svelte';
	import { page } from '$app/stores';
	import { listRouteCacheKey } from '$lib/detail-route-patterns';
	import { t } from '$lib/i18n';
	import { LoaderCircle } from '$lib/icons';
	import { get } from 'svelte/store';

	const {
		query,
		loadingTitle,
		children,
	}: {
		query: (url: URL) => Promise<T>;
		loadingTitle?: string;
		children: Snippet<[T]>;
	} = $props();

	let result = $state<T | null>(null);
	let loadVersion = 0;

	const cacheKey = $derived(listRouteCacheKey($page.url));

	$effect(() => {
		void cacheKey;
		const runQuery = query;
		const version = ++loadVersion;
		result = null;
		void runQuery(get(page).url).then((data) => {
			if (version === loadVersion) {
				result = data;
			}
		});
	});
</script>

{#if result}
	{@render children(result)}
{:else}
	<div
		class="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8 animate-fade-in"
		role="status"
		aria-live="polite"
	>
		<LoaderCircle class="h-8 w-8 animate-spin text-primary" />
		<p class="text-sm text-muted-foreground">{loadingTitle ?? $t('dataState.loading')}</p>
	</div>
{/if}
