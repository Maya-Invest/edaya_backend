<script lang="ts">
	import type { StaffRole } from '$lib/data/school';
	import type { PageData } from './$types';
	import { page } from '$app/stores';
	import RolesMatrixView from '$lib/components/school/RolesMatrixView.svelte';
	import DataState from '$lib/components/ui/DataState.svelte';
	import { detailHref } from '$lib/detail-hrefs';
	import { t } from '$lib/i18n';
	import { appGoto } from '$lib/navigation/app-navigation';

	const { data }: { data: PageData } = $props();

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
		onSelect={role => appGoto(detailHref.configRole(role))}
		{selectedRole}
	/>
</DataState>
