# 📋 IDYLL TRACK PAYMENTS — COMPLETE PRE-DEPLOYMENT TEST CHECKLIST
> Use this checklist to manually test and verify every button, function, and view before deploying to production.
> Mark items as `[x]` as you test and verify them.

---

## 🔐 1. AUTHENTICATION & ONBOARDING

### Login & Sign In
- [ ] **Email & Password Login**: Enter valid credentials and click **"Log In"** (verifies successful redirect to dashboard).
- [ ] **Password Visibility Toggle**: Click the eye icon in the password field (toggles plain text and obscured dots).
- [ ] **Empty / Invalid Credentials**: Click **"Log In"** with blank fields or wrong password (shows error alert).
- [ ] **Google Sign-In**: Click **"Continue with Google"** (initiates Supabase OAuth flow and logs in).
- [ ] **"Forgot Password?" Link**: Click to open password recovery form.
- [ ] **"Create New Account" Link**: Navigates to the sign-up tab.

### Registration & Sign Up
- [ ] **New Account Creation**: Enter email, password, and confirm password -> click **"Create Account"**.
- [ ] **Email Verification Alert**: Confirms verification email notification appears.
- [ ] **"Change Email" Option**: Click **"Wrong email address? Change it"** (allows updating destination address).
- [ ] **"Back to Sign In"**: Returns to login screen.

### Welcome Tour & Onboarding
- [ ] **Welcome Modal / First-Time Login**: Displays welcome tour modal on fresh account.
- [ ] **Tour Navigation**: Click through steps (`Next`, `Back`, `Skip`, `Get Started`).
- [ ] **Scroll Lock**: Background cannot be scrolled while modal is open.
- [ ] **Dismiss Tour**: Closes cleanly without freezing UI.

---

## 👤 2. USER SETTINGS & PROFILE (`/settings`)

### Left Column: Profile Information
- [ ] **Profile Photo Display**: Shows initial avatar or uploaded picture correctly.
- [ ] **Change Picture Button**: Opens the avatar selection & crop modal.
- [ ] **Preset Avatars**: Select from preset avatar gallery and click **"Save Picture"**.
- [ ] **Custom Photo Upload**: Upload an image file -> cropper appears -> zoom/pan -> save cropped image.
- [ ] **PDF Document Upload**: Upload a PDF document -> verifies PDF badge and file card appear.
- [ ] **View PDF Button**: Opens uploaded document in a new tab.
- [ ] **Replace / Remove Button**: Clicking **"Remove"** restores default avatar letter; **"Replace"** opens picker.
- [ ] **"Fetch from Google" Button**: (For Google accounts) pulls Google profile picture.
- [ ] **Display Name Field**: Edit name (required field check).
- [ ] **Full Name Field**: Edit legal full name (verifies helper text and autofill compatibility).
- [ ] **Mobile Number Input**: Type phone number with country dial code.
- [ ] **Country Dropdown**:
  - [ ] Click to open custom dropdown.
  - [ ] Search for a country (e.g. "India", "United States").
  - [ ] Select country -> updates flag and dial code.
- [ ] **Unique ID**: Confirms read-only ID (e.g. `IDY-...`).
- [ ] **Email Address**: Confirms read-only registered email with mail icon.
- [ ] **Sign Up Method**: Confirms read-only provider (e.g. `Google Sign Up` or `Email`).
- [ ] **Time Format Dropdown**: Switch between `12-hour (e.g., 2:30 PM)` and `24-hour (e.g., 14:30)`.

### Right Column: Preferences & System
- [ ] **Email Notifications Switch**:
  - [ ] Click switch to toggle OFF -> status badge changes to **"● Emails Paused"** (red) and breakdown explains paused services.
  - [ ] Click switch to toggle ON -> status badge changes to **"● Emails Enabled"** (green) and breakdown explains active services.
