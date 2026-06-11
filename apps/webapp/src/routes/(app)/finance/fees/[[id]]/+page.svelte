<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/stores';
	import FinanceView from '$lib/components/school/FinanceView.svelte';
	import DataState from '$lib/components/ui/DataState.svelte';
	import { detailHref } from '$lib/detail-hrefs';
	import { t } from '$lib/i18n';
	import { appGoto } from '$lib/navigation/app-navigation';

	const { data }: { data: PageData } = $props();

	const selectedId = $derived($page.params.id);
</script>

<DataState
	status={data.status}
	errorMessage={data.errorMessage}
	emptyTitle={$t('finance.fees')}
	emptyDescription={$t('dataState.emptyDescription')}
>
	<FinanceView
		fees={data.fees}
		billing={data.billing}
		students={data.students}
		forcedTab="fees"
		onSelectBilling={b => appGoto(detailHref.financeBilling(b.id))}
		onSelectFee={f => appGoto(detailHref.financeFee(f.id))}
		{selectedId}
	/>
</DataState>
