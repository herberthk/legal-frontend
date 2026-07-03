import DirectionalTransition from "@/components/global/DirectionalTransition";

const PrivacyPage = () => (
  <DirectionalTransition>
    <h3>1. Introduction</h3>
    <p>
      LegalAdviser is committed to protecting your privacy. This policy
      outlines our practices in compliance with the{" "}
      <strong>Data Protection and Privacy Act, 2019</strong> of Uganda.
    </p>

    <h3>2. Data We Collect</h3>
    <ul>
      <li>
        <strong>Personal Information:</strong> Name, email address, and payment
        information.
      </li>
      <li>
        <strong>Usage Data:</strong> Chat logs, voice transcripts, and uploaded
        documents for analysis.
      </li>
      <li>
        <strong>Technical Data:</strong> IP address, browser type, and device
        information.
      </li>
    </ul>

    <h3>3. Data Retention</h3>
    <p>
      We value your control over your data. User chat logs, voice sessions, and transcripts are retained indefinitely <strong>until you explicitly delete them</strong>. You can clear your chat history or delete your account at any time, at which point the associated data will be permanently removed from our systems.
    </p>

    <h3>4. How We Use Your Data</h3>
    <p>We use your data to:</p>
    <ul>
      <li>Provide and improve our AI legal services.</li>
      <li>Process payments securely (via Stripe or Pawapay).</li>
      <li>Comply with legal obligations under Ugandan law.</li>
    </ul>
    <p>
      <strong>Note:</strong> We do not sell your personal data to third parties.
    </p>

    <h3>5. AI Processing & Third Parties</h3>
    <p>
      Data submitted to our chat and voice interfaces is processed by
      Google&apos;s Gemini, Claude, and ChatGPT AI models and stored in Firebase databases. While data is transmitted securely (TLS 1.3), we
      strongly recommend redacting sensitive personal details (such as names of minors or specific
      confidential addresses) from your prompts.
    </p>

    <h3>6. Data Security</h3>
    <p>
      We implement appropriate technical and organizational measures to secure
      your personal data, including encryption at rest and in transit, in
      accordance with the <strong>Electronic Transactions Act, 2011</strong>.
    </p>

    <h3>7. Your Rights & Contact</h3>
    <p>Under the Data Protection and Privacy Act, you have the right to access, correct, delete, or withdraw consent for your personal data. To exercise these rights, please contact us at legaladviser@netbritz.com or at our physical address in Mukono, Uganda.</p>
  </DirectionalTransition>
);

export default PrivacyPage;
