<script lang="ts">
	import type { Snippet } from 'svelte';
	import { redirectPathIfAuthenticated } from '$lib/auth/resolve-post-auth';
	import { authSession } from '$lib/auth/session.svelte';
	import LanguageSelector from '$lib/components/layout/LanguageSelector.svelte';
	import { GraduationCap, LoaderCircle } from '$lib/icons';
	import { appGoto, appPath } from '$lib/navigation/app-navigation';

	const { children }: { children: Snippet } = $props();

	$effect(() => {
		if (!authSession.ready) {
			return;
		}

		if (!authSession.hasAuthAccount) {
			appGoto(appPath('/login'), { replaceState: true });
			return;
		}

		if (authSession.isLoggedIn) {
			const target = redirectPathIfAuthenticated();
			if (target) {
				appGoto(target, { replaceState: true });
			}
		}
	});
</script>

{#if !authSession.ready}
	<div class="flex min-h-screen items-center justify-center bg-background text-foreground">
		<LoaderCircle class="h-8 w-8 animate-spin text-primary" />
	</div>
{:else if authSession.needsOnboarding}
	<div class="flex min-h-screen flex-col bg-background text-foreground">
		<header class="flex items-center justify-end px-4 py-3 sm:px-6">
			<LanguageSelector />
		</header>

		<main class="flex flex-1 flex-col">
			<div class="mb-4 flex flex-col items-center pt-4 text-center">
				<div
					class="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-panel"
				>
					<GraduationCap class="h-5 w-5" />
				</div>
				<p class="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">EDAYA</p>
			</div>

			{@render children()}
		</main>
	</div>
{/if}
