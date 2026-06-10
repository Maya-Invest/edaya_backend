<script lang="ts">
	import { page } from '$app/stores';
</script>

<div class="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-center">
	<h1 class="font-display text-6xl font-semibold">404</h1>
	<p class="text-muted-foreground">Page not found: {$page.url.pathname}</p>
	<a href="/school/students" class="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">
		Back to home
	</a>
</div>
