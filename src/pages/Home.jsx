import { useState, useEffect } from "react";
import TestRunner from "@/components/TestRunner";

function Home() {
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Load notes from localStorage on component mount
  useEffect(() => {
    const savedNotes = localStorage.getItem("notes");
    if (savedNotes) {
      setNotes(JSON.parse(savedNotes));
    }
  }, []);

  // Save notes to localStorage whenever notes change
  useEffect(() => {
    localStorage.setItem("notes", JSON.stringify(notes));
  }, [notes]);

  // Add a new note
  const addNote = () => {
    if (newNote.trim() !== "") {
      const note = {
        id: Date.now(),
        text: newNote.trim(),
        createdAt: new Date().toLocaleString(),
      };
      setNotes([note, ...notes]);
      setNewNote("");
    }
  };

  // Delete a note
  const deleteNote = (id) => {
    setNotes(notes.filter((note) => note.id !== id));
  };

  // Start editing a note
  const startEdit = (id, text) => {
    setEditingId(id);
    setEditingText(text);
  };

  // Save edited note
  const saveEdit = () => {
    if (editingText.trim() !== "") {
      setNotes(
        notes.map((note) =>
          note.id === editingId
            ? {
                ...note,
                text: editingText.trim(),
                updatedAt: new Date().toLocaleString(),
              }
            : note
        )
      );
    }
    setEditingId(null);
    setEditingText("");
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingId(null);
    setEditingText("");
  };

  // Filter notes based on search term
  const filteredNotes = notes.filter((note) =>
    note.text.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">My Notes</h1>
          <p className="text-gray-600">Keep track of your thoughts and ideas</p>
        </div>

        {/* Add Note Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Write your note here..."
              className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows="3"
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.ctrlKey) {
                  addNote();
                }
              }}
            />
            <button
              onClick={addNote}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium self-start"
            >
              Add Note
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Press Ctrl + Enter to quickly add a note
          </p>
        </div>

        {/* Search Section */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search notes..."
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Notes Stats */}
        <div className="flex justify-between items-center mb-6">
          <p className="text-gray-600">
            {filteredNotes.length} of {notes.length} notes
            {searchTerm && ` matching "${searchTerm}"`}
          </p>
          {notes.length > 0 && (
            <button
              onClick={() => {
                if (
                  window.confirm("Are you sure you want to delete all notes?")
                ) {
                  setNotes([]);
                }
              }}
              className="text-red-500 hover:text-red-700 text-sm font-medium"
            >
              Clear All Notes
            </button>
          )}
        </div>

        {/* Notes List */}
        <TestRunner />

        <div className="space-y-4">
          {filteredNotes.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📝</div>
              <h3 className="text-xl font-medium text-gray-600 mb-2">
                {notes.length === 0
                  ? "No notes yet"
                  : "No notes match your search"}
              </h3>
              <p className="text-gray-500">
                {notes.length === 0
                  ? "Start by adding your first note above"
                  : "Try searching for something else"}
              </p>
            </div>
          ) : (
            filteredNotes.map((note) => (
              <div key={note.id} className="bg-white rounded-lg shadow-md p-6">
                {editingId === note.id ? (
                  <div className="space-y-4">
                    <textarea
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      rows="4"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={saveEdit}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-gray-800 mb-3 whitespace-pre-wrap leading-relaxed">
                      {note.text}
                    </p>
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-gray-500">
                        <span>Created: {note.createdAt}</span>
                        {note.updatedAt && (
                          <span className="ml-4">
                            Updated: {note.updatedAt}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(note.id, note.text)}
                          className="px-3 py-1 text-blue-500 hover:text-blue-700 text-sm font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            if (
                              window.confirm(
                                "Are you sure you want to delete this note?"
                              )
                            ) {
                              deleteNote(note.id);
                            }
                          }}
                          className="px-3 py-1 text-red-500 hover:text-red-700 text-sm font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default Home;