- [ ] **Keyboard Shortcuts / Operating System**:
  - [ ] Click **"iOS / Mac"** card -> sets preference, highlights with active border, displays `⌘K`.
  - [ ] Click **"Windows"** card -> sets preference, highlights with active border, displays `Ctrl + K`.
- [ ] **Top Bar Display Toggles**:
  - [ ] Toggle **"Show Date"** switch -> check top header clock reflects changes.
  - [ ] Toggle **"Show Day"** switch -> check top header clock reflects changes.
  - [ ] Toggle **"Show Time"** switch -> check top header clock reflects changes.
- [ ] **"Save Changes" Button**:
  - [ ] Click **"Save Changes"** -> button shows loading spinner / "Saving...", toast notification pops up ("Changes saved").
  - [ ] Refresh page -> all saved values persist from Supabase database.
- [ ] **Unsaved Changes Guard**: Modify a field without saving, click a sidebar link -> prompts confirmation before leaving.

---

## 🧾 3. INVOICING & INVOICE CREATION (`/payments` & `/idyll-invoicing`)

### Invoice Form
- [ ] **Invoice Number**: Auto-generated invoice number displays cleanly (e.g. `IDYSAT-0004`).
- [ ] **Invoice Date & Due Date**: Date pickers allow date selection; dates format properly.
- [ ] **Billed To / Client Details**: Fill in client name, email, and address.
- [ ] **Service Payroll Items**:
  - [ ] Add description, quantity, and rate for Service 1.
  - [ ] Click **"+ Add Service"** button (adds 2nd and 3rd service).
  - [ ] Max limit check: adding 3 services disables button or warns "Maximum 3 services allowed per invoice".
  - [ ] Delete Service: Click trash icon on a row -> removes service row and recalculates total.
  - [ ] Subtotal & Amount Calculation: Quantities × rates sum up accurately in real time.
- [ ] **Currency Selector**: Change currency (INR ₹, USD $, EUR €, GBP £) -> updates symbol everywhere.
- [ ] **Payment Details & Notes (Left Box)**:
  - [ ] Type bank details, IFSC, UPI ID, or notes.
  - [ ] Character counter `0 / 200` counts keystrokes accurately.
  - [ ] Click **"Use Saved Payment Details"** button -> opens modal -> click saved method -> autofills textarea.
- [ ] **Total Amount Card (Right Box)**:
  - [ ] Level horizontal baseline: starts on the exact same line as the notes textarea.
  - [ ] Total number formats with commas (e.g. `₹15,000.00`).
  - [ ] "In words" box accurately converts number to words (e.g. `Fifteen Thousand Rupees Only`).
- [ ] **Submit / Save Invoice**:
  - [ ] Click **"Submit Invoice"** -> validates required fields (flags red if empty).
  - [ ] When valid -> shows success animation/confetti, saves to database, redirects to table.
  - [ ] Email sent check: If Email Notifications are ON, confirmation email arrives via Resend.

### Export, PDF & Print Actions
- [ ] **Download PDF**: Click **"Download PDF"** -> generates clean PDF without hidden UI controls.
- [ ] **Print Invoice**: Click **"Print"** -> opens browser print preview dialog cleanly formatted.
- [ ] **Copy Invoice Link**: Click copy/share icon -> copies link to clipboard with confirmation toast.

---

## 📊 4. INVOICES TABLE & INFO MODAL

- [ ] **Table View**: Lists submitted invoices with columns: Invoice #, Date, Client, Amount, Status, Actions.
- [ ] **Status Badges**: Verify pills for `Pending`, `Approved`, `Paid`, `Rejected`.
- [ ] **Search Bar**: Type client name or invoice number -> filters table rows in real time.
- [ ] **Status Filters**: Click filter tabs/buttons (`All`, `Pending`, `Paid`) -> updates table rows.
- [ ] **Sort Columns**: Click column headers to sort ascending / descending.
- [ ] **Pagination**: Navigate between pages if there are multiple invoices.
- [ ] **Invoice Info / Details Modal**:
  - [ ] Click an invoice row or view icon -> opens info modal.
  - [ ] Clean single-column layout without scrollbar clutter.
  - [ ] Low-opacity dark scrim backdrop (no aggressive background blur).
  - [ ] Background body scroll is locked while modal is open.
  - [ ] Click outside or `X` button closes modal cleanly.
