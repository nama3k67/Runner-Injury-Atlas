import type { Term } from '@atlas/content-schema';
import { useSimStore } from '../simStore';
import { Inline, RichText } from './RichText';

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
      <p className="note" data-testid="term-hint">
        Chạm vào một cấu trúc trên mô hình để xem giải thích.
      </p>
    );
  }

  const related = term.related.flatMap((id) => terms.get(id) ?? []);

  return (
    <section
      className="card term-panel"
      aria-labelledby="term-panel-title"
      data-testid="term-panel"
    >
      <button
        type="button"
        className="term-close"
        aria-label="Bỏ chọn"
        onClick={() => select(null)}
      >
        ×
      </button>
      <h3 id="term-panel-title">{term.vi}</h3>
      <p className="en">{term.en}</p>
      <p>
        <Inline text={term.short} />
      </p>
      <RichText text={term.body} />
      <p className="role">
        <strong>Vai trò trong {injury.name}: </strong>
        <Inline text={link.role} />
      </p>
      {related.length > 0 && (
        <nav className="term-related" aria-label="Thuật ngữ liên quan">
          {related.map((r) => (
            <button key={r.id} type="button" onClick={() => select(r.id)}>
              {r.vi}
            </button>
          ))}
        </nav>
      )}
    </section>
  );
}
