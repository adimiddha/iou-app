type LandingProps = {
  onSignInClick: () => void;
};

export default function Landing({ onSignInClick }: LandingProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-lg p-8 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">IOU</h1>
        <p className="text-gray-700 text-lg mb-6">
          IOU helps you track favors with friends—coffees, beers, meals, rides, pizza, and more. See who owes whom and settle up.
        </p>
        <ul className="text-left text-gray-600 mb-8 space-y-2 max-w-sm mx-auto">
          <li>• Track IOUs by type and amount</li>
          <li>• Add friends and send requests</li>
          <li>• Optional phone number so friends can find you</li>
        </ul>
        <button
          type="button"
          onClick={onSignInClick}
          className="w-full bg-amber-500 text-white py-3 rounded-lg font-medium hover:bg-amber-600 transition-colors"
        >
          Get started
        </button>
        <p className="mt-6 text-sm text-gray-500">
          <a
            href="/privacy.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-600 hover:text-amber-700"
          >
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
}
