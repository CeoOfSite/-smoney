import type { Metadata } from "next";

import { LegalDocShell, LegalSection } from "@/components/legal-doc-shell";

export const metadata: Metadata = {
  title: "Privacy Policy — ChezTrading",
  description: "Privacy Policy for ChezTrading",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalDocShell title="Privacy Policy">
      <LegalSection title="Data Collection">
        <p>We adhere to GDPR (EU 2016/679) and CCPA (2018). We collect:</p>
        <ul className="list-disc space-y-2 pl-6 marker:text-zinc-500">
          <li>SteamID64 (public identifier)</li>
          <li>Public profile data (avatar, username)</li>
          <li>Trade metadata (timestamps, item counts)</li>
        </ul>
      </LegalSection>

      <LegalSection title="Data Sharing">
        <p>Data is shared only with:</p>
        <ul className="list-disc space-y-2 pl-6 marker:text-zinc-500">
          <li>Valve&apos;s Steam API</li>
          <li>GDPR-compliant hosting providers</li>
        </ul>
      </LegalSection>
    </LegalDocShell>
  );
}
