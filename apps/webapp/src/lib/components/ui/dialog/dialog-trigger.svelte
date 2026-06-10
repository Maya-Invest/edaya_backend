<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';

	let { child, children, ...restProps }: DialogPrimitive.TriggerProps = $props();
</script>

<DialogPrimitive.Trigger {...restProps} {child}>
	{@render children?.()}
</DialogPrimitive.Trigger>
