/// <reference types="vite/client" />
import { createRootRoute, HeadContent, Link, Outlet, Scripts } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import appCss from '../styles.css?url';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Atlas Chấn thương Runner' },
      {
        name: 'description',
        content: 'Từ điển tương tác về chấn thương chạy bộ, với mô phỏng 3D giải phẫu thật.',
      },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
  component: () => <Outlet />,
  notFoundComponent: () => (
    <main className="wrap">
      <h1>Không tìm thấy trang</h1>
      <Link to="/">Về trang chủ</Link>
    </main>
  ),
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <HeadContent />
      </head>
      <body>
        <header className="top">
          <div className="wrap">
            <Link to="/" className="brand">
              Atlas Chấn thương Runner
            </Link>
          </div>
        </header>
        {children}
        <footer className="wrap foot">
          Nội dung để tìm hiểu, không thay thế chẩn đoán hay điều trị. Mô hình 3D: BodyParts3D ©
          DBCLS, CC BY-SA 2.1 JP.
        </footer>
        <Scripts />
      </body>
    </html>
  );
}
