<script lang="ts">
	import type { NotificationSettingsPageData } from '$lib/queries/account.queries';
	import Button from '$lib/components/ui/button/button.svelte';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import ListPageHeader from '$lib/components/ui/ListPageHeader.svelte';
	import { saveGuardianNotificationPreferencesMutation } from '$lib/api/mutations/notifications.mutations';
	import { t } from '$lib/i18n';

	const {
		data,
		onSaved,
	}: {
		data: NotificationSettingsPageData;
		onSaved?: () => void;
	} = $props();

	const settings = $derived(data.settings);

	let premiumNotificationsEnabled = $state(false);
	let emailNotificationsEnabled = $state(false);
	let smsNotificationsEnabled = $state(false);
	let linkRows = $state<Array<{
		studentId: string;
		receivesAcademicReports: boolean;
		receivesAttendanceAlerts: boolean;
	}>>([]);
	let saving = $state(false);
	let hydratedId = $state<string | null>(null);

	$effect(() => {
		if (!settings || settings.id === hydratedId) {
			return;
		}
		hydratedId = settings.id;
		premiumNotificationsEnabled = settings.premiumNotificationsEnabled;
		emailNotificationsEnabled = settings.contactMethods.some(
			method => method.type === 'email' && method.allowsNotifications,
		);
		smsNotificationsEnabled = settings.contactMethods.some(
			method => (method.type === 'phone' || method.type === 'sms' || method.type === 'whatsapp')
				&& method.allowsNotifications,
		);
		linkRows = settings.links.map(link => ({
			studentId: link.studentId,
			receivesAcademicReports: link.receivesAcademicReports,
			receivesAttendanceAlerts: link.receivesAttendanceAlerts,
		}));
	});

	async function save() {
		if (!settings || saving) {
			return;
		}
		saving = true;
		const ok = await saveGuardianNotificationPreferencesMutation({
			guardianId: settings.id,
			premiumNotificationsEnabled,
			emailNotificationsEnabled,
			smsNotificationsEnabled,
			links: linkRows,
		}, {
			current: settings,
			successMessage: $t('account.notifications.saved'),
		});
		saving = false;
		if (ok) {
			onSaved?.();
		}
	}
</script>

<div class="flex h-full flex-col overflow-hidden">
	<ListPageHeader title={$t('account.notifications.title')} />

	<div class="flex-1 overflow-y-auto p-6">
		{#if !settings}
			<p class="text-sm text-muted-foreground">{$t('account.notifications.unavailable')}</p>
		{:else if !settings.subjectId}
			<p class="text-sm text-muted-foreground">{$t('account.notifications.noSubject')}</p>
		{:else}
			<div class="mx-auto max-w-2xl space-y-8">
				<section class="space-y-4 rounded-xl border border-border bg-card p-5">
					<h2 class="font-display text-lg font-semibold">{$t('account.notifications.channels')}</h2>
					<div class="space-y-3">
						<label class="flex items-center gap-3 text-sm">
							<Checkbox bind:checked={emailNotificationsEnabled} />
							<span>{$t('account.notifications.email')}</span>
						</label>
						<label class="flex items-center gap-3 text-sm">
							<Checkbox bind:checked={smsNotificationsEnabled} />
							<span>{$t('account.notifications.sms')}</span>
						</label>
						<label class="flex items-center gap-3 text-sm">
							<Checkbox bind:checked={premiumNotificationsEnabled} />
							<span>{$t('account.notifications.premium')}</span>
						</label>
					</div>
				</section>

				{#if linkRows.length > 0}
					<section class="space-y-4 rounded-xl border border-border bg-card p-5">
						<h2 class="font-display text-lg font-semibold">{$t('account.notifications.perStudent')}</h2>
						<div class="space-y-5">
							{#each linkRows as link, index (link.studentId)}
								<div class="space-y-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
									<p class="text-sm font-medium">
										{data.studentNames[link.studentId] ?? link.studentId}
									</p>
									<label class="flex items-center gap-3 text-sm">
										<Checkbox bind:checked={linkRows[index].receivesAcademicReports} />
										<span>{$t('account.notifications.academicReports')}</span>
									</label>
									<label class="flex items-center gap-3 text-sm">
										<Checkbox bind:checked={linkRows[index].receivesAttendanceAlerts} />
										<span>{$t('account.notifications.attendanceAlerts')}</span>
									</label>
								</div>
							{/each}
						</div>
					</section>
				{/if}

				<div class="flex justify-end">
					<Button onclick={save} disabled={saving}>
						{saving ? $t('account.notifications.saving') : $t('common.save')}
					</Button>
				</div>
			</div>
		{/if}
	</div>
</div>
