export default function Privacy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 py-12 px-4">
      <article className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8 text-gray-700">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: January 31, 2026</p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Introduction</h2>
          <p>
            IOU App (&quot;we&quot;, &quot;our&quot;, or &quot;the app&quot;) helps you track favors with friends—such as coffees, beers, meals, rides, and more. This privacy policy explains what information we collect, how we use it, and your choices.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Information We Collect</h2>
          <p className="mb-3">We collect information you provide and data necessary to run the service:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Account information:</strong> If you sign in with Google, we receive your email and name from Google. If you sign up with email, we store your email and a hashed password.</li>
            <li><strong>Profile information:</strong> Username, optional profile photo (avatar), and optionally a hashed form of your phone number so friends can find you by number.</li>
            <li><strong>IOU and social data:</strong> Favors you log (type and amount), friend connections, and notifications we send you about IOUs and friend requests.</li>
            <li><strong>Technical data:</strong> Standard data such as IP address and browser type may be processed by our hosting and auth providers.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">3. How We Use Your Information</h2>
          <p>
            We use your information to provide and improve the app: to create and manage your account, display your profile to friends, record and display IOUs, send notifications (e.g., friend requests, IOU updates), and to protect against abuse and enforce our terms.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Third-Party Services</h2>
          <p className="mb-3">We rely on the following services, which have their own privacy practices:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Google:</strong> For &quot;Sign in with Google&quot;. Google shares your email and name with us in accordance with your Google account settings and Google&apos;s privacy policy.</li>
            <li><strong>Supabase:</strong> Our backend (database, authentication, and file storage). Data is stored and processed by Supabase under their privacy policy and terms.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Data Retention and Security</h2>
          <p>
            We keep your data for as long as your account is active. You can delete your account and associated data through the app or by contacting us. We use industry-standard measures (including encryption and secure auth) to protect your data, but no system is completely secure.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Your Rights</h2>
          <p>
            Depending on where you live, you may have the right to access, correct, or delete your personal data, or to object to or restrict certain processing. You can update your profile and account settings in the app. To request deletion or exercise other rights, contact us at the email below.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Children</h2>
          <p>
            The app is not intended for users under 13. We do not knowingly collect personal information from children under 13. If you believe we have done so, please contact us and we will delete it.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Changes to This Policy</h2>
          <p>
            We may update this privacy policy from time to time. We will post the updated version here and change the &quot;Last updated&quot; date. Continued use of the app after changes means you accept the updated policy.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Contact Us</h2>
          <p>
            For privacy-related questions or requests, contact us at{' '}
            <a href="mailto:aditmiddha@gmail.com" className="text-amber-600 hover:text-amber-700 underline">
              aditmiddha@gmail.com
            </a>.
          </p>
        </section>

        <p className="mt-10 pt-6 border-t border-gray-200 text-sm text-gray-500">
          <a href="/" className="text-amber-600 hover:text-amber-700 font-medium">← Back to IOU</a>
        </p>
      </article>
    </div>
  );
}
