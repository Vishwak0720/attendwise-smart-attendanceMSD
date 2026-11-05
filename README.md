# Attendwise — Smart Student Attendance

A beginner-friendly MERN demo for faculty-controlled attendance sessions. The backend is authoritative: every attendance request checks the session status and expiry, student class, GPS radius, request IP, registered-device signature, passkey proof, and duplicate record constraint.

## What works

- Student and faculty sign-in, student registration, hashed passwords, role-protected routes, and short-lived JWTs.
- Faculty session start (5/10/15/20 minutes), manual stop, automatic expiry, class roster, present/absent reports, and CSV export.
- Server-validated GPS using the Haversine formula and a configurable campus radius.
- Server-side public IP/CIDR allowlist. The backend uses `req.ip`; forwarded headers are trusted only when their proxy is explicitly configured.
- First-device enrollment using a locally stored non-exportable WebCrypto private key; faculty can clear a student's device binding for replacement.
- WebAuthn passkeys with server-verified challenges, signatures, and user verification. The system stores passkey public keys, not fingerprints.
- Student dashboard, subject percentages, attendance history, faculty dashboard, and responsive layouts.

## Biometric and network limitations

- A browser passkey prompt may use Face ID, fingerprint, or another device screen-lock method. WebAuthn does not tell this app which biometric was used, and this project does **not** capture face images, perform face matching, or claim liveness detection. No raw biometric is sent to or stored by the server.
- Browsers do not expose the connected Wi-Fi SSID/BSSID to normal web pages. This project checks the source IP against `ALLOWED_IP_CIDRS`. A real college deployment must configure its public egress IP/ranges and trusted reverse proxies.
- Local allowlist entries are only a **local development test configuration**, not proof of being on campus. The device key provides browser key-possession proof, not an unspoofable hardware identity. Require a passkey for attendance and use faculty-controlled device resets.
- GPS coordinates can be spoofed on some devices. Treat GPS/IP/passkey checks as layered signals, not a substitute for institutional review or a managed campus network.

## Requirements

- Node.js 20 or newer and npm.
- MongoDB running locally, or a MongoDB connection string.
- A modern browser with WebAuthn/passkey support. Use `localhost` for the demo so WebAuthn and location permissions work without deploying HTTPS.

## Setup

1. Copy `backend/.env.example` to `backend/.env`.
2. Set `JWT_SECRET` to a random secret of at least 32 characters.
3. Set `COLLEGE_LATITUDE` and `COLLEGE_LONGITUDE` to your campus coordinates. Keep the 100 metre radius or adjust `COLLEGE_RADIUS_METERS`.
4. For a local-only demo, keep the loopback entries in `ALLOWED_IP_CIDRS`. For real use, replace them with authorized campus public IP addresses/CIDRs. Do not configure broad ranges such as `0.0.0.0/0`.
5. If behind a reverse proxy, set `TRUSTED_PROXIES` to only the proxy IP addresses/CIDRs. Leave it blank when running directly on localhost.
6. From the project root run:

   ```sh
   npm install
   npm run seed
   npm run dev
   ```

7. Open `http://localhost:5173`.

Run `npm run build` to create the production frontend bundle, and `npm test` to run the backend utility tests.

The seed command creates two subjects for class `CSE-3A` and these local demo accounts:

| Role | Email | Password |
|---|---|---|
| Faculty | `faculty@example.edu` | `FacultyDemo123!` |
| Student | `student@example.edu` | `StudentDemo123!` |

These are public demo credentials. Do not use them in a deployed system. The seeded student must enroll a device and passkey from the dashboard before attendance can be marked.

## Student registration

Registration is intentionally student-only and is available on the sign-in page; faculty accounts and subject assignments are provisioned by the administrator. The API accepts:

```json
{
  "name": "New Student",
  "email": "new.student@example.edu",
  "password": "AtLeast8Characters",
  "studentId": "STU-100",
  "className": "CSE-3A"
}
```

Send that JSON to `POST http://localhost:5000/api/auth/register`. Duplicate email addresses and student IDs are rejected.

## API outline

- Auth: `POST /api/auth/register`, `/login`, `/logout`
- Student: `GET /api/student/profile`, `/dashboard`, `/attendance`, `/attendance-percentage`; device enrollment under `/api/student/device/*`
- Faculty: `GET /api/faculty/dashboard`, `POST /api/faculty/start-session`, `POST /api/faculty/stop-session`, `GET /api/faculty/attendance-report`
- Attendance: `GET /api/attendance/active-session`, `/history`, `/percentage`, `POST /api/attendance/mark-present`
- Passkeys: `/api/biometric/register-options`, `/register-verify`, `/authenticate-options`, `/authenticate-verify`

## Project layout

```text
backend/
  src/config.js
  src/middleware/
  src/models/
  src/routes/
  src/utils/
  src/server.js
  src/seed.js
frontend/
  src/context/
  src/pages/
  src/services/
  src/App.jsx
  src/main.jsx
```

## Troubleshooting

- If login says the server is unavailable, confirm MongoDB is running and `backend/.env` has a valid `MONGODB_URI`.
- If attendance says college coordinates are missing, configure both latitude and longitude and restart the backend.
- If network verification fails, the backend's observed request IP is not in `ALLOWED_IP_CIDRS`; configure the actual local/test or campus range. Do not send an IP from the browser.
- If location permission is unavailable, use `localhost`, allow location access in the browser, and enable the device's location services.
- Passkeys are origin-bound. Use the same `localhost` URL configured by `CLIENT_ORIGIN`, and keep `RP_ID=localhost`.
- Device registration is one-time per student. For a replacement, a faculty member assigned to that class can use the dashboard-authorized reset endpoint; the student then registers the new browser.

## Security notes

Passwords use bcrypt hashing. API input is validated, authentication endpoints are rate-limited, faculty operations are role-protected, passkey challenges expire, requests must originate from a configured network, and a unique `(student, session)` database index prevents duplicate attendance. In production, use HTTPS, a managed secret store, a secure deployment configuration, backup/retention policies, monitoring, and an administrator-reviewed account/device enrollment process.
