const CookiePolicyPage = () => (
  <>
    <h3>1. What are Cookies?</h3>
    <p>
      Cookies are small text files stored on your device when you visit LegalAdviser. They help us remember your preferences (like Dark Mode) and maintain your secure authentication state.
    </p>

    <h3>2. Cookies We Use</h3>
    <div className="not-prose grid gap-4 my-6">
      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <h4 className="font-bold text-slate-900 dark:text-white">
          Essential Cookies
        </h4>
        <p className="text-sm text-slate-500">
          Required for authentication, security, and processing payments via Stripe or PawaPay. These cannot be disabled as the app requires them to function.
        </p>
      </div>
      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <h4 className="font-bold text-slate-900 dark:text-white">
          Preference Cookies
        </h4>
        <p className="text-sm text-slate-500">
          Remember your theme settings (Light/Dark) and local UI preferences.
        </p>
      </div>
    </div>

    <h3>3. Third-Party Services</h3>
    <p>
      We use trusted third-party services like Firebase (for backend databases and authentication) and Google Gemini, Claude, and ChatGPT models (for AI capabilities) which may employ their own necessary technical cookies or local storage mechanisms to deliver their services securely.
    </p>

    <h3>4. Managing Cookies</h3>
    <p>
      You can control and/or delete cookies as you wish via your browser
      settings. Note that disabling essential cookies will prevent you from logging in or using the LegalAdviser application correctly.
    </p>

    <h3>5. Contact Us</h3>
    <p>
      For any questions regarding our use of cookies, please contact us at legaladviser@netbritz.com.
    </p>
  </>
);

export default CookiePolicyPage;
