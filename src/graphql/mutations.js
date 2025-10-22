import { gql } from "@apollo/client";
import { NOTE_FRAGMENT } from "./queries";

// Authentication mutations
export const REGISTER = gql`
  mutation Register($email: String!, $password: String!) {
    register(email: $email, password: $password)
  }
`;

export const LOGIN = gql`
  mutation Login($email: String!, $password: String!) {
    login(input: { email: $email, password: $password }) {
      accessToken
    }
  }
`;

export const GOOGLE_AUTH = gql`
  mutation GoogleAuth($input: GoogleAuthInput!) {
    googleAuth(input: $input) {
      accessToken
    }
  }
`;

export const LOGOUT = gql`
  mutation Logout {
    logout
  }
`;

export const REFRESH_TOKEN = gql`
  mutation RefreshToken {
    refresh {
      accessToken
    }
  }
`;

export const CHANGE_PASSWORD = gql`
  mutation ChangePassword($oldPassword: String!, $newPassword: String!) {
    changePassword(
      input: { oldPassword: $oldPassword, newPassword: $newPassword }
    )
  }
`;

export const REQUEST_PASSWORD_RESET = gql`
  mutation ForgotPassword($email: String!) {
    forgotPassword(email: $email)
  }
`;

export const RESET_PASSWORD = gql`
  mutation ResetPassword(
    $email: String!
    $otp: String!
    $newPassword: String!
  ) {
    resetPassword(
      input: { email: $email, otp: $otp, newPassword: $newPassword }
    )
  }
`;

export const UPDATE_PROFILE = gql`
  mutation UpdateMyProfile(
    $fullName: String
    $phone: String
    $location: String
    $avatar: String
    $bio: String
  ) {
    updateMyProfile(
      input: {
        fullName: $fullName
        phone: $phone
        location: $location
        avatar: $avatar
        bio: $bio
      }
    )
  }
`;

// Logout from all devices
export const REQUEST_LOGOUT_ALL_OTP = gql`
  mutation RequestLogoutAllOTP($email: String!) {
    requestLogoutAllOTP(email: $email)
  }
`;

export const LOGOUT_ALL = gql`
  mutation LogoutAll($email: String!, $otp: String!) {
    logoutAll(input: { email: $email, otp: $otp })
  }
`;

// Note mutations
export const CREATE_NOTE = gql`
  ${NOTE_FRAGMENT}
  mutation CreateNote($input: CreateNoteInput!) {
    createNote(input: $input) {
      ...NoteFields
    }
  }
`;

export const UPDATE_NOTE = gql`
  ${NOTE_FRAGMENT}
  mutation UpdateNote($id: Int!, $input: UpdateNoteInput!) {
    updateNote(id: $id, input: $input) {
      ...NoteFields
    }
  }
`;

export const DELETE_NOTE = gql`
  mutation DeleteNote($id: Int!) {
    deleteNote(id: $id)
  }
`;

// Quick actions
export const COMPLETE_TASK = gql`
  ${NOTE_FRAGMENT}
  mutation CompleteTask($id: Int!) {
    completeTask(id: $id) {
      ...NoteFields
    }
  }
`;

export const UNCOMPLETE_TASK = gql`
  ${NOTE_FRAGMENT}
  mutation UncompleteTask($id: Int!) {
    uncompleteTask(id: $id) {
      ...NoteFields
    }
  }
`;

export const ARCHIVE_NOTE = gql`
  ${NOTE_FRAGMENT}
  mutation ArchiveNote($id: Int!) {
    archiveNote(id: $id) {
      ...NoteFields
    }
  }
`;

export const UNARCHIVE_NOTE = gql`
  ${NOTE_FRAGMENT}
  mutation UnarchiveNote($id: Int!) {
    unarchiveNote(id: $id) {
      ...NoteFields
    }
  }
`;

export const PIN_NOTE = gql`
  ${NOTE_FRAGMENT}
  mutation PinNote($id: Int!) {
    pinNote(id: $id) {
      ...NoteFields
    }
  }
`;

export const UNPIN_NOTE = gql`
  ${NOTE_FRAGMENT}
  mutation UnpinNote($id: Int!) {
    unpinNote(id: $id) {
      ...NoteFields
    }
  }
`;
