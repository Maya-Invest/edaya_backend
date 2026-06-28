<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import { t } from '$lib/i18n';
	import { ArrowLeft, ChevronRight } from '$lib/icons';

	const {
		page,
		pageCount,
		total,
		pageSize,
		loading = false,
		onPageChange,
	}: {
		page: number;
		pageCount: number;
		total: number;
		pageSize: number;
		loading?: boolean;
		onPageChange: (page: number) => void;
	} = $props();

	const rangeStart = $derived(total === 0 ? 0 : (page - 1) * pageSize + 1);
	const rangeEnd = $derived(Math.min(page * pageSize, total));
</script>

<nav
	class="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3"
	aria-label={$t('list.pagination')}
>
	<p class="text-xs text-muted-foreground">
		{$t('list.pageRange', { start: rangeStart, end: rangeEnd, total })}
	</p>
	<div class="flex items-center gap-2">
		<Button
			variant="outline"
			size="sm"
			class="rounded-full"
			disabled={page <= 1 || loading}
			onclick={() => onPageChange(page - 1)}
		>
			<ArrowLeft class="h-3.5 w-3.5" />
			{$t('list.previousPage')}
		</Button>
		<span class="min-w-20 text-center text-xs tabular-nums text-muted-foreground">
			{$t('list.pageOf', { page, pageCount })}
		</span>
		<Button
			variant="outline"
			size="sm"
			class="rounded-full"
			disabled={page >= pageCount || loading}
			onclick={() => onPageChange(page + 1)}
		>
			{$t('list.nextPage')}
			<ChevronRight class="h-3.5 w-3.5" />
		</Button>
	</div>
</nav>
