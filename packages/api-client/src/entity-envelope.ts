function isEntityEnvelope(value: unknown): value is { data: Record<string, unknown> } {
	if (typeof value !== 'object' || value === null || !('data' in value)) {
		return false;
	}

	const { data } = value as { data: unknown };
	if (typeof data !== 'object' || data === null) {
		return false;
	}

	return Object.keys(value).length === 1;
}

export function unwrapEntity<T>(value: unknown): T {
	return (isEntityEnvelope(value) ? value.data : value) as T;
}

export function unwrapEntityList<T>(values: unknown): T[] {
	if (!Array.isArray(values)) {
		return [];
	}

	return values.map(entry => unwrapEntity<T>(entry));
}
