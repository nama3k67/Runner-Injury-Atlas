import { createFileRoute, Link } from '@tanstack/react-router';
import { content } from '../content';

export const Route = createFileRoute('/')({ component: Home });

function Home() {
  return (
    <main className="wrap">
      <h1>Chấn thương chạy bộ, giải thích bằng mô phỏng</h1>
      <p className="lead">
        Mỗi chấn thương một trang: giải phẫu thật, cơ chế gây đau, phục hồi theo giai đoạn. Mọi nhận
        định đều có nguồn.
      </p>
      <ul className="cards">
        {content.injuries.map(({ injury }) => (
          <li key={injury.slug} className="card">
            <h2>
              <Link to="/$injury" params={{ injury: injury.slug }}>
                {injury.title.vi}
              </Link>
            </h2>
            <p className="en">{injury.title.en}</p>
            <p>{injury.summary}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
