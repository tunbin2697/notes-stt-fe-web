# 📚 Complete API Documentation

**DPL Notes Backend - GraphQL API Reference**

Welcome! This is your complete guide to integrating with the DPL Notes Backend API.

---

## 📖 Table of Contents

1. [Getting Started](#getting-started)
2. [Authentication](#authentication)
3. [Notes Feature](#notes-feature)
4. [Pagination & Performance](#pagination--performance)
5. [Validation Rules](#validation-rules)
6. [Password Management](#password-management)
7. [Error Handling](#error-handling)
8. [Best Practices](#best-practices)

---

## 🚀 Getting Started

### **Quick Setup**

1. **API Endpoint:** `http://localhost:3000/graphql`
2. **GraphQL Playground:** Available in development mode
3. **Authentication:** JWT tokens with HttpOnly refresh cookies
4. **CORS:** Enabled with credentials support

### **First Steps**

```graphql
# 1. Register an account
mutation {
  register(email: "user@example.com", password: "SecurePass123!")
}

# 2. Login to get access token
mutation {
  login(email: "user@example.com", password: "SecurePass123!") {
    accessToken
  }
}

# 3. Use token in subsequent requests
# Add header: Authorization: Bearer <accessToken>

# 4. Create your first note
mutation {
  createNote(input: { title: "My First Note", content: "Hello World!" }) {
    id
    title
    createdAt
  }
}
```

---

## 🔐 Authentication

### **Registration**

```graphql
mutation Register {
  register(email: "user@example.com", password: "SecurePass123!")
}
```

**Password Requirements:**

- Minimum 8 characters
- Must contain at least 3 of: uppercase, lowercase, number, special character
- Not in common password list

### **Login**

```graphql
mutation Login {
  login(email: "user@example.com", password: "SecurePass123!") {
    accessToken # Use this in Authorization header
  }
}
```

**Side Effects:**

- Sets `refreshToken` as HttpOnly cookie (automatic, handled by browser)

### **Using Access Tokens**

```javascript
// In your HTTP requests
fetch('http://localhost:3000/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`, // Add this!
  },
  credentials: 'include', // Important for cookies!
  body: JSON.stringify({ query, variables }),
});
```

### **Refresh Token**

```graphql
mutation Refresh {
  refresh {
    accessToken
  }
}
```

**When to refresh:**

- Access tokens expire in 15 minutes
- Refresh before expiry or on 401 error
- Refresh tokens valid for 7 days

### **Logout**

```graphql
mutation Logout {
  logout # Returns true, clears refresh token
}
```

---

## 📝 Notes Feature

### **Data Model**

**Note Fields:**

| Field         | Type     | Description                                | Required              |
| ------------- | -------- | ------------------------------------------ | --------------------- |
| `id`          | Int      | Unique identifier                          | Auto                  |
| `title`       | String   | Note title                                 | Yes                   |
| `content`     | String   | Note content                               | Yes                   |
| `type`        | Enum     | NOTE, TASK, TODO, REMINDER                 | No (default: NOTE)    |
| `status`      | Enum     | PENDING, IN_PROGRESS, COMPLETED, CANCELLED | No (default: PENDING) |
| `priority`    | Enum     | LOW, MEDIUM, HIGH, URGENT                  | No (default: MEDIUM)  |
| `dueDate`     | DateTime | Due date for tasks                         | No                    |
| `completedAt` | DateTime | Completion timestamp                       | Auto                  |
| `tags`        | String[] | Array of tags (max 20)                     | No                    |
| `color`       | String   | Hex color code                             | No                    |
| `isPinned`    | Boolean  | Pin to top                                 | No (default: false)   |
| `isArchived`  | Boolean  | Archive note                               | No (default: false)   |

### **Create Note**

```graphql
mutation CreateNote {
  createNote(
    input: {
      title: "Buy groceries"
      content: "Milk, eggs, bread"
      type: TODO
      priority: HIGH
      dueDate: "2025-10-20T10:00:00Z"
      tags: ["shopping", "urgent"]
      color: "#FF5733"
    }
  ) {
    id
    title
    type
    status
    createdAt
  }
}
```

### **Get My Notes (with Pagination & Filters)**

```graphql
query GetMyNotes {
  getMyNotes(
    # Filters (all optional)
    type: TODO
    status: PENDING
    isArchived: false
    isPinned: true
    tags: ["urgent"]

    # Pagination (all optional)
    limit: 20 # Items per page (1-100, default: 20)
    offset: 0 # Skip items (default: 0)
  ) {
    nodes {
      id
      title
      content
      type
      status
      priority
      dueDate
      tags
      isPinned
    }
    totalCount # Total items in DB
    hasMore # More items available?
    pageInfo {
      currentPage # Current page number
      totalPages # Total pages
      limit
      offset
    }
  }
}
```

### **Update Note**

```graphql
mutation UpdateNote {
  updateNote(
    id: 1
    input: { title: "Updated title", status: COMPLETED, priority: URGENT }
  ) {
    id
    title
    status
    updatedAt
  }
}
```

### **Delete Note**

```graphql
mutation DeleteNote {
  deleteNote(id: 1) # Returns true
}
```

### **Quick Actions**

```graphql
# Complete a task
mutation {
  completeTask(id: 1) {
    id
    status
    completedAt
  }
}

# Uncomplete a task
mutation {
  uncompleteTask(id: 1) {
    id
    status
  }
}

# Archive a note
mutation {
  archiveNote(id: 1) {
    id
    isArchived
  }
}

# Unarchive a note
mutation {
  unarchiveNote(id: 1) {
    id
    isArchived
  }
}

# Pin a note
mutation {
  pinNote(id: 1) {
    id
    isPinned
  }
}

# Unpin a note
mutation {
  unpinNote(id: 1) {
    id
    isPinned
  }
}
```

### **Special Queries**

```graphql
# Get upcoming tasks (due within 7 days)
query {
  getUpcomingNotes(limit: 10, offset: 0) {
    nodes {
      id
      title
      dueDate
      priority
    }
    totalCount
  }
}

# Get overdue tasks
query {
  getOverdueNotes(limit: 10, offset: 0) {
    nodes {
      id
      title
      dueDate
    }
    totalCount
  }
}

# Search notes
query {
  searchNotes(query: "meeting", limit: 15, offset: 0) {
    nodes {
      id
      title
      content
    }
    totalCount
  }
}

# Get single note
query {
  getNote(id: 1) {
    id
    title
    content
    type
    status
    priority
    dueDate
    completedAt
    tags
    color
    isPinned
    isArchived
    createdAt
    updatedAt
  }
}
```

---

## ⚡ Pagination & Performance

### **Why Pagination?**

- ✅ Load only what you need (faster page loads)
- ✅ Reduce memory usage
- ✅ Handle thousands of notes efficiently

### **Pagination Methods**

#### **1. Offset-Based (Numbered Pages)**

Perfect for traditional page navigation (Page 1, 2, 3...)

```graphql
# Page 1
query {
  getMyNotes(limit: 20, offset: 0) {
    nodes {
      id
    }
    pageInfo {
      currentPage
      totalPages
    }
  }
}

# Page 2
query {
  getMyNotes(limit: 20, offset: 20) {
    nodes {
      id
    }
    pageInfo {
      currentPage
      totalPages
    }
  }
}

# Page 3
query {
  getMyNotes(limit: 20, offset: 40) {
    nodes {
      id
    }
    pageInfo {
      currentPage
      totalPages
    }
  }
}
```

**Frontend Implementation:**

```typescript
const [page, setPage] = useState(1);
const limit = 20;

const { data } = useQuery(GET_NOTES, {
  variables: {
    limit,
    offset: (page - 1) * limit
  }
});

// Pagination controls
<button onClick={() => setPage(page - 1)} disabled={page === 1}>
  Previous
</button>
<span>Page {page} of {data?.getMyNotes.pageInfo.totalPages}</span>
<button onClick={() => setPage(page + 1)} disabled={!data?.getMyNotes.hasMore}>
  Next
</button>
```

#### **2. Cursor-Based (Infinite Scroll)**

Perfect for mobile apps and infinite scrolling

```graphql
# Initial load
query {
  getMyNotes(limit: 20) {
    nodes {
      id
    }
    nextCursor
    hasMore
  }
}

# Load more (use nextCursor from previous response)
query {
  getMyNotes(limit: 20, cursor: 155) {
    nodes {
      id
    }
    nextCursor
    hasMore
  }
}
```

**Frontend Implementation:**

```typescript
const [notes, setNotes] = useState([]);
const [cursor, setCursor] = useState(null);
const [hasMore, setHasMore] = useState(true);

const loadMore = async () => {
  const { data } = await fetchNotes({ limit: 20, cursor });

  setNotes([...notes, ...data.getMyNotes.nodes]);
  setCursor(data.getMyNotes.nextCursor);
  setHasMore(data.getMyNotes.hasMore);
};

// With InfiniteScroll component
<InfiniteScroll
  dataLength={notes.length}
  next={loadMore}
  hasMore={hasMore}
  loader={<Spinner />}
>
  {notes.map(note => <NoteCard key={note.id} note={note} />)}
</InfiniteScroll>
```

### **Response Structure**

```typescript
{
  nodes: Note[]           // The actual notes
  totalCount: number      // Total items in database
  hasMore: boolean        // Are there more to load?
  nextCursor?: number     // ID for cursor-based pagination
  pageInfo: {
    limit: number         // Items per page
    offset: number        // Current offset
    currentPage: number   // Page number (1-indexed)
    totalPages: number    // Total pages
  }
}
```

### **Performance Tips**

1. **Choose right limit:**
   - Mobile: 10-15 items
   - Desktop: 20-50 items
   - Dashboard: 5-10 items

2. **Use appropriate method:**
   - Offset: Page numbers
   - Cursor: Infinite scroll, real-time data

3. **Cache results:**

   ```typescript
   const { data } = useQuery(GET_NOTES, {
     fetchPolicy: 'cache-and-network',
   });
   ```

4. **Pre-fetch next page:**
   ```typescript
   useEffect(() => {
     if (scrollPosition > 80% && hasMore) {
       prefetchNextPage();
     }
   }, [scrollPosition]);
   ```

---

## ✅ Validation Rules

All inputs are automatically validated. Invalid inputs return clear error messages.

### **Pagination Constraints**

| Parameter | Min | Max | Default | Error Message                                          |
| --------- | --- | --- | ------- | ------------------------------------------------------ |
| `limit`   | 1   | 100 | 20      | "Limit must be at least 1" / "Limit cannot exceed 100" |
| `offset`  | 0   | ∞   | 0       | "Offset must be at least 0"                            |
| `cursor`  | 1   | ∞   | null    | "Cursor must be a positive integer"                    |

### **Filter Constraints**

| Parameter    | Validation                                            | Error Message                           |
| ------------ | ----------------------------------------------------- | --------------------------------------- |
| `type`       | Must be NOTE, TASK, TODO, or REMINDER                 | "Type must be a valid NoteType"         |
| `status`     | Must be PENDING, IN_PROGRESS, COMPLETED, or CANCELLED | "Status must be a valid NoteStatus"     |
| `priority`   | Must be LOW, MEDIUM, HIGH, or URGENT                  | "Priority must be a valid NotePriority" |
| `isArchived` | Must be boolean                                       | "isArchived must be a boolean"          |
| `isPinned`   | Must be boolean                                       | "isPinned must be a boolean"            |
| `tags`       | Array with max 20 items                               | "Maximum 20 tags allowed"               |

### **Valid Examples**

```graphql
# ✅ Good pagination
query {
  getMyNotes(limit: 50, offset: 0) {
    nodes {
      id
    }
  }
}

# ✅ Valid filters
query {
  getMyNotes(type: TODO, status: PENDING) {
    nodes {
      id
    }
  }
}

# ✅ Reasonable tags
query {
  getMyNotes(tags: ["work", "urgent"]) {
    nodes {
      id
    }
  }
}
```

### **Invalid Examples**

```graphql
# ❌ Limit too high
query { getMyNotes(limit: 200) { nodes { id } } }
# Error: "Limit cannot exceed 100"

# ❌ Negative offset
query { getMyNotes(offset: -5) { nodes { id } } }
# Error: "Offset must be at least 0"

# ❌ Invalid enum
query { getMyNotes(type: INVALID) { nodes { id } } }
# Error: "Type must be a valid NoteType"

# ❌ Too many tags
query { getMyNotes(tags: ["tag1", "tag2", ..., "tag25"]) { nodes { id } } }
# Error: "Maximum 20 tags allowed"
```

---

## 🔑 Password Management

### **Change Password (Authenticated)**

```graphql
mutation ChangePassword {
  changePassword(currentPassword: "OldPass123!", newPassword: "NewPass456!")
}
```

**Effects:**

- Password updated
- All refresh tokens revoked (user logged out everywhere)
- Email notification sent (console in dev)

### **Forgot Password (Public)**

```graphql
mutation ForgotPassword {
  forgotPassword(email: "user@example.com")
}
```

**Effects:**

- 6-digit OTP generated
- OTP valid for 10 minutes
- Email sent (console in dev)
- Check console for OTP code!

### **Reset Password with OTP (Public)**

```graphql
mutation ResetPassword {
  resetPassword(
    email: "user@example.com"
    otp: "123456"
    newPassword: "NewPass789!"
  )
}
```

**Effects:**

- Password updated
- OTP marked as used
- All refresh tokens revoked
- Confirmation email sent (console in dev)

### **Mock Email Service (Development)**

In development, emails are logged to the console:

```
═══════════════════════════════════════════════
📧 EMAIL SERVICE (DEV MODE)
═══════════════════════════════════════════════
To: user@example.com
Subject: Password Reset Code
───────────────────────────────────────────────
Your password reset code is: 123456
This code will expire in 10 minutes.
═══════════════════════════════════════════════
```

---

## ⚠️ Error Handling

### **Error Response Format**

```json
{
  "errors": [
    {
      "message": "Note not found",
      "extensions": {
        "code": "BUSINESS_RULE_EXCEPTION",
        "statusCode": 400
      }
    }
  ]
}
```

### **Common Error Codes**

| Code                        | HTTP | Description               |
| --------------------------- | ---- | ------------------------- |
| `UNAUTHENTICATED`           | 401  | No token or invalid token |
| `BUSINESS_RULE_EXCEPTION`   | 400  | Business logic error      |
| `BAD_USER_INPUT`            | 400  | Validation failed         |
| `GRAPHQL_VALIDATION_FAILED` | 400  | Invalid GraphQL syntax    |
| `INTERNAL_SERVER_ERROR`     | 500  | Server error              |

### **Frontend Error Handling**

```typescript
try {
  const result = await fetchNotes();
} catch (error) {
  if (error.extensions?.code === 'UNAUTHENTICATED') {
    // Redirect to login
    router.push('/login');
  } else if (error.extensions?.code === 'BAD_USER_INPUT') {
    // Show validation error
    showError(error.message);
  } else {
    // Generic error
    showError('Something went wrong. Please try again.');
  }
}
```

---

## 💡 Best Practices

### **1. Security**

```typescript
// ✅ Store access token in memory (not localStorage)
let accessToken = '';

// ✅ Use HttpOnly cookies for refresh tokens (automatic)
credentials: 'include';

// ✅ Implement auto-refresh before expiry
setInterval(() => {
  if (tokenExpiresIn < 2 * 60 * 1000) {
    // 2 minutes
    refreshToken();
  }
}, 60 * 1000); // Check every minute
```

### **2. Performance**

```typescript
// ✅ Request only needed fields
query {
  getMyNotes(limit: 20) {
    nodes {
      id
      title
      // Don't fetch content if not displayed
    }
  }
}

// ✅ Use pagination
query { getMyNotes(limit: 20) { nodes { id } } }

// ❌ Don't fetch everything at once
query { getMyNotes(limit: 10000) { nodes { id } } }  // Bad!
```

### **3. User Experience**

```typescript
// ✅ Show loading states
{loading && <Skeleton count={5} />}

// ✅ Display progress
<p>Showing {nodes.length} of {totalCount} notes</p>

// ✅ Handle empty states
{nodes.length === 0 && <EmptyState />}

// ✅ Debounce search
const debouncedSearch = debounce(searchNotes, 300);
```

### **4. Error Recovery**

```typescript
// ✅ Implement retry logic
const fetchWithRetry = async (fn, retries = 3) => {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0 && isNetworkError(error)) {
      await delay(1000);
      return fetchWithRetry(fn, retries - 1);
    }
    throw error;
  }
};
```

---

## 🎯 Quick Reference

### **Authentication Flow**

```
Register → Login → Get Token → Use Token → Refresh Token → Logout
```

### **Notes CRUD**

```
Create → Read (List/Single) → Update → Delete
```

### **Pagination Flow**

```
Initial Load → Load More / Next Page → Show Total/Progress
```

### **Common Operations**

| Task          | Query/Mutation                    |
| ------------- | --------------------------------- |
| Create note   | `createNote(input: {...})`        |
| List notes    | `getMyNotes(limit: 20)`           |
| Get note      | `getNote(id: 1)`                  |
| Update note   | `updateNote(id: 1, input: {...})` |
| Delete note   | `deleteNote(id: 1)`               |
| Complete task | `completeTask(id: 1)`             |
| Search        | `searchNotes(query: "...")`       |
| Archive       | `archiveNote(id: 1)`              |
| Pin           | `pinNote(id: 1)`                  |

---

## 📚 Additional Resources

### **GraphQL Tools**

- Playground: `http://localhost:3000/graphql`
- Schema: Auto-generated in `schema.gql`

### **Client Libraries**

- Apollo Client: https://www.apollographql.com/docs/react/
- urql: https://formidable.com/open-source/urql/
- Fetch API: Native browser support

### **Code Generation**

```bash
# Generate TypeScript types from schema
npx graphql-codegen --config codegen.yml
```

---

## 🆘 Troubleshooting

**CORS errors?**

- Check `credentials: 'include'` in requests
- Verify origin in CORS whitelist

**Authentication not working?**

- Check token format: `Bearer <token>`
- Verify token hasn't expired (15 min)
- Try refreshing token

**Pagination issues?**

- Returns `PaginatedNotes` not `Note[]`
- Access notes via `data.getMyNotes.nodes`
- Check limit (1-100), offset (≥0)

**Validation errors?**

- Check constraints in this guide
- Validate inputs on frontend first
- Read error messages carefully

---

**Need more help?** All features are production-ready and tested! 🚀

---

_Last updated: October 15, 2025_
