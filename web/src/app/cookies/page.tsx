import type { Metadata } from "next";

import { LegalDocShell, LegalSection } from "@/components/legal-doc-shell";

export const metadata: Metadata = {
  title: "Cookie Policy — ChezTrading",
  description: "Cookie Policy for ChezTrading",
};

export default function CookiesPolicyPage() {
  return (
    <LegalDocShell title="Cookie Policy">
      <LegalSection title="Essential Cookies">
        <p>We use cookies for:</p>
        <ul className="list-disc space-y-2 pl-6 marker:text-zinc-500">
          <li>Session management</li>
          <li>Security (CSRF tokens)</li>
          <li>UI preferences</li>
        </ul>
      </LegalSection>

      <LegalSection title="Cookie Control">
        <p>Manage cookies via:</p>
        <ul className="list-disc space-y-2 pl-6 marker:text-zinc-500">
          <li>Browser settings</li>
          <li>Our cookie consent banner</li>
        </ul>
      </LegalSection>

      <LegalSection title="Analytics">
        <p>We use anonymized analytics with:</p>
        <ul className="list-disc space-y-2 pl-6 marker:text-zinc-500">
          <li>IP masking</li>
          <li>No cross-site tracking</li>
        </ul>
      </LegalSection>
    </LegalDocShell>
  );
}
