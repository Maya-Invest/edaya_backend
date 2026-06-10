import { getContext } from 'svelte';
import type { DrawerState } from '$lib/drawer.svelte';

export function getDrawer(): DrawerState {
	return getContext<DrawerState>('drawer');
}
