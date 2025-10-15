import { useMutation } from "@apollo/client/react";
import {
  DELETE_NOTE,
  PIN_NOTE,
  UNPIN_NOTE,
  ARCHIVE_NOTE,
  COMPLETE_TASK,
  UNCOMPLETE_TASK,
} from "@/graphql/mutations";
import {
  formatRelativeTime,
  getPriorityColor,
  getStatusColor,
  getTypeIcon,
  isOverdue,
} from "@/utils/helpers";

export default function NoteCard({ note, onEdit, onRefetch }) {
  const [deleteNote] = useMutation(DELETE_NOTE);
  const [pinNote] = useMutation(PIN_NOTE);
  const [unpinNote] = useMutation(UNPIN_NOTE);
  const [archiveNote] = useMutation(ARCHIVE_NOTE);
  const [completeTask] = useMutation(COMPLETE_TASK);
  const [uncompleteTask] = useMutation(UNCOMPLETE_TASK);

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this note?")) return;

    try {
      await deleteNote({ variables: { id: note.id } });
      onRefetch();
    } catch (error) {
      alert("Failed to delete note");
    }
  };

  const handleTogglePin = async () => {
    try {
      if (note.isPinned) {
        await unpinNote({ variables: { id: note.id } });
      } else {
        await pinNote({ variables: { id: note.id } });
      }
      onRefetch();
    } catch (error) {
      alert("Failed to toggle pin");
    }
  };

  const handleArchive = async () => {
    try {
      await archiveNote({ variables: { id: note.id } });
      onRefetch();
    } catch (error) {
      alert("Failed to archive note");
    }
  };

  const handleToggleComplete = async () => {
    try {
      if (note.status === "COMPLETED") {
        await uncompleteTask({ variables: { id: note.id } });
      } else {
        await completeTask({ variables: { id: note.id } });
      }
      onRefetch();
    } catch (error) {
      alert("Failed to toggle completion");
    }
  };

  const isTaskType = note.type === "TASK" || note.type === "TODO";
  const overdueTask =
    isTaskType &&
    note.dueDate &&
    isOverdue(note.dueDate) &&
    note.status !== "COMPLETED";

  return (
    <div
      className={`bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow border-l-4 ${
        note.isPinned ? "border-yellow-400" : "border-blue-400"
      } ${note.color ? `bg-opacity-50` : ""}`}
      style={note.color ? { backgroundColor: note.color + "20" } : {}}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-2xl">{getTypeIcon(note.type)}</span>
          <h3
            className={`font-semibold text-lg ${
              note.status === "COMPLETED" ? "line-through text-gray-500" : ""
            }`}
          >
            {note.title}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleTogglePin}
            className={`p-1 rounded hover:bg-gray-100 ${
              note.isPinned ? "text-yellow-500" : "text-gray-400"
            }`}
            title={note.isPinned ? "Unpin" : "Pin"}
          >
            📌
          </button>
          <button
            onClick={onEdit}
            className="p-1 rounded hover:bg-gray-100 text-gray-600"
            title="Edit"
          >
            ✏️
          </button>
          <button
            onClick={handleArchive}
            className="p-1 rounded hover:bg-gray-100 text-gray-600"
            title="Archive"
          >
            📦
          </button>
          <button
            onClick={handleDelete}
            className="p-1 rounded hover:bg-gray-100 text-red-600"
            title="Delete"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Content */}
      <p
        className={`text-gray-700 mb-3 ${
          note.status === "COMPLETED" ? "line-through text-gray-500" : ""
        }`}
      >
        {note.content}
      </p>

      {/* Metadata */}
      <div className="flex flex-wrap gap-2 mb-3">
        <span
          className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(
            note.status
          )}`}
        >
          {note.status}
        </span>
        <span
          className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(
            note.priority
          )}`}
        >
          {note.priority}
        </span>
      </div>

      {/* Tags */}
      {note.tags && note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {note.tags.map((tag, index) => (
            <span
              key={index}
              className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Due Date */}
      {note.dueDate && (
        <div
          className={`text-sm mb-2 ${
            overdueTask ? "text-red-600 font-semibold" : "text-gray-600"
          }`}
        >
          📅 Due: {formatRelativeTime(note.dueDate)}
          {overdueTask && " (Overdue!)"}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-200">
        <span className="text-xs text-gray-500">
          {formatRelativeTime(note.createdAt)}
        </span>

        {isTaskType && (
          <button
            onClick={handleToggleComplete}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              note.status === "COMPLETED"
                ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                : "bg-green-500 text-white hover:bg-green-600"
            }`}
          >
            {note.status === "COMPLETED" ? "↩️ Reopen" : "✓ Complete"}
          </button>
        )}
      </div>
    </div>
  );
}
