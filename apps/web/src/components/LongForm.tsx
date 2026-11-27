import type { Sections, Term } from '@atlas/content-schema';
import { Inline } from './RichText';
import { ShowIn3D } from './ShowIn3D';

/** The injury's long-form sections, in v0.3 order: mechanism, causes, symptoms, clinical tests. */
export function LongForm({
  sections,
  terms,
  slug,
}: {
  sections: Sections;
  terms: readonly Term[];
  slug: string;
}) {
  const { mechanism, causes, symptoms, tests } = sections;
  const termById = new Map(terms.map((t) => [t.id, t]));

  return (
    <>
      <section aria-labelledby="co-che">
        <h2 id="co-che">{mechanism.title}</h2>
        {mechanism.intro && (
          <p className="intro">
            <Inline text={mechanism.intro} />
          </p>
        )}
        <div className="vs">
          {mechanism.oldHypothesis && (
            <div className="card old">
              <span className="tag old">{mechanism.oldHypothesis.label}</span>
              <h3>{mechanism.oldHypothesis.title}</h3>
              <p>
                <Inline text={mechanism.oldHypothesis.text} />
              </p>
            </div>
          )}
          <div className="card new">
            <span className="tag new">{mechanism.evidence.label}</span>
            <h3>{mechanism.evidence.title}</h3>
            <ul>
              {mechanism.evidence.points.map((p) => (
                <li key={p}>
                  <Inline text={p} />
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="card">
          <h3>{mechanism.whyItMatters.title}</h3>
          <p>
            <Inline text={mechanism.whyItMatters.text} />
          </p>
        </div>
      </section>

      <section aria-labelledby="nguyen-nhan">
        <h2 id="nguyen-nhan">{causes.title}</h2>
        <p className="intro">
          <Inline text={causes.intro} />
        </p>
        <ul className="cards">
          {causes.items.map((c) => (
            <li key={c.title} className="card">
              <h3>{c.title}</h3>
              <p>
                <Inline text={c.text} />
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="trieu-chung">
        <h2 id="trieu-chung">{symptoms.title}</h2>
        <div className="cards">
          <div className="card">
            <h3>Dấu hiệu điển hình</h3>
            <ul>
              {symptoms.typical.map((t) => (
                <li key={t}>
                  <Inline text={t} />
                </li>
              ))}
            </ul>
          </div>
          <div className="card">
            <h3>Khi nào không nên tự xử lý</h3>
            {symptoms.redFlags.length > 0 && (
              <ul>
                {symptoms.redFlags.map((t) => (
                  <li key={t}>
                    <Inline text={t} />
                  </li>
                ))}
              </ul>
            )}
            <p className="flag">
              <strong>Gặp chuyên gia: </strong>
              <Inline text={symptoms.seeExpert} />
            </p>
          </div>
        </div>
        {symptoms.differential.length > 0 && (
          <>
            <h3>Những thứ cũng gây đau gối ngoài</h3>
            <table className="diff">
              <thead>
                <tr>
                  <th scope="col">Tình trạng</th>
                  <th scope="col">Điểm khác</th>
                </tr>
              </thead>
              <tbody>
                {symptoms.differential.map((d) => (
                  <tr key={d.condition}>
                    <th scope="row">{d.condition}</th>
                    <td>
                      <Inline text={d.difference} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      <section aria-labelledby="test">
        <h2 id="test">{tests.title}</h2>
        <p className="intro">
          <Inline text={tests.intro} />
        </p>
        <ul className="cards">
          {tests.items.map((t) => (
            <li key={t.id} className="card">
              <h3>{t.name}</h3>
              <p className="en">{t.en}</p>
              <p>
                <Inline text={t.text} />
              </p>
              {t.scene && (
                <ShowIn3D
                  term={t.scene.term}
                  hint={{
                    ...termById.get(t.scene.term)?.injuries[slug]?.scene,
                    kneeAngle: t.scene.kneeAngle,
                  }}
                  label={`Xem góc ${t.scene.kneeAngle}° trên 3D`}
                />
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
