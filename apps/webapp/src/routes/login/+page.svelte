<script lang="ts">
	import type { LoginMethodId } from '$lib/auth/login-methods';
	import { browser } from '$app/environment';
	import { checkBrowserApiHealth } from '$lib/api/check-api-health';
	import { redirectPathIfLoggedIn } from '$lib/auth/complete-sign-in';
	import {
		DEFAULT_LOGIN_METHOD_ID,

	} from '$lib/auth/login-methods';
	import ApiConnectionBanner from '$lib/components/auth/ApiConnectionBanner.svelte';
	import AuthScreenShell from '$lib/components/auth/AuthScreenShell.svelte';
	import LoginPanelHost from '$lib/components/auth/login/LoginPanelHost.svelte';
	import { isDemoLoginEnabled } from '$lib/env/app-env';
	import { t } from '$lib/i18n';
	import { appGoto, appPath } from '$lib/navigation/app-navigation';

	let apiConnected = $state(false);
	let email = $state('');
	let activeMethod = $state<LoginMethodId>(DEFAULT_LOGIN_METHOD_ID);

	const showDemoLink = $derived(isDemoLoginEnabled());

	$effect(() => {
		const target = redirectPathIfLoggedIn();
		if (target) {
			appGoto(target, { replaceState: true });
		}
	});

	$effect(() => {
		if (!browser) {
			return;
		}

		void (async () => {
			const health = await checkBrowserApiHealth();
			apiConnected = health.connected;
		})();
	});

	function handleMethodChange(method: LoginMethodId) {
		activeMethod = method;
	}
</script>

<AuthScreenShell title={$t('auth.welcome')} subtitle={$t('auth.subtitle')}>
	<ApiConnectionBanner connected={apiConnected} />

	<LoginPanelHost
		bind:email
		{activeMethod}
		{apiConnected}
		onMethodChange={handleMethodChange}
	/>

	{#snippet footer()}
		{#if showDemoLink}
			<p class="text-muted-foreground">
				{$t('auth.exploringQuestion')}
				<a
					href={appPath('/login/demo')}
					class="font-medium text-primary hover:underline"
				>
					{$t('auth.demoLoginLink')}
				</a>
			</p>
		{/if}
	{/snippet}
</AuthScreenShell>
