<script lang="ts">
	import { authSession } from '$lib/auth/session.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import { t } from '$lib/i18n';
	import { appGoto, appPath } from '$lib/navigation/app-navigation';

	async function logout() {
		await authSession.logout();
		appGoto(appPath('/login'), { replaceState: true });
	}
</script>

<div class="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-10 pt-2 sm:px-6">
	<section class="rounded-2xl border border-border bg-card p-6 shadow-soft">
		<h1 class="font-display text-2xl font-semibold">{$t('onboarding.title')}</h1>
		<p class="mt-2 text-sm text-muted-foreground">{$t('onboarding.placeholder')}</p>

		{#if authSession.loginEmail}
			<p class="mt-4 rounded-xl bg-secondary/50 px-3 py-2 text-sm text-muted-foreground">
				{$t('onboarding.signedInAs', { email: authSession.loginEmail })}
			</p>
		{/if}

		<p class="mt-6 text-xs text-muted-foreground">{$t('onboarding.comingSoon')}</p>
	</section>

	<div class="mt-6 flex justify-center">
		<Button variant="ghost" type="button" onclick={() => void logout()}>
			{$t('auth.signOut')}
		</Button>
	</div>
</div>
