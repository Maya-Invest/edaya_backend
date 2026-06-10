<script lang="ts">
	import type { Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import AppSidebar from '$lib/components/layout/AppSidebar.svelte';
	import AcademicHeader from '$lib/components/layout/AcademicHeader.svelte';
	import LanguageSelector from '$lib/components/layout/LanguageSelector.svelte';
	import SchoolSelector from '$lib/components/layout/SchoolSelector.svelte';
	import ToastHost from '$lib/components/ui/ToastHost.svelte';
	import DetailDrawer from '$lib/components/school/DetailDrawer.svelte';
	import { DrawerState } from '$lib/drawer.svelte';
	import { getListPathForDetail, parseDetailPath } from '$lib/detail-routes';
	import { academicContext } from '$lib/academic/context.svelte';
	import { authSession } from '$lib/auth/session.svelte';
	import { t } from '$lib/i18n';
	import { LogOut } from 'lucide-svelte';
	import { setContext } from 'svelte';

	let { data, children }: { data: import('./$types').LayoutData; children: Snippet } = $props();

	const drawer = new DrawerState();
	setContext('drawer', drawer);

	const me = $derived(authSession.user);

	$effect(() => {
		if (authSession.ready && !authSession.isLoggedIn) {
			goto('/login', { replaceState: true });
		}
	});

	$effect(() => {
		const parsed = parseDetailPath($page.url.pathname);
		if (parsed) drawer.open(parsed.item);
		else drawer.close();
	});

	function closeDetail() {
		const listPath = getListPathForDetail($page.url.pathname);
		if (listPath) goto(listPath);
		else drawer.close();
	}

	function logout() {
		authSession.logout();
		goto('/login', { replaceState: true });
	}
</script>

{#if authSession.ready && authSession.isLoggedIn && me}
	<div class="flex h-screen w-full overflow-hidden bg-background text-foreground">
		<AppSidebar hierarchy={academicContext.hierarchy} studentCount={data.studentCount} />

		<div class="flex min-w-0 flex-1 flex-col">
			<div
				class="flex h-14 shrink-0 items-center justify-end gap-3 border-b border-border bg-card px-6"
			>
				<SchoolSelector schools={data.schools} />
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

			<DetailDrawer item={drawer.item} onClose={closeDetail} />
		</div>
	</div>

	<ToastHost />
{/if}
