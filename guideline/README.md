# 📚 DPL Notes Application - Documentation Hub

**Complete Guide to DPL Notes Application (Frontend + Backend)**

---

## 📖 Documentation Files

This folder contains **2 comprehensive guides** that cover everything you need:

| Document                                                     | Description                                                            | Target Audience              |
| ------------------------------------------------------------ | ---------------------------------------------------------------------- | ---------------------------- |
| 📘 [**API Complete Guide**](./API_COMPLETE_GUIDE.md)         | **All-in-one reference** - Auth, Notes, Pagination, Validation, Errors | **Everyone - Start here!**   |
| 📙 [**Password Management**](./PASSWORD_MANAGEMENT_GUIDE.md) | Change/reset password flows with OTP                                   | Developers implementing auth |

---

## 🎉 New Features (Latest Update)

### 🔑 Password Management

- ✅ **Forgot Password** (`/forgot-password`) - Request password reset via email OTP
- ✅ **Reset Password** (`/reset-password`) - Reset password using OTP code
- ✅ **Change Password** (`/change-password`) - Change password when logged in

### 👤 Profile Management

- ✅ **User Profile** (`/profile`) - View and edit full profile
  - Full Name, Phone, Location, Bio, Avatar
  - Avatar preview with URL validation
  - View user role and account dates
- ✅ **Profile Navigation** - Quick access from Notes page header

### 🔒 Security Features

- ✅ **Logout From All Devices** (`/logout-all`) - Logout from all active sessions with OTP verification
- ✅ **Session Management** - Secure token-based authentication with auto-refresh

---

## 🚀 Quick Start

### **New to the API?**

**Just read this:** [**API Complete Guide**](./API_COMPLETE_GUIDE.md)

It includes:

- ✅ Authentication (register, login, refresh)
- ✅ Notes CRUD (create, read, update, delete)
- ✅ Pagination (offset & cursor-based)
- ✅ Validation rules (constraints & errors)
- ✅ Error handling & best practices
- ✅ Quick reference & troubleshooting

### **Need Password Reset?**

Read: [**Password Management Guide**](./PASSWORD_MANAGEMENT_GUIDE.md)

### **Implementing New Features?**

