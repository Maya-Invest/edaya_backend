<script lang="ts">
	import type { DrawerItem } from '$lib/components/school/drawer-types';
	import type { Component, Snippet } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { academicContext } from '$lib/academic/context.svelte';
	import { bootstrapAppShell, resetAppShellBootstrap } from '$lib/auth/bootstrap-app';
	import { authSession } from '$lib/auth/session.svelte';
	import AcademicHeader from '$lib/components/layout/AcademicHeader.svelte';
	import AppSidebar from '$lib/components/layout/AppSidebar.svelte';
	import LanguageSelector from '$lib/components/layout/LanguageSelector.svelte';
	import SchoolSelector from '$lib/components/layout/SchoolSelector.svelte';
	import { detailDataContext } from '$lib/detail-data/context.svelte';
	import { isLikelyDetailPath } from '$lib/detail-route-patterns';
	import { DrawerState } from '$lib/drawer.svelte';
	import { t } from '$lib/i18n';
	import { LogOut, LoaderCircle } from '$lib/icons';
	import { appGoto, appPath } from '$lib/navigation/app-navigation';
	import { reportCardsContext } from '$lib/report-cards/context.svelte';
	import { setContext } from 'svelte';

	const { children }: { children: Snippet } = $props();

	const drawer = new DrawerState();
	setContext('drawer', drawer);

	const me = $derived(authSession.user);
	const needsDrawer = $derived(drawer.item !== null || isLikelyDetailPath($page.url.pathname));

	type DetailDrawerComponent = Component<{ item: DrawerItem | null; onClose: () => void }>;
	type ToastHostComponent = Component;

	let DetailDrawer = $state<DetailDrawerComponent | null>(null);
	let ToastHost = $state<ToastHostComponent | null>(null);

	let drawerSyncVersion = 0;

	$effect(() => {
		if (authSession.ready && !authSession.isLoggedIn) {
			appGoto(appPath('/login'), { replaceState: true });
		}
	});

	$effect(() => {
		if (!browser || !authSession.ready || !authSession.isLoggedIn) {
			return;
		}
		void bootstrapAppShell();
	});

	$effect(() => {
		const pathname = $page.url.pathname;
		const detailReady = detailDataContext.ready;
		const reportCardsReady = reportCardsContext.ready;

		if (!isLikelyDetailPath(pathname)) {
			drawer.close();
			return;
		}

		// Detail URLs on refresh: wait for bootstrap before parsing entity ids.
		if (!detailReady || !reportCardsReady) {
			return;
		}

		const version = ++drawerSyncVersion;

		void import('$lib/detail-routes').then(({ parseDetailPath }) => {
			if (version !== drawerSyncVersion)
				return;
			const parsed = parseDetailPath(pathname);
			if (parsed)
				drawer.open(parsed.item);
			else drawer.close();
		});
	});

	$effect(() => {
		if (!needsDrawer || DetailDrawer)
			return;
		void import('$lib/components/school/DetailDrawer.svelte').then((module) => {
			DetailDrawer = module.default;
		});
	});

	$effect(() => {
		if (!browser || ToastHost)
			return;
		void import('$lib/components/ui/ToastHost.svelte').then((module) => {
			ToastHost = module.default;
		});
	});

	async function closeDetail() {
		const { getListPathForDetail } = await import('$lib/detail-routes');
		const listPath = getListPathForDetail($page.url.pathname);
		if (listPath)
			appGoto(listPath);
		else drawer.close();
	}

	function logout() {
		resetAppShellBootstrap();
		authSession.logout();
		appGoto(appPath('/login'), { replaceState: true });
	}
</script>

{#if authSession.ready && authSession.isLoggedIn && me}
	{#if !academicContext.shellReady}
		<div
			class="flex h-screen w-full items-center justify-center bg-background text-foreground"
			role="status"
			aria-live="polite"
		>
			<LoaderCircle class="h-8 w-8 animate-spin text-primary" />
		</div>
	{:else}
		<div class="flex h-screen w-full overflow-hidden bg-background text-foreground">
			<AppSidebar hierarchy={academicContext.hierarchy} studentCount={academicContext.studentCount} />

			<div class="flex min-w-0 flex-1 flex-col">
				<div
					class="flex h-14 shrink-0 items-center justify-end gap-3 border-b border-border bg-card px-6"
				>
					<SchoolSelector schools={academicContext.schools} />
					<AcademicHeader />
					<LanguageSelector />
					<div class="flex items-center gap-1.5">
						<div
							class="flex h-9 items-center gap-2 rounded-full border border-border bg-card pl-1 pr-3 text-xs font-medium text-foreground"
							title={me.name}
						>
							<span
								class="flex h-7 w-7 items-center justify-center rounded-full bg-primary font-display text-[11px] font-semibold text-primary-foreground"
							>
								{me.initials}
							</span>
							<span class="flex flex-col items-start leading-tight">
								<span class="text-[11px] font-semibold">{me.name}</span>
								<span class="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
									{$t(`staff.role.${me.role}`)}
								</span>
							</span>
						</div>
						<button
							type="button"
							onclick={logout}
							class="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:bg-secondary hover:text-foreground"
							title={$t('auth.signOut')}
							aria-label={$t('auth.signOut')}
						>
							<LogOut class="h-4 w-4" />
						</button>
					</div>
				</div>

				{@render children()}

				{#if DetailDrawer}
					<DetailDrawer item={drawer.item} onClose={closeDetail} />
				{/if}
			</div>
		</div>

		{#if ToastHost}
			<ToastHost />
		{/if}
	{/if}
{/if}
