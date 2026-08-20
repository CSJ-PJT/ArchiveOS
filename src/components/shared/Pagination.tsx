export function Pagination({ page, pageSize, totalItems, onPageChange, label = "목록 페이지" }: {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  label?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  return <nav className="list-pagination" aria-label={label}>
    <span>{totalItems.toLocaleString()}건 · {safePage + 1}/{totalPages} 페이지</span>
    <div>
      <button type="button" disabled={safePage === 0} onClick={() => onPageChange(safePage - 1)} aria-label="이전 페이지">이전</button>
      <button type="button" disabled={safePage >= totalPages - 1} onClick={() => onPageChange(safePage + 1)} aria-label="다음 페이지">다음</button>
    </div>
  </nav>;
}
