import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="legal-page-shell">
      <article className="legal-page-card">
        <p className="eyebrow">Terms of Service</p>
        <h1>Terms of Service</h1>
        <p>
          These Terms of Service are a general template for use with Family Hub
          and govern access to and use of the shared dashboard.
        </p>
        <section>
          <h2>Use of the Service</h2>
          <p>
            You may use the service only for lawful purposes and in a way that
            does not interfere with the operation, security, or availability of
            the app.
          </p>
        </section>
        <section>
          <h2>Accounts and Access</h2>
          <p>
            Access may be limited to invited or approved users. You are
            responsible for maintaining the security of your account and any
            connected services.
          </p>
        </section>
        <section>
          <h2>Third-Party Services</h2>
          <p>
            Family Hub may rely on third-party providers for authentication,
            hosting, email delivery, weather data, or calendar integrations.
            Their terms may also apply.
          </p>
        </section>
        <section>
          <h2>No Warranty</h2>
          <p>
            The service is provided on an &quot;as is&quot; and &quot;as
            available&quot; basis without warranties of any kind, to the extent
            permitted by law.
          </p>
        </section>
        <section>
          <h2>Limitation of Liability</h2>
          <p>
            To the extent permitted by law, the service operator is not liable
            for indirect, incidental, special, consequential, or punitive
            damages arising from use of the service.
          </p>
        </section>
        <section>
          <h2>Changes</h2>
          <p>
            These terms may be updated from time to time. Continued use of the
            service after updates means you accept the revised terms.
          </p>
        </section>
        <Link href="/" className="secondary-button legal-back-link">
          Return home
        </Link>
      </article>
    </main>
  );
}
