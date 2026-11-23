import { describe, expect, it, vi } from 'vitest';
import { collectInPages, findInPages } from './findInPages';

const pages = [[1, 2], [3, 4], [5]];
const fetcher = () => vi.fn(async (page: number) => ({ items: pages[page - 1] ?? [], totalPages: pages.length }));

describe('findInPages', () => {
  it('stops at the page holding the item', async () => {
    const f = fetcher();
    expect(await findInPages(f, (x) => x === 3)).toBe(3);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('returns null after the last page', async () => {
    const f = fetcher();
    expect(await findInPages(f, (x) => x === 9)).toBeNull();
    expect(f).toHaveBeenCalledTimes(3);
  });

  it('respects maxPages', async () => {
    const f = fetcher();
    expect(await findInPages(f, (x) => x === 5, 2)).toBeNull();
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('stops on an empty page', async () => {
    const f = vi.fn(async () => ({ items: [] as number[], totalPages: 5 }));
    expect(await findInPages(f, () => true)).toBeNull();
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe('collectInPages', () => {
  it('collects matches across pages', async () => {
    expect(await collectInPages(fetcher(), (x) => x % 2 === 1)).toEqual([1, 3, 5]);
  });

  it('stops at the first past item', async () => {
    const f = fetcher();
    expect(await collectInPages(f, () => true, (x) => x >= 3)).toEqual([1, 2]);
    expect(f).toHaveBeenCalledTimes(2);
  });
});
