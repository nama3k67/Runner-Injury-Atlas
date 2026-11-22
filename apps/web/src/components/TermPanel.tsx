import type { Term } from '@atlas/content-schema';
import { useSimStore } from '../simStore';
import { Inline, RichText } from './RichText';

// Category labels from legacy v0.3.
const CATEGORY: Readonly<Record<Term['category'], string>> = {
  structure: 'Cấu trúc',
  muscle: 'Cơ',
  bone: 'Xương',
  concept: 'Khái niệm',
  test: 'Test',
};

interface Props {
  /** Terms linked to this injury, by id. */
  terms: ReadonlyMap<string, Term>;
  injury: { slug: string; name: string };
}

export function TermPanel({ terms, injury }: Props) {
  const selected = useSimStore((s) => s.selected);
  const { select } = useSimStore.getState();
  const term = selected === null ? undefined : terms.get(selected);
  const link = term?.injuries[injury.slug];

  if (!term || !link) {
    return (
      <p className="empty" data-testid="term-hint">
        Bấm vào một cấu trúc trên mô hình 3D để mở mục từ tại đây.
      </p>
    );
  }

  const related = term.related.flatMap((id) => terms.get(id) ?? []);

  return (
    <article className="entry" aria-labelledby="term-panel-title" data-testid="term-panel">
      <button
        type="button"
        className="entry-close"
        aria-label="Bỏ chọn"
        onClick={() => select(null)}
      >
        ×
      </button>
      <span className="entry-cat">{CATEGORY[term.category]}</span>
      <h3 id="term-panel-title">{term.vi}</h3>
      <p className="entry-en">{term.en}</p>
      <p>
        <Inline text={term.short} />
      </p>
      <RichText text={term.body} />
      <div className="entry-role">
        <strong>Vai trò trong {injury.name}</strong>
        <Inline text={link.role} />
      </div>
      {related.length > 0 && (
        <nav className="entry-related" aria-label="Thuật ngữ liên quan">
          {related.map((r) => (
            <button key={r.id} type="button" className="btn" onClick={() => select(r.id)}>
              {r.vi}
            </button>
          ))}
        </nav>
      )}
    </article>
  );
}
