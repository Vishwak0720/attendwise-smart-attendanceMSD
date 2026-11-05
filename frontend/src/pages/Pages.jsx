import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Activity, ArrowDownToLine, ArrowRight, BookOpen, Check, Clock3, Fingerprint, GraduationCap, LayoutDashboard, LogOut, MapPin, ShieldCheck, UserRound, Users, Wifi, X } from 'lucide-react';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import api, { errorMessage } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { registerDeviceKey, signDeviceChallenge } from '../services/deviceKey.js';

function PageShell({ children, title, subtitle }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = user.role === 'student'
    ? [
      { to: '/student', label: 'Overview', icon: LayoutDashboard },
      { to: '/attendance', label: 'Mark attendance', icon: MapPin },
      { to: '/history', label: 'Attendance history', icon: Clock3 }
    ]
    : [
      { to: '/faculty', label: 'Faculty dashboard', icon: LayoutDashboard },
      { to: '/faculty/new-session', label: 'Create session', icon: Clock3 }
    ];

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" to={user.role === 'faculty' ? '/faculty' : '/student'}>
          <span className="brand-icon"><Activity size={21} /></span>
          <span>attendwise<small>SMART ATTENDANCE</small></span>
        </Link>
        <div className="side-label">WORKSPACE</div>
        <nav className="side-nav">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon size={18} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="profile-chip">
            <span className="avatar">{user.name?.slice(0, 1).toUpperCase()}</span>
            <span className="profile-name">{user.name}<small>{user.role === 'faculty' ? 'Faculty' : user.studentId}</small></span>
          </div>
          <button className="nav-link logout-button" onClick={handleLogout}><LogOut size={18} /><span>Sign out</span></button>
        </div>
      </aside>
      <main className="main-content">
        <header className="page-heading">
          <div><p className="eyebrow">{user.role === 'faculty' ? 'FACULTY PORTAL' : 'STUDENT PORTAL'}</p><h1>{title}</h1><p className="subtitle">{subtitle}</p></div>
          <div className="header-user"><span className="online-dot" /> Signed in as <b>{user.name}</b></div>
        </header>
        {children}
      </main>
    </div>
  );
}

function Notice({ tone = 'info', children, onDismiss }) {
  return <div className={`notice ${tone}`} role="status">{children}{onDismiss && <button className="notice-close" onClick={onDismiss} aria-label="Dismiss"><X size={15} /></button>}</div>;
}

function StatCard({ icon: Icon, label, value, note, color = 'blue' }) {
  return <article className="stat-card"><div className={`stat-icon ${color}`}><Icon size={19} /></div><p>{label}</p><strong>{value}</strong>{note && <small>{note}</small>}</article>;
}

