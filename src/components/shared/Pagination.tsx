export function Pagination({ page, pageSize, totalItems, onPageChange, label = "목록 페이지" }: {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  label?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const pageItems = paginationItems(safePage, totalPages);
  return <nav className="list-pagination" aria-label={label}>
    <span>{totalItems.toLocaleString()}건 · {safePage + 1}/{totalPages} 페이지</span>
    <div>
      <button type="button" disabled={safePage === 0} onClick={() => onPageChange(safePage - 1)} aria-label="이전 페이지">이전</button>
      {pageItems.map((item, index) => item === "gap"
        ? <span className="pagination-ellipsis" aria-hidden="true" key={`gap-${index}`}>…</span>
        : <button type="button" className={item === safePage ? "page-number active" : "page-number"} aria-current={item === safePage ? "page" : undefined} aria-label={`${item + 1} 페이지`} onClick={() => onPageChange(item)} key={item}>{item + 1}</button>)}
      <button type="button" disabled={safePage >= totalPages - 1} onClick={() => onPageChange(safePage + 1)} aria-label="다음 페이지">다음</button>
    </div>
  </nav>;
}

function paginationItems(page: number, totalPages: number): Array<number | "gap"> {
  const candidates = new Set([0, totalPages - 1, page - 2, page - 1, page, page + 1, page + 2]);
  const pages = [...candidates].filter((item) => item >= 0 && item < totalPages).sort((left, right) => left - right);
  const result: Array<number | "gap"> = [];
  pages.forEach((item, index) => {
    if (index > 0 && item - pages[index - 1] > 1) result.push("gap");
    result.push(item);
  });
  return result;
}
