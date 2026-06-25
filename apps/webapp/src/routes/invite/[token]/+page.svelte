<script lang="ts">
	import type { InvitationPreview } from '$lib/api/invitation-data';
	import { page } from '$app/stores';
	import { acceptInvitation, fetchInvitationPreview } from '$lib/api/invitation-data';
	import { bootstrapSession } from '$lib/auth/bootstrap';
	import { resetAppShellBootstrap } from '$lib/auth/bootstrap-app';
	import { authClient } from '$lib/auth/client';
	import { authSession } from '$lib/auth/session.svelte';
	import LanguageSelector from '$lib/components/layout/LanguageSelector.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import Label from '$lib/components/ui/label/label.svelte';
	import { t } from '$lib/i18n';
	import { GraduationCap, LoaderCircle } from '$lib/icons';
	import { appGoto, appPath } from '$lib/navigation/app-navigation';
	import { toast } from '$lib/toast.svelte';
	import { ApiError } from '@edaya/api-client';

	const token = $derived($page.params.token ?? '');

	type PageState = 'loading' | 'invalid' | 'accepted' | 'ready' | 'accepting';

	let preview = $state<InvitationPreview | null>(null);
	let pageState = $state<PageState>('loading');
	let authMode = $state<'signUp' | 'signIn'>('signUp');
	let email = $state('');
	let password = $state('');
	let name = $state('');
	let busy = $state(false);

	const actorKindLabel = $derived.by(() => {
		if (preview?.kind === 'staff') {
			return $t('invitation.kind.staff');
		}
		if (preview?.kind === 'guardian') {
			return $t('invitation.kind.guardian');
		}
		return $t('invitation.kind.student');
	});

	$effect(() => {
		const currentToken = token;
		if (!currentToken) {
			pageState = 'invalid';
			return;
		}

		void (async () => {
			pageState = 'loading';
			try {
				const result = await fetchInvitationPreview(currentToken);
				preview = result;
				if (result.status === 'accepted') {
					pageState = 'accepted';
					return;
				}
				if (result.status !== 'pending' || !result.expiresAt || new Date(result.expiresAt) <= new Date()) {
					pageState = 'invalid';
					return;
				}
				pageState = 'ready';
			}
			catch {
				pageState = 'invalid';
			}
		})();
	});

	async function authenticate(): Promise<boolean> {
		if (authMode === 'signUp') {
			const { error } = await authClient.signUp.email({
				email: email.trim(),
				password,
				name: name.trim() || email.trim(),
			});
			if (error) {
				toast.error(error.message ?? $t('invitation.accept.signUpFailed'));
				return false;
			}
		}
		else {
			const { error } = await authClient.signIn.email({
				email: email.trim(),
				password,
			});
			if (error) {
				toast.error(error.message ?? $t('invitation.accept.signInFailed'));
				return false;
			}
		}

		resetAppShellBootstrap();
		const { session } = await bootstrapSession();
		if (!session) {
			toast.error($t('invitation.accept.sessionFailed'));
			return false;
		}
		return true;
	}

	async function handleAccept() {
		if (!token || !preview) {
			return;
		}

		busy = true;
		pageState = 'accepting';
		try {
			if (!authSession.isLoggedIn) {
				const authenticated = await authenticate();
				if (!authenticated) {
					pageState = 'ready';
					return;
				}
			}

			await acceptInvitation(token);
			resetAppShellBootstrap();
			await bootstrapSession();
			toast.success($t('invitation.accept.success'));
			await appGoto(appPath('/(app)/school/students/[[id]]'));
		}
		catch (err) {
			pageState = 'ready';
			if (err instanceof ApiError) {
				toast.error(err.message);
			}
			else {
				toast.error($t('invitation.accept.failed'));
			}
		}
		finally {
			busy = false;
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
				<div class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-panel">
					<GraduationCap class="h-7 w-7" />
				</div>
				<p class="font-mono text-xs uppercase tracking-widest text-muted-foreground">EDAYA</p>
				<h1 class="font-display text-3xl font-semibold">{$t('invitation.accept.title')}</h1>
			</div>

			<section class="rounded-2xl border border-border bg-card p-5 shadow-soft">
				{#if pageState === 'loading' || pageState === 'accepting'}
					<div class="flex flex-col items-center gap-3 py-8 text-sm text-muted-foreground">
						<LoaderCircle class="h-6 w-6 animate-spin" />
						<p>{pageState === 'accepting' ? $t('invitation.accept.linking') : $t('dataState.loading')}</p>
					</div>
				{:else if pageState === 'invalid'}
					<div class="space-y-2 py-4 text-center">
						<h2 class="font-display text-lg font-semibold">{$t('invitation.accept.invalidTitle')}</h2>
						<p class="text-sm text-muted-foreground">{$t('invitation.accept.invalidHint')}</p>
					</div>
				{:else if pageState === 'accepted'}
					<div class="space-y-4 py-4 text-center">
						<h2 class="font-display text-lg font-semibold">{$t('invitation.accept.alreadyAcceptedTitle')}</h2>
						<p class="text-sm text-muted-foreground">{$t('invitation.accept.alreadyAcceptedHint')}</p>
						<Button type="button" onclick={() => appGoto('/login')}>
							{$t('invitation.accept.goToLogin')}
						</Button>
					</div>
				{:else if preview}
					<div class="space-y-4">
						<div class="rounded-xl bg-secondary/40 px-4 py-3 text-sm">
							<p class="font-medium">{preview.schoolName}</p>
							<p class="mt-1 text-muted-foreground">
								{$t('invitation.accept.summary', {
									name: preview.inviteeName,
									role: actorKindLabel,
								})}
							</p>
							<p class="mt-2 text-xs text-muted-foreground">
								{$t('invitation.accept.expires', {
									date: preview.expiresAt
										? new Date(preview.expiresAt).toLocaleString()
										: '—',
								})}
							</p>
						</div>

						{#if !authSession.isLoggedIn}
							<div class="flex gap-2">
								<Button
									type="button"
									size="sm"
									variant={authMode === 'signUp' ? 'default' : 'outline'}
									onclick={() => (authMode = 'signUp')}
								>
									{$t('invitation.accept.signUp')}
								</Button>
								<Button
									type="button"
									size="sm"
									variant={authMode === 'signIn' ? 'default' : 'outline'}
									onclick={() => (authMode = 'signIn')}
								>
									{$t('invitation.accept.signIn')}
								</Button>
							</div>

							{#if authMode === 'signUp'}
								<div class="space-y-1.5">
									<Label>{$t('guardian.fullName')}</Label>
									<Input bind:value={name} autocomplete="name" />
								</div>
							{/if}

							<div class="space-y-1.5">
								<Label>{$t('common.email')}</Label>
								<Input type="email" bind:value={email} autocomplete="email" />
							</div>
							<div class="space-y-1.5">
								<Label>{$t('invitation.accept.password')}</Label>
								<Input type="password" bind:value={password} autocomplete={authMode === 'signUp' ? 'new-password' : 'current-password'} />
							</div>
						{/if}

						<Button
							type="button"
							class="w-full"
							disabled={busy || (!authSession.isLoggedIn && (!email.trim() || !password.trim()))}
							onclick={handleAccept}
						>
							{$t('invitation.accept.cta')}
						</Button>
					</div>
				{/if}
			</section>
		</div>
	</main>
</div>
