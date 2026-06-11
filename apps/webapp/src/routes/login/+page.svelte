<script lang="ts">
	import type { DemoAccount } from '$lib/types/demo-account';
	import { browser } from '$app/environment';
	import { browserFetch } from '$lib/api/browser-fetch';
	import { checkBrowserApiHealth } from '$lib/api/check-api-health';
	import { bootstrapSession } from '$lib/auth/bootstrap';
	import { resetAppShellBootstrap } from '$lib/auth/bootstrap-app';
	import { authClient } from '$lib/auth/client';
	import { authSession } from '$lib/auth/session.svelte';
	import LanguageSelector from '$lib/components/layout/LanguageSelector.svelte';
	import { t } from '$lib/i18n';
	import { GraduationCap } from '$lib/icons';
	import { appGoto, appPath } from '$lib/navigation/app-navigation';
	import { toast } from '$lib/toast.svelte';

	const DEV_AUTH_PASSWORD = 'DevPassword1!';

	let demoAccounts = $state<DemoAccount[]>([]);
	let loading = $state(false);
	let apiConnected = $state(false);

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

	$effect(() => {
		if (!browser) {
			return;
		}

		void (async () => {
			const health = await checkBrowserApiHealth();
			apiConnected = health.connected;
			if (!health.connected) {
				return;
			}

			try {
				demoAccounts = await browserFetch<DemoAccount[]>('/core/prototype/demo-accounts/list', {
					method: 'POST',
					body: JSON.stringify({}),
				});
			}
			catch {
				demoAccounts = [];
			}
		})();
	});

	async function signIn(account: DemoAccount) {
		if (!apiConnected) {
			toast.error('API locale indisponible — attendez le démarrage du serveur.');
			return;
		}

		loading = true;
		try {
			const error = await signInWithRetry(account.email, DEV_AUTH_PASSWORD);

			if (error) {
				toast.error(`Connexion échouée: ${error.message}`);
				return;
			}

			resetAppShellBootstrap();
			await bootstrapSession();
			toast.success(`Bienvenue, ${account.name}`);
			appGoto(appPath('/(app)/school/students/[[id]]'));
		}
		catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			toast.error(`Erreur: ${message}`);
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

			<section class="rounded-2xl border border-border bg-card p-5 shadow-soft">
				<h2 class="mb-1 font-display text-base font-semibold">{$t('auth.pickAccount')}</h2>
				<p class="mb-4 text-xs text-muted-foreground">{$t('auth.demoHint')}</p>
				{#if !apiConnected}
					<p class="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
						API locale indisponible — attendez quelques secondes que le serveur termine son initialisation.
					</p>
				{/if}

				<ul class="space-y-2">
					{#each demoAccounts as account (account.staffId)}
						<li>
							<button
								type="button"
								onclick={() => signIn(account)}
								disabled={loading || !apiConnected}
								class="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-left transition hover:border-primary/20 hover:bg-secondary/50 disabled:pointer-events-none disabled:opacity-50"
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
