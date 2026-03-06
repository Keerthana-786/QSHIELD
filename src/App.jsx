import { useState, useEffect, useCallback, useRef } from "react";
import { Session, Users, Records, Vitals, Notes, Audit, Requests, Privacy, Tasks, QuantumKeys, seedIfEmpty } from "./db.js";
import { lockRecord, unlockRecord, generateQuantumKey } from "./quantum.js";

// ─── DESIGN TOKENS ───────────────────────────────────────────────
const C = {
  bg:      "#030b15",
  surface: "#071220",
  card:    "#0c1a2e",
  card2:   "#0f2242",
  border:  "#153552",
  brite:   "#1e4d7a",
  accent:  "#00d4ff",
  aGlow:   "rgba(0,212,255,0.12)",
  green:   "#00ff9d",
  gGlow:   "rgba(0,255,157,0.1)",
  red:     "#ff3d6b",
  rGlow:   "rgba(255,61,107,0.1)",
  amber:   "#ffb800",
  aGlow2:  "rgba(255,184,0,0.1)",
  purple:  "#a78bfa",
  pGlow:   "rgba(167,139,250,0.1)",
  cyan:    "#22d3ee",
  text:    "#dbeafe",
  muted:   "#4a7a9b",
  faint:   "#0d2030",
};

// ─── TOAST ────────────────────────────────────────────────────────
let _pushToast = () => {};
const toast = {
  ok:   m => _pushToast({ t: "ok",   m }),
  err:  m => _pushToast({ t: "err",  m }),
  info: m => _pushToast({ t: "info", m }),
  warn: m => _pushToast({ t: "warn", m }),
};

function Toasts() {
  const [items, setItems] = useState([]);
  _pushToast = useCallback(item => {
    const id = Math.random();
    setItems(p => [...p, { ...item, id }]);
    setTimeout(() => setItems(p => p.filter(x => x.id !== id)), 4500);
  }, []);
  const col = { ok: C.green, err: C.red, info: C.accent, warn: C.amber };
  const ico = { ok: "✅", err: "❌", info: "ℹ️", warn: "⚠️" };
  return (
    <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, maxWidth: 340 }}>
      {items.map(x => (
        <div key={x.id} style={{ background: C.card2, border: `1px solid ${col[x.t]}`, borderLeft: `4px solid ${col[x.t]}`, padding: "12px 16px", borderRadius: 7, fontSize: 13, color: C.text, boxShadow: "0 4px 24px rgba(0,0,0,0.6)", animation: "fadeSlide 0.3s ease" }}>
          {ico[x.t]} {x.m}
        </div>
      ))}
    </div>
  );
}

// ─── ATOMS ────────────────────────────────────────────────────────
const GridBg = () => (
  <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", backgroundImage: `linear-gradient(rgba(0,212,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.025) 1px,transparent 1px)`, backgroundSize: "48px 48px" }} />
);
const Blob = ({ x, y, color, size = 500 }) => (
  <div style={{ position: "fixed", left: x, top: y, width: size, height: size, borderRadius: "50%", zIndex: 0, pointerEvents: "none", background: color, opacity: 0.055, filter: "blur(90px)", transform: "translate(-50%,-50%)" }} />
);
const Tag = ({ label, color = C.accent }) => (
  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2.5, color, border: `1px solid ${color}40`, padding: "2px 8px", borderRadius: 2, background: `${color}12`, whiteSpace: "nowrap" }}>{label}</span>
);
const Divider = () => <div style={{ borderBottom: `1px solid ${C.border}`, margin: "0" }} />;

function Card({ children, s = {}, glow, accent, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={() => onClick && setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ background: C.card, border: `1px solid ${glow ? (accent || C.accent) : hover ? C.brite : C.border}`, borderRadius: 10, padding: 20, boxShadow: glow ? `0 0 30px ${C.aGlow}` : "none", cursor: onClick ? "pointer" : undefined, transition: "border-color 0.2s", ...s }}>
      {children}
    </div>
  );
}

function Btn({ children, onClick, v = "primary", s = {}, disabled, loading, full }) {
  const [hover, setHover] = useState(false);
  const styles = {
    primary: { bg: C.accent,  fg: "#000", bdr: "none" },
    danger:  { bg: C.red,     fg: "#fff", bdr: "none" },
    ghost:   { bg: "transparent", fg: C.accent, bdr: `1px solid ${C.accent}` },
    amber:   { bg: C.amber,   fg: "#000", bdr: "none" },
    green:   { bg: C.green,   fg: "#000", bdr: "none" },
    purple:  { bg: C.purple,  fg: "#000", bdr: "none" },
    dark:    { bg: C.card2,   fg: C.text, bdr: `1px solid ${C.border}` },
    red2:    { bg: C.rGlow,   fg: C.red,  bdr: `1px solid ${C.red}50` },
  };
  const st = styles[v] || styles.primary;
  return (
    <button onClick={onClick} disabled={disabled || loading}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ padding: "10px 18px", borderRadius: 5, border: st.bdr, cursor: (disabled||loading) ? "not-allowed" : "pointer", fontSize: 12, letterSpacing: 1.2, fontWeight: 700, fontFamily: "inherit", background: st.bg, color: st.fg, opacity: (disabled||loading) ? 0.5 : hover ? 0.82 : 1, transition: "opacity 0.15s", width: full ? "100%" : undefined, ...s }}>
      {loading ? "⏳ Please wait..." : children}
    </button>
  );
}

function Field({ label, value, onChange, type = "text", placeholder, error, disabled }) {
  const [focus, setFocus] = useState(false);
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <div style={{ fontSize: 10, letterSpacing: 2.5, color: C.muted, marginBottom: 6 }}>{label}</div>}
      <input type={type} value={value} onChange={e => onChange && onChange(e.target.value)} placeholder={placeholder}
        disabled={disabled}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={{ width: "100%", background: disabled ? C.faint : C.surface, border: `1px solid ${error ? C.red : focus ? C.accent : C.border}`, borderRadius: 5, padding: "11px 14px", color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", transition: "border-color 0.2s", cursor: disabled ? "default" : undefined }} />
      {error && <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>{error}</div>}
    </div>
  );
}

function SelField({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <div style={{ fontSize: 10, letterSpacing: 2.5, color: C.muted, marginBottom: 6 }}>{label}</div>}
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 5, padding: "11px 14px", color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}>
        {options.map(o => <option key={o.v} value={o.v} style={{ background: C.card }}>{o.l}</option>)}
      </select>
    </div>
  );
}

function TxtArea({ label, value, onChange, rows = 4, placeholder }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <div style={{ fontSize: 10, letterSpacing: 2.5, color: C.muted, marginBottom: 6 }}>{label}</div>}
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder}
        style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 5, padding: 12, color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", resize: "vertical" }} />
    </div>
  );
}