export function LoginPage() {
  const [role, setRole] = useState('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [className, setClassName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      if (isRegistering) {
        await api.post('/auth/register', { name, email, password, studentId, className });
        setSuccess('Student account created. Sign in with your new credentials.');
        setPassword('');
        setIsRegistering(false);
        return;
      }
      await login({ email, password, role });
      navigate(role === 'faculty' ? '/faculty' : '/student');
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-aside">
        <Link className="brand brand-light" to="/login"><span className="brand-icon"><Activity size={21} /></span><span>attendwise<small>SMART ATTENDANCE</small></span></Link>
        <div className="login-message">
          <div className="pill"><span className="online-dot" /> VERIFIED CAMPUS ATTENDANCE</div>
          <h1>Show up.<br /><span>Stay accountable.</span></h1>
          <p>A smarter, transparent way to manage every class — built for students and faculty.</p>
        </div>
        <div className="login-foot">GPS · Campus network · Passkeys</div>
      </div>
      <div className="login-main">
        <form className="login-card" onSubmit={submit}>
          <p className="eyebrow">{isRegistering ? 'STUDENT ENROLLMENT' : 'WELCOME BACK'}</p><h2>{isRegistering ? 'Create your student account' : 'Sign in to your account'}</h2><p className="muted">Choose your account type and enter your details.</p>
          <div className="role-switch">
            <button type="button" className={role === 'student' ? 'selected' : ''} onClick={() => { setRole('student'); setIsRegistering(false); }}><GraduationCap size={17} /> Student</button>
            <button type="button" className={role === 'faculty' ? 'selected' : ''} onClick={() => { setRole('faculty'); setIsRegistering(false); }}><Users size={17} /> Faculty</button>
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          {success && <Notice tone="success">{success}</Notice>}
          {isRegistering && <>
            <label>Full name<input required minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" /></label>
            <label>Student ID<input required value={studentId} onChange={(event) => setStudentId(event.target.value)} placeholder="e.g. STU-100" /></label>
            <label>Class<input required value={className} onChange={(event) => setClassName(event.target.value)} placeholder="e.g. CSE-3A" /></label>
          </>}
          <label>Email address<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@college.edu" /></label>
          <label>Password<input type="password" autoComplete={isRegistering ? 'new-password' : 'current-password'} minLength={isRegistering ? 8 : undefined} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isRegistering ? 'At least 8 characters' : 'Enter your password'} /></label>
          <button className="button primary wide" disabled={busy}>{busy ? 'Please wait…' : isRegistering ? 'Create account' : 'Sign in'} <ArrowRight size={17} /></button>
          {role === 'student' && <p className="login-note">{isRegistering ? 'Already enrolled?' : 'New student?'} <button className="text-button" type="button" onClick={() => { setIsRegistering(!isRegistering); setError(''); setSuccess(''); }}>{isRegistering ? 'Sign in' : 'Create an account'}</button></p>}
          {role === 'faculty' && <p className="login-note">Faculty accounts and subject assignments are managed by the project administrator.</p>}
        </form>
        <span className="copyright">Attendwise · Student Attendance Management</span>
      </div>
    </div>
  );
}

