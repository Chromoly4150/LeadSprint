import { AppShell, cardStyle } from '../../components/app-shell';

export default function AccessStatusPage() {
  return (
    <AppShell title="Access status" subtitle="Placeholder for pending / follow-up / rejected onboarding states.">
      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Scaffold placeholder</h2>
        <p>
          This route will eventually show whether a verified business workspace request is pending, needs follow-up,
          or has been rejected.
        </p>
      </section>
    </AppShell>
  );
}
