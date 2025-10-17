# Notes Application - Frontend

A modern, feature-rich notes application built with React, GraphQL, and Speech-to-Text capabilities.

## ✨ Features

### 🔐 Authentication & Security

- User registration and login
- JWT token-based authentication with auto-refresh
- **Forgot Password** - Request password reset via email OTP
- **Reset Password** - Reset password using OTP code
- **Change Password** - Change password when logged in (requires current password)
- Protected routes for authenticated features

### 👤 User Profile Management

- **Profile Page** - View and edit user information
- Update Full Name, Bio (500 characters max), and Avatar URL
- Avatar preview with direct image link support
- View account creation date
- Quick access to Change Password and Logout

### 📝 Notes Management

- Create, read, update, and delete notes
- Multiple note types: NOTE, TASK, TODO, REMINDER
- Note status: PENDING, IN_PROGRESS, COMPLETED, CANCELLED
- Priority levels: LOW, MEDIUM, HIGH, URGENT
- Rich features:
  - Pin important notes
  - Archive old notes
  - Tag notes for organization
  - Color coding
  - Due dates for tasks
  - Search and filter capabilities

### 🎤 Speech-to-Text

- Real-time voice-to-text conversion
- Microphone integration
- Audio processing with Sherpa ONNX

## 🚀 Quick Start

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

## 📱 Application Routes

| Route              | Access    | Description                |
| ------------------ | --------- | -------------------------- |
| `/login`           | Public    | User login                 |
| `/register`        | Public    | User registration          |
| `/forgot-password` | Public    | Request password reset OTP |
| `/reset-password`  | Public    | Reset password with OTP    |
| `/notes`           | Protected | Main notes page            |
| `/profile`         | Protected | View/edit user profile     |
| `/change-password` | Protected | Change password            |
| `/test`            | Public    | Testing/development page   |

## 📚 Documentation

All comprehensive documentation is located in the `guideline/` folder:

- **[Main Guide](./guideline/README.md)** - Start here! Complete overview and quick reference
- **[API Complete Guide](./guideline/API_COMPLETE_GUIDE.md)** - Full API reference
- **[Password Management Guide](./guideline/PASSWORD_MANAGEMENT_GUIDE.md)** - Password features implementation

## 🛠️ Tech Stack

- **React** - UI framework
- **Apollo Client** - GraphQL client
- **React Router** - Navigation
- **Vite** - Build tool
- **Sherpa ONNX** - Speech-to-Text engine

## 📁 Project Structure

```
src/
├── pages/          # Page components
│   ├── Login.jsx
│   ├── Register.jsx
│   ├── ForgotPassword.jsx
│   ├── ResetPassword.jsx
│   ├── ChangePassword.jsx
│   ├── Profile.jsx
│   └── Notes.jsx
├── components/     # Reusable components
├── contexts/       # React contexts (Auth, etc.)
├── graphql/        # GraphQL queries and mutations
├── services/       # External services (STT, Audio)
├── utils/          # Utility functions
└── lib/           # Third-party library configs
```

## 🔑 Environment Variables

Create a `.env` file in the root directory:

```env
VITE_GRAPHQL_URI=your_graphql_endpoint
```

---

# GitHub Workflow Guide for Small Team Projects

## Branching Strategy

- **Main branch (`main`) is the primary branch.**
- For every change:
  - Create a new feature branch from `main` **before** making changes.
  - Alternatively, make changes locally, then create a branch **before** staging (`git add`) and committing.

## Workflow Steps

1. **Create a Feature Branch**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/your-feature-name
   ```
2. **Make Changes**

   - Edit files as needed.

3. **Stage and Commit**

   ```bash
   git add .
   git commit -m "Describe your changes"
   ```

4. **Sync with Main**

   - Pull the latest changes from `main`:
     ```bash
     git checkout main
     git pull origin main
     git checkout feature/your-feature-name
     git merge main
     ```
   - **Resolve any conflicts locally.**
   - Commit resolved conflicts if necessary.

5. **Push Feature Branch**

   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request**

   - Go to GitHub and open a pull request from your feature branch to `main`.

7. **Code Review & Merge**

   - Wait for the team leader to review and merge the pull request into `main`.

8. **Clean Up (Optional)**
   - After merging, delete the stale feature branch:
     - On GitHub: Use the "Delete branch" button.
     - Locally:
       ```bash
       git branch -d feature/your-feature-name
       git push origin --delete feature/your-feature-name
       ```

## Tips

- Always keep your feature branch up-to-date with `main` before merging.
- Communicate with your team about ongoing work to avoid conflicts.
- Use descriptive branch names and commit messages.
