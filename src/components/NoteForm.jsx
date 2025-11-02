import { useState, useEffect } from "react";
import STTInput from "./STTInput";

// Function to generate default color based on type, priority, and status
const getDefaultColor = (type, priority, status) => {
  // Base color by type
  let color = "";

  if (type === "NOTE") {
    color = "#3B82F6"; // Blue
  } else if (type === "TASK") {
    color = "#10B981"; // Green
  } else if (type === "TODO") {
    color = "#FBBF24"; // Amber
  } else if (type === "REMINDER") {
    color = "#A855F7"; // Purple
  } else {
    color = "#3B82F6"; // Default blue
  }

  // Adjust for priority
  if (priority === "URGENT") {
    if (type === "NOTE") color = "#2563EB"; // Darker blue
    else if (type === "TASK") color = "#059669"; // Darker green
    else if (type === "TODO") color = "#F59E0B"; // Darker amber
    else if (type === "REMINDER") color = "#9333EA"; // Darker purple
  } else if (priority === "HIGH") {
    if (type === "NOTE") color = "#3B82F6"; // Blue (default)
    else if (type === "TASK") color = "#10B981"; // Green (default)
    else if (type === "TODO") color = "#FBBF24"; // Amber (default)
    else if (type === "REMINDER") color = "#A855F7"; // Purple (default)
  } else if (priority === "MEDIUM") {
    if (type === "NOTE") color = "#60A5FA"; // Light blue
    else if (type === "TASK") color = "#34D399"; // Light green
    else if (type === "TODO") color = "#FCD34D"; // Light amber
    else if (type === "REMINDER") color = "#C084FC"; // Light purple
  } else if (priority === "LOW") {
    if (type === "NOTE") color = "#93C5FD"; // Lighter blue
    else if (type === "TASK") color = "#6EE7B7"; // Lighter green
    else if (type === "TODO") color = "#FDE68A"; // Lighter amber
    else if (type === "REMINDER") color = "#D8B4FE"; // Lighter purple
  }

  // Adjust for status (completed/cancelled get muted)
  if (status === "COMPLETED") {
    if (type === "NOTE") color = "#9CA3AF"; // Gray blue
    else if (type === "TASK") color = "#A7F3D0"; // Pale green
    else if (type === "TODO") color = "#FEF3C7"; // Pale amber
    else if (type === "REMINDER") color = "#E9D5FF"; // Pale purple
  } else if (status === "CANCELLED") {
    color = "#6B7280"; // Gray for all cancelled
  }

  return color;
};

export default function NoteForm({ note, onSubmit, onCancel, loading }) {
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    type: "NOTE",
    priority: "MEDIUM",
    status: "PENDING",
    dueDate: "",
    tags: "",
    color: "",
  });
  const [isColorManuallySet, setIsColorManuallySet] = useState(false);

  useEffect(() => {
    if (note) {
      setFormData({
        title: note.title || "",
        content: note.content || "",
        type: note.type || "NOTE",
        priority: note.priority || "MEDIUM",
        status: note.status || "PENDING",
        dueDate: note.dueDate ? note.dueDate.split("T")[0] : "",
        tags: note.tags ? note.tags.join(", ") : "",
        color:
          note.color ||
          getDefaultColor(
            note.type || "NOTE",
            note.priority || "MEDIUM",
            note.status || "PENDING"
          ),
      });
      setIsColorManuallySet(!!note.color);
    } else {
      // Set initial default color for new notes
      setFormData((prev) => ({
        ...prev,
        color: getDefaultColor(prev.type, prev.priority, prev.status),
      }));
    }
  }, [note]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "color") {
      setIsColorManuallySet(true);
    }

    setFormData((prev) => {
      const newData = { ...prev, [name]: value };

      // Auto-update color when type, priority, or status changes (unless manually set)
      if (
        !isColorManuallySet &&
        (name === "type" || name === "priority" || name === "status")
      ) {
        newData.color = getDefaultColor(
          name === "type" ? value : prev.type,
          name === "priority" ? value : prev.priority,
          name === "status" ? value : prev.status
        );
      }

      return newData;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const input = {
      title: formData.title,
      content: formData.content,
      type: formData.type,
      priority: formData.priority,
      status: formData.status,
      dueDate: formData.dueDate
        ? new Date(formData.dueDate).toISOString()
        : null,
      tags: formData.tags
        ? formData.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        : [],
      color: formData.color || null,
    };

    onSubmit(input);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Title *
        </label>
        <input
          type="text"
          name="title"
          value={formData.title}
          onChange={handleChange}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter note title"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Content * 🎤
        </label>
        <STTInput
          value={formData.content}
          onChange={handleChange}
          placeholder="Type or use microphone to record your note..."
          rows={6}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type
          </label>
          <select
            name="type"
            value={formData.type}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="NOTE">Note</option>
            <option value="TASK">Task</option>
            <option value="TODO">Todo</option>
            <option value="REMINDER">Reminder</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Priority
          </label>
          <select
            name="priority"
            value={formData.priority}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="PENDING">Pending</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Due Date
          </label>
          <input
            type="date"
            name="dueDate"
            value={formData.dueDate}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tags (comma separated)
        </label>
        <input
          type="text"
          name="tags"
          value={formData.tags}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="work, personal, urgent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Color{" "}
          {!isColorManuallySet && (
            <span className="text-xs text-gray-500">(auto-generated)</span>
          )}
        </label>
        <div className="flex gap-2 items-center">
          <input
            type="color"
            name="color"
            value={formData.color}
            onChange={handleChange}
            className="w-20 h-10 border border-gray-300 rounded-lg cursor-pointer"
          />
          <div
            className="flex-1 h-10 rounded-lg border border-gray-300"
            style={{ backgroundColor: formData.color }}
          />
          {isColorManuallySet && (
            <button
              type="button"
              onClick={() => {
                setIsColorManuallySet(false);
                setFormData((prev) => ({
                  ...prev,
                  color: getDefaultColor(prev.type, prev.priority, prev.status),
                }));
              }}
              className="px-3 py-2 text-sm text-blue-600 hover:text-blue-800 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
            >
              Reset
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Color automatically adjusts based on type, priority, and status
        </p>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Saving..." : note ? "Update Note" : "Create Note"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
