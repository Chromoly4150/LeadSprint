export function Badge({ children, tone = 'default' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function toneForUrgency(urgency: string) {
  return urgency.toLowerCase().replace(/\s+/g, '-');
}
