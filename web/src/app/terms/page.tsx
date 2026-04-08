import type { Metadata } from "next";

import { LegalDocShell, LegalSection } from "@/components/legal-doc-shell";

export const metadata: Metadata = {
  title: "Terms of Service — ChezTrading",
  description: "Terms of Service for ChezTrading",
};

export default function TermsOfServicePage() {
  return (
    <LegalDocShell title="Terms of Service">
      <LegalSection title="Legal Compliance">
        <p>
          This service operates in full compliance with Valve Corporation&apos;s Steam Web API Terms of Use and Steam
          Subscriber Agreement. All transactions and user interactions conform to Steam&apos;s guidelines for
          third-party services. By using this platform, you affirm compliance with 18 U.S.C. § 1030 (Computer Fraud and
          Abuse Act) and EU Directive 2019/770 on digital content.
        </p>
      </LegalSection>

      <LegalSection title="Steam API Compliance">
        <p>
          This service uses Valve&apos;s Steamworks API pursuant to their terms. Steam and Steamworks are trademarks of
          Valve Corporation. Inventory data is sourced through Steam&apos;s public API endpoints
          (ISteamUser/GetPlayerSummaries/v2 and IPlayerService/GetOwnedGames/v1) and cached according to Valve&apos;s
          rate limiting requirements. We maintain no control over Steam&apos;s infrastructure or inventory systems.
        </p>
      </LegalSection>

      <LegalSection title="User Responsibilities">
        <p>Maintain valid Steam profile with public inventory settings (per Steam Community Guidelines)</p>
        <p>Ensure all trades comply with Steam&apos;s Item Restoration Policy and Trade Offer API Rules</p>
        <p>
          Acknowledge that all trade operations are subject to Steam&apos;s Economy Fraud Detection mechanisms
        </p>
      </LegalSection>

      <LegalSection title="Limited Liability">
        <p>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTY OF ANY KIND. TO THE MAXIMUM EXTENT PERMITTED BY LAW:
        </p>
        <ul className="list-none space-y-4 pl-0">
          <li>
            a) We exclude all liability for damages arising from Steam API limitations, inventory discrepancies, or trade
            offer failures
          </li>
          <li>
            b) We assume no responsibility for Valve-initiated trade holds, account restrictions, or item cooldowns
          </li>
          <li>
            c) We disclaim liability for third-party actions including but not limited to phishing attempts, API key
            misuse, or Steam Guard compromises
          </li>
          <li>d) Market data is provided for informational purposes only and does not constitute financial advice</li>
        </ul>
      </LegalSection>

      <LegalSection title="Intellectual Property">
        <p>
          All CS:GO item images, descriptions, and game-related content are property of Valve Corporation. This service
          complies with Valve&apos;s Copyright Policy for fan content. Any use of Valve&apos;s intellectual property is
          under fair use principles (17 U.S.C. § 107) and constitutes nominative fair use under 15 U.S.C. §
          1125(c)(3)(A).
        </p>
      </LegalSection>
    </LegalDocShell>
  );
}
