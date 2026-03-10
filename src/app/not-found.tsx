import Link from 'next/link';

export default function NotFound() {
  return (
    <main style={{ padding: 40, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <h1>Not found</h1>
      <p>The page you were looking for doesn’t exist.</p>
      <Link href="/dashboard">Go to dashboard</Link>
    </main>
  );
}
