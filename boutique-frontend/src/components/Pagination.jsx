import { useT } from '../i18n.jsx';

// Barre de pagination : "12 résultats   ‹ Précédent   Page 2 / 5   Suivant ›"
// "pagination" vient de l'API : { page, pages, total }
export default function Pagination({ pagination, onChange }) {
  const { t } = useT();
  if (!pagination || pagination.total === 0) return null;

  const { page, pages, total } = pagination;
  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="muted petit">{t('pagination.total', { n: total })}</span>
      {pages > 1 && (
        <div className="pagination-boutons">
          <button className="btn btn-light btn-small" disabled={page <= 1} onClick={() => onChange(page - 1)}>
            {t('pagination.precedent')}
          </button>
          <span className="petit">{t('pagination.page', { page, pages })}</span>
          <button className="btn btn-light btn-small" disabled={page >= pages} onClick={() => onChange(page + 1)}>
            {t('pagination.suivant')}
          </button>
        </div>
      )}
    </nav>
  );
}
