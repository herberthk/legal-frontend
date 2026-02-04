const PrivacyPage = () => (
  <>
    <h3>1. Introduction</h3>
    <p>
      LegalAdviser UG is committed to protecting your privacy. This policy
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

    <h3>3. How We Use Your Data</h3>
    <p>We use your data to:</p>
    <ul>
      <li>Provide and improve our AI legal services.</li>
      <li>Process payments and prevent fraud.</li>
      <li>Comply with legal obligations under Ugandan law.</li>
    </ul>
    <p>
      <strong>Note:</strong> We do not sell your personal data to third parties.
      Anonymized query data may be used to improve model accuracy.
    </p>

    <h3>4. AI Processing</h3>
    <p>
      Data submitted to our chat and voice interfaces is processed by
      Google&apos;s Gemini API. While data is transmitted securely (TLS 1.3), we
      recommend redacting sensitive personal details (names of minors, specific
      addresses) from your queries.
    </p>

    <h3>5. Data Security</h3>
    <p>
      We implement appropriate technical and organizational measures to secure
      your personal data, including encryption at rest and in transit, in
      accordance with the <strong>Electronic Transactions Act, 2011</strong>.
    </p>

    <h3>6. Your Rights</h3>
    <p>Under the Data Protection and Privacy Act, you have the right to:</p>
    <ul>
      <li>Access your personal data.</li>
      <li>Request correction or deletion of your data.</li>
      <li>Withdraw consent for data processing.</li>
    </ul>
  </>
);

export default PrivacyPage;