For the latest frontend features (Forgot Password, Profile Management), see the [Feature Implementation](#-feature-implementation-guide) section below.

---

## 🎯 Quick Reference

### **Frontend Routes**

| Route              | Access    | Description                                 |
| ------------------ | --------- | ------------------------------------------- |
| `/login`           | Public    | User login                                  |
| `/register`        | Public    | User registration                           |
| `/forgot-password` | Public    | Request password reset OTP                  |
| `/reset-password`  | Public    | Reset password with OTP                     |
| `/notes`           | Protected | Main notes page                             |
| `/profile`         | Protected | View/edit user profile                      |
| `/change-password` | Protected | Change password (requires current password) |

### **Common Tasks**

| I want to...          | Section in API Complete Guide                                                |
| --------------------- | ---------------------------------------------------------------------------- |
| Set up authentication | [Authentication](./API_COMPLETE_GUIDE.md#-authentication)                    |
| Create/update notes   | [Notes Feature](./API_COMPLETE_GUIDE.md#-notes-feature)                      |
| Add pagination        | [Pagination & Performance](./API_COMPLETE_GUIDE.md#-pagination--performance) |
| Fix validation errors | [Validation Rules](./API_COMPLETE_GUIDE.md#-validation-rules)                |
| Handle errors         | [Error Handling](./API_COMPLETE_GUIDE.md#️-error-handling)                   |
| Optimize performance  | [Best Practices](./API_COMPLETE_GUIDE.md#-best-practices)                    |
| Reset password        | [Password Management Guide](./PASSWORD_MANAGEMENT_GUIDE.md)                  |

---

## 📊 Feature Matrix

| Feature                | Supported | Where to Find                                                                      |
| ---------------------- | --------- | ---------------------------------------------------------------------------------- |
| User Registration      | ✅        | [API Guide - Auth](./API_COMPLETE_GUIDE.md#registration)                           |
| JWT Authentication     | ✅        | [API Guide - Auth](./API_COMPLETE_GUIDE.md#login)                                  |
| Refresh Tokens         | ✅        | [API Guide - Auth](./API_COMPLETE_GUIDE.md#refresh-token)                          |
| **Forgot Password**    | ✅        | [Password Guide](./PASSWORD_MANAGEMENT_GUIDE.md#forgot-password)                   |
| **Reset Password**     | ✅        | [Password Guide](./PASSWORD_MANAGEMENT_GUIDE.md#reset-password)                    |
| **Change Password**    | ✅        | [Password Guide](./PASSWORD_MANAGEMENT_GUIDE.md#change-password)                   |
| **Profile Management** | ✅        | Frontend feature - Edit Full Name, Bio, Avatar                                     |
| CRUD Notes             | ✅        | [API Guide - Notes](./API_COMPLETE_GUIDE.md#-notes-feature)                        |
| Archive/Pin/Complete   | ✅        | [API Guide - Quick Actions](./API_COMPLETE_GUIDE.md#quick-actions)                 |
| Search & Filter        | ✅        | [API Guide - Notes](./API_COMPLETE_GUIDE.md#get-my-notes-with-pagination--filters) |
| Pagination (Offset)    | ✅        | [API Guide - Pagination](./API_COMPLETE_GUIDE.md#1-offset-based-numbered-pages)    |
| Pagination (Cursor)    | ✅        | [API Guide - Pagination](./API_COMPLETE_GUIDE.md#2-cursor-based-infinite-scroll)   |
| Input Validation       | ✅        | [API Guide - Validation](./API_COMPLETE_GUIDE.md#-validation-rules)                |
| Upcoming/Overdue       | ✅        | [API Guide - Special Queries](./API_COMPLETE_GUIDE.md#special-queries)             |

---

## 🛠️ Feature Implementation Guide

### Password Management Features

#### 1. Forgot Password Flow

```
User clicks "Forgot password?" → Enters email →
Receives OTP via email → Proceeds to reset password
```

**Files:**

- `src/pages/ForgotPassword.jsx` - Request OTP page
- `src/graphql/mutations.js` - `REQUEST_PASSWORD_RESET` mutation

**Key Features:**

- Email validation
- Success message with OTP sent confirmation
- Link to reset password page

#### 2. Reset Password Flow

```
User enters email + OTP + new password →
Password validated → Password reset →
Redirect to login
```

**Files:**

- `src/pages/ResetPassword.jsx` - Reset password with OTP
- `src/graphql/mutations.js` - `RESET_PASSWORD` mutation

**Key Features:**

- OTP verification
- Password strength validation
- Show/hide password toggles
- Confirmation password matching

#### 3. Change Password Flow (Authenticated)

```
User navigates to Profile → Change Password →
Enters current + new password →
Password updated → Auto logout → Login again
```

**Files:**

- `src/pages/ChangePassword.jsx` - Change password page
- `src/contexts/AuthContext.jsx` - `changePassword()` function
- `src/graphql/mutations.js` - `CHANGE_PASSWORD` mutation

**Key Features:**

- Current password verification
- Validates new password differs from old
- Password strength validation
- Auto logout after successful change

### Profile Management Feature

#### User Profile Page

```
User clicks "Profile" button → View/Edit profile →
Update Full Name, Bio, Avatar → Save changes
```

**Files:**

- `src/pages/Profile.jsx` - Profile management page
- `src/contexts/AuthContext.jsx` - `updateProfile()` function
- `src/graphql/mutations.js` - `UPDATE_PROFILE` mutation
- `src/pages/Notes.jsx` - Profile button in header

**Key Features:**

- Edit Full Name, Bio (500 chars max), Avatar URL
- Avatar preview (if valid URL)
- Read-only email display
- Character counter for bio
- Account creation date
- Quick links to Change Password and Logout

### Security & Validation

**Password Requirements:**

- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character

**Validation Helper:**

```javascript
// From src/utils/helpers.js
validatePassword(password); // Returns { isValid, errors }
```

### Implementation Notes

1. **Protected Routes:** Change Password and Profile require authentication
2. **Public Routes:** Forgot Password and Reset Password are public
3. **Auto Logout:** Password change triggers automatic logout for security
4. **Token Refresh:** Existing token refresh mechanism handles auth state
5. **Error Handling:** All mutations include proper error handling
6. **UI Consistency:** All pages follow existing design patterns

---

## 💡 Documentation Philosophy

**We consolidated from 8 files to 2 comprehensive guides!**

✅ **Before:** Scattered info across FRONTEND_API_GUIDE, NOTES_FEATURE_GUIDE, PAGINATION_GUIDE, VALIDATION_GUIDE, etc.  
✅ **Now:** One complete reference with everything organized by topic

**Benefits:**

- 🎯 Single source of truth
- 🔍 Easy to search (Ctrl+F)
- 📱 Better mobile reading
- 🚀 Faster onboarding

---

## 🆘 Common Issues

| Problem                     | Solution                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| Can't authenticate?         | Check [Using Access Tokens](./API_COMPLETE_GUIDE.md#using-access-tokens)                    |
| Pagination not working?     | Verify you access `.nodes` array - [Pagination](./API_COMPLETE_GUIDE.md#response-structure) |
| Validation errors?          | Review [Validation Rules](./API_COMPLETE_GUIDE.md#-validation-rules)                        |
| Password reset not working? | Check console for OTP - [Password Guide](./PASSWORD_MANAGEMENT_GUIDE.md)                    |
| Profile not updating?       | Ensure you're passing valid data - Check network tab for errors                             |
| Avatar not showing?         | Verify URL is a direct image link and accessible                                            |
| OTP expired?                | Request a new OTP from forgot password page                                                 |

---

## 🚀 Getting Started

### For Developers

1. **Setup:** Follow main [README.md](../README.md) for installation
2. **API Reference:** Start with [API Complete Guide](./API_COMPLETE_GUIDE.md)
3. **Password Features:** Read [Password Management Guide](./PASSWORD_MANAGEMENT_GUIDE.md)
4. **Frontend Features:** Review [Feature Implementation](#-feature-implementation-guide) above

### For Users

1. **Registration:** Create account at `/register`
2. **Login:** Access app at `/login`
3. **Profile:** Update your profile at `/profile`
4. **Notes:** Manage notes at `/notes`
5. **Forgot Password:** Use `/forgot-password` if you forget password

---

## 🔧 Tools & Resources

- **GraphQL Playground:** `http://localhost:3000/graphql`
- **Schema:** Auto-generated in `schema.gql`
- **Architecture:** See `Architecture_pattern_guide.md` in root folder
- **Project Workflow:** See `Project-WorkFlow.md` in root folder

---

**Last Updated:** October 15, 2025

**Happy Coding! 🚀**
