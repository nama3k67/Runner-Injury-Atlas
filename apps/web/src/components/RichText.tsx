import { sourceIndex } from '../content';
import { paragraphs, tokenize } from '../richtext';

export function Inline({ text }: { text: string }) {
  return (
    <>
      {tokenize(text).map((t, i) => {
        // Tokens come from one static string, so position is a stable key.
        const key = i;
        if (t.type === 'bold') return <strong key={key}>{t.text}</strong>;
        if (t.type === 'italic') return <em key={key}>{t.text}</em>;
        if (t.type === 'source') {
          const n = sourceIndex.get(t.id)?.n ?? '?';
          return (
            <sup key={key}>
              <a href={`#${t.id}`} aria-label={`Nguồn ${n}`}>
                {n}
              </a>
            </sup>
          );
        }
        return <span key={key}>{t.text}</span>;
      })}
    </>
  );
}

export function RichText({ text }: { text: string }) {
  return (
    <>
      {paragraphs(text).map((p) => (
        <p key={p}>
          <Inline text={p} />
        </p>
      ))}
    </>
  );
}