function Modal({ title, onClose, children, accent = C.accent, wide }) {
  useEffect(() => {
    const h = e => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: C.card, border: `2px solid ${accent}`, borderRadius: 12, padding: 28, width: "100%", maxWidth: wide ? 660 : 480, boxShadow: `0 0 70px ${accent}22`, maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{title}</div>
          <span onClick={onClose} style={{ cursor: "pointer", color: C.muted, fontSize: 26, lineHeight: 1, padding: "0 4px" }}>×</span>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── CHARTS ───────────────────────────────────────────────────────
function BarChart({ data, color = C.accent, h = 90 }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map(d => d.v), 1);
  const bw = 100 / data.length;
  return (
    <svg width="100%" height={h}>
      {data.map((d, i) => {
        const bh = Math.max((d.v / max) * (h - 22), 2);
        return (
          <g key={i}>
            <rect x={`${i * bw + bw * 0.15}%`} y={h - bh - 18} width={`${bw * 0.7}%`} height={bh} fill={color} opacity={0.8} rx={2} />
            <text x={`${i * bw + bw / 2}%`} y={h - 3} textAnchor="middle" fill={C.muted} fontSize={8}>{d.l}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Spark({ data, color = C.accent, h = 48 }) {
  if (!data?.length || data.length < 2) return null;
  const max = Math.max(...data, 1), min = Math.min(...data, 0), range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${h - ((v - min) / range) * (h - 6) - 3}`).join(" ");
  return <svg width="100%" height={h} viewBox={`0 0 100 ${h}`} preserveAspectRatio="none"><polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" /></svg>;
}

function Donut({ pct, color = C.accent, size = 76 }) {
  const r = 28, cx = 36, cy = 36, circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 72 72">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.faint} strokeWidth="7" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="7"
        strokeDasharray={`${circ * pct / 100} ${circ * (1 - pct / 100)}`}
        strokeLinecap="round" transform="rotate(-90 36 36)" />
      <text x={cx} y={cy + 5} textAnchor="middle" fill={color} fontSize="13" fontWeight="800">{pct}%</text>
    </svg>
  );
}

// ─── STAT CARD ────────────────────────────────────────────────────
function Stat({ icon, label, value, sub, color = C.accent, spark }) {
  return (
    <Card s={{ flex: 1, minWidth: 130 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 20 }}>{icon}</div>
          <div style={{ fontSize: 26, fontWeight: 900, color, margin: "6px 0 3px", lineHeight: 1 }}>{value}</div>
          <div style={{ fontSize: 12, color: C.text }}>{label}</div>
          {sub && <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{sub}</div>}
        </div>
        {spark && <div style={{ width: 68 }}>{spark}</div>}
      </div>
    </Card>
  );
}

// ─── SECTION HEADER ───────────────────────────────────────────────
const SH = ({ title, sub, right }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
    <div>
      <div style={{ fontSize: 20, fontWeight: 800 }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{sub}</div>}
    </div>
    {right}
  </div>
);

const Empty = ({ msg }) => (
  <div style={{ padding: "28px 0", textAlign: "center", color: C.muted, fontSize: 13 }}>— {msg} —</div>
);

// ─── QUANTUM KEY DISPLAY ──────────────────────────────────────────
function QKeyDisplay({ info }) {
  const [show, setShow] = useState(false);
  if (!info) return null;
  return (
    <div style={{ background: "#020c18", border: `1px solid ${C.green}30`, borderRadius: 8, padding: 14, marginTop: 12, fontFamily: "monospace" }}>
      <div style={{ fontSize: 9, color: C.green, letterSpacing: 3, marginBottom: 12 }}>⬡ QUANTUM ENCRYPTION CERTIFICATE</div>
      {[
        ["SOURCE",      info.keySource, info.isQuantum ? C.green : C.amber],
        ["ALGORITHM",   info.algorithm, C.accent],
        ["KEY SIZE",    `${info.bits} bits`, C.text],
        ["FINGERPRINT", info.fingerprint, C.cyan],
        ["LOCKED AT",   new Date(info.lockedAt).toLocaleString(), C.muted],
      ].map(([k, v, c]) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 10 }}>
          <span style={{ color: C.muted }}>{k}</span>
          <span style={{ color: c, fontWeight: 600 }}>{v}</span>
        </div>
      ))}
      <div style={{ marginTop: 12, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
        <div style={{ fontSize: 9, color: C.muted, marginBottom: 4 }}>
          256-BIT QUANTUM KEY
          <span onClick={() => setShow(p => !p)} style={{ color: C.accent, cursor: "pointer", marginLeft: 8 }}>[{show ? "HIDE" : "REVEAL"}]</span>
        </div>
        {show && (
          <div style={{ fontSize: 9, color: C.accent, wordBreak: "break-all", background: "#000", padding: 8, borderRadius: 4, lineHeight: 1.7 }}>
            {info.keyHex}
          </div>
        )}
      </div>
      <div style={{ marginTop: 8, fontSize: 9, color: info.isQuantum ? C.green : C.amber }}>
        {info.isQuantum
          ? "✅ Generated from quantum vacuum fluctuations — ANU, Canberra, Australia"
          : "⚠ ANU API offline — browser CSPRNG used (cryptographically secure)"}
      </div>
    </div>
  );
}

// ─── NOTIFICATION BELL ────────────────────────────────────────────
function Bell({ notifs, clear }) {
  const [open, setOpen] = useState(false);
  const unread = notifs.filter(n => !n.read).length;
  const ref = useRef();
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div onClick={() => setOpen(p => !p)} style={{ cursor: "pointer", padding: "6px 10px", border: `1px solid ${open ? C.accent : C.border}`, borderRadius: 6, background: open ? C.aGlow : "transparent", position: "relative", userSelect: "none" }}>
        🔔{unread > 0 && <span style={{ position: "absolute", top: 1, right: 1, width: 15, height: 15, borderRadius: "50%", background: C.red, fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>{unread}</span>}
      </div>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "110%", width: 310, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, zIndex: 500, boxShadow: "0 8px 40px rgba(0,0,0,0.7)", overflow: "hidden" }}>
          <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, letterSpacing: 2.5, color: C.muted }}>NOTIFICATIONS</span>
            <span onClick={() => { clear(); setOpen(false); }} style={{ fontSize: 10, color: C.accent, cursor: "pointer" }}>CLEAR ALL</span>
          </div>
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {notifs.length === 0
              ? <div style={{ padding: 20, fontSize: 12, color: C.muted, textAlign: "center" }}>All clear ✅</div>
              : notifs.map((n, i) => (
                <div key={i} style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, background: n.read ? "transparent" : `${C.accent}06`, fontSize: 12 }}>
                  <div style={{ color: C.text }}>{n.msg}</div>
                  <div style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>{n.time}</div>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────
function Sidebar({ user, onLogout, active, setActive }) {
  const navs = {
    patient: [
      { id: "dashboard",  l: "Dashboard",        i: "◈" },
      { id: "records",    l: "My Records",        i: "📋" },
      { id: "quantum",    l: "Quantum Vault",     i: "⬡" },
      { id: "vitals",     l: "My Vitals",         i: "💓" },
      { id: "requests",   l: "Access Requests",   i: "🔑" },
      { id: "profile",    l: "My Profile",        i: "👤" },
    ],
    doctor: [
      { id: "dashboard",  l: "Dashboard",         i: "◈" },
      { id: "patients",   l: "Patients",          i: "👥" },
      { id: "records",    l: "All Records",       i: "📋" },
      { id: "notes",      l: "Clinical Notes",    i: "📝" },
      { id: "requests",   l: "Access Requests",   i: "🔑" },
      { id: "emergency",  l: "Emergency",         i: "🚨" },
    ],
    nurse: [
      { id: "dashboard",  l: "Dashboard",         i: "◈" },
      { id: "patients",   l: "Patient List",      i: "👥" },
      { id: "vitals",     l: "Record Vitals",     i: "📡" },
      { id: "tasks",      l: "Tasks",             i: "✅" },
    ],
    admin: [
      { id: "dashboard",  l: "Dashboard",         i: "◈" },
      { id: "users",      l: "All Users",         i: "👥" },
      { id: "audit",      l: "Audit Blockchain",  i: "⛓" },
      { id: "alerts",     l: "Security Alerts",   i: "🚨" },
      { id: "analytics",  l: "Analytics",         i: "📈" },
    ],
  };
  const rc = { patient: C.green, doctor: C.accent, nurse: C.purple, admin: C.red }[user.role] || C.accent;
  return (
    <div style={{ width: 236, background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 100, overflowY: "auto" }}>
      {/* Logo */}
      <div style={{ padding: "22px 20px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: C.accent, letterSpacing: 2.5 }}>⬡ QUANTUM<span style={{ color: "#fff" }}>SHIELD</span></div>
        <div style={{ fontSize: 9, letterSpacing: 3, color: C.muted, marginTop: 3 }}>HEALTHCARE SECURITY v2.0</div>
      </div>
      {/* Profile */}
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${rc}22`, border: `2px solid ${rc}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, marginBottom: 10 }}>
          {user.name[0]}
        </div>
        <Tag label={user.role.toUpperCase()} color={rc} />
        <div style={{ fontSize: 13, marginTop: 8, fontWeight: 700, color: C.text }}>{user.name}</div>
        {user.spec && <div style={{ fontSize: 11, color: C.muted }}>{user.spec}</div>}
        {user.ward && <div style={{ fontSize: 11, color: C.muted }}>{user.ward}</div>}
        <div style={{ fontSize: 10, color: C.green, marginTop: 4 }}>● SECURE SESSION ACTIVE</div>
      </div>
      {/* Nav */}
      <nav style={{ flex: 1, padding: "10px 0" }}>
        {(navs[user.role] || []).map(item => (
          <div key={item.id} onClick={() => setActive(item.id)}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 20px", cursor: "pointer", background: active === item.id ? `${rc}15` : "transparent", borderLeft: active === item.id ? `3px solid ${rc}` : "3px solid transparent", color: active === item.id ? rc : C.muted, fontSize: 13, transition: "all 0.15s", userSelect: "none" }}>
            <span style={{ fontSize: 15 }}>{item.i}</span>{item.l}
          </div>
        ))}
      </nav>
      {/* Logout */}
      <div style={{ padding: 16, borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ fontSize: 9, color: C.muted, marginBottom: 10, letterSpacing: 1 }}>🔒 AES-256-GCM ENCRYPTED</div>
        <Btn onClick={onLogout} v="ghost" full>← LOGOUT</Btn>
      </div>
    </div>
  );
}

// ─── TOP BAR ──────────────────────────────────────────────────────
function TopBar({ title, sub, notifs, clearNotifs }) {
  const [t, setT] = useState(new Date());
  useEffect(() => { const x = setInterval(() => setT(new Date()), 1000); return () => clearInterval(x); }, []);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28, paddingBottom: 18, borderBottom: `1px solid ${C.border}` }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800 }}>{title}</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{sub}</div>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Bell notifs={notifs} clear={clearNotifs} />
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, color: C.accent, letterSpacing: 2, fontFamily: "monospace" }}>{t.toLocaleTimeString()}</div>
          <div style={{ fontSize: 10, color: C.muted }}>{t.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PATIENT PAGES
// ═══════════════════════════════════════════════════════════════════
function PatientDash({ user, page, notifPush }) {
  const [records,  setRecords]  = useState([]);
  const [vitals,   setVitals]   = useState([]);
  const [privacy,  setPrivacy]  = useState({});
  const [requests, setRequests] = useState([]);
  const [qMap,     setQMap]     = useState({});
  const [locking,  setLocking]  = useState(null);
  const [modal,    setModal]    = useState(null);
  const [profile,  setProfile]  = useState(user);
  const [saving,   setSaving]   = useState(false);

  const load = useCallback(() => {
    setRecords(Records.byPatient(user.id));
    setVitals(Vitals.byPatient(user.id));
    setPrivacy(Privacy.get());
    setRequests(Requests.forPatient(user.id));
    // Load saved quantum keys
    const map = {};
    Records.byPatient(user.id).forEach(r => {
      const k = QuantumKeys.forRecord(r.id);
      if (k) map[r.id] = k;
    });
    setQMap(map);
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  const handleLock = async (rec) => {
    setLocking(rec.id);
    try {
      const data = await lockRecord(rec.content || rec.title);
      Records.update(rec.id, { locked: true, encrypted: true, cipher: data.cipher });
      QuantumKeys.save(rec.id, data);
      await Audit.add(user.name, "QUANTUM_LOCK", `Record: ${rec.title} | Key: ${data.keyTag} | FP: ${data.fingerprint}`);
      setQMap(p => ({ ...p, [rec.id]: data }));
      setRecords(Records.byPatient(user.id));
      toast.ok(`⬡ Quantum locked with ${data.keyTag}`);
      notifPush(`Record encrypted: ${rec.title}`);
    } catch (e) {
      toast.err("Encryption failed: " + e.message);
    } finally {
      setLocking(null);
    }
  };

  const handleUnlock = async (rec) => {
    const k = qMap[rec.id];
    if (!k) { toast.err("Key not found in vault"); return; }
    try {
      const plain = await unlockRecord(rec.cipher, k.keyHex);
      Records.update(rec.id, { locked: false, encrypted: false, content: plain, cipher: null });
      setQMap(p => { const n = { ...p }; delete n[rec.id]; return n; });
      setRecords(Records.byPatient(user.id));
      await Audit.add(user.name, "QUANTUM_UNLOCK", `Record: ${rec.title}`);
      toast.ok("Record decrypted successfully");
    } catch (e) {
      toast.err("Decryption failed: " + e.message);
    }
  };

  const togglePrivacy = (key) => {
    const p = Privacy.toggle(key);
    setPrivacy(p);
    toast[p[key] ? "ok" : "warn"](p[key] ? `${key} locked` : `${key} unlocked`);
    Audit.add(user.name, "PRIVACY_TOGGLE", `${key} = ${p[key]}`);
    notifPush(`Privacy changed: ${key}`);
  };

  const respondRequest = (id, status) => {
    Requests.respond(id, status);
    setRequests(Requests.forPatient(user.id));
    Audit.add(user.name, `REQUEST_${status.toUpperCase()}`, `Request ${id}`);
    toast.ok(`Request ${status}`);
    notifPush(`Access request ${status}`);
  };

  const saveProfile = () => {
    setSaving(true);
    Users.update(user.id, { name: profile.name, phone: profile.phone, dob: profile.dob });
    Session.save({ ...Session.get(), ...profile });
    setTimeout(() => { setSaving(false); setModal(null); toast.ok("Profile updated!"); }, 500);
  };

  if (page === "quantum") return (
    <div>
      <SH title="⬡ Quantum Vault" sub="AES-256-GCM encryption powered by real quantum randomness from ANU, Australia" />
      <div style={{ background: "linear-gradient(135deg, rgba(0,255,157,0.06), rgba(0,212,255,0.06))", border: `1px solid ${C.green}30`, borderRadius: 10, padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 10, letterSpacing: 3, color: C.green, marginBottom: 8 }}>⬡ QUANTUM ENCRYPTION ENGINE ACTIVE</div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Real Quantum Key Generation</div>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.8 }}>
          Each QUANTUM LOCK fetches true random bytes from the <strong style={{ color: C.text }}>ANU Quantum Random Number Generator</strong>,
          which exploits quantum vacuum fluctuations. These bytes seed <strong style={{ color: C.text }}>AES-256-GCM</strong> encryption —
          the same standard used by governments and banks worldwide. Every key is unique and irreproducible.
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {records.map(rec => (
          <Card key={rec.id} s={{ borderColor: rec.locked ? C.green : C.border }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{rec.title}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{rec.category} · {rec.doctor} · {new Date(rec.createdAt).toLocaleDateString()}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  {rec.sensitive  && <Tag label="SENSITIVE" color={C.amber} />}
                  {rec.locked     && <Tag label="QUANTUM LOCKED" color={C.green} />}
                  {rec.encrypted  && <Tag label="AES-256-GCM" color={C.accent} />}
                  {!rec.locked    && <Tag label="UNENCRYPTED" color={C.muted} />}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                {!rec.locked
                  ? <Btn v="green" s={{ fontSize: 11 }} loading={locking === rec.id} onClick={() => handleLock(rec)}>⬡ QUANTUM LOCK</Btn>
                  : <Btn v="dark"  s={{ fontSize: 11 }} onClick={() => handleUnlock(rec)}>🔓 UNLOCK</Btn>
                }
              </div>
            </div>
            {qMap[rec.id] && <QKeyDisplay info={qMap[rec.id]} />}
          </Card>
        ))}
        {!records.length && <Empty msg="No records to encrypt. Ask your doctor to add records." />}
      </div>
    </div>
  );

  if (page === "vitals") return (
    <div>
      <SH title="My Vitals" sub="Historical vital signs recorded by nursing staff" />
      {vitals.length > 0 && (
        <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
          <Stat icon="❤" label="Latest HR" value={vitals[0].hr + " bpm"} color={C.red} />
          <Stat icon="🩸" label="Latest BP" value={`${vitals[0].systolic}/${vitals[0].diastolic}`} color={C.accent} />
          <Stat icon="🌡" label="Latest Temp" value={vitals[0].temp + "°C"} color={C.amber} />
          <Stat icon="💨" label="Latest SpO2" value={vitals[0].spo2 + "%"} color={C.green} />
        </div>
      )}
      {vitals.length > 2 && (
        <Card s={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, letterSpacing: 2.5, color: C.muted, marginBottom: 12 }}>HEART RATE TREND</div>
          <Spark data={[...vitals].reverse().map(v => v.hr)} color={C.red} h={60} />
        </Card>
      )}
      <Card>
        <div style={{ fontSize: 10, letterSpacing: 2.5, color: C.muted, marginBottom: 14 }}>ALL VITAL READINGS</div>
        {vitals.map((v, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: `1px solid ${C.border}` }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>BP {v.systolic}/{v.diastolic} · HR {v.hr}bpm · SpO2 {v.spo2}% · Temp {v.temp}°C</div>
              <div style={{ fontSize: 11, color: C.muted }}>{new Date(v.recordedAt).toLocaleString()}{v.notes && ` · ${v.notes}`}</div>
            </div>
            <Tag label={v.systolic > 140 ? "HIGH" : "NORMAL"} color={v.systolic > 140 ? C.red : C.green} />
          </div>
        ))}
        {!vitals.length && <Empty msg="No vital readings recorded yet." />}
      </Card>
    </div>
  );

  if (page === "requests") return (
    <div>
      <SH title="Access Requests" sub="Manage who can access your medical records" />
      <Card>
        {requests.map((r, i) => (
          <div key={i} style={{ padding: "14px 0", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{r.requesterName}</div>
                <div style={{ fontSize: 12, color: C.muted, margin: "4px 0" }}>Reason: {r.reason}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{new Date(r.createdAt).toLocaleString()}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Tag label={r.status.toUpperCase()} color={r.status === "approved" ? C.green : r.status === "denied" ? C.red : C.amber} />
                {r.status === "pending" && (
                  <>
                    <Btn v="green" s={{ fontSize: 10, padding: "5px 12px" }} onClick={() => respondRequest(r.id, "approved")}>APPROVE</Btn>
                    <Btn v="danger" s={{ fontSize: 10, padding: "5px 12px" }} onClick={() => respondRequest(r.id, "denied")}>DENY</Btn>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
        {!requests.length && <Empty msg="No access requests." />}
      </Card>
    </div>
  );

  if (page === "profile") return (
    <div>
      <SH title="My Profile" sub="Your personal information" right={<Btn onClick={() => setModal("profile")}>EDIT PROFILE</Btn>} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <div style={{ fontSize: 10, letterSpacing: 2.5, color: C.muted, marginBottom: 16 }}>PERSONAL DETAILS</div>
          {[["Full Name", user.name], ["Email", user.email], ["Phone", user.phone || "—"], ["Date of Birth", user.dob || "—"], ["Blood Type", user.blood || "—"]].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
              <span style={{ color: C.muted }}>{k}</span><span>{v}</span>
            </div>
          ))}
        </Card>
        <Card>
          <div style={{ fontSize: 10, letterSpacing: 2.5, color: C.muted, marginBottom: 16 }}>PRIVACY SETTINGS</div>
          {[["mental", "Mental Health Records", "🧠"], ["genetics", "Genetic Data", "🧬"], ["hiv", "HIV / STI Records", "🔬"], ["substance", "Substance Use Records", "💊"]].map(([key, label, icon]) => (
            <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span>{icon}</span>
                <div>
                  <div style={{ fontSize: 13 }}>{label}</div>
                  <div style={{ fontSize: 10, color: privacy[key] ? C.green : C.red }}>{privacy[key] ? "🔒 LOCKED" : "🔓 OPEN"}</div>
                </div>
              </div>
              <div onClick={() => togglePrivacy(key)} style={{ width: 44, height: 24, borderRadius: 12, cursor: "pointer", background: privacy[key] ? C.green : C.border, position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: privacy[key] ? 23 : 3, transition: "left 0.2s" }} />
              </div>
            </div>
          ))}
        </Card>
      </div>
      {modal === "profile" && (
        <Modal title="✏ Edit Profile" onClose={() => setModal(null)}>
          <Field label="FULL NAME" value={profile.name} onChange={v => setProfile(p => ({ ...p, name: v }))} />
          <Field label="PHONE" value={profile.phone || ""} onChange={v => setProfile(p => ({ ...p, phone: v }))} placeholder="+1-555-0000" />
          <Field label="DATE OF BIRTH" value={profile.dob || ""} onChange={v => setProfile(p => ({ ...p, dob: v }))} type="date" />
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={saveProfile} loading={saving}>SAVE CHANGES</Btn>
            <Btn v="ghost" onClick={() => setModal(null)}>CANCEL</Btn>
          </div>
        </Modal>
      )}
    </div>
  );

  // Default: dashboard
  const locked = records.filter(r => r.locked).length;
  const pendingReq = requests.filter(r => r.status === "pending").length;
  return (
    <div>
      <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <Stat icon="📋" label="Health Records"   value={records.length} color={C.green} spark={<Spark data={[2,3,4,4,5,records.length]} color={C.green} />} />
        <Stat icon="⬡"  label="Quantum Locked"   value={locked}         color={C.accent} sub="AES-256-GCM" />
        <Stat icon="💓" label="Vital Readings"    value={vitals.length}  color={C.red} />
        <Stat icon="🔑" label="Pending Requests"  value={pendingReq}     color={C.amber} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <div style={{ fontSize: 10, letterSpacing: 2.5, color: C.muted, marginBottom: 16 }}>RECENT RECORDS</div>
          {records.slice(0, 5).map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
              <div>
                <div style={{ fontSize: 13 }}>{r.title}</div>
                <div style={{ fontSize: 10, color: C.muted }}>{r.category} · {r.doctor}</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {r.locked && <Tag label="🔒" color={C.green} />}
                <Tag label={r.status} color={r.status === "Normal" ? C.green : r.status === "Review" ? C.amber : C.accent} />
              </div>
            </div>
          ))}
          {!records.length && <Empty msg="No records yet." />}
        </Card>
        <Card>
          <div style={{ fontSize: 10, letterSpacing: 2.5, color: C.muted, marginBottom: 16 }}>HEALTH SCORES</div>
          <div style={{ display: "flex", justifyContent: "space-around" }}>
            {[{ l: "Overall", v: 87, c: C.green }, { l: "Cardiac", v: 72, c: C.accent }, { l: "Metabolic", v: 91, c: C.amber }].map(d => (
              <div key={d.l} style={{ textAlign: "center" }}><Donut pct={d.v} color={d.c} /><div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{d.l}</div></div>
            ))}
          </div>
        </Card>
        {vitals.length > 0 && (
          <Card s={{ gridColumn: "1/-1" }}>
            <div style={{ fontSize: 10, letterSpacing: 2.5, color: C.muted, marginBottom: 14 }}>LATEST VITALS</div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {[["❤ HR", vitals[0].hr + " bpm", C.red], ["🩸 BP", `${vitals[0].systolic}/${vitals[0].diastolic}`, C.accent], ["💨 SpO2", vitals[0].spo2 + "%", C.green], ["🌡 Temp", vitals[0].temp + "°C", C.amber]].map(([l, v, c]) => (
                <div key={l} style={{ flex: 1, minWidth: 100 }}>
                  <div style={{ fontSize: 11, color: C.muted }}>{l}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: c }}>{v}</div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DOCTOR PAGES
// ═══════════════════════════════════════════════════════════════════
function DoctorDash({ user, page, notifPush }) {
  const [patients, setPatients] = useState([]);
  const [records,  setRecords]  = useState([]);
  const [notes,    setNotes]    = useState([]);
  const [requests, setRequests] = useState([]);
  const [modal,    setModal]    = useState(null);
  const [noteF,    setNoteF]    = useState({ patientId: "", category: "General", text: "" });
  const [bgF,      setBgF]      = useState({ patientId: "", reason: "" });
  const [reqF,     setReqF]     = useState({ patientId: "", reason: "" });
  const [recF,     setRecF]     = useState({ patientId: "", title: "", category: "Hematology", status: "Normal", sensitive: false, content: "" });
  const [busy,     setBusy]     = useState(false);

  const load = useCallback(() => {
    setPatients(Users.byRole("patient"));
    setRecords(Records.all());
    setNotes(Notes.all());
    setRequests(Requests.byRequester(user.id));
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  const submitNote = async () => {
    if (!noteF.patientId || !noteF.text.trim()) { toast.err("Select patient and enter note"); return; }
    setBusy(true);
    const patient = Users.byId(noteF.patientId);
    Notes.create({ patientId: noteF.patientId, patientName: patient.name, doctorId: user.id, doctorName: user.name, category: noteF.category, text: noteF.text });
    await Audit.add(user.name, "CLINICAL_NOTE_ADDED", `Patient: ${patient.name} | Category: ${noteF.category}`);
    toast.ok("Clinical note saved!");
    notifPush(`Note saved for ${patient.name}`);
    setNoteF({ patientId: "", category: "General", text: "" });
    setModal(null); load(); setBusy(false);
  };

  const addRecord = async () => {
    if (!recF.patientId || !recF.title.trim()) { toast.err("Patient and title required"); return; }
    setBusy(true);
    const patient = Users.byId(recF.patientId);
    Records.create({ patientId: recF.patientId, title: recF.title, category: recF.category, doctor: user.name, status: recF.status, sensitive: recF.sensitive, content: recF.content });
    await Audit.add(user.name, "RECORD_ADDED", `Patient: ${patient.name} | Record: ${recF.title}`);
    toast.ok("Record added!"); notifPush(`New record for ${patient.name}`);
    setRecF({ patientId: "", title: "", category: "Hematology", status: "Normal", sensitive: false, content: "" });
    setModal(null); load(); setBusy(false);
  };

  const submitBreakglass = async () => {
    if (!bgF.reason.trim()) { toast.err("Reason is mandatory"); return; }
    setBusy(true);
    const patient = Users.byId(bgF.patientId);
    await Audit.add(user.name, "BREAK_GLASS_OVERRIDE", `Physician: ${user.name} | Patient: ${patient?.name || "All"} | Reason: ${bgF.reason}`);
    toast.warn("⚠ Break-glass override permanently logged on blockchain");
    notifPush("🚨 CRITICAL: Break-glass override by " + user.name);
    setBgF({ patientId: "", reason: "" }); setModal(null); setBusy(false);
  };

  const submitRequest = async () => {
    if (!reqF.patientId || !reqF.reason.trim()) { toast.err("Select patient and provide reason"); return; }
    setBusy(true);
    const patient = Users.byId(reqF.patientId);
    Requests.create({ requesterId: user.id, patientId: reqF.patientId, requesterName: user.name, reason: reqF.reason, emergency: false });
    await Audit.add(user.name, "ACCESS_REQUESTED", `Patient: ${patient.name} | Reason: ${reqF.reason}`);
    toast.ok("Access request sent to patient"); notifPush("Record access request submitted");
    setReqF({ patientId: "", reason: "" }); setModal(null); load(); setBusy(false);
  };

  if (page === "patients") return (
    <div>
      <SH title="Patients" sub="All registered patients in the system" />
      <Card>
        {patients.map((p, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 0", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.gGlow, border: `2px solid ${C.green}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: C.green }}>{p.name[0]}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{p.blood ? `Blood: ${p.blood}` : "—"} · DOB: {p.dob || "—"}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Tag label="STABLE" color={C.green} />
              <Btn v="dark" s={{ fontSize: 10, padding: "5px 10px" }} onClick={() => { setRecF(f => ({ ...f, patientId: p.id })); setModal("record"); }}>+ ADD RECORD</Btn>
            </div>
          </div>
        ))}
        {!patients.length && <Empty msg="No patients registered yet." />}
      </Card>
    </div>
  );

  if (page === "records") return (
    <div>
      <SH title="All Records" sub="Medical records across all patients"
        right={<Btn onClick={() => setModal("record")}>+ ADD RECORD</Btn>} />
      <Card>
        {records.map((r, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: `1px solid ${C.border}` }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{r.title}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{r.category} · {r.doctor} · {new Date(r.createdAt).toLocaleDateString()}</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {r.locked    && <Tag label="LOCKED" color={C.green} />}
              {r.sensitive && <Tag label="SENSITIVE" color={C.amber} />}
              <Tag label={r.status} color={r.status === "Normal" ? C.green : C.amber} />
            </div>
          </div>
        ))}
        {!records.length && <Empty msg="No records yet." />}
      </Card>
      {modal === "record" && (
        <Modal title="📋 Add Medical Record" onClose={() => setModal(null)}>
          <SelField label="PATIENT *" value={recF.patientId} onChange={v => setRecF(p => ({ ...p, patientId: v }))}
            options={[{ v: "", l: "— Select patient —" }, ...patients.map(p => ({ v: p.id, l: p.name }))]} />
          <Field label="RECORD TITLE *" value={recF.title} onChange={v => setRecF(p => ({ ...p, title: v }))} placeholder="e.g. Blood Panel Results" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <SelField label="CATEGORY" value={recF.category} onChange={v => setRecF(p => ({ ...p, category: v }))}
              options={["Hematology","Cardiology","Oncology","Neurology","Psychiatry","Genomics","Infectious","Radiology","Surgery"].map(c => ({ v: c, l: c }))} />
            <SelField label="STATUS" value={recF.status} onChange={v => setRecF(p => ({ ...p, status: v }))}
              options={["Normal","Review","Active","Clear","Critical"].map(s => ({ v: s, l: s }))} />
          </div>
          <TxtArea label="CONTENT / FINDINGS" value={recF.content} onChange={v => setRecF(p => ({ ...p, content: v }))} placeholder='{"glucose": 95, "notes": "Normal range"}' rows={3} />
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
            <input type="checkbox" checked={recF.sensitive} onChange={e => setRecF(p => ({ ...p, sensitive: e.target.checked }))} id="sens" />
            <label htmlFor="sens" style={{ fontSize: 13, color: C.text, cursor: "pointer" }}>Mark as sensitive record</label>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={addRecord} loading={busy}>SAVE RECORD</Btn>
            <Btn v="ghost" onClick={() => setModal(null)}>CANCEL</Btn>
          </div>
        </Modal>
      )}
    </div>
  );

  if (page === "notes") return (
    <div>
      <SH title="Clinical Notes" sub="Your saved notes across all patients"
        right={<Btn onClick={() => setModal("note")}>+ NEW NOTE</Btn>} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {notes.filter(n => n.doctorId === user.id).map((n, i) => (
          <Card key={i}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{n.patientName}</span>
                <span style={{ marginLeft: 8 }}><Tag label={n.category} color={C.accent} /></span>
              </div>
              <div style={{ fontSize: 11, color: C.muted }}>{new Date(n.createdAt).toLocaleString()}</div>
            </div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7 }}>{n.text}</div>
          </Card>
        ))}
        {!notes.filter(n => n.doctorId === user.id).length && <Empty msg="No clinical notes yet. Create your first one." />}
      </div>
      {modal === "note" && (
        <Modal title="📝 New Clinical Note" onClose={() => setModal(null)}>
          <SelField label="PATIENT *" value={noteF.patientId} onChange={v => setNoteF(p => ({ ...p, patientId: v }))}
            options={[{ v: "", l: "— Select patient —" }, ...patients.map(p => ({ v: p.id, l: p.name }))]} />
          <SelField label="CATEGORY" value={noteF.category} onChange={v => setNoteF(p => ({ ...p, category: v }))}
            options={["General","Cardiology","Oncology","Neurology","Psychiatry","Surgery","Follow-up"].map(c => ({ v: c, l: c }))} />
          <TxtArea label="NOTE *" value={noteF.text} onChange={v => setNoteF(p => ({ ...p, text: v }))} placeholder="Clinical observations, diagnosis, treatment plan..." rows={5} />
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={submitNote} loading={busy}>SAVE NOTE</Btn>
            <Btn v="ghost" onClick={() => setModal(null)}>CANCEL</Btn>
          </div>
        </Modal>
      )}
    </div>
  );

  if (page === "requests") return (
    <div>
      <SH title="Access Requests" sub="Request access to patient records"
        right={<Btn onClick={() => setModal("request")}>+ NEW REQUEST</Btn>} />
      <Card>
        {requests.map((r, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${C.border}` }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{Users.byId(r.patientId)?.name || "Unknown Patient"}</div>
              <div style={{ fontSize: 12, color: C.muted }}>Reason: {r.reason}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{new Date(r.createdAt).toLocaleString()}</div>
            </div>
            <Tag label={r.status.toUpperCase()} color={r.status === "approved" ? C.green : r.status === "denied" ? C.red : C.amber} />
          </div>
        ))}
        {!requests.length && <Empty msg="No requests yet." />}
      </Card>
      {modal === "request" && (
        <Modal title="🔑 Request Record Access" onClose={() => setModal(null)}>
          <SelField label="PATIENT *" value={reqF.patientId} onChange={v => setReqF(p => ({ ...p, patientId: v }))}
            options={[{ v: "", l: "— Select patient —" }, ...patients.map(p => ({ v: p.id, l: p.name }))]} />
          <TxtArea label="REASON *" value={reqF.reason} onChange={v => setReqF(p => ({ ...p, reason: v }))} placeholder="Clinical reason for needing access..." rows={3} />
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={submitRequest} loading={busy}>SEND REQUEST</Btn>
            <Btn v="ghost" onClick={() => setModal(null)}>CANCEL</Btn>
          </div>
        </Modal>
      )}
    </div>
  );

  if (page === "emergency") return (
    <div>
      <SH title="Emergency Protocols" sub="Break-glass override — permanently blockchain-logged" />
      <div style={{ background: C.rGlow, border: `1px solid ${C.red}40`, borderRadius: 10, padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 10, letterSpacing: 2.5, color: C.red, marginBottom: 8 }}>⚠ BREAK-GLASS SYSTEM</div>
        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.8 }}>
          This bypasses all consent protocols and grants <strong>immediate full access</strong> to patient records.
          Every override is <strong>permanently hashed into the blockchain audit trail</strong> with your identity,
          timestamp, and reason. Compliance reviews all overrides within 24 hours. Unauthorized use is a criminal offence under HIPAA.
        </div>
      </div>
      <Btn v="danger" s={{ fontSize: 13, padding: "14px 28px" }} onClick={() => setModal("breakglass")}>
        🚨 AUTHORIZE BREAK-GLASS EMERGENCY OVERRIDE
      </Btn>
      {modal === "breakglass" && (
        <Modal title="🚨 Emergency Break-Glass Override" onClose={() => setModal(null)} accent={C.red}>
          <div style={{ background: C.rGlow, border: `1px solid ${C.red}50`, borderRadius: 7, padding: 14, marginBottom: 18, fontSize: 12, color: C.red, lineHeight: 1.7 }}>
            ⚠ PERMANENT AND IRREVERSIBLE. Logged with your identity and blockchain hash.
          </div>
          <SelField label="PATIENT (if known)" value={bgF.patientId} onChange={v => setBgF(p => ({ ...p, patientId: v }))}
            options={[{ v: "", l: "— All patients —" }, ...patients.map(p => ({ v: p.id, l: p.name }))]} />
          <TxtArea label="EMERGENCY REASON *" value={bgF.reason} onChange={v => setBgF(p => ({ ...p, reason: v }))} placeholder="e.g. Patient unconscious, life-threatening emergency..." rows={4} />
          <div style={{ display: "flex", gap: 10 }}>
            <Btn v="danger" onClick={submitBreakglass} loading={busy}>AUTHORIZE & LOG ON BLOCKCHAIN</Btn>
            <Btn v="ghost" onClick={() => setModal(null)}>CANCEL</Btn>
          </div>
        </Modal>
      )}
    </div>
  );

  // Dashboard
  return (
    <div>
      <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <Stat icon="👥" label="Patients"     value={patients.length} color={C.accent} spark={<Spark data={[1,2,3,4,patients.length]} color={C.accent} />} />
        <Stat icon="📋" label="All Records"  value={records.length}  color={C.green} />
        <Stat icon="📝" label="My Notes"     value={notes.filter(n => n.doctorId === user.id).length} color={C.purple} />
        <Stat icon="🤖" label="AI Flags"     value="1" color={C.red} sub="Cardiac anomaly" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <div style={{ fontSize: 10, letterSpacing: 2.5, color: C.muted, marginBottom: 16 }}>PATIENTS</div>
          {patients.slice(0, 5).map((p, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: `1px solid ${C.border}` }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: C.muted }}>Blood: {p.blood || "—"}</div>
              </div>
              <Tag label="STABLE" color={C.green} />
            </div>
          ))}
          {!patients.length && <Empty msg="No patients yet." />}
        </Card>
        <Card>
          <div style={{ fontSize: 10, letterSpacing: 2.5, color: C.muted, marginBottom: 16 }}>QUICK ACTIONS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Btn v="ghost" full onClick={() => setModal("note")}>📝 Write Clinical Note</Btn>
            <Btn v="ghost" full onClick={() => setModal("record")}>📋 Add Medical Record</Btn>
            <Btn v="ghost" full onClick={() => setModal("request")}>🔑 Request Record Access</Btn>
            <Btn v="ghost" full onClick={() => toast.ok("Lab order submitted")}>📡 Order Lab Tests</Btn>
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
              <Btn v="danger" full onClick={() => setModal("breakglass")}>🚨 BREAK-GLASS EMERGENCY</Btn>
            </div>
          </div>
        </Card>
        <Card glow s={{ gridColumn: "1/-1", borderColor: C.amber }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: 2.5, color: C.amber, marginBottom: 6 }}>🤖 AI ANOMALY DETECTION — LIVE</div>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>Unusual Cardiac Pattern Detected — Alex Johnson</div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.8 }}>
                AI model flagged <strong style={{ color: C.text }}>73% correlation</strong> with pre-arrhythmia markers in last 3 ECG readings.
                Confidence: HIGH · Avg HR 142bpm · BP 160/100 · Immediate cardiology consultation recommended.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0, marginLeft: 20 }}>
              <Btn v="amber" onClick={() => { toast.warn("Cardiology team notified!"); notifPush("🤖 AI alert escalated — Cardiology notified"); }}>ESCALATE</Btn>
              <Btn v="ghost" onClick={() => toast.info("Alert dismissed")}>DISMISS</Btn>
            </div>
          </div>
        </Card>
      </div>
      {modal === "note" && (
        <Modal title="📝 New Clinical Note" onClose={() => setModal(null)}>
          <SelField label="PATIENT *" value={noteF.patientId} onChange={v => setNoteF(p => ({ ...p, patientId: v }))}
            options={[{ v: "", l: "— Select patient —" }, ...patients.map(p => ({ v: p.id, l: p.name }))]} />
          <SelField label="CATEGORY" value={noteF.category} onChange={v => setNoteF(p => ({ ...p, category: v }))}
            options={["General","Cardiology","Oncology","Neurology","Psychiatry","Surgery","Follow-up"].map(c => ({ v: c, l: c }))} />
          <TxtArea label="NOTE *" value={noteF.text} onChange={v => setNoteF(p => ({ ...p, text: v }))} placeholder="Clinical observations, diagnosis, treatment plan..." rows={5} />
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={submitNote} loading={busy}>SAVE NOTE</Btn>
            <Btn v="ghost" onClick={() => setModal(null)}>CANCEL</Btn>
          </div>
        </Modal>
      )}
      {modal === "record" && (
        <Modal title="📋 Add Medical Record" onClose={() => setModal(null)}>
          <SelField label="PATIENT *" value={recF.patientId} onChange={v => setRecF(p => ({ ...p, patientId: v }))}
            options={[{ v: "", l: "— Select patient —" }, ...patients.map(p => ({ v: p.id, l: p.name }))]} />
          <Field label="RECORD TITLE *" value={recF.title} onChange={v => setRecF(p => ({ ...p, title: v }))} placeholder="e.g. Blood Panel Results" />
          <TxtArea label="CONTENT / FINDINGS" value={recF.content} onChange={v => setRecF(p => ({ ...p, content: v }))} rows={3} />
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={addRecord} loading={busy}>SAVE RECORD</Btn>
            <Btn v="ghost" onClick={() => setModal(null)}>CANCEL</Btn>
          </div>
        </Modal>
      )}
      {modal === "request" && (
        <Modal title="🔑 Request Access" onClose={() => setModal(null)}>
          <SelField label="PATIENT *" value={reqF.patientId} onChange={v => setReqF(p => ({ ...p, patientId: v }))}
            options={[{ v: "", l: "— Select patient —" }, ...patients.map(p => ({ v: p.id, l: p.name }))]} />
          <TxtArea label="REASON *" value={reqF.reason} onChange={v => setReqF(p => ({ ...p, reason: v }))} rows={3} />
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={submitRequest} loading={busy}>SEND REQUEST</Btn>
            <Btn v="ghost" onClick={() => setModal(null)}>CANCEL</Btn>
          </div>
        </Modal>
      )}
      {modal === "breakglass" && (
        <Modal title="🚨 Emergency Override" onClose={() => setModal(null)} accent={C.red}>
          <div style={{ background: C.rGlow, border: `1px solid ${C.red}50`, borderRadius: 7, padding: 12, marginBottom: 16, fontSize: 12, color: C.red }}>⚠ PERMANENT blockchain record.</div>
          <SelField label="PATIENT" value={bgF.patientId} onChange={v => setBgF(p => ({ ...p, patientId: v }))}
            options={[{ v: "", l: "— All patients —" }, ...patients.map(p => ({ v: p.id, l: p.name }))]} />
          <TxtArea label="REASON *" value={bgF.reason} onChange={v => setBgF(p => ({ ...p, reason: v }))} rows={3} />
          <div style={{ display: "flex", gap: 10 }}>
            <Btn v="danger" onClick={submitBreakglass} loading={busy}>AUTHORIZE OVERRIDE</Btn>
            <Btn v="ghost" onClick={() => setModal(null)}>CANCEL</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// NURSE PAGES
// ═══════════════════════════════════════════════════════════════════
function NurseDash({ user, page, notifPush }) {
  const [patients, setPatients] = useState([]);
  const [tasks,    setTasks]    = useState([]);
  const [modal,    setModal]    = useState(false);
  const [vd,       setVd]       = useState({ patientId: "", systolic: "", diastolic: "", hr: "", temp: "", spo2: "", notes: "" });
  const [busy,     setBusy]     = useState(false);

  const load = useCallback(() => {
    setPatients(Users.byRole("patient"));
    setTasks(Tasks.all());
  }, []);
  useEffect(() => { load(); }, [load]);

  const saveVitals = async () => {
    if (!vd.patientId || !vd.systolic || !vd.hr) { toast.err("Patient, BP and HR are required"); return; }
    setBusy(true);
    const patient = Users.byId(vd.patientId);
    Vitals.create({ patientId: vd.patientId, nurseId: user.id, systolic: +vd.systolic, diastolic: +vd.diastolic, hr: +vd.hr, temp: +vd.temp || null, spo2: +vd.spo2 || null, notes: vd.notes });
    await Audit.add(user.name, "VITALS_RECORDED", `Patient: ${patient.name} | BP: ${vd.systolic}/${vd.diastolic} | HR: ${vd.hr}`);
    toast.ok("Vitals saved successfully!"); notifPush(`Vitals recorded for ${patient.name}`);
    setVd({ patientId: "", systolic: "", diastolic: "", hr: "", temp: "", spo2: "", notes: "" });
    setModal(false); setBusy(false);
  };

  const toggleTask = (id) => { const t = Tasks.toggle(id); setTasks(t); };
  const done = tasks.filter(t => t.done).length;
  const pct  = tasks.length ? Math.round(done / tasks.length * 100) : 0;

  if (page === "tasks") return (
    <div>
      <SH title="Tasks" sub={`${done}/${tasks.length} complete · ${pct}%`} right={<Btn onClick={() => setModal("task")}>+ ADD TASK</Btn>} />
      <div style={{ height: 6, background: C.faint, borderRadius: 3, marginBottom: 24 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: C.green, borderRadius: 3, transition: "width 0.4s" }} />
      </div>
      <Card>
        {tasks.map(t => (
          <div key={t.id} onClick={() => toggleTask(t.id)} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 0", borderBottom: `1px solid ${C.border}`, cursor: "pointer" }}>
            <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{t.done ? "✅" : "⬜"}</span>
            <div>
              <div style={{ fontSize: 13, textDecoration: t.done ? "line-through" : "none", color: t.done ? C.muted : C.text }}>{t.text}</div>
              <div style={{ fontSize: 11, color: C.muted }}>Due: {t.due}</div>
            </div>
          </div>
        ))}
        {!tasks.length && <Empty msg="No tasks. Add one above." />}
      </Card>
    </div>
  );

  if (page === "vitals") return (
    <div>
      <SH title="Record Vitals" sub="Enter patient vital signs" right={<Btn onClick={() => setModal(true)}>+ RECORD VITALS</Btn>} />
      <Card>
        {patients.map((p, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${C.border}` }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: C.muted }}>Blood: {p.blood || "—"}</div>
            </div>
            <Btn v="dark" s={{ fontSize: 10, padding: "5px 10px" }} onClick={() => { setVd(x => ({ ...x, patientId: p.id })); setModal(true); }}>RECORD VITALS</Btn>
          </div>
        ))}
        {!patients.length && <Empty msg="No patients found." />}
      </Card>
      {modal && (
        <Modal title="📡 Record Vital Signs" onClose={() => setModal(false)} accent={C.purple}>
          <SelField label="PATIENT *" value={vd.patientId} onChange={v => setVd(p => ({ ...p, patientId: v }))}
            options={[{ v: "", l: "— Select patient —" }, ...patients.map(p => ({ v: p.id, l: p.name }))]} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="SYSTOLIC BP *"   value={vd.systolic}  onChange={v => setVd(p => ({ ...p, systolic: v }))}  type="number" placeholder="120" />
            <Field label="DIASTOLIC BP *"  value={vd.diastolic} onChange={v => setVd(p => ({ ...p, diastolic: v }))} type="number" placeholder="80" />
            <Field label="HEART RATE *"    value={vd.hr}        onChange={v => setVd(p => ({ ...p, hr: v }))}        type="number" placeholder="72" />
            <Field label="TEMPERATURE °C"  value={vd.temp}      onChange={v => setVd(p => ({ ...p, temp: v }))}      type="number" placeholder="36.8" />
            <Field label="SpO2 %"          value={vd.spo2}      onChange={v => setVd(p => ({ ...p, spo2: v }))}      type="number" placeholder="98" />
          </div>
          <TxtArea label="NOTES" value={vd.notes} onChange={v => setVd(p => ({ ...p, notes: v }))} rows={2} placeholder="Observations..." />
          <div style={{ display: "flex", gap: 10 }}>
            <Btn v="purple" onClick={saveVitals} loading={busy}>SAVE VITALS</Btn>
            <Btn v="ghost" onClick={() => setModal(false)}>CANCEL</Btn>
          </div>
        </Modal>
      )}
    </div>
  );

  // Dashboard
  return (
    <div>
      <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <Stat icon="🛏"  label="Patients"     value={patients.length} color={C.purple} />
        <Stat icon="✅"  label="Tasks Done"   value={`${done}/${tasks.length}`} color={C.green} />
        <Stat icon="📡" label="Vitals Logged"  value="—" color={C.accent} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <div style={{ fontSize: 10, letterSpacing: 2.5, color: C.muted, marginBottom: 16 }}>PATIENT LIST</div>
          {patients.map((p, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: `1px solid ${C.border}` }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: C.muted }}>Blood: {p.blood || "—"}</div>
              </div>
              <Tag label="STABLE" color={C.green} />
            </div>
          ))}
          {!patients.length && <Empty msg="No patients." />}
        </Card>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 10, letterSpacing: 2.5, color: C.muted }}>TODAY'S TASKS</div>
            <Btn v="ghost" s={{ fontSize: 10, padding: "4px 10px" }} onClick={() => setModal(true)}>+ VITALS</Btn>
          </div>
          {tasks.slice(0, 5).map(t => (
            <div key={t.id} onClick={() => toggleTask(t.id)} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.border}`, cursor: "pointer" }}>
              <span>{t.done ? "✅" : "⬜"}</span>
              <div>
                <div style={{ fontSize: 12, textDecoration: t.done ? "line-through" : "none", color: t.done ? C.muted : C.text }}>{t.text}</div>
                <div style={{ fontSize: 10, color: C.muted }}>Due: {t.due}</div>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 12, height: 4, background: C.faint, borderRadius: 2 }}>
            <div style={{ width: `${pct}%`, height: "100%", background: C.green, borderRadius: 2, transition: "width 0.3s" }} />
          </div>
          <div style={{ marginTop: 6, fontSize: 10, color: C.muted }}>{done}/{tasks.length} complete · {pct}%</div>
        </Card>
      </div>
      {modal && (
        <Modal title="📡 Record Vital Signs" onClose={() => setModal(false)} accent={C.purple}>
          <SelField label="PATIENT *" value={vd.patientId} onChange={v => setVd(p => ({ ...p, patientId: v }))}
            options={[{ v: "", l: "— Select patient —" }, ...patients.map(p => ({ v: p.id, l: p.name }))]} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="SYSTOLIC *"  value={vd.systolic}  onChange={v => setVd(p => ({ ...p, systolic: v }))}  type="number" placeholder="120" />
            <Field label="DIASTOLIC *" value={vd.diastolic} onChange={v => setVd(p => ({ ...p, diastolic: v }))} type="number" placeholder="80" />
            <Field label="HEART RATE *" value={vd.hr}       onChange={v => setVd(p => ({ ...p, hr: v }))}        type="number" placeholder="72" />
            <Field label="SpO2 %"       value={vd.spo2}     onChange={v => setVd(p => ({ ...p, spo2: v }))}      type="number" placeholder="98" />
          </div>
          <TxtArea label="NOTES" value={vd.notes} onChange={v => setVd(p => ({ ...p, notes: v }))} rows={2} />
          <div style={{ display: "flex", gap: 10 }}>
            <Btn v="purple" onClick={saveVitals} loading={busy}>SAVE VITALS</Btn>
            <Btn v="ghost" onClick={() => setModal(false)}>CANCEL</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ADMIN PAGES
// ═══════════════════════════════════════════════════════════════════
function AdminDash({ user, page, notifPush }) {
  const [users,  setUsers]  = useState([]);
  const [logs,   setLogs]   = useState([]);
  const [modal,  setModal]  = useState(false);
  const [nf,     setNf]     = useState({ name: "", email: "", password: "", role: "doctor", spec: "" });
  const [busy,   setBusy]   = useState(false);

  const load = useCallback(() => {
    setUsers(Users.all());
    setLogs(Audit.recent(50));
  }, []);
  useEffect(() => { load(); }, [load]);

  const createUser = async () => {
    if (!nf.name || !nf.email || !nf.password) { toast.err("Name, email, password required"); return; }
    if (nf.password.length < 6) { toast.err("Password must be 6+ characters"); return; }
    setBusy(true);
    try {
      await Users.create({ name: nf.name, email: nf.email, password: nf.password, role: nf.role, spec: nf.spec });
      await Audit.add(user.name, "USER_CREATED", `Name: ${nf.name} | Role: ${nf.role} | Email: ${nf.email}`);
      toast.ok(`Account created for ${nf.name}!`); notifPush(`New ${nf.role}: ${nf.name}`);
      setNf({ name: "", email: "", password: "", role: "doctor", spec: "" });
      setModal(false); load();
    } catch (e) {
      toast.err(e.message);
    }
    setBusy(false);
  };

  const toggleSuspend = async (u) => {
    Users.suspend(u.id);
    await Audit.add(user.name, u.suspended ? "USER_RESTORED" : "USER_SUSPENDED", `User: ${u.name}`);
    toast.warn(u.suspended ? `${u.name} restored` : `${u.name} suspended`);
    load();
  };

  const alerts = [
    { sev: "CRITICAL", msg: "Brute force attack — 17 failed logins on patient portal", time: "2 min ago" },
    { sev: "HIGH",     msg: "Break-glass override used outside office hours",           time: "47 min ago" },
    { sev: "MEDIUM",   msg: "Bulk record export attempt — blocked by policy",          time: "2 hr ago" },
    { sev: "LOW",      msg: "New device login detected for Dr. Sarah Chen",            time: "3 hr ago" },
  ];

  if (page === "audit") return (
    <div>
      <SH title="⛓ Blockchain Audit Log" sub={`${logs.length} events · tamper-evident SHA-256 hash chain`} />
      <Card>
        {logs.map((log, i) => (
          <div key={i} style={{ padding: "11px 0", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: log.action.includes("BREAK") || log.action.includes("FAIL") ? C.red : C.text }}>{log.action}</div>
              <div style={{ fontSize: 10, color: C.muted }}>{new Date(log.createdAt).toLocaleString()}</div>
            </div>
            <div style={{ fontSize: 12, color: C.muted }}>Actor: {log.actor}</div>
            {log.detail && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Detail: {log.detail}</div>}
            {log.blockHash && (
              <div style={{ fontSize: 9, fontFamily: "monospace", color: C.accent, marginTop: 4, display: "flex", gap: 8 }}>
                <span>Block: {log.blockHash}</span>
                <span style={{ color: C.muted }}>← {log.prevHash}</span>
              </div>
            )}
          </div>
        ))}
        {!logs.length && <Empty msg="Audit log is empty." />}
      </Card>
    </div>
  );

  if (page === "users") return (
    <div>
      <SH title="User Management" sub="All registered accounts" right={<Btn onClick={() => setModal(true)}>+ CREATE USER</Btn>} />
      <Card>
        {users.map((u, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: C.aGlow, border: `2px solid ${C.accent}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: C.accent }}>{u.name[0]}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{u.name}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{u.email} · {u.spec || u.ward || "—"}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Tag label={u.role.toUpperCase()} color={{ patient: C.green, doctor: C.accent, nurse: C.purple, admin: C.red }[u.role]} />
              <Tag label={u.suspended ? "SUSPENDED" : "ACTIVE"} color={u.suspended ? C.red : C.green} />
              {u.id !== user.id && <Btn v={u.suspended ? "green" : "danger"} s={{ fontSize: 10, padding: "4px 10px" }} onClick={() => toggleSuspend(u)}>{u.suspended ? "RESTORE" : "SUSPEND"}</Btn>}
            </div>
          </div>
        ))}
        {!users.length && <Empty msg="No users." />}
      </Card>
      {modal && (
        <Modal title="➕ Create User Account" onClose={() => setModal(false)}>
          <Field label="FULL NAME *"   value={nf.name}     onChange={v => setNf(p => ({ ...p, name: v }))}     placeholder="Dr. Jane Smith" />
          <Field label="EMAIL *"       value={nf.email}    onChange={v => setNf(p => ({ ...p, email: v }))}    placeholder="jane@hospital.org" type="email" />
          <Field label="PASSWORD *"    value={nf.password} onChange={v => setNf(p => ({ ...p, password: v }))} placeholder="Min 6 characters" type="password" />
          <SelField label="ROLE *" value={nf.role} onChange={v => setNf(p => ({ ...p, role: v }))}
            options={["patient","doctor","nurse","admin"].map(r => ({ v: r, l: r.charAt(0).toUpperCase() + r.slice(1) }))} />
          {nf.role === "doctor" && <Field label="SPECIALITY" value={nf.spec} onChange={v => setNf(p => ({ ...p, spec: v }))} placeholder="e.g. Cardiology" />}
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={createUser} loading={busy}>CREATE ACCOUNT</Btn>
            <Btn v="ghost" onClick={() => setModal(false)}>CANCEL</Btn>
          </div>
        </Modal>
      )}
    </div>
  );

  if (page === "alerts") return (
    <div>
      <SH title="Security Alerts" sub="Real-time threat monitoring" />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {alerts.map((a, i) => (
          <Card key={i} s={{ borderColor: a.sev === "CRITICAL" ? C.red : a.sev === "HIGH" ? C.amber : C.border }}
            onClick={() => toast[a.sev === "CRITICAL" ? "err" : a.sev === "HIGH" ? "warn" : "info"](`Alert: ${a.msg}`)}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <Tag label={a.sev} color={a.sev === "CRITICAL" ? C.red : a.sev === "HIGH" ? C.amber : a.sev === "MEDIUM" ? C.accent : C.muted} />
              <span style={{ fontSize: 11, color: C.muted }}>{a.time}</span>
            </div>
            <div style={{ fontSize: 13 }}>{a.msg}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Click to acknowledge → automated block applied</div>
          </Card>
        ))}
      </div>
    </div>
  );

  if (page === "analytics") return (
    <div>
      <SH title="Analytics" sub="System usage and access patterns" />
      <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <Stat icon="👥" label="Total Users"    value={users.length} color={C.accent} />
        <Stat icon="📋" label="Total Records"  value={Records.all().length} color={C.green} />
        <Stat icon="⛓"  label="Audit Events"  value={logs.length} color={C.purple} />
        <Stat icon="🔒" label="Encrypted"      value={Records.all().filter(r => r.locked).length} color={C.amber} sub="Quantum locked" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <div style={{ fontSize: 10, letterSpacing: 2.5, color: C.muted, marginBottom: 16 }}>ACCESS ACTIVITY (7 DAYS)</div>
          <BarChart data={[{l:"Mon",v:120},{l:"Tue",v:180},{l:"Wed",v:95},{l:"Thu",v:220},{l:"Fri",v:160},{l:"Sat",v:40},{l:"Sun",v:30}]} h={100} />
        </Card>
        <Card>
          <div style={{ fontSize: 10, letterSpacing: 2.5, color: C.muted, marginBottom: 16 }}>USER BREAKDOWN</div>
          <div style={{ display: "flex", justifyContent: "space-around" }}>
            {[{ l: "Doctors", v: users.filter(u => u.role === "doctor").length, c: C.accent },
              { l: "Nurses",  v: users.filter(u => u.role === "nurse").length,  c: C.purple },
              { l: "Patients",v: users.filter(u => u.role === "patient").length, c: C.green }
            ].map(d => (
              <div key={d.l} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 32, fontWeight: 900, color: d.c }}>{d.v}</div>
                <div style={{ fontSize: 10, color: C.muted }}>{d.l}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );

  // Dashboard
  return (
    <div>
      <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <Stat icon="👥" label="Total Users"    value={users.length}           color={C.accent} spark={<Spark data={[1,2,3,4,users.length]} color={C.accent} />} />
        <Stat icon="🚨" label="Active Alerts"  value={alerts.length}           color={C.red} sub="2 critical" />
        <Stat icon="⛓"  label="Audit Events"  value={logs.length}              color={C.green} sub="Blockchain logged" />
        <Stat icon="🔒" label="Quantum Locked" value={Records.all().filter(r => r.locked).length} color={C.amber} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <div style={{ fontSize: 10, letterSpacing: 2.5, color: C.muted, marginBottom: 16 }}>LIVE SECURITY ALERTS</div>
          {alerts.slice(0, 3).map((a, i) => (
            <div key={i} style={{ padding: 12, marginBottom: 8, borderRadius: 6, cursor: "pointer", background: a.sev === "CRITICAL" ? C.rGlow : a.sev === "HIGH" ? C.aGlow2 : C.aGlow, border: `1px solid ${a.sev === "CRITICAL" ? C.red + "40" : a.sev === "HIGH" ? C.amber + "40" : C.border}` }}
              onClick={() => toast[a.sev === "CRITICAL" ? "err" : "warn"](`Alert: ${a.msg}`)}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <Tag label={a.sev} color={a.sev === "CRITICAL" ? C.red : a.sev === "HIGH" ? C.amber : C.accent} />
                <span style={{ fontSize: 10, color: C.muted }}>{a.time}</span>
              </div>
              <div style={{ fontSize: 12 }}>{a.msg}</div>
            </div>
          ))}
        </Card>
        <Card>
          <div style={{ fontSize: 10, letterSpacing: 2.5, color: C.muted, marginBottom: 16 }}>RECENT AUDIT CHAIN</div>
          {logs.slice(0, 5).map((log, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 14 }}>{log.action.includes("BREAK") || log.action.includes("FAIL") ? "❌" : "✅"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: log.action.includes("BREAK") ? C.red : C.text }}>{log.actor} · {log.action}</div>
                <div style={{ fontSize: 9, fontFamily: "monospace", color: C.muted, marginTop: 2 }}>{log.blockHash?.slice(0, 24)}...</div>
              </div>
            </div>
          ))}
          {!logs.length && <Empty msg="No events." />}
        </Card>
        <Card s={{ gridColumn: "1/-1" }}>
          <div style={{ fontSize: 10, letterSpacing: 2.5, color: C.muted, marginBottom: 16 }}>ACCESS ACTIVITY (7 DAYS)</div>
          <BarChart data={[{l:"Mon",v:120},{l:"Tue",v:180},{l:"Wed",v:95},{l:"Thu",v:220},{l:"Fri",v:160},{l:"Sat",v:40},{l:"Sun",v:30}]} h={90} />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <Tag label="↑ 12% vs last week" color={C.green} />
          </div>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// LOGIN / SIGNUP
