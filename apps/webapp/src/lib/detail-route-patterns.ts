const DETAIL_PATH_PATTERNS = [
	/^\/school\/(students|guardians|activities|events|calendar)\/[^/]+$/,
	/^\/classes\/[^/]+\/(students|subjects|timetable|teaching|evaluations|report-cards)\/[^/]+$/,
	/^\/finance\/(billing|fees)\/[^/]+$/,
	/^\/configuration\/subjects\/level\/[^/]+$/,
	/^\/configuration\/subjects\/[^/]+$/,
	/^\/configuration\/staff\/[^/]+$/,
	/^\/configuration\/roles\/[^/]+$/,
	/^\/configuration\/report-cards\/[^/]+$/,
] as const;

export function isLikelyDetailPath(pathname: string): boolean {
	return DETAIL_PATH_PATTERNS.some(pattern => pattern.test(pathname));
}
