import { useState } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import { Link } from "react-router-dom";
import { GET_MY_NOTES } from "@/graphql/queries";
import { CREATE_NOTE, UPDATE_NOTE } from "@/graphql/mutations";
import { useAuth } from "@/contexts/AuthContext";
import NoteCard from "@/components/NoteCard";
import NoteForm from "@/components/NoteForm";
import NoteFilters from "@/components/NoteFilters";

export default function Notes() {
  const { user, logout } = useAuth();
  const [filters, setFilters] = useState({ isArchived: false });
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const limit = 20;

  const { data, loading, error, refetch } = useQuery(GET_MY_NOTES, {
    variables: {
      limit,
      offset: (page - 1) * limit,
      ...(searchQuery && { search: searchQuery }),
      ...(filters.type && { type: filters.type }),
      ...(filters.status && { status: filters.status }),
      ...(filters.isArchived !== undefined && {
        isArchived: filters.isArchived,
      }),
      ...(filters.isPinned !== undefined && { isPinned: filters.isPinned }),
      ...(filters.tags && filters.tags.length > 0 && { tags: filters.tags }),
      ...(filters.isUpcoming && { isUpcoming: filters.isUpcoming }),
      ...(filters.isOverdue && { isOverdue: filters.isOverdue }),
    },
  });

  const [createNote] = useMutation(CREATE_NOTE, {
    onCompleted: () => {
      setShowForm(false);
      refetch();
    },
  });

  const [updateNote] = useMutation(UPDATE_NOTE, {
    onCompleted: () => {
      setShowForm(false);
      setEditingNote(null);
      refetch();
    },
  });

  const handleCreateNote = async (input) => {
    try {
      await createNote({ variables: { input } });
    } catch (error) {
      alert("Failed to create note: " + error.message);
    }
  };

  const handleUpdateNote = async (input) => {
    try {
      await updateNote({
        variables: { id: editingNote.id, input },
      });
    } catch (error) {
      alert("Failed to update note: " + error.message);
    }
  };

  const handleEdit = (note) => {
    setEditingNote(note);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingNote(null);
  };

  const notes = data?.notes?.nodes || [];
  const pageInfo = data?.notes?.pageInfo;
  const totalPages = pageInfo?.totalPages || 1;
  const totalCount = data?.notes?.totalCount || 0;

  // Notes are already filtered server-side
  const filteredNotes = notes;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-800">📝 My Notes</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                Hello, {user?.fullName || user?.email || "User"}
              </span>
              <Link
                to="/profile"
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Profile
              </Link>
              <button
                onClick={logout}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Create */}
        <div className="mb-6 flex gap-4">
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors whitespace-nowrap"
          >
            {showForm ? "✖ Cancel" : "+ New Note"}
          </button>
        </div>

        {/* Note Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">
              {editingNote ? "Edit Note" : "Create New Note"}
            </h2>
            <NoteForm
              note={editingNote}
              onSubmit={editingNote ? handleUpdateNote : handleCreateNote}
              onCancel={handleCancel}
            />
          </div>
        )}

        {/* Filters */}
        <NoteFilters filters={filters} onChange={setFilters} />

        {/* Stats */}
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Showing {filteredNotes.length} of {totalCount} notes
          </p>
          {loading && <span className="text-sm text-blue-600">Loading...</span>}
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700">Error loading notes: {error.message}</p>
          </div>
        )}

        {/* Notes Grid */}
        {filteredNotes.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg mb-4">
              {searchQuery
                ? "No notes found matching your search"
                : "No notes yet"}
            </p>
            {!showForm && !searchQuery && (
              <button
                onClick={() => setShowForm(true)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create your first note
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {filteredNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onEdit={() => handleEdit(note)}
                onRefetch={refetch}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && !searchQuery && (
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              ← Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
