<script lang="ts">
	import { Select as SelectPrimitive } from 'bits-ui';

	const { placeholder, ...restProps }: SelectPrimitive.ValueProps = $props();
</script>

<SelectPrimitive.Value {placeholder} {...restProps} />
