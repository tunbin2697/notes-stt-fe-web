# 🔑 Password Management Guide

**Complete guide for implementing password change and reset flows**

> **Quick Link:** For basic password operations, see the [API Complete Guide - Password Management](./API_COMPLETE_GUIDE.md#-password-management)

---

## 📖 Table of Contents

1. [Overview](#overview)
2. [Setup](#setup)
3. [API Reference](#api-reference)
4. [Frontend Integration](#frontend-integration)
5. [Security Features](#security-features)
6. [Production Deployment](#production-deployment)

---

## 🎯 Overview

### **Available Features**

| Feature         | Auth Required | Description                                   |
| --------------- | ------------- | --------------------------------------------- |
| Change Password | ✅ Yes        | Authenticated users can change their password |
| Forgot Password | ❌ No         | Request OTP code via email                    |
| Reset Password  | ❌ No         | Reset password using OTP code                 |

### **Security Highlights**

- ✅ OTP expires in 10 minutes
- ✅ OTP can only be used once
- ✅ All passwords hashed with bcrypt
- ✅ Revokes all sessions on password change
- ✅ Email notifications for security events

---

## � Setup

### **Database Migration**

The password reset feature requires the `PasswordReset` table:

```bash
# Run migration
npx prisma migrate dev

# Or generate and apply
npx prisma generate
npx prisma migrate dev
```

**PasswordReset Table Schema:**

- `id` - Primary key
- `token` - 6-digit OTP code (unique)
- `accountId` - Foreign key to Account
- `expiresAt` - Expiration timestamp (10 minutes)
- `used` - Prevents OTP reuse
- `createdAt` - Creation timestamp

---

## 🔐 API Reference

### **1. Change Password (Authenticated)**

Change password for logged-in users.

```graphql
mutation ChangePassword {
  changePassword(
    input: { currentPassword: "OldPass123!", newPassword: "NewPass456!" }
  )
}
```

**Requirements:**

- ✅ Valid access token in `Authorization` header
- ✅ Current password must be correct
- ✅ New password must be different

**Effects:**

- Password updated
- All refresh tokens revoked
- User logged out from all devices
- Email notification sent

**Errors:**
| Error | Cause |
|-------|-------|
| `"Current password is incorrect"` | Wrong current password |
| `"New password must be different from current password"` | Same password |
| `401 Unauthorized` | Missing/invalid token |

---

### **2. Forgot Password (Public)**

Request OTP code for password reset.

```graphql
mutation ForgotPassword {
  forgotPassword(email: "user@example.com")
}
```

**Requirements:**

- ✅ Valid email address

**Effects:**

- 6-digit OTP generated
- OTP stored in database (10 min expiry)
- Previous unused OTPs invalidated
- Email sent with OTP code

**Security Note:** Always returns `true` even if email doesn't exist (prevents email enumeration).

**Development:** Check server console for OTP code!

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

### **3. Reset Password (Public)**

Reset password using OTP code.

```graphql
mutation ResetPassword {
  resetPassword(
    input: {
      email: "user@example.com"
      otp: "123456"
      newPassword: "NewPass789!"
    }
  )
}
```

**Requirements:**

- ✅ Valid email address
- ✅ Valid OTP code (not expired, not used)
- ✅ Strong password

**Effects:**

- Password updated
- OTP marked as used
- All refresh tokens revoked
- Confirmation email sent

**Errors:**
| Error | Cause |
|-------|-------|
| `"Invalid or expired reset code. Please request a new one."` | Wrong/expired/used OTP |

---

## 💻 Frontend Integration

### **Complete Password Reset Flow**

```typescript
// Step 1: Request OTP
const forgotPassword = async (email: string) => {
  const response = await fetch('http://localhost:3000/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `mutation { forgotPassword(email: "${email}") }`,
    }),
  });

  const { data, errors } = await response.json();

  if (data?.forgotPassword) {
    // Show success message
    return true;
  }

  // Handle errors
  console.error(errors);
  return false;
};

// Step 2: Reset password with OTP
const resetPassword = async (
  email: string,
  otp: string,
  newPassword: string,
) => {
  const response = await fetch('http://localhost:3000/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        mutation ResetPassword($input: ResetPasswordInput!) {
          resetPassword(input: $input)
        }
      `,
      variables: {
        input: { email, otp, newPassword },
      },
    }),
  });

  const { data, errors } = await response.json();

  if (errors) {
    // Show error: Invalid or expired OTP
    return { success: false, error: errors[0].message };
  }

  if (data?.resetPassword) {
    // Redirect to login
    return { success: true };
  }
};

// Step 3: Change password (authenticated)
const changePassword = async (currentPassword: string, newPassword: string) => {
  const accessToken = localStorage.getItem('accessToken');

  const response = await fetch('http://localhost:3000/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: 'include',
    body: JSON.stringify({
      query: `
        mutation ChangePassword($input: ChangePasswordInput!) {
          changePassword(input: $input)
        }
      `,
      variables: {
        input: { currentPassword, newPassword },
      },
    }),
  });

  const { data, errors } = await response.json();

  if (errors) {
    return { success: false, error: errors[0].message };
  }

  if (data?.changePassword) {
    // Clear tokens and redirect to login
    localStorage.removeItem('accessToken');
    return { success: true };
  }
};
```

### **React Component Example**

```tsx
// Forgot Password Form
const ForgotPasswordForm = () => {
  const [email, setEmail] = useState('');
  const [showOtpForm, setShowOtpForm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await forgotPassword(email);

    if (success) {
      setShowOtpForm(true);
      toast.success('OTP sent! Check your email.');
    }
  };

  if (showOtpForm) {
    return <ResetPasswordForm email={email} />;
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
        required
      />
      <button type="submit">Send Reset Code</button>
    </form>
  );
};

// Reset Password Form
const ResetPasswordForm = ({ email }: { email: string }) => {
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await resetPassword(email, otp, newPassword);

    if (result.success) {
      toast.success('Password reset successful!');
      router.push('/login');
    } else {
      toast.error(result.error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={otp}
        onChange={(e) => setOtp(e.target.value)}
        placeholder="Enter 6-digit code"
        maxLength={6}
        required
      />
      <input
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        placeholder="New password"
        required
      />
      <button type="submit">Reset Password</button>
    </form>
  );
};
```

---

## 🔒 Security Features

### **Built-in Protection**

| Feature                       | Change Password | Forgot/Reset Password        |
| ----------------------------- | --------------- | ---------------------------- |
| Authentication Required       | ✅ Yes          | ❌ No (user can't login)     |
| Current Password Verification | ✅ Yes          | N/A                          |
| OTP Expiration (10 min)       | N/A             | ✅ Yes                       |
| Single-use OTP                | N/A             | ✅ Yes                       |
| Auto-invalidate old OTPs      | N/A             | ✅ Yes                       |
| Bcrypt Password Hashing       | ✅ Yes          | ✅ Yes                       |
| Revoke All Sessions           | ✅ Yes          | ✅ Yes                       |
| Email Notification            | ✅ Yes          | ✅ Yes                       |
| Prevent Email Enumeration     | N/A             | ✅ Yes (always returns true) |

### **Password Requirements**

- Minimum 8 characters
- At least 3 of: uppercase, lowercase, number, special character
- Not in common password list

---

## 📧 Email Service

### **Development Mode**

Emails are logged to the server console:

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

**Testing:** Check the console for OTP codes!

### **Production Setup**

Replace the mock `EmailService` with a real provider:

```typescript
// src/common/services/email.service.ts
import { Injectable } from '@nestjs/common';
import * as sgMail from '@sendgrid/mail';

@Injectable()
export class EmailService {
  constructor() {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  }

  async sendPasswordResetOTP(email: string, otp: string) {
    await sgMail.send({
      to: email,
      from: 'noreply@yourdomain.com',
      subject: 'Password Reset Code',
      html: `
        <h2>Password Reset Code</h2>
        <p>Your code is: <strong>${otp}</strong></p>
        <p>Expires in 10 minutes.</p>
      `,
    });
  }

  async sendPasswordChangedNotification(email: string) {
    await sgMail.send({
      to: email,
      from: 'noreply@yourdomain.com',
      subject: 'Password Changed',
      html: `
        <h2>Password Changed</h2>
        <p>Your password was successfully changed.</p>
        <p>If this wasn't you, contact support immediately.</p>
      `,
    });
  }
}
```

**Email Providers:**

- SendGrid: https://sendgrid.com
- AWS SES: https://aws.amazon.com/ses/
- Mailgun: https://www.mailgun.com
- Postmark: https://postmarkapp.com

---

## 🧪 Testing Guide

### **Quick Test Flow**

```bash
# 1. Start server
npm run start:dev

# 2. Open GraphQL Playground
# http://localhost:3000/graphql
```

### **Test Forgot Password**

```graphql
mutation {
  forgotPassword(email: "test@example.com")
}
```

✅ Check console for OTP → Copy the 6-digit code

### **Test Reset Password**

```graphql
mutation {
  resetPassword(
    input: {
      email: "test@example.com"
      otp: "123456" # Use code from console
      newPassword: "NewPass123!"
    }
  )
}
```

### **Test Login**

```graphql
mutation {
  login(email: "test@example.com", password: "NewPass123!") {
    accessToken
  }
}
```

### **Test Change Password**

**1. Add token to HTTP Headers:**

```json
{
  "Authorization": "Bearer <your-access-token>"
}
```

**2. Run mutation:**

```graphql
mutation {
  changePassword(
    input: { currentPassword: "NewPass123!", newPassword: "AnotherPass456!" }
  )
}
```

---

## 💡 Best Practices

### **Frontend Implementation**

```typescript
// ✅ Show clear error messages
if (error.message.includes('Invalid or expired')) {
  showError('Your reset code has expired. Please request a new one.');
}

// ✅ Add countdown timer for OTP
const [timeLeft, setTimeLeft] = useState(600); // 10 minutes

// ✅ Clear tokens after password change
localStorage.removeItem('accessToken');
router.push('/login');

// ✅ Show security tips
<Alert>
  For your security, you'll be logged out from all devices.
</Alert>
```

### **UX Recommendations**

1. **OTP Input:** Use 6 separate input boxes for better UX
2. **Countdown Timer:** Show remaining time for OTP validity
3. **Resend OTP:** Allow users to request new code after expiry
4. **Password Strength:** Show real-time password strength meter
5. **Success Feedback:** Clear confirmation messages

---

## 🎯 Quick Reference

### **API Summary**

| Operation       | Endpoint                | Auth   | Returns |
| --------------- | ----------------------- | ------ | ------- |
| Change Password | `changePassword(input)` | ✅ Yes | Boolean |
| Request OTP     | `forgotPassword(email)` | ❌ No  | Boolean |
| Reset Password  | `resetPassword(input)`  | ❌ No  | Boolean |

### **Common Issues**

| Problem                      | Solution                                                      |
| ---------------------------- | ------------------------------------------------------------- |
| "Invalid OTP"                | Check console for correct code; OTP may have expired (10 min) |
| "Current password incorrect" | Verify user is entering correct current password              |
| Can't find OTP               | Check server console logs; ensure email service is running    |
| Still logged in after change | Clear localStorage and cookies; refresh page                  |

---

## 📚 Additional Resources

- **Main API Guide:** [API_COMPLETE_GUIDE.md](./API_COMPLETE_GUIDE.md)
- **Authentication:** [API Guide - Authentication](./API_COMPLETE_GUIDE.md#-authentication)
- **Error Handling:** [API Guide - Error Handling](./API_COMPLETE_GUIDE.md#️-error-handling)

---

**Ready to implement!** 🔐 All features are tested and production-ready.

---

_Last updated: October 15, 2025_
