import { gql } from "@apollo/client";

// Note fragment for reuse
export const NOTE_FRAGMENT = gql`
  fragment NoteFields on Note {
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
`;

// Get current user profile
export const GET_ME = gql`
  query GetMyProfile {
    getMyProfile {
      id
      email
      fullName
      bio
      avatar
      createdAt
    }
  }
`;

// Get notes with flexible filtering, pagination, and search
export const GET_NOTES = gql`
  ${NOTE_FRAGMENT}
  query GetNotes(
    $limit: Int
    $offset: Int
    $cursor: Int
    $type: NoteType
    $status: NoteStatus
    $isArchived: Boolean
    $isPinned: Boolean
    $tags: [String!]
    $search: String
    $isUpcoming: Boolean
    $isOverdue: Boolean
  ) {
    notes(
      limit: $limit
      offset: $offset
      cursor: $cursor
      type: $type
      status: $status
      isArchived: $isArchived
      isPinned: $isPinned
      tags: $tags
      search: $search
      isUpcoming: $isUpcoming
      isOverdue: $isOverdue
    ) {
      nodes {
        ...NoteFields
      }
      totalCount
      hasMore
      nextCursor
      pageInfo {
        limit
        offset
        currentPage
        totalPages
      }
    }
  }
`;

// Legacy alias for backward compatibility
export const GET_MY_NOTES = GET_NOTES;

// Get single note by ID
export const GET_NOTE = gql`
  ${NOTE_FRAGMENT}
  query GetNote($id: Int!) {
    note(id: $id) {
      ...NoteFields
    }
  }
`;
