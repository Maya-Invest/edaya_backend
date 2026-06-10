<script lang="ts">
	import { goto } from '$app/navigation';
	import { GraduationCap, Building2, Check } from '$lib/icons';
	import { schools, type School } from '$lib/data/school';
	import { authSession, DEMO_ACCOUNTS } from '$lib/auth/session.svelte';
	import LanguageSelector from '$lib/components/layout/LanguageSelector.svelte';
	import { cn } from '$lib/utils';
	import { t } from '$lib/i18n';

	let selectedSchoolId = $state(schools[0]?.id ?? '');

	const selectedSchool = $derived(
		schools.find((entry) => entry.id === selectedSchoolId) ?? schools[0]
	);

	$effect(() => {
		if (authSession.ready && authSession.isLoggedIn) {
			goto('/school/students', { replaceState: true });
		}
	});

	function pickSchool(school: School) {
		selectedSchoolId = school.id;
	}

	function signIn(userId: string) {
		authSession.login(userId, selectedSchoolId);
		goto('/school/students');
	}
</script>

<div class="flex min-h-screen flex-col bg-background text-foreground">
	<header class="flex items-center justify-end gap-3 border-b border-border bg-card/60 px-6 py-4 backdrop-blur">
		<LanguageSelector />
	</header>

	<main class="flex flex-1 items-center justify-center p-6">
		<div class="w-full max-w-lg animate-fade-in">
			<div class="mb-8 flex flex-col items-center text-center">
				<div
					class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-panel"
				>
					<GraduationCap class="h-7 w-7" />
				</div>
				<p class="font-mono text-xs uppercase tracking-widest text-muted-foreground">EDAYA</p>
				<h1 class="font-display text-3xl font-semibold">{$t('auth.welcome')}</h1>
				<p class="mt-2 max-w-sm text-sm text-muted-foreground">{$t('auth.subtitle')}</p>
			</div>

			<section class="mb-6 rounded-2xl border border-border bg-card p-5 shadow-soft">
				<div class="mb-3 flex items-center gap-2">
					<Building2 class="h-4 w-4 text-muted-foreground" />
					<h2 class="font-display text-base font-semibold">{$t('auth.pickSchool')}</h2>
				</div>
				<div class="grid gap-2 sm:grid-cols-2">
					{#each schools as school (school.id)}
						<button
							type="button"
							onclick={() => pickSchool(school)}
							class={cn(
								'rounded-xl border border-border px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-soft',
								selectedSchool?.id === school.id
									? 'border-primary/30 bg-primary/5 ring-1 ring-primary/20'
									: 'bg-card hover:bg-secondary/40'
							)}
						>
							<div class="flex items-start justify-between gap-2">
								<span>
									<span class="block text-sm font-medium">{school.shortName}</span>
									<span class="font-mono text-[10px] text-muted-foreground">{school.city}</span>
								</span>
								{#if selectedSchool?.id === school.id}
									<Check class="h-4 w-4 shrink-0 text-accent" />
								{/if}
							</div>
						</button>
					{/each}
				</div>
			</section>

			<section class="rounded-2xl border border-border bg-card p-5 shadow-soft">
				<h2 class="mb-1 font-display text-base font-semibold">{$t('auth.pickAccount')}</h2>
				<p class="mb-4 text-xs text-muted-foreground">{$t('auth.demoHint')}</p>

				<ul class="space-y-2">
					{#each DEMO_ACCOUNTS as account (account.id)}
						<li>
							<button
								type="button"
								onclick={() => signIn(account.id)}
								class="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-left transition hover:border-primary/20 hover:bg-secondary/50"
							>
								<span
									class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary font-display text-sm font-semibold text-primary-foreground"
								>
									{account.initials}
								</span>
								<span class="min-w-0 flex-1">
									<span class="block truncate text-sm font-medium">{account.name}</span>
									<span class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
										{$t(`staff.role.${account.role}`)}
									</span>
								</span>
								<span class="text-xs font-medium text-accent-foreground/80">{$t('auth.continue')}</span>
							</button>
						</li>
					{/each}
				</ul>
			</section>
		</div>
	</main>
</div>