export function StudentDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [notice, setNotice] = useState('');
  const [noticeTone, setNoticeTone] = useState('info');
  const [busy, setBusy] = useState(false);

  async function loadDashboard() {
    const response = await api.get('/student/dashboard');
    setData(response.data);
  }
  useEffect(() => { loadDashboard().catch((error) => { setNoticeTone('error'); setNotice(errorMessage(error)); }); }, []);

  async function setupPasskey() {
    setBusy(true);
    setNoticeTone('info');
    setNotice('');
    try {
      const { data: options } = await api.post('/biometric/register-options');
      const response = await startRegistration({ optionsJSON: options });
      await api.post('/biometric/register-verify', response);
      setNoticeTone('success');
      setNotice('Passkey registered. Your device will ask for its supported biometric or screen lock.');
    } catch (error) {
      setNoticeTone('error');
      setNotice(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell title="Your overview" subtitle={`Welcome back, ${user.name}. Here's your attendance at a glance.`}>
      {notice && <Notice tone={noticeTone} onDismiss={() => setNotice('')}>{notice}</Notice>}
      <section className="stat-grid">
        <StatCard icon={BookOpen} label="Total classes" value={data?.totalClasses ?? '—'} color="blue" />
        <StatCard icon={Check} label="Classes attended" value={data?.classesAttended ?? '—'} color="green" />
        <StatCard icon={X} label="Classes missed" value={data?.classesMissed ?? '—'} color="orange" />
        <StatCard icon={Activity} label="Attendance rate" value={data ? `${data.attendancePercentage}%` : '—'} note="Across all recorded sessions" color="purple" />
      </section>
      {data?.activeSession ? (
        <section className="active-banner">
          <div className="active-symbol"><Clock3 size={22} /></div>
          <div><span className="status-label"><span className="online-dot" /> ATTENDANCE OPEN</span><h2>{data.activeSession.subject?.name}</h2><p>{data.activeSession.subject?.code} · {data.activeSession.className}</p></div>
          <Link className="button primary" to="/attendance">Mark attendance <ArrowRight size={16} /></Link>
        </section>
      ) : (
        <section className="empty-banner"><div className="empty-symbol"><Clock3 size={21} /></div><div><h3>No open attendance session</h3><p>Your faculty member has not started an attendance session for your class.</p></div></section>
      )}
      <section className="content-grid">
        <article className="panel">
          <div className="panel-heading"><div><h2>Subject attendance</h2><p>Your progress by subject</p></div><BookOpen size={19} /></div>
          {data?.subjects?.length ? <div className="subject-list">{data.subjects.map(({ subject, attended, total, percentage }) => (
            <div className="subject-row" key={subject._id}><div className="subject-line"><div><strong>{subject.name}</strong><small>{subject.code}</small></div><b>{percentage}%</b></div><div className="progress-track"><span style={{ width: `${percentage}%` }} /></div><small>{attended} of {total} classes attended</small></div>
          ))}</div> : <p className="empty-text">Your subject records will appear here after sessions are created.</p>}
        </article>
        <article className="panel setup-panel">
          <div className="panel-heading"><div><h2>Verification setup</h2><p>Prepare your device before class</p></div><ShieldCheck size={19} /></div>
          <SetupChecklist onPasskey={setupPasskey} busy={busy} />
        </article>
      </section>
    </PageShell>
  );
}

function SetupChecklist({ onPasskey, busy }) {
  const [profile, setProfile] = useState(null);
  const [message, setMessage] = useState('');
  useEffect(() => { api.get('/student/profile').then(({ data }) => setProfile(data.user)).catch((error) => setMessage(errorMessage(error))); }, []);

  async function setupDevice() {
    setMessage('');
    try {
      const publicKey = await registerDeviceKey();
      await api.post('/student/device/register', { publicKey });
      setProfile((current) => ({ ...current, hasDevice: true }));
      setMessage('This browser is registered to your account.');
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  return <>
    <div className="check-row"><span className={`check-mark ${profile?.hasDevice ? 'done' : ''}`}>{profile?.hasDevice ? <Check size={14} /> : <UserRound size={14} />}</span><div><strong>Register this device</strong><small>{profile?.hasDevice ? 'This browser is linked to your account.' : 'One-time setup in this browser.'}</small></div>{!profile?.hasDevice && <button className="text-button" onClick={setupDevice}>Set up</button>}</div>
    <div className="check-row"><span className={`check-mark ${profile?.hasPasskey ? 'done' : ''}`}>{profile?.hasPasskey ? <Check size={14} /> : <Fingerprint size={14} />}</span><div><strong>Set up a passkey</strong><small>{profile?.hasPasskey ? 'Passkey ready for verification.' : 'Uses device biometrics or screen lock.'}</small></div>{!profile?.hasPasskey && <button className="text-button" onClick={onPasskey} disabled={busy}>{busy ? 'Working…' : 'Set up'}</button>}</div>
    {message && <small className="setup-message">{message}</small>}
    <p className="helper-text">Your browser or device chooses the passkey unlock method. The app does not receive face images or fingerprints.</p>
  </>;
}

function getCoordinates() {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext) return reject(new Error('Location verification requires a secure HTTPS connection on your phone.'));
    if (!navigator.geolocation) return reject(new Error('This browser does not support location verification.'));
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      (error) => reject(new Error(error.code === 1 ? 'Location permission was denied.' : 'Could not get your location. Check GPS and try again.')),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 }
    );
  });
}

