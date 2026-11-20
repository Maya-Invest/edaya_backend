export interface TransportRequestOptions {
	body?: unknown
	signal?: AbortSignal
}

export interface Transport {
	request: <T>(method: string, path: string, options?: TransportRequestOptions) => Promise<T>
}
