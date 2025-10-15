# API Migration Notes

## Backend Schema Changes Applied

### Query Changes

The backend has consolidated multiple note-related queries into a single flexible `notes` query.

#### Before (Old API):

- `getMyNotes` - Get notes with basic filters
- `searchNotes` - Search notes
- `getUpcomingNotes` - Get upcoming notes
- `getOverdueNotes` - Get overdue notes
- `getNote` - Get single note

#### After (New API):

- `notes` - Single query with all filtering capabilities
  - Basic filters: `type`, `status`, `isArchived`, `isPinned`, `tags`
  - Search: `search` (searches in title and content)
  - Date filters: `isUpcoming` (due within 7 days), `isOverdue`
  - Pagination: `limit`, `offset`, `cursor`
- `note` - Get single note by ID

### Frontend Changes Applied

#### 1. Updated `src/graphql/queries.js`

```javascript
// New unified query
export const GET_NOTES = gql`
  query GetNotes(
    $limit: Int
    $offset: Int
    $cursor: Int
    $type: NoteType
    $status: NoteStatus
    $isArchived: Boolean
    $isPinned: Boolean
    $tags: [String!]
    $search: String           // NEW: Server-side search
    $isUpcoming: Boolean      // NEW: Filter upcoming notes
    $isOverdue: Boolean       // NEW: Filter overdue notes
  ) {
    notes(...)              // Changed from getMyNotes to notes
  }
`;

// Backward compatibility alias
export const GET_MY_NOTES = GET_NOTES;

// Updated single note query
export const GET_NOTE = gql`
  query GetNote($id: Int!) {
    note(id: $id) {          // Changed from getNote to note
      ...NoteFields
    }
  }
`;
```

#### 2. Updated `src/pages/Notes.jsx`

- **Search is now server-side**: Added `search` parameter to query variables
- **Data path updated**: Changed from `data?.getMyNotes?.nodes` to `data?.notes?.nodes`
- **Removed client-side filtering**: Search is now handled by the backend
- **Added new filter support**: Can now use `isUpcoming` and `isOverdue` filters

#### 3. Updated `src/lib/apolloClient.js`

- **Cache configuration updated**: Changed cache key from `getMyNotes` to `notes`
- **Added new cache keys**: Included `search`, `isUpcoming`, `isOverdue` in keyArgs

### Benefits of New API

1. **Unified Query**: Single endpoint for all note queries
2. **Server-side Search**: Better performance, no need to fetch all notes for search
3. **Flexible Filtering**: Combine multiple filters in one query
4. **Better Performance**: Server-side filtering reduces data transfer
5. **Simpler Code**: Less query definitions, easier to maintain

### Migration Checklist

✅ Updated query definitions
✅ Updated query names (getMyNotes → notes, getNote → note)
✅ Added search parameter support
✅ Added isUpcoming/isOverdue filter support
✅ Updated data access paths in components
✅ Updated Apollo Client cache configuration
✅ Maintained backward compatibility with GET_MY_NOTES alias
✅ Removed redundant client-side filtering

### Testing Recommendations

1. Test basic note fetching
2. Test server-side search functionality
3. Test filter combinations (type + status + search)
4. Test upcoming/overdue filters
5. Test pagination with filters
6. Test single note fetching by ID
7. Test cache behavior with different filter combinations

### No Breaking Changes

The code maintains backward compatibility through the `GET_MY_NOTES` alias, so existing imports will continue to work.
