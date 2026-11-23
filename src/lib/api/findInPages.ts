/**
 * Some broker resources have a list endpoint but no "get one" endpoint (wallet ledger entries,
 * commission accruals, notifications). Their detail pages page through the list until the item is
 * found. `maxPages` bounds the scan; null means not found within it.
 */
export async function findInPages<T>(
  fetchPage: (page: number) => Promise<{ items: readonly T[]; totalPages: number }>,
  match: (item: T) => boolean,
  maxPages = 20,
): Promise<T | null> {
  for (let page = 1; page <= maxPages; page += 1) {
    const { items, totalPages } = await fetchPage(page);
    const found = items.find(match);
    if (found !== undefined) return found;
    if (page >= totalPages || items.length === 0) return null;
  }
  return null;
}

/** Largest page size the broker list endpoints accept (`paginationQuerySchema`). */
export const SCAN_PAGE_SIZE = 100;

/**
 * Collect every matching item of a newest-first list, stopping at the first item for which
 * `isPast` is true (everything after it is older) or after `maxPages`.
 */
export async function collectInPages<T>(
  fetchPage: (page: number) => Promise<{ items: readonly T[]; totalPages: number }>,
  match: (item: T) => boolean,
  isPast: (item: T) => boolean = () => false,
  maxPages = 20,
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const { items, totalPages } = await fetchPage(page);
    for (const item of items) {
      if (isPast(item)) return out;
      if (match(item)) out.push(item);
    }
    if (page >= totalPages || items.length === 0) return out;
  }
  return out;
}
