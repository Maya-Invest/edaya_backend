<script lang="ts">
	import type { components } from '$lib/api/schema';
	import { readPendingInvitation } from '$lib/api/invitation-cache';
	import { fetchPendingAccountInvitation } from '$lib/api/invitation-data';
	import {
		resendAccountInvitationMutation,
		revokeAccountInvitationMutation,
		sendAccountInvitationMutation,
	} from '$lib/api/mutations/invitation.mutations';
	import Button from '$lib/components/ui/button/button.svelte';
	import Label from '$lib/components/ui/label/label.svelte';
	import PermissionGate from '$lib/components/ui/PermissionGate.svelte';
	import { t } from '$lib/i18n';
	import { Mail, ShieldCheck, User } from '$lib/icons';
	import { get } from 'svelte/store';

	type InvitationKind = components['schemas']['SendAccountInvitationCommand']['kind'];

	const {
		kind,
		targetId,
		subjectId = null,
		contactEmail = '',
		displayName,
	}: {
		kind: InvitationKind;
		targetId: string;
		subjectId?: string | null;
		contactEmail?: string;
		displayName: string;
	} = $props();

	let busy = $state(false);
	let pendingOverride = $state<string | null | undefined>(undefined);
	let serverPendingId = $state<string | null>(null);

	const pendingInvitationId = $derived(
		pendingOverride !== undefined
			? pendingOverride
			: serverPendingId ?? readPendingInvitation(kind, targetId),
	);

	const linkStatus = $derived.by(() => {
		if (subjectId) {
			return 'linked' as const;
		}
		if (pendingInvitationId) {
			return 'pending' as const;
		}
		return 'not_linked' as const;
	});

	const statusLabel = $derived(
		linkStatus === 'linked'
			? $t('invitation.status.linked')
			: linkStatus === 'pending'
			? $t('invitation.status.pending')
			: $t('invitation.status.notLinked'),
	);

	const statusTone = $derived(
		linkStatus === 'linked'
			? 'text-emerald-700 bg-emerald-500/10 border-emerald-500/20'
			: linkStatus === 'pending'
			? 'text-amber-800 bg-amber-500/10 border-amber-500/20'
			: 'text-muted-foreground bg-secondary/50 border-border',
	);

	$effect(() => {
		pendingOverride = undefined;

		if (subjectId) {
			serverPendingId = null;
			return;
		}

		const currentKind = kind;
		const currentTargetId = targetId;
		let cancelled = false;
		void fetchPendingAccountInvitation(currentKind, currentTargetId).then((invitation) => {
			if (!cancelled) {
				serverPendingId = invitation?.id ?? null;
			}
		});

		return () => {
			cancelled = true;
		};
	});

	async function handleSend() {
		busy = true;
		const invitationId = await sendAccountInvitationMutation({
			kind,
			targetId,
			contactValue: contactEmail || undefined,
			successMessage: get(t)('invitation.sendSuccess', { name: displayName }),
		});
		busy = false;
		if (invitationId) {
			pendingOverride = invitationId;
			serverPendingId = invitationId;
		}
	}

	async function handleResend() {
		if (!pendingInvitationId) {
			return;
		}
		busy = true;
		const ok = await resendAccountInvitationMutation({
			kind,
			targetId,
			invitationId: pendingInvitationId,
			successMessage: get(t)('invitation.resendSuccess', { name: displayName }),
		});
		busy = false;
		if (ok) {
			const invitation = await fetchPendingAccountInvitation(kind, targetId);
			pendingOverride = invitation?.id ?? readPendingInvitation(kind, targetId);
			serverPendingId = invitation?.id ?? null;
		}
	}

	async function handleRevoke() {
		if (!pendingInvitationId) {
			return;
		}
		busy = true;
		const ok = await revokeAccountInvitationMutation({
			kind,
			targetId,
			invitationId: pendingInvitationId,
			successMessage: get(t)('invitation.revokeSuccess', { name: displayName }),
		});
		busy = false;
		if (ok) {
			pendingOverride = null;
			serverPendingId = null;
		}
	}
</script>

<div class="space-y-3 rounded-xl border border-border bg-card px-4 py-3">
	<div class="flex items-start justify-between gap-3">
		<div class="space-y-1">
			<Label class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
				{$t('invitation.accountSection')}
			</Label>
			<p class="text-sm text-muted-foreground">{$t('invitation.accountHint')}</p>
		</div>
		<span class={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusTone}`}>
			{#if linkStatus === 'linked'}
				<ShieldCheck class="h-3.5 w-3.5" />
			{:else if linkStatus === 'pending'}
				<Mail class="h-3.5 w-3.5" />
			{:else}
				<User class="h-3.5 w-3.5" />
			{/if}
			{statusLabel}
		</span>
	</div>

	{#if linkStatus !== 'linked'}
		<PermissionGate permission="ACCESS_CONTROL_ASSIGN" mode="disable" tooltip={$t('invitation.permissionRequired')}>
			{#snippet children({ disabled, title })}
				<div class="flex flex-wrap gap-2">
					{#if linkStatus === 'not_linked'}
						<Button
							type="button"
							size="sm"
							variant="outline"
							disabled={disabled || busy || !contactEmail}
							title={!contactEmail ? $t('invitation.emailRequired') : title}
							onclick={handleSend}
						>
							<Mail class="mr-1.5 h-3.5 w-3.5" />
							{$t('invitation.send')}
						</Button>
					{:else}
						<Button
							type="button"
							size="sm"
							variant="outline"
							disabled={disabled || busy}
							title={title}
							onclick={handleResend}
						>
							{$t('invitation.resend')}
						</Button>
						<Button
							type="button"
							size="sm"
							variant="ghost"
							disabled={disabled || busy}
							title={title}
							onclick={handleRevoke}
						>
							{$t('invitation.revoke')}
						</Button>
					{/if}
				</div>
			{/snippet}
		</PermissionGate>
	{/if}
</div>
