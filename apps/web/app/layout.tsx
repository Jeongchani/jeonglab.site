import Link from 'next/link';

export const metadata = {
  title: 'jeong.site',
  description: '내가 진행/연결한 사이트들을 한 곳에서 관리하는 허브',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-dvh bg-black text-white">
        <header className="border-b border-white/10">
          <nav className="container mx-auto h-14 flex items-center px-4">
            <Link href="/" className="font-semibold">jeong.site</Link>
            <div className="ml-auto flex gap-6 text-sm opacity-80">
              <Link href="/status">Status</Link>
              <Link href="/projects">Projects</Link>
            </div>
          </nav>
        </header>
        <main className="container mx-auto px-4 py-10">
          {children}
        </main>
        <footer className="container mx-auto px-4 py-8 opacity-60 text-sm">
          © {new Date().getFullYear()} jeong.site
        </footer>
      </body>
    </html>
  );
}
