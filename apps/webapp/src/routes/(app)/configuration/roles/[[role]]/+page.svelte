<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import DataState from '$lib/components/ui/DataState.svelte';
	import RolesMatrixView from '$lib/components/school/RolesMatrixView.svelte';
	import { detailHref } from '$lib/detail-routes';
	import { t } from '$lib/i18n';
	import type { StaffRole } from '$lib/data/school';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const selectedRole = $derived($page.params.role as StaffRole | undefined);
</script>

<DataState
	status={data.status}
	errorMessage={data.errorMessage}
	emptyTitle={$t('roles.title')}
	emptyDescription={$t('dataState.emptyDescription')}
>
	<RolesMatrixView
		staff={data.staff}
		onSelect={(role) => goto(detailHref.configRole(role))}
		{selectedRole}
	/>
</DataState>
