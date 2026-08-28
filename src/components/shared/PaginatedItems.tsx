import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Pagination } from "./Pagination";

export function PaginatedItems<T>({ items, renderItem, className, pageSize = 10, label, empty, resetKey }: {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
  pageSize?: number;
  label: string;
  empty?: ReactNode;
  resetKey?: string;
}) {
  const [page, setPage] = useState(0);
  const safePage = Math.min(page, Math.max(0, Math.ceil(items.length / pageSize) - 1));
  const pagedItems = useMemo(
    () => items.slice(safePage * pageSize, (safePage + 1) * pageSize),
    [items, pageSize, safePage],
  );

  useEffect(() => setPage(0), [resetKey]);

  return <>
    <div className={className}>{pagedItems.map((item, index) => renderItem(item, safePage * pageSize + index))}{!items.length ? empty : null}</div>
    {items.length ? <Pagination page={safePage} pageSize={pageSize} totalItems={items.length} onPageChange={setPage} label={label} /> : null}
  </>;
}
