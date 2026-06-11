<script lang="ts">
	import type { School } from '$lib/data/school';
	import { authSession } from '$lib/auth/session.svelte';
	import { t } from '$lib/i18n';
	import { Building2, Check, ChevronDown } from '$lib/icons';
	import { cn } from '$lib/utils';

	const { schools }: { schools: School[] } = $props();

	let open = $state(false);

	const school = $derived(authSession.school ?? schools[0]);
</script>

{#if schools.length > 1}
	<div class="relative">
		<button
			type="button"
			onclick={() => (open = !open)}
			class={cn(
				'flex h-9 max-w-[11rem] items-center gap-2 rounded-full border border-border bg-card pl-2.5 pr-3 text-xs font-medium transition hover:bg-secondary',
				open && 'bg-secondary',
			)}
			title={school.name}
		>
			<Building2 class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
			<span class="truncate">{school.shortName}</span>
			<ChevronDown class={cn('h-3 w-3 shrink-0 transition-transform', open && 'rotate-180')} />
		</button>

		{#if open}
			<div
				class="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-border bg-card shadow-panel animate-fade-in"
			>
				<p
					class="border-b border-border px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
				>
					{$t('auth.school')}
				</p>
				{#each schools as entry (entry.id)}
					<button
						type="button"
						onclick={() => {
							authSession.setSchool(entry.id);
							open = false;
						}}
						class={cn(
							'flex w-full items-start justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-secondary/60',
							entry.id === school.id && 'bg-primary/5',
						)}
					>
						<span class="min-w-0">
							<span class="block truncate text-sm font-medium">{entry.shortName}</span>
							<span class="font-mono text-[10px] text-muted-foreground">{entry.city}</span>
						</span>
						{#if entry.id === school.id}
							<Check class="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
						{/if}
					</button>
				{/each}
			</div>
		{/if}
	</div>
{/if}
