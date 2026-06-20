<script lang="ts">
	import type { PermissionCode } from '$lib/auth/types';
	import type { Snippet } from 'svelte';
	import { hasAnyPermission, hasPermission } from '$lib/permissions';

	const {
		permission,
		permissions,
		match = 'any',
		classId,
		subject,
		tooltip = 'Action non autorisée',
		mode = 'hide',
		children,
	}: {
		permission?: PermissionCode;
		permissions?: readonly PermissionCode[];
		match?: 'any' | 'all';
		classId?: string;
		subject?: string;
		tooltip?: string;
		mode?: 'hide' | 'disable';
		children?: Snippet<[{ disabled: boolean; title?: string }]>;
	} = $props();

	const codes = $derived(permissions ?? (permission ? [permission] : []));

	const allowed = $derived.by(() => {
		const ctx = { classId, subject };
		if (codes.length === 0) {
			return false;
		}
		if (match === 'all') {
			return codes.every(code => hasPermission(code, ctx));
		}
		return hasAnyPermission(codes, ctx);
	});
</script>

{#if allowed || mode === 'disable'}
	{@render children?.({ disabled: !allowed, title: allowed ? undefined : tooltip })}
{/if}
