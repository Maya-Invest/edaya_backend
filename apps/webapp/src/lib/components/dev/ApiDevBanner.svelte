<script lang="ts">
	import { browser, dev } from '$app/environment';
	import { page } from '$app/stores';

	type ApiStatus = { connected: true; message: string } | { connected: false };

	let { initial }: { initial: ApiStatus } = $props();

	let live = $state<ApiStatus | null>(null);

	const status = $derived(live ?? ($page.data.api as ApiStatus | undefined) ?? initial);

	$effect(() => {
		if (!browser || !dev) return;

		let cancelled = false;

		async function refresh() {
			try {
				const response = await fetch('/dev/api-health');
				if (!response.ok || cancelled) return;
				live = (await response.json()) as ApiStatus;
			}
			catch {
				if (!cancelled) live = { connected: false };
			}
		}

		void refresh();
		const interval = setInterval(refresh, 10_000);

		return () => {
			cancelled = true;
			clearInterval(interval);
		};
	});

	const show = $derived(dev && !status.connected);
</script>

{#if show}
	<div
		role="status"
		class="border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-center text-xs text-amber-900 dark:text-amber-200"
	>
		Local API unreachable — run <code class="font-mono">cd apps/api && bun dev</code> or
		<code class="font-mono">bun dev</code> from the repo root
	</div>
{/if}