- [ ] **Edit Invoice**: Click edit icon -> loads invoice data back into form for updates.
- [ ] **Delete Invoice**: Click delete trash icon -> prompts confirmation -> removes invoice.

---

## 💳 5. PAYMENT DETAILS (`/payment-details`)

- [ ] **Tabs Navigation**: Switch between **Bank Transfer (Wire)**, **UPI**, **PayPal**, **Wise**.
- [ ] **Add Bank Transfer**:
  - [ ] Enter Account Holder, Account Number, IFSC, Bank Name.
  - [ ] Click **"Save Payment Method"** -> saves to database.
- [ ] **Add UPI**:
  - [ ] Enter Account Name, UPI ID.
  - [ ] **Upload QR Code Image**: Select JPEG/PNG -> opens cropper -> zoom/crop -> saves image preview.
  - [ ] Click trash icon on QR preview -> removes QR code.
- [ ] **Add PayPal / Wise**:
  - [ ] Enter registered email / account handle -> save.
- [ ] **Set as Default**: Click **"Set as Default"** -> updates default indicator badge.
- [ ] **Delete Payment Method**: Click delete -> removes method from saved list.

---

## 📑 6. BILLING VIEW (`/billing`)

- [ ] **Global Billing Table Columns**:
  - [ ] **Clean Alignment by Default**: Checkbox column is hidden by default so `Invoice Name`, `Creator / User`, `Invoice ID`, `Date`, `Amount`, `Payment Status` are perfectly aligned directly below each title with zero left offset.
  - [ ] **"Select" Action Button**: Clicking the **"Select"** button at the top enables Selection Mode, smoothly revealing the checkbox column (master checkbox in header + row checkboxes).
  - [ ] **Amount Column**: Accurately displays currency symbol and formatted amount with commas (e.g. `₹15,000.00` or `$1,250.00`).
- [ ] **Unified Action Bar**:
  - [ ] Select one or more invoices with checkboxes.
  - [ ] Bulk action bar appears with clean 8px rounded corners and matching 36px buttons.
  - [ ] **"Mark Paid"**: Updates status of all selected invoices to Paid.
  - [ ] **"Export CSV / PDF"**: Downloads summary of selected invoices.
  - [ ] **"Delete Selected"**: Deletes selected items after confirmation.
- [ ] **User Filter Dropdown**:
  - [ ] Click **"All Users"** dropdown filter -> button height is 38px, clean light styling.
  - [ ] Select a specific user -> filters table to show only that user's invoices.
- [ ] **Date Range Filter**: Filter invoices by date period.
- [ ] **Summary Cards**: Verifies Total Billed, Total Paid, and Outstanding balances calculate accurately.

---

## 🪪 7. KYC VERIFICATION & ADMIN KYC MANAGEMENT

### User KYC Submission (`/kyc`)
- [ ] **Document Type Selection**: Choose Aadhaar / National ID / Passport.
- [ ] **Front & Back Upload**: Upload front and back photos -> crop tool allows adjusting frame.
- [ ] **Submit KYC**: Submit for review -> status badge updates to **"Pending Verification"**.
- [ ] **Locking**: Once submitted, fields are locked from tampering.

### Admin KYC Management (`/kyc-management`)
- [ ] **Pending KYC Queue**: View all pending user verification requests.
- [ ] **Document Inspection**: Click to view uploaded ID card in full resolution.
- [ ] **Approve KYC**: Click **"Approve"** -> updates user's KYC status to Verified; user gets verified badge.
- [ ] **Reject KYC**: Click **"Reject"** -> prompts reason input -> sends rejection notification to user.

