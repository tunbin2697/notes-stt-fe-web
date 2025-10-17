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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Forgot Password
          </h1>
          <p className="text-gray-600">
            Enter your email to receive a password reset code
          </p>
        </div>

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            Password reset code has been sent to your email. Please check your
            inbox and use the code to reset your password.
          </div>
        )}

        {errors.submit && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {errors.submit}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={handleChange}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.email ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="you@example.com"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Sending..." : "Send Reset Code"}
          </button>
        </form>

        <div className="mt-6 text-center space-y-2">
          {success && (
            <Link
              to="/reset-password"
              className="block text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Have a reset code? Reset password
            </Link>
          )}
          <Link
            to="/login"
            className="block text-sm text-gray-600 hover:text-gray-800"
          >
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
