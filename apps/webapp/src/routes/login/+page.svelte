<script lang="ts">
	import type { School } from '$lib/data/school';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { authClient } from '$lib/auth/client';
	import { authSession, DEMO_ACCOUNTS } from '$lib/auth/session.svelte';
	import LanguageSelector from '$lib/components/layout/LanguageSelector.svelte';
	import { schools } from '$lib/data/school';
	import { t } from '$lib/i18n';
	import { GraduationCap, Building2, Check } from '$lib/icons';
	import { appGoto, appPath } from '$lib/navigation/app-navigation';
	import { toast } from '$lib/toast.svelte';
	import { cn } from '$lib/utils';

	let selectedSchoolId = $state(schools[0]?.id ?? '');
	let loading = $state(false);

	const apiConnected = $derived(
		($page.data.api as { connected?: boolean } | undefined)?.connected ?? false,
	);
	const selectedSchool = $derived(
		schools.find(entry => entry.id === selectedSchoolId) ?? schools[0],
	);

	async function signInWithRetry(email: string, password: string) {
		const maxAttempts = 3;
		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			const { error } = await authClient.signIn.email({ email, password });
			if (!error) {
				return null;
			}
			const retryable = /user not found/i.test(error.message ?? '') && attempt < maxAttempts - 1;
			if (!retryable) {
				return error;
			}
			await new Promise(resolve => setTimeout(resolve, 1_000));
		}
		return { message: 'User not found' };
	}

	$effect(() => {
		if (authSession.ready && authSession.isLoggedIn) {
			appGoto(appPath('/(app)/school/students/[[id]]'), { replaceState: true });
		}
	});

	function pickSchool(school: School) {
		selectedSchoolId = school.id;
	}

	async function signIn(userId: string) {
		const account = DEMO_ACCOUNTS.find(entry => entry.id === userId);
		if (!account)
			return;

		if (!apiConnected) {
			toast.error('API locale indisponible — attendez le démarrage du serveur.');
			return;
		}

		loading = true;
		try {
			const error = await signInWithRetry(account.email, 'DevPassword1!');

			if (error) {
				toast.error(`Connexion échouée: ${error.message}`);
				return;
			}

			authSession.setSchool(selectedSchoolId);
			authSession.setSession(userId, selectedSchoolId);
			try {
				await invalidateAll();
			}
			catch {
			// SSR refresh is best-effort; client session is already set
			}
			toast.success(`Bienvenue, ${account.name}`);
			appGoto(appPath('/(app)/school/students/[[id]]'));
		}
		catch (err: any) {
			toast.error(`Erreur: ${err.message || err}`);
		}
		finally {
			loading = false;
		}
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
							disabled={loading || !apiConnected}
							class={cn(
								'rounded-xl border border-border px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-soft disabled:opacity-50 disabled:pointer-events-none',
								selectedSchool?.id === school.id
									? 'border-primary/30 bg-primary/5 ring-1 ring-primary/20'
									: 'bg-card hover:bg-secondary/40',
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
				{#if !apiConnected}
					<p class="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
						API locale indisponible — attendez quelques secondes que le serveur termine son initialisation.
					</p>
				{/if}

				<ul class="space-y-2">
					{#each DEMO_ACCOUNTS as account (account.id)}
						<li>
							<button
								type="button"
								onclick={() => signIn(account.id)}
								disabled={loading || !apiConnected}
								class="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-left transition hover:border-primary/20 hover:bg-secondary/50 disabled:opacity-50 disabled:pointer-events-none"
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