---

## 👥 8. WORKSPACE USERS & ROLES (`/users`)

- [ ] **Active Users Tab**: Shows list of registered users, avatars, email, joined date, and current role.
- [ ] **Pending Approvals Tab**: Shows pending user requests and rejected users with status badges.
- [ ] **Pending Actions**:
  - [ ] Click **"Approve"** on a pending or rejected user -> approves user and sends account approval email.
  - [ ] Click **"Reject"** on a pending user -> marks status as Rejected.
  - [ ] Click **"Delete"** (trash icon) on a pending or rejected user -> opens confirmation modal -> permanently deletes user from database.
- [ ] **Change User Role**: Change role between `User`, `Finance`, `Admin` -> saves permissions in Supabase.
- [ ] **Permission Matrix**: Verify role restrictions (e.g. non-admins cannot access `/admin-panel` or `/users`).
- [ ] **Remove / Delete Active User**: Admin can remove active user from workspace after confirmation.

---

## 🛡️ 9. AUDIT LOGS (`/audit`)

- [ ] **Log Stream**: Logs key actions (login, invoice created, invoice paid, role changed, KYC approved).
- [ ] **Actor & Timestamp**: Confirms user email, action description, IP/metadata, and formatted timestamp.
- [ ] **Search & Filter**: Search logs by keyword, action type, or user email.

---

## ⚙️ 10. ADMIN PANEL (`/admin-panel`)

- [ ] **Admin Metrics**: Total users, total volume, pending approvals.
- [ ] **Broadcast Notification**: Create global alert -> verifies banner appears for workspace users.
- [ ] **System Settings**: Toggle platform-wide features if applicable.

---

## 🔔 11. NOTIFICATIONS & EMAIL DELIVERY (Resend)

- [ ] **Header Bell Icon**: Click notification bell -> dropdown opens showing unread notifications.
- [ ] **Mark as Read**: Click individual notification or **"Mark all as read"** -> unread badge clears.
- [ ] **Email Dispatch on Invoice Creation**:
  - [ ] Submit an invoice with Email Notifications turned ON.
  - [ ] Check inbox (or Resend dashboard): confirmation email received with invoice details.
- [ ] **Email Dispatch on Invoice Status Update**:
  - [ ] Admin marks invoice as Paid or Approved.
  - [ ] User receives real-time status update email.
- [ ] **Email Suppression**:
  - [ ] Toggle Email Notifications OFF in Settings.
  - [ ] Submit an invoice -> confirms no email sent, but invoice appears in dashboard safely.

---

## 🖥️ 12. RESPONSIVENESS & BROWSER SHORTCUTS

- [ ] **Quick Search / Command Palette**:
  - [ ] On Mac: Press `⌘K` -> opens search/command palette.
  - [ ] On Windows: Press `Ctrl + K` -> opens search/command palette.
- [ ] **Desktop Full-Screen Layout**:
  - [ ] Verify Settings page splits into 2 equal columns (Profile left, Preferences right).
  - [ ] Verify Invoice table and Billing view span full width without horizontal overflow.
- [ ] **Mobile & Tablet Responsiveness**:
  - [ ] Shrink browser window or test on mobile device.
  - [ ] Sidebar collapses into mobile hamburger menu.
  - [ ] Settings page stacks into a single, clean scrollable column.
  - [ ] Buttons and touch targets are easy to tap.

---

## 🚪 13. LOGOUT & SESSION TERMINATION

- [ ] **Sign Out**: Click user profile / **"Sign Out"** button in sidebar.
- [ ] **Session Cleared**: Confirms redirect to `/login`.
- [ ] **Protected Routes**: Attempting to visit `/dashboard` or `/settings` while logged out redirects back to `/login`.

---

**Status**: 
- Date Tested: ___________________
- Tested By: _____________________
- Ready for Deployment: [ ] YES  [ ] NO
