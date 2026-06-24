<script lang="ts">
	import type { NotificationSettingsPageData } from '$lib/queries/account.queries';
	import ListPageHeader from '$lib/components/ui/ListPageHeader.svelte';
	import { authSession } from '$lib/auth/session.svelte';
	import { t } from '$lib/i18n';
	import { Mail } from '$lib/icons';
	import { appGoto, appPath } from '$lib/navigation/app-navigation';
	import Button from '$lib/components/ui/button/button.svelte';

	const { data }: { data: NotificationSettingsPageData } = $props();
</script>

<div class="flex h-full flex-col overflow-hidden">
	<ListPageHeader title={$t('account.notifications.title')} />

	<div class="flex-1 overflow-y-auto p-6">
		<div class="mx-auto max-w-2xl space-y-6 rounded-xl border border-border bg-card p-5">
			<p class="text-sm text-muted-foreground">{$t('account.notifications.staffIntro')}</p>

			<div class="space-y-2">
				<p class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
					{$t('common.email')}
				</p>
				<div class="flex min-h-10 items-center gap-2 rounded-md border border-input bg-secondary/30 px-3 py-2 text-sm">
					<Mail class="h-3.5 w-3.5 text-muted-foreground" />
					{data.staffEmail || authSession.accountActor?.email || '—'}
				</div>
			</div>

			{#if !authSession.subjectId}
				<p class="text-sm text-amber-700">{$t('account.notifications.noSubject')}</p>
			{:else}
				<p class="text-sm text-muted-foreground">{$t('account.notifications.staffInApp')}</p>
			{/if}

			<Button variant="outline" onclick={() => appGoto(appPath('/(app)/account/inbox/[[id]]'))}>
				{$t('account.inbox.open')}
			</Button>
		</div>
	</div>
</div>
