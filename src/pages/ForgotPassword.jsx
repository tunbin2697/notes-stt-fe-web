import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@apollo/client/react";
import { REQUEST_PASSWORD_RESET } from "@/graphql/mutations";
import { isValidEmail } from "@/utils/helpers";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);
  const [requestPasswordReset, { loading }] = useMutation(
    REQUEST_PASSWORD_RESET
  );

  const handleChange = (e) => {
    setEmail(e.target.value);
    if (errors.email) {
      setErrors({});
    }
    if (success) {
      setSuccess(false);
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!email) {
      newErrors.email = "Email is required";
    } else if (!isValidEmail(email)) {
      newErrors.email = "Invalid email format";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      await requestPasswordReset({
        variables: { email },
      });
      setSuccess(true);
      setErrors({});
    } catch (error) {
      setErrors({
        submit:
          error.graphQLErrors?.[0]?.message ||
          error.message ||
          "Failed to send reset email",
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left side - Illustration */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-600 items-center justify-center p-12">
        <div className="max-w-md text-white">
          <div className="mb-8">
            <svg
              className="w-20 h-20 text-white/80 mb-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h2 className="text-4xl font-bold mb-6">Reset Made Easy</h2>
          <p className="text-lg text-blue-100 mb-8">
            We'll send you a secure reset code to your email. Check your inbox
            and follow the instructions to regain access to your account.
          </p>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <svg
                className="w-6 h-6 text-blue-200"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-blue-100">Quick and secure process</span>
            </div>
            <div className="flex items-center gap-3">
              <svg
                className="w-6 h-6 text-blue-200"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-blue-100">
                Code expires after 15 minutes
              </span>
            </div>
            <div className="flex items-center gap-3">
              <svg
                className="w-6 h-6 text-blue-200"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-blue-100">Your data stays protected</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center px-4 py-8 sm:px-6 lg:px-12 bg-white">
        <div className="max-w-md w-full">
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-2">
              Forgot Password
            </h1>
            <p className="text-sm sm:text-base text-gray-600">
              Enter your email to receive a password reset code
            </p>
          </div>

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-xs sm:text-sm">
              Password reset code has been sent to your email. Please check your
              inbox and use the code to reset your password.
            </div>
          )}

          {errors.submit && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs sm:text-sm">
              {errors.submit}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
            <div>
              <label
                htmlFor="email"
                className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2"
              >
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={email}
                onChange={handleChange}
                className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.email ? "border-red-500" : "border-gray-300"
                }`}
                placeholder="you@example.com"
              />
              {errors.email && (
                <p className="mt-1 text-xs sm:text-sm text-red-600">
                  {errors.email}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 sm:py-2.5 px-4 text-sm sm:text-base rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Sending..." : "Send Reset Code"}
            </button>
          </form>

          <div className="mt-6 text-center space-y-2">
            {success && (
              <Link
                to="/reset-password"
                className="block text-xs sm:text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Have a reset code? Reset password
              </Link>
            )}
            <Link
              to="/login"
              className="block text-xs sm:text-sm text-gray-600 hover:text-gray-800"
            >
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