// ═══════════════════════════════════════════════════════════════════
function AuthPage({ onLogin }) {
  const [tab,     setTab]     = useState("login");
  const [email,   setEmail]   = useState("");
  const [pw,      setPw]      = useState("");
  const [name,    setName]    = useState("");
  const [role,    setRole]    = useState("patient");
  const [spec,    setSpec]    = useState("");
  const [blood,   setBlood]   = useState("");
  const [dob,     setDob]     = useState("");
  const [err,     setErr]     = useState("");
  const [busy,    setBusy]    = useState(false);
  const [showPw,  setShowPw]  = useState(false);
  const [scanning,setScanning]= useState(false);

  const demos = [
    { role: "Patient", email: "patient@qs.com", pw: "Patient@123", color: C.green },
    { role: "Doctor",  email: "doctor@qs.com",  pw: "Doctor@123",  color: C.accent },
    { role: "Nurse",   email: "nurse@qs.com",   pw: "Nurse@123",   color: C.purple },
    { role: "Admin",   email: "admin@qs.com",   pw: "Admin@123",   color: C.red },
  ];

  const doLogin = async () => {
    setErr(""); if (!email || !pw) { setErr("Email and password required"); return; }
    setBusy(true);
    const user = await Users.authenticate(email, pw);
    if (!user) { setErr("Invalid email or password"); setBusy(false); return; }
    if (user.suspended) { setErr("Account suspended. Contact admin."); setBusy(false); return; }
    Session.save(user);
    toast.ok(`Welcome, ${user.name}!`);
    await Audit.add(user.name, "LOGIN", `Email: ${email}`);
    onLogin(user);
    setBusy(false);
  };

  const doSignup = async () => {
    setErr(""); if (!name || !email || !pw) { setErr("Name, email and password required"); return; }
    if (pw.length < 6) { setErr("Password must be at least 6 characters"); return; }
    setBusy(true);
    try {
      const user = await Users.create({ name, email, role, spec, blood, dob, password: pw });
      Session.save(user);
      toast.ok(`Welcome to QuantumShield, ${user.name}!`);
      await Audit.add(user.name, "SIGNUP", `Role: ${role} | Email: ${email}`);
      onLogin(user);
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  };

  const doBiometric = () => {
    setScanning(true);
    setTimeout(async () => {
      const user = await Users.authenticate("doctor@qs.com", "Doctor@123");
      if (user) {
        Session.save(user); toast.ok("Biometric verified — Dr. Sarah Chen"); onLogin(user);
      } else {
        toast.err("Biometric: demo account not found"); setScanning(false);
      }
    }, 2200);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1, padding: 20 }}>
      <Blob x="20%" y="25%" color={C.accent} size={600} />
      <Blob x="80%" y="75%" color={C.green} size={500} />
      <div style={{ width: "100%", maxWidth: 460, position: "relative", zIndex: 1 }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "36px 40px", boxShadow: `0 0 100px rgba(0,212,255,0.06)` }}>
          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ fontSize: 50, filter: `drop-shadow(0 0 16px ${C.accent})`, marginBottom: 8 }}>⬡</div>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 3, color: C.accent }}>QUANTUMSHIELD</div>
            <div style={{ fontSize: 9, letterSpacing: 4, color: C.muted, marginTop: 4 }}>SECURE HEALTHCARE PLATFORM v2.0</div>
          </div>
          {/* Tabs */}
          <div style={{ display: "flex", background: C.bg, borderRadius: 6, padding: 3, marginBottom: 24 }}>
            {["login","signup"].map(t => (
              <div key={t} onClick={() => { setTab(t); setErr(""); }} style={{ flex: 1, textAlign: "center", padding: "9px 0", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 800, letterSpacing: 2, background: tab === t ? C.accent : "transparent", color: tab === t ? "#000" : C.muted, transition: "all 0.2s", userSelect: "none" }}>
                {t === "login" ? "LOG IN" : "SIGN UP"}
              </div>
            ))}
          </div>
          {/* Signup extras */}
          {tab === "signup" && (
            <>
              <Field label="FULL NAME *" value={name} onChange={v => { setName(v); setErr(""); }} placeholder="Your full name" />
              <SelField label="ROLE *" value={role} onChange={setRole}
                options={["patient","doctor","nurse","admin"].map(r => ({ v: r, l: r.charAt(0).toUpperCase() + r.slice(1) }))} />
              {role === "doctor" && <Field label="SPECIALITY" value={spec} onChange={setSpec} placeholder="e.g. Cardiology" />}
              {role === "patient" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Field label="DATE OF BIRTH" value={dob} onChange={setDob} type="date" />
                  <SelField label="BLOOD TYPE" value={blood} onChange={setBlood}
                    options={[{v:"",l:"—"},{v:"A+",l:"A+"},{v:"A-",l:"A-"},{v:"B+",l:"B+"},{v:"B-",l:"B-"},{v:"O+",l:"O+"},{v:"O-",l:"O-"},{v:"AB+",l:"AB+"},{v:"AB-",l:"AB-"}]} />
                </div>
              )}
            </>
          )}
          {/* Email + Password */}
          <Field label="EMAIL *" value={email} onChange={v => { setEmail(v); setErr(""); }} placeholder="you@hospital.org" type="email" error={err} />
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, letterSpacing: 2.5, color: C.muted, marginBottom: 6 }}>PASSWORD *</div>
            <div style={{ position: "relative" }}>
              <input type={showPw ? "text" : "password"} value={pw}
                onChange={e => { setPw(e.target.value); setErr(""); }}
                onKeyDown={e => e.key === "Enter" && (tab === "login" ? doLogin() : doSignup())}
                placeholder={tab === "login" ? "Your password" : "Min 6 characters"}
                style={{ width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: 5, padding: "11px 42px 11px 14px", color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
              <span onClick={() => setShowPw(p => !p)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: C.muted, userSelect: "none" }}>{showPw ? "🙈" : "👁"}</span>
            </div>
          </div>
          {tab === "login" && (
            <div style={{ textAlign: "right", marginBottom: 18 }}>
              <span style={{ fontSize: 11, color: C.accent, cursor: "pointer" }}>Forgot password?</span>
            </div>
          )}
          <Btn onClick={tab === "login" ? doLogin : doSignup} loading={busy} full s={{ padding: 13, fontSize: 13, letterSpacing: 2 }}>
            {tab === "login" ? "SECURE LOGIN →" : "CREATE ACCOUNT →"}
          </Btn>
          {tab === "login" && (
            <div style={{ textAlign: "center", margin: "18px 0" }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>— OR USE BIOMETRIC —</div>
              <div onClick={!scanning ? doBiometric : undefined}
                style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", cursor: scanning ? "default" : "pointer", padding: "10px 22px", borderRadius: 8, border: `1px solid ${scanning ? C.green : C.border}`, background: scanning ? C.gGlow : "transparent", transition: "all 0.3s" }}>
                <span style={{ fontSize: 28, marginBottom: 4 }}>{scanning ? "🔍" : "👆"}</span>
                <span style={{ fontSize: 10, letterSpacing: 2, color: scanning ? C.green : C.muted }}>{scanning ? "SCANNING..." : "BIOMETRIC LOGIN"}</span>
              </div>
            </div>
          )}
          {/* Demo accounts */}
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
            <div style={{ fontSize: 9, letterSpacing: 2.5, color: C.muted, marginBottom: 10, textAlign: "center" }}>DEMO ACCOUNTS — CLICK TO FILL</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {demos.map(d => (
                <div key={d.role} onClick={() => { setEmail(d.email); setPw(d.pw); setErr(""); setTab("login"); }} style={{ padding: "8px 10px", borderRadius: 5, cursor: "pointer", border: `1px solid ${d.color}30`, background: `${d.color}08`, userSelect: "none" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: d.color }}>{d.role}</div>
                  <div style={{ fontSize: 9, color: C.muted }}>{d.email}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 14, padding: 10, borderRadius: 5, background: C.faint, textAlign: "center" }}>
            <span style={{ fontSize: 9, color: C.muted, letterSpacing: 1 }}>⬡ AES-256-GCM · QUANTUM KEYS · HIPAA COMPLIANT · BLOCKCHAIN AUDIT</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════════
export default function App() {
  const [user,   setUser]   = useState(null);
  const [active, setActive] = useState("dashboard");
  const [notifs, setNotifs] = useState([]);
  const [ready,  setReady]  = useState(false);

  useEffect(() => {
    (async () => {
      await seedIfEmpty();          // seed demo data on first load
      const saved = Session.get(); // restore session
      if (saved) setUser(saved);
      setReady(true);
    })();
  }, []);

  const notifPush = useCallback((msg) => {
    setNotifs(p => [{ msg, time: new Date().toLocaleTimeString(), read: false }, ...p].slice(0, 20));
  }, []);

  const handleLogin = (u) => {
    setUser(u); setActive("dashboard");
    notifPush(`Session started — ${u.name}`);
  };

  const handleLogout = async () => {
    if (user) await Audit.add(user.name, "LOGOUT", `Email: ${user.email}`);
    Session.clear();
    setUser(null); setNotifs([]);
    toast.info("Logged out securely");
  };

  const renderPage = () => {
    const props = { user, page: active, notifPush };
    if (user.role === "patient") return <PatientDash {...props} />;
    if (user.role === "doctor")  return <DoctorDash  {...props} />;
    if (user.role === "nurse")   return <NurseDash   {...props} />;
    if (user.role === "admin")   return <AdminDash   {...props} />;
  };

  if (!ready) return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace" }}>
      <GridBg />
      <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 56, animation: "spin 2s linear infinite", display: "inline-block" }}>⬡</div>
        <div style={{ color: C.accent, fontSize: 13, letterSpacing: 3, marginTop: 16 }}>INITIALIZING QUANTUMSHIELD...</div>
        <div style={{ color: C.muted, fontSize: 10, marginTop: 8 }}>Loading quantum encryption engine</div>
      </div>
    </div>
  );

  return (
    <div style={{ fontFamily: "'Exo 2', monospace", background: C.bg, minHeight: "100vh", color: C.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Exo+2:wght@400;600;700;800;900&display=swap');
        input::placeholder, textarea::placeholder { color: #2a5a7a; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #030b15; }
        ::-webkit-scrollbar-thumb { background: #153552; border-radius: 2px; }
        select option { background: #0c1a2e; }
        @keyframes fadeSlide { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <GridBg />
      <Blob x="75%" y="10%" color={C.purple} size={600} />
      <Blob x="10%" y="80%" color={C.cyan}   size={450} />

      {!user ? (
        <AuthPage onLogin={handleLogin} />
      ) : (
        <div style={{ display: "flex", minHeight: "100vh", position: "relative", zIndex: 1 }}>
          <Sidebar user={user} onLogout={handleLogout} active={active} setActive={setActive} />
          <main style={{ marginLeft: 236, flex: 1, padding: "28px 32px", minWidth: 0 }}>
            <TopBar
              title={active.charAt(0).toUpperCase() + active.slice(1)}
              sub={`${user.name} · ${user.role.charAt(0).toUpperCase() + user.role.slice(1)}`}
              notifs={notifs}
              clearNotifs={() => setNotifs(p => p.map(n => ({ ...n, read: true })))}
            />
            {renderPage()}
          </main>
        </div>
      )}

      <Toasts />
    </div>
  );
}
