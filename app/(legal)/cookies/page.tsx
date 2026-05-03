const CookiePolicyPage = () => (
  <>
    <h3>1. What are Cookies?</h3>
    <p>
      Cookies are small text files stored on your device when you visit our
      website. They help us remember your preferences (like Dark Mode) and
      authentication state.
    </p>

    <h3>2. Cookies We Use</h3>
    <div className="not-prose grid gap-4 my-6">
      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <h4 className="font-bold text-slate-900 dark:text-white">
          Essential Cookies
        </h4>
        <p className="text-sm text-slate-500">
          Required for login, security, and billing functionality. Cannot be
          disabled.
        </p>
      </div>
      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <h4 className="font-bold text-slate-900 dark:text-white">
          Preference Cookies
        </h4>
        <p className="text-sm text-slate-500">
          Remember your theme settings (Light/Dark) and voice persona selection.
        </p>
      </div>
      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <h4 className="font-bold text-slate-900 dark:text-white">
          Analytics Cookies
        </h4>
        <p className="text-sm text-slate-500">
          Help us understand how users navigate the Constitution database to
          improve UX.
        </p>
      </div>
    </div>

    <h3>3. Managing Cookies</h3>
    <p>
      You can control and/or delete cookies as you wish via your browser
      settings. Note that disabling essential cookies may affect your ability to
      log in to the Client Portal.
    </p>
  </>
);

export default CookiePolicyPage;