export function AttendancePage() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [steps, setSteps] = useState({ gps: 'waiting', network: 'waiting', device: 'waiting', passkey: 'waiting' });

  useEffect(() => {
    Promise.all([api.get('/attendance/active-session'), api.get('/student/profile')])
      .then(([sessionResponse, profileResponse]) => {
        setSession(sessionResponse.data.session);
        setProfile(profileResponse.data.user);
      })
      .catch((error) => setMessage(errorMessage(error)));
  }, []);

  async function registerPasskey() {
    setBusy(true);
    try {
      const { data: options } = await api.post('/biometric/register-options');
      const response = await startRegistration({ optionsJSON: options });
      await api.post('/biometric/register-verify', response);
      setProfile((current) => ({ ...current, hasPasskey: true }));
      setMessage('Passkey registered. You can now submit attendance.');
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function markPresent() {
    setMessage('');
    setBusy(true);
    setSteps({ gps: 'checking', network: 'checking', device: 'checking', passkey: 'checking' });
    try {
      if (!profile?.hasDevice) throw new Error('Register this device on your dashboard before marking attendance.');
      if (!profile?.hasPasskey) throw new Error('Register a passkey on your dashboard before marking attendance.');
      const coordinates = await getCoordinates();
      setSteps((current) => ({ ...current, gps: 'passed' }));
      const { data: options } = await api.post('/biometric/authenticate-options', { sessionId: session._id });
      const assertion = await startAuthentication({ optionsJSON: options });
      const { data: auth } = await api.post('/biometric/authenticate-verify', assertion);
      setSteps((current) => ({ ...current, passkey: 'passed' }));
      const { data: device } = await api.post('/student/device/challenge');
      const signature = await signDeviceChallenge(device.challenge);
      setSteps((current) => ({ ...current, device: 'passed' }));
      await api.post('/attendance/mark-present', {
        sessionId: session._id,
        ...coordinates,
        biometricTicket: auth.ticket,
        deviceChallenge: device.challenge,
        deviceSignature: signature
      });
      setSteps({ gps: 'passed', network: 'passed', device: 'passed', passkey: 'passed' });
      setMessage('Attendance marked present. All checks passed.');
      setSession(null);
    } catch (error) {
      const reason = error.response?.data?.message?.toLowerCase() || '';
      setSteps((current) => ({
        ...current,
        ...(reason.includes('gps') || reason.includes('location') ? { gps: 'failed' } : {}),
        ...(reason.includes('network') || reason.includes('ip') ? { network: 'failed' } : {}),
        ...(reason.includes('device') ? { device: 'failed' } : {}),
        ...(reason.includes('passkey') ? { passkey: 'failed' } : {})
      }));
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell title="Mark attendance" subtitle="Complete each verification check while the faculty session is active.">
      {message && <Notice tone={message.includes('marked present') ? 'success' : 'error'}>{message}</Notice>}
      {!session ? <section className="panel empty-session"><div className="empty-symbol"><Clock3 size={24} /></div><h2>No active session</h2><p>Attendance is only available after your faculty member starts a session.</p><Link className="button secondary" to="/student">Back to dashboard</Link></section> : (
        <div className="attendance-layout">
          <section className="panel session-panel">
            <span className="status-label"><span className="online-dot" /> SESSION ACTIVE</span>
            <h2>{session.subject?.name}</h2><p className="muted">{session.subject?.code} · {session.className}</p>
            <div className="session-time"><Clock3 size={16} /><span>Closes at <b>{new Date(session.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</b></span></div>
            <button className="button primary wide mark-button" onClick={markPresent} disabled={busy || !profile?.hasDevice || !profile?.hasPasskey}>
              {busy ? 'Verifying…' : 'Verify & mark present'} <ArrowRight size={17} />
            </button>
            {(!profile?.hasDevice || !profile?.hasPasskey) && <p className="inline-hint">Complete device and passkey setup on your <Link to="/student">dashboard</Link> first.</p>}
            <p className="helper-text">The server checks the current session, location, request IP, registered device signature and passkey assertion. An open page cannot bypass expiry.</p>
          </section>
          <section className="panel verification-panel">
            <div className="panel-heading"><div><h2>Verification steps</h2><p>All checks must pass</p></div><ShieldCheck size={20} /></div>
            <VerificationRow icon={MapPin} name="College location" detail="Current GPS position" state={steps.gps} />
            <VerificationRow icon={Wifi} name="College network" detail="Request IP verified by server" state={steps.network} />
            <VerificationRow icon={UserRound} name="Registered device" detail="Cryptographic device key" state={steps.device} />
            <VerificationRow icon={Fingerprint} name="Device passkey" detail="Biometric or device screen lock" state={steps.passkey} />
            <p className="helper-text">A browser cannot report Wi-Fi name; network verification uses the connection's public IP.</p>
          </section>
        </div>
      )}
    </PageShell>
  );
}

function VerificationRow({ icon: Icon, name, detail, state }) {
  const label = { waiting: 'Waiting', checking: 'Checking', passed: 'Verified', failed: 'Failed' }[state];
  return <div className={`verification-row ${state}`}><span className="verification-icon"><Icon size={17} /></span><div><strong>{name}</strong><small>{detail}</small></div><span className="verification-state">{state === 'passed' ? <Check size={14} /> : null}{label}</span></div>;
}

export function HistoryPage() {
  const [records, setRecords] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => { api.get('/attendance/history').then(({ data }) => setRecords(data.records)).catch((requestError) => setError(errorMessage(requestError))); }, []);
  return <PageShell title="Attendance history" subtitle="Review the attendance records saved to your account.">
    {error && <Notice tone="error">{error}</Notice>}
    <section className="panel table-panel">
      <div className="panel-heading"><div><h2>Past sessions</h2><p>{records.length} attendance record{records.length === 1 ? '' : 's'}</p></div><Clock3 size={19} /></div>
      {records.length ? <div className="table-scroll"><table><thead><tr><th>Subject</th><th>Date</th><th>Time</th><th>Status</th><th>Verification</th></tr></thead><tbody>{records.map((record) => (
        <tr key={record._id}><td><strong>{record.subject?.name}</strong><small className="cell-sub">{record.subject?.code}</small></td><td>{new Date(record.markedAt).toLocaleDateString()}</td><td>{new Date(record.markedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td><td><span className="badge present">{record.status}</span></td><td><span className="checks">{Object.values(record.verification || {}).filter(Boolean).length}/4 checks</span></td></tr>
      ))}</tbody></table></div> : <p className="empty-text">No attendance records yet. Records appear here once a session is complete.</p>}
    </section>
  </PageShell>;
}

export function FacultyDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(null);

  async function load() {
    const response = await api.get('/faculty/dashboard');
    setData(response.data);
  }
  useEffect(() => { load().catch((requestError) => setError(errorMessage(requestError))); }, []);

  async function stopSession() {
    setBusy(true);
    setError('');
    try {
      await api.post('/faculty/stop-session', { sessionId: data.activeSession._id });
      await load();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function showReport(sessionId) {
    setError('');
    try {
      const { data: reportData } = await api.get('/faculty/attendance-report', { params: { sessionId } });
      setReport(reportData);
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }

  async function downloadReport(sessionId) {
    try {
      const response = await api.get('/faculty/attendance-report', {
        params: { sessionId, format: 'csv' },
        responseType: 'blob'
      });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'attendance-report.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }

  async function resetDevice(student) {
    if (!window.confirm(`Reset the registered device for ${student.name}? They will need to register this browser again.`)) return;
    setError('');
    try {
      await api.post(`/faculty/students/${student.id}/reset-device`);
      await load();
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }

  const present = data?.records || [];
  return <PageShell title="Faculty dashboard" subtitle="Manage class attendance sessions and review student participation.">
    {error && <Notice tone="error">{error}</Notice>}
    <section className="stat-grid faculty-stats">
      <StatCard icon={Users} label="Students in your classes" value={data?.students?.length ?? '—'} color="blue" />
      <StatCard icon={BookOpen} label="Assigned subjects" value={data?.subjects?.length ?? '—'} color="purple" />
      <StatCard icon={Check} label="Present in active session" value={data?.activeSession ? present.length : '—'} color="green" />
      <StatCard icon={Activity} label="Session status" value={data?.activeSession ? 'Active' : 'Closed'} color={data?.activeSession ? 'green' : 'orange'} />
    </section>
    {data?.activeSession ? <section className="active-banner faculty-active">
      <div className="active-symbol"><Clock3 size={22} /></div>
      <div className="session-summary"><span className="status-label"><span className="online-dot" /> ATTENDANCE OPEN</span><h2>{data.activeSession.subject?.name}</h2><p>{data.activeSession.className} · Ends {new Date(data.activeSession.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p></div>
      <button className="button danger" onClick={stopSession} disabled={busy}>{busy ? 'Stopping…' : 'Stop attendance'} <X size={16} /></button>
    </section> : <section className="empty-banner faculty-empty"><div className="empty-symbol"><Clock3 size={21} /></div><div><h3>Attendance is inactive</h3><p>Create a session when you are ready to take attendance.</p></div><Link className="button primary" to="/faculty/new-session">Start attendance <ArrowRight size={16} /></Link></section>}
    <section className="panel table-panel">
      <div className="panel-heading"><div><h2>{data?.activeSession ? 'Current session attendance' : 'Your subjects'}</h2><p>{data?.activeSession ? `${present.length} students marked present` : 'Subjects and classes assigned to you'}</p></div><Users size={19} /></div>
      {data?.activeSession ? <div className="table-scroll"><table><thead><tr><th>Student</th><th>Student ID</th><th>Status</th><th>Verification</th></tr></thead><tbody>{present.map((record) => <tr key={record._id}><td><strong>{record.student?.name}</strong></td><td>{record.student?.studentId}</td><td><span className="badge present">Present</span></td><td><span className="checks">{Object.values(record.verification || {}).filter(Boolean).length}/4 passed</span></td></tr>)}</tbody></table>{present.length === 0 && <p className="empty-text">No students have marked attendance yet.</p>}</div> : <div className="subject-cards">{data?.subjects?.map((subject) => <div className="subject-card" key={subject._id}><span className="subject-code">{subject.code}</span><h3>{subject.name}</h3><small>{subject.className}</small></div>)}</div>}
    </section>
    {data?.activeSession && <section className="report-actions"><button className="button secondary" onClick={() => showReport(data.activeSession._id)}>View present & absent</button><button className="button secondary" onClick={() => downloadReport(data.activeSession._id)}><ArrowDownToLine size={16} /> Download CSV</button></section>}
    {!!data?.recentSessions?.length && <section className="panel table-panel recent-sessions"><div className="panel-heading"><div><h2>Recent sessions</h2><p>View attendance and export reports for past sessions</p></div><Clock3 size={19} /></div><div className="table-scroll"><table><thead><tr><th>Subject</th><th>Class</th><th>Date</th><th>Session</th><th>Reports</th></tr></thead><tbody>{data.recentSessions.map((item) => <tr key={item._id}><td><strong>{item.subject?.name}</strong><small className="cell-sub">{item.subject?.code}</small></td><td>{item.className}</td><td>{new Date(item.startsAt).toLocaleDateString()}</td><td><span className={`badge ${item.status === 'active' && new Date(item.expiresAt) > new Date() ? 'present' : 'absent'}`}>{item.status === 'active' && new Date(item.expiresAt) > new Date() ? 'Active' : 'Closed'}</span></td><td><button className="text-button" onClick={() => showReport(item._id)}>View</button><button className="text-button" onClick={() => downloadReport(item._id)}>CSV</button></td></tr>)}</tbody></table></div></section>}
    {!!data?.students?.length && <section className="panel table-panel recent-sessions"><div className="panel-heading"><div><h2>Student devices</h2><p>Manage registered browsers for students in your classes</p></div><UserRound size={19} /></div><div className="table-scroll"><table><thead><tr><th>Student</th><th>Student ID</th><th>Class</th><th>Device</th><th>Action</th></tr></thead><tbody>{data.students.map((student) => <tr key={student.id}><td><strong>{student.name}</strong></td><td>{student.studentId}</td><td>{student.className}</td><td><span className={`badge ${student.hasDevice ? 'present' : 'absent'}`}>{student.hasDevice ? 'Registered' : 'Not set up'}</span></td><td>{student.hasDevice && <button className="text-button" onClick={() => resetDevice(student)}>Reset device</button>}</td></tr>)}</tbody></table></div></section>}
    {report && <ReportTable report={report} onClose={() => setReport(null)} />}
  </PageShell>;
}

function ReportTable({ report, onClose }) {
  return <section className="panel table-panel report-table"><div className="panel-heading"><div><h2>Session report</h2><p>{report.session.subject?.name} · {report.rows.filter((row) => row.status === 'Present').length} present, {report.rows.filter((row) => row.status === 'Absent').length} absent</p></div><button className="icon-button" onClick={onClose} aria-label="Close report"><X size={17} /></button></div>
    <div className="table-scroll"><table><thead><tr><th>Student</th><th>Student ID</th><th>Status</th><th>Marked at</th></tr></thead><tbody>{report.rows.map((row) => <tr key={row.studentId}><td>{row.name}</td><td>{row.studentId}</td><td><span className={`badge ${row.status.toLowerCase()}`}>{row.status}</span></td><td>{row.markedAt ? new Date(row.markedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td></tr>)}</tbody></table></div>
  </section>;
}

export function CreateSessionPage() {
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(10);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/faculty/dashboard').then(({ data }) => {
      setSubjects(data.subjects);
      if (data.subjects.length) setSubjectId(data.subjects[0]._id);
      if (data.activeSession) setMessage('An attendance session is already active. Stop it before starting another.');
    }).catch((error) => setMessage(errorMessage(error)));
  }, []);

  async function startSession(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await api.post('/faculty/start-session', { subjectId, durationMinutes: Number(durationMinutes) });
      navigate('/faculty');
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return <PageShell title="Create attendance session" subtitle="Choose a class and set how long the attendance window stays open.">
    <div className="create-session-wrap">
      <form className="panel session-form" onSubmit={startSession}>
        <div className="panel-heading"><div><h2>Session details</h2><p>Students can mark attendance only while this session is open.</p></div><Clock3 size={20} /></div>
        {message && <Notice tone={message.includes('already active') ? 'info' : 'error'}>{message}</Notice>}
        <label>Subject and class<select value={subjectId} onChange={(event) => setSubjectId(event.target.value)} required disabled={!subjects.length}><option value="" disabled>Select a subject</option>{subjects.map((subject) => <option value={subject._id} key={subject._id}>{subject.code} · {subject.name} ({subject.className})</option>)}</select></label>
        <fieldset><legend>Attendance duration</legend><div className="duration-options">{[5, 10, 15, 20].map((minutes) => <button key={minutes} type="button" className={Number(durationMinutes) === minutes ? 'chosen' : ''} onClick={() => setDurationMinutes(minutes)}><strong>{minutes}</strong><small>minutes</small></button>)}</div></fieldset>
        <div className="session-warning"><ShieldCheck size={18} /><span>The server closes this session automatically at expiry and rejects late requests.</span></div>
        <button className="button primary wide" disabled={busy || !subjects.length}>{busy ? 'Starting…' : 'Start attendance'} <ArrowRight size={17} /></button>
        {!subjects.length && <p className="empty-text">No subjects are assigned to your faculty account. Ask the administrator to add one.</p>}
      </form>
    </div>
  </PageShell>;
}
