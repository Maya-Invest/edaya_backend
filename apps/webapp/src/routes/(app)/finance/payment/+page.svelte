<script lang="ts">
	import type { PageData } from './$types';
	import PaymentsView from '$lib/components/school/PaymentsView.svelte';
	import DataState from '$lib/components/ui/DataState.svelte';
	import { t } from '$lib/i18n';

	const { data }: { data: PageData } = $props();
</script>

<DataState
	status={data.status}
	errorMessage={data.errorMessage}
	emptyTitle={$t('finance.payments')}
	emptyDescription={$t('dataState.emptyDescription')}
>
	<PaymentsView
		billing={data.billing}
		students={data.students}
		fees={data.fees}
		classes={data.classes}
	/>
</DataState>
