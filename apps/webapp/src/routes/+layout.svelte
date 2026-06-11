<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { authSession } from '$lib/auth/session.svelte';
	import ApiDevBanner from '$lib/components/dev/ApiDevBanner.svelte';
	import '../app.css';

	const { data, children } = $props();

	$effect(() => {
		authSession.setFromServer(data.session, data.staffProfile);
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Scholaria — School Management</title>
</svelte:head>

<ApiDevBanner initial={data.api} />

{@render children()}
