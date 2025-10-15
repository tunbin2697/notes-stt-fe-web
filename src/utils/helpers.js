import {
  format,
  formatDistanceToNow,
  parseISO,
  isPast,
  isFuture,
} from "date-fns";

// Format date to readable string
export const formatDate = (dateString) => {
  if (!dateString) return "";
  try {
    return format(parseISO(dateString), "MMM dd, yyyy");
  } catch {
    return "";
  }
};

// Format datetime to readable string
export const formatDateTime = (dateString) => {
  if (!dateString) return "";
  try {
    return format(parseISO(dateString), "MMM dd, yyyy HH:mm");
  } catch {
    return "";
  }
};

// Format relative time (e.g., "2 hours ago")
export const formatRelativeTime = (dateString) => {
  if (!dateString) return "";
  try {
    return formatDistanceToNow(parseISO(dateString), { addSuffix: true });
  } catch {
    return "";
  }
};

// Check if date is in the past
export const isOverdue = (dateString) => {
  if (!dateString) return false;
  try {
    return isPast(parseISO(dateString));
  } catch {
    return false;
  }
};

// Check if date is in the future
export const isUpcoming = (dateString) => {
  if (!dateString) return false;
  try {
    return isFuture(parseISO(dateString));
  } catch {
    return false;
  }
};

// Validate email format
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate password strength (as per API requirements)
export const validatePassword = (password) => {
  if (password.length < 8) {
    return "Password must be at least 8 characters";
  }

  let strength = 0;
  if (/[a-z]/.test(password)) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^a-zA-Z0-9]/.test(password)) strength++;

  if (strength < 3) {
    return "Password must contain at least 3 of: uppercase, lowercase, number, special character";
  }

  return null;
};

// Get priority color
export const getPriorityColor = (priority) => {
  const colors = {
    LOW: "bg-gray-100 text-gray-700",
    MEDIUM: "bg-blue-100 text-blue-700",
    HIGH: "bg-orange-100 text-orange-700",
    URGENT: "bg-red-100 text-red-700",
  };
  return colors[priority] || colors.MEDIUM;
};

// Get status color
export const getStatusColor = (status) => {
  const colors = {
    PENDING: "bg-yellow-100 text-yellow-700",
    IN_PROGRESS: "bg-blue-100 text-blue-700",
    COMPLETED: "bg-green-100 text-green-700",
    CANCELLED: "bg-gray-100 text-gray-700",
  };
  return colors[status] || colors.PENDING;
};

// Get type icon
export const getTypeIcon = (type) => {
  const icons = {
    NOTE: "📝",
    TASK: "✓",
    TODO: "☐",
    REMINDER: "🔔",
  };
  return icons[type] || icons.NOTE;
};

// Truncate text
export const truncateText = (text, maxLength = 100) => {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
};

// Handle GraphQL errors
export const getErrorMessage = (error) => {
  if (error.graphQLErrors?.length > 0) {
    return error.graphQLErrors[0].message;
  }
  if (error.networkError) {
    return "Network error. Please check your connection.";
  }
  return error.message || "An unexpected error occurred";
};
