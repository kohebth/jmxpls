export type Page<T> = {
  items: T[];
  nextCursor?: string;
};

export function paginate<T>(items: T[], limit = 50, cursor?: string): Page<T> {
  const start = cursor ? Number(cursor) : 0;
  const selected = items.slice(start, start + limit);
  const page: Page<T> = { items: selected };
  if (start + limit < items.length) {
    page.nextCursor = String(start + limit);
  }
  return page;
}
