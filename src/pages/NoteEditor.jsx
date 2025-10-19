import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useMutation, useQuery } from "@apollo/client/react";
import { CREATE_NOTE, UPDATE_NOTE } from "@/graphql/mutations";
import { GET_MY_NOTES } from "@/graphql/queries";
import NoteForm from "@/components/NoteForm";

export default function NoteEditor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const editingNote = location.state?.note;

  const [createNote, { loading: creating }] = useMutation(CREATE_NOTE, {
    onCompleted: () => {
      navigate("/notes");
    },
    refetchQueries: [{ query: GET_MY_NOTES }],
  });

  const [updateNote, { loading: updating }] = useMutation(UPDATE_NOTE, {
    onCompleted: () => {
      navigate("/notes");
    },
    refetchQueries: [{ query: GET_MY_NOTES }],
  });

  const handleSubmit = async (input) => {
    try {
      if (editingNote) {
        await updateNote({
          variables: { id: editingNote.id, input },
        });
      } else {
        await createNote({ variables: { input } });
      }
    } catch (error) {
      alert(
        `Failed to ${editingNote ? "update" : "create"} note: ${error.message}`
      );
    }
  };

  const handleCancel = () => {
    navigate("/notes");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/notes")}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Back to notes"
            >
              <svg
                className="w-6 h-6 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-gray-800">
              {editingNote ? "✏️ Edit Note" : "➕ Create New Note"}
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <NoteForm
            note={editingNote}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            loading={creating || updating}
          />
        </div>
      </main>
    </div>
  );
}
