import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="legal-page-shell">
      <article className="legal-page-card">
        <p className="eyebrow">Privacy Policy</p>
        <h1>Privacy Policy</h1>
        <p>
          This Privacy Policy explains, in general terms, how Family Hub may
          collect, use, and store information needed to operate the shared
          family dashboard.
        </p>
        <section>
          <h2>Information We Collect</h2>
          <p>
            Family Hub may collect account information, calendar data, display
            settings, and other information you choose to provide through the
            app.
          </p>
        </section>
        <section>
          <h2>How Information Is Used</h2>
          <p>
            Information is used to provide core app functionality, such as
            displaying shared schedules, managing members, and syncing related
            services.
          </p>
        </section>
        <section>
          <h2>Data Sharing</h2>
          <p>
            Information is not sold. Data may be processed by service providers
            that support hosting, authentication, storage, email delivery, or
            calendar integrations.
          </p>
        </section>
        <section>
          <h2>Data Retention</h2>
          <p>
            Information may be retained for as long as reasonably necessary to
            operate the service, comply with legal obligations, or resolve
            disputes.
          </p>
        </section>
        <section>
          <h2>Contact</h2>
          <p>
            If you have questions about this Privacy Policy, contact the owner
            or administrator of the Family Hub deployment you use.
          </p>
        </section>
        <Link href="/" className="secondary-button legal-back-link">
          Return home
        </Link>
      </article>
    </main>
  );
}
