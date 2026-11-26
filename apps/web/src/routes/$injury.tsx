import { createFileRoute, notFound } from '@tanstack/react-router';
import { FeedbackForm } from '../components/FeedbackForm';
import { ReviewBadge } from '../components/ReviewBadge';
import { Inline, RichText } from '../components/RichText';
import { ShowIn3D } from '../components/ShowIn3D';
import { Simulation } from '../components/Simulation';
import { content, findInjury, termsFor } from '../content';

export const Route = createFileRoute('/$injury')({
  loader: ({ params }) => {
    if (!findInjury(params.injury)) throw notFound();
    return { slug: params.injury };
  },
  head: ({ params }) => {
    const bundle = findInjury(params.injury);
    return {
      meta: bundle ? [{ title: `${bundle.injury.title.vi} · Atlas Chấn thương Runner` }] : [],
    };
  },
  component: InjuryPage,
});

function InjuryPage() {
  const { slug } = Route.useLoaderData();
  const bundle = findInjury(slug);
  if (!bundle) return null;
  const { injury, rehab, myths, tour, simulation, contentHash } = bundle;
  const terms = termsFor(slug);

  return (
    <main className="wrap">
      <p className="eyebrow">{injury.title.en}</p>
      <h1>{injury.title.vi}</h1>
      <p className="lead">{injury.summary}</p>
      <ReviewBadge injurySlug={slug} contentHash={contentHash} />

      <section aria-labelledby="sim">
        <h2 id="sim">Mô phỏng 3D</h2>
        <Simulation
          sim={simulation}
          tour={tour}
          terms={terms}
          injury={{ slug, name: injury.title.vi }}
        />
      </section>

      <section aria-labelledby="rehab">
        <h2 id="rehab">Phục hồi theo giai đoạn</h2>
        <ol className="phases">
          {rehab.phases.map((phase) => (
            <li key={phase.id} className="card">
              <h3>
                {phase.label} · {phase.title}
              </h3>
              <p>{phase.goal}</p>
              <h4>Nên làm</h4>
              <ul>
                {phase.do.map((item) => (
                  <li key={item}>
                    <Inline text={item} />
                  </li>
                ))}
              </ul>
              <h4>Tránh</h4>
              <ul>
                {phase.avoid.map((item) => (
                  <li key={item}>
                    <Inline text={item} />
                  </li>
                ))}
              </ul>
              <p className="gate">
                Tiêu chí chuyển giai đoạn: <Inline text={phase.gate} />
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="myths">
        <h2 id="myths">Hiểu lầm phổ biến</h2>
        <dl className="myths">
          {myths.map((m) => (
            <div key={m.id} className="card">
              <dt>“{m.myth}”</dt>
              <dd>
                <Inline text={m.fact} />
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="terms">
        <h2 id="terms">Từ điển</h2>
        <ul className="cards">
          {terms.map((term) => (
            <li key={term.id} id={`term-${term.id}`} className="card">
              <h3>{term.vi}</h3>
              <p className="en">{term.en}</p>
              <RichText text={term.body} />
              <p className="role">
                <strong>Vai trò: </strong>
                <Inline text={term.injuries[slug]?.role ?? ''} />
              </p>
              <ShowIn3D term={term.id} hint={term.injuries[slug]?.scene} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="feedback">
        <h2 id="feedback">Góp ý nội dung</h2>
        <FeedbackForm injurySlug={slug} />
      </section>

      <section aria-labelledby="sources">
        <h2 id="sources">Nguồn tham khảo</h2>
        <ol className="sources">
          {content.sources.map((s) => (
            <li key={s.id} id={s.id}>
              {s.citation} <a href={s.url}>Liên kết</a>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
