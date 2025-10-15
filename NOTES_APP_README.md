# 📝 DPL Notes Application

A fully-featured note-taking application built with React, GraphQL, and Apollo Client.

## ✨ Features

### Authentication

- ✅ User registration with email validation
- ✅ Secure login with JWT tokens
- ✅ Automatic token refresh (tokens refresh every 14 minutes)
- ✅ Protected routes
- ✅ Password strength validation

### Notes Management

- ✅ Create, Read, Update, Delete (CRUD) notes
- ✅ Multiple note types: Note, Task, Todo, Reminder
- ✅ Priority levels: Low, Medium, High, Urgent
- ✅ Status tracking: Pending, In Progress, Completed, Cancelled
- ✅ Due dates with overdue indicators
- ✅ Tags support (up to 20 tags per note)
- ✅ Custom color coding
- ✅ Pin important notes
- ✅ Archive notes

### Advanced Features

- ✅ Real-time search
- ✅ Advanced filtering (type, status, priority, archived, pinned)
- ✅ Pagination (20 notes per page)
- ✅ Quick actions (complete task, pin, archive)
- ✅ Responsive design
- ✅ Beautiful UI with Tailwind CSS

## 🚀 Getting Started

### Prerequisites

- Node.js 16+
- npm or yarn
- Backend API running on `http://localhost:3000/graphql`

### Installation

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Start the development server:**

   ```bash
   npm run dev
   ```

3. **Open your browser:**
   Navigate to `http://localhost:5175`

### Backend Setup

Make sure your GraphQL backend is running on `http://localhost:3000/graphql`.

If your backend is on a different URL, update it in:

```javascript
// src/lib/apolloClient.js
const httpLink = createHttpLink({
  uri: "YOUR_BACKEND_URL/graphql",
  credentials: "include",
});
```

## 📁 Project Structure

```
src/
├── components/          # Reusable components
│   ├── NoteCard.jsx    # Note display card with actions
│   ├── NoteForm.jsx    # Create/edit note form
│   ├── NoteFilters.jsx # Filter controls
│   ├── ProtectedRoute.jsx # Route protection
│   └── TestRunner.jsx  # Test component
├── contexts/           # React contexts
│   └── AuthContext.jsx # Authentication state management
├── graphql/           # GraphQL operations
│   ├── queries.js     # GraphQL queries
│   └── mutations.js   # GraphQL mutations
├── lib/               # Library configurations
│   └── apolloClient.js # Apollo Client setup
├── pages/             # Page components
│   ├── Login.jsx      # Login page
│   ├── Register.jsx   # Registration page
│   ├── Notes.jsx      # Main notes dashboard
│   └── Test.jsx       # Test page
├── routes/            # Route definitions
│   └── ClientRoute.jsx # Route configuration
├── utils/             # Utility functions
│   └── helpers.js     # Helper functions
├── App.jsx            # Main app component
└── main.jsx           # Entry point
```

## 🎯 Usage Guide

### Creating a Note

1. Click the **"+ New Note"** button
2. Fill in the form:
   - **Title** (required)
   - **Content** (required)
   - **Type**: Note, Task, Todo, or Reminder
   - **Priority**: Low, Medium, High, or Urgent
   - **Status**: Pending, In Progress, Completed, or Cancelled
   - **Due Date**: Optional
   - **Tags**: Comma-separated (e.g., "work, urgent, meeting")
   - **Color**: Optional custom color
3. Click **"Create Note"**

### Managing Notes

- **Edit**: Click the ✏️ icon
- **Delete**: Click the 🗑️ icon (confirms before deletion)
- **Pin**: Click the 📌 icon to pin/unpin
- **Archive**: Click the 📦 icon
- **Complete Task**: Click the **"✓ Complete"** button (for tasks/todos)

### Filtering Notes

Use the filter controls to:

- Filter by type (Note, Task, Todo, Reminder)
- Filter by status (Pending, In Progress, Completed, Cancelled)
- Filter by priority (Low, Medium, High, Urgent)
- View archived notes
- Show only pinned notes

### Searching

Use the search bar to find notes by title or content in real-time.

### Pagination

Navigate through pages using the **Previous** and **Next** buttons at the bottom.

## 🔐 Authentication Flow

1. **Register**: Create an account with email and password

   - Password must be at least 8 characters
   - Must contain 3 of: uppercase, lowercase, number, special character

2. **Login**: Sign in with your credentials

   - Receives an access token (valid for 15 minutes)
   - Refresh token stored in HttpOnly cookie (valid for 7 days)

3. **Auto Refresh**: Token automatically refreshes every 14 minutes

4. **Logout**: Clears tokens and redirects to login

## 🛠️ Technology Stack

- **React 19** - UI framework
- **Apollo Client** - GraphQL client
- **GraphQL** - API query language
- **React Router** - Routing
- **Tailwind CSS** - Styling
- **date-fns** - Date formatting
- **Vite** - Build tool

## 📝 GraphQL Schema

The application uses the following main types:

### Note Type

```graphql
type Note {
  id: Int!
  title: String!
  content: String!
  type: NoteType!
  status: NoteStatus!
  priority: NotePriority!
  dueDate: DateTime
  completedAt: DateTime
  tags: [String!]
  color: String
  isPinned: Boolean!
  isArchived: Boolean!
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

### Enums

- **NoteType**: NOTE, TASK, TODO, REMINDER
- **NoteStatus**: PENDING, IN_PROGRESS, COMPLETED, CANCELLED
- **NotePriority**: LOW, MEDIUM, HIGH, URGENT

## 🐛 Troubleshooting

### Backend Connection Issues

- Ensure backend is running on `http://localhost:3000/graphql`
- Check CORS settings on backend
- Verify `credentials: 'include'` in Apollo Client config

### Authentication Issues

- Clear browser cookies and localStorage
- Check if tokens are being set correctly
- Verify backend JWT configuration

### Notes Not Displaying

- Check browser console for errors
- Verify GraphQL queries are correct
- Ensure user is authenticated

## 📚 Additional Resources

- [API Complete Guide](./guideline/API_COMPLETE_GUIDE.md)
- [Password Management Guide](./guideline/PASSWORD_MANAGEMENT_GUIDE.md)
- [Backend Documentation](./guideline/README.md)

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

## 📄 License

This project is part of the DPL course at FPT University.
