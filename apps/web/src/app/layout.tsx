export const metadata = {
  title: 'LeadSprint',
  description: 'Simple lead automation for small businesses'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'Inter, system-ui, sans-serif', margin: 0 }}>{children}</body>
    </html>
  );
}
