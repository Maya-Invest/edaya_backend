<script lang="ts">
	import type { AnnouncementTargetKind } from '$lib/types/school';
	import { academicContext } from '$lib/academic/context.svelte';
	import { addAnnouncementTargetMutation } from '$lib/api/mutations/announcement.mutations';
	import FormModal from '$lib/components/ui/FormModal.svelte';
	import Label from '$lib/components/ui/label/label.svelte';
	import * as Select from '$lib/components/ui/select';
	import { detailDataContext } from '$lib/detail-data/context.svelte';
	import { announcementTargetNeedsEntity } from './announcement-target-label';
	import { t } from '$lib/i18n';
	import { get } from 'svelte/store';

	const SCOPED_TARGET_KINDS: AnnouncementTargetKind[] = [
		'class_group',
		'grade_level',
		'staff_member',
		'guardian',
		'student',
	];

	const BROADCAST_TARGET_KINDS: AnnouncementTargetKind[] = [
		'school',
		'all_staff',
		'all_guardians',
		'all_students',
	];

	let {
		announcementId,
		open = $bindable(false),
	}: {
		announcementId: string;
		open?: boolean;
	} = $props();

	let busy = $state(false);
	let targetKind = $state<AnnouncementTargetKind>('school');
	let targetId = $state('');

	const sortedLevels = $derived([...academicContext.gradeLevels].sort((a, b) => a.order - b.order));
	const needsEntity = $derived(announcementTargetNeedsEntity(targetKind));
	const targetKindLabel = $derived($t(`announcements.targetKind.${targetKind}`));

	const entityOptions = $derived.by(() => {
		switch (targetKind) {
			case 'class_group':
				return academicContext.classes.map(entry => ({ id: entry.id, label: entry.name }));
			case 'grade_level':
				return sortedLevels.map(entry => ({ id: entry.id, label: entry.name }));
			case 'staff_member':
				return detailDataContext.staff.map(entry => ({ id: entry.id, label: entry.name }));
			case 'guardian':
				return detailDataContext.guardians.map(entry => ({ id: entry.id, label: entry.name }));
			case 'student':
				return detailDataContext.students.map(entry => ({ id: entry.id, label: entry.name }));
			default:
				return [];
		}
	});

	const selectedEntityLabel = $derived(
		entityOptions.find(entry => entry.id === targetId)?.label ?? '',
	);

	const canSubmit = $derived(!needsEntity || targetId.length > 0);

	function resetForm() {
		targetKind = 'school';
		targetId = '';
	}

	$effect(() => {
		if (open) {
			resetForm();
		}
	});

	$effect(() => {
		if (!needsEntity) {
			targetId = '';
			return;
		}
		if (!entityOptions.some(entry => entry.id === targetId)) {
			targetId = entityOptions[0]?.id ?? '';
		}
	});

	async function submit() {
		if (!canSubmit) {
			return;
		}

		busy = true;
		const ok = await addAnnouncementTargetMutation({
			announcementId,
			targetKind,
			targetId: needsEntity ? targetId : undefined,
			successMessage: get(t)('announcements.targetAdded'),
		});
		busy = false;
		if (ok) {
			open = false;
			resetForm();
		}
	}
</script>

<FormModal
	bind:open
	title={$t('announcements.addTargetTitle')}
	description={$t('announcements.addTargetDescription')}
	submitLabel={$t('common.add')}
	busy={busy}
	submitDisabled={!canSubmit}
	onCancel={resetForm}
	onSubmit={submit}
>
	<div class="space-y-1.5">
		<Label class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
			{$t('announcements.targetKindLabel')}
		</Label>
		<Select.Root type="single" value={targetKind} onValueChange={v => v && (targetKind = v as AnnouncementTargetKind)}>
			<Select.Trigger>
				<Select.Value placeholder={$t('announcements.targetKindLabel')}>
					{targetKindLabel}
				</Select.Value>
			</Select.Trigger>
			<Select.Content class="z-[100]">
				{#each BROADCAST_TARGET_KINDS as entry (entry)}
					<Select.Item value={entry} label={$t(`announcements.targetKind.${entry}`)}>
						{$t(`announcements.targetKind.${entry}`)}
					</Select.Item>
				{/each}
				{#each SCOPED_TARGET_KINDS as entry (entry)}
					<Select.Item value={entry} label={$t(`announcements.targetKind.${entry}`)}>
						{$t(`announcements.targetKind.${entry}`)}
					</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	</div>

	{#if needsEntity}
		<div class="space-y-1.5">
			<Label class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
				{$t('announcements.targetEntityLabel')}
			</Label>
			<Select.Root type="single" value={targetId} onValueChange={v => v && (targetId = v)}>
				<Select.Trigger>
					<Select.Value placeholder={$t('announcements.targetEntityLabel')}>
						{selectedEntityLabel}
					</Select.Value>
				</Select.Trigger>
				<Select.Content class="z-[100]">
					{#each entityOptions as entry (entry.id)}
						<Select.Item value={entry.id} label={entry.label}>
							{entry.label}
						</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>
	{/if}
</FormModal>
