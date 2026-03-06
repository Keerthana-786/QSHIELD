// ================================================================
//  QuantumShield — Local Database (localStorage)
//  Real persistent storage — survives page refresh
//  Structured like a real SQL database
// ================================================================
import { hashPassword, chainHash } from "./quantum.js";

const KEY = k => `qs_${k}`;

function read(k, def = []) {
  try { const v = localStorage.getItem(KEY(k)); return v ? JSON.parse(v) : def; }
  catch { return def; }
}
function write(k, v) {
  try { localStorage.setItem(KEY(k), JSON.stringify(v)); } catch {}
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function now() { return new Date().toISOString(); }

// ─── SEED DATA (pre-loaded patients / records / vitals) ──────────
export async function seedIfEmpty() {
  if (read("seeded", false)) return;

  // Hash passwords
  const pw = {
    patient: await hashPassword("Patient@123"),
    doctor:  await hashPassword("Doctor@123"),
    nurse:   await hashPassword("Nurse@123"),
    admin:   await hashPassword("Admin@123"),
  };

  const pid = "patient-001";
  const did = "doctor-001";
  const nid = "nurse-001";
  const aid = "admin-001";

  // Users
  write("users", [
    { id: pid, email: "patient@qs.com",  password: pw.patient, role: "patient", name: "Alex Johnson",      dob: "1990-05-15", blood: "O+",  phone: "+1-555-0101", createdAt: now() },
    { id: did, email: "doctor@qs.com",   password: pw.doctor,  role: "doctor",  name: "Dr. Sarah Chen",    spec: "Cardiology", phone: "+1-555-0102", createdAt: now() },
    { id: nid, email: "nurse@qs.com",    password: pw.nurse,   role: "nurse",   name: "Nurse Maria Lopez", ward: "Ward 3",     phone: "+1-555-0103", createdAt: now() },
    { id: aid, email: "admin@qs.com",    password: pw.admin,   role: "admin",   name: "System Admin",      phone: "+1-555-0104", createdAt: now() },
  ]);

  const r1 = uid(), r2 = uid(), r3 = uid(), r4 = uid(), r5 = uid();

  // Records
  write("records", [
    { id: r1, patientId: pid, title: "Blood Panel – Complete Metabolic", category: "Hematology",  doctor: "Dr. Sarah Chen",  status: "Normal",  sensitive: false, locked: false, encrypted: false, content: JSON.stringify({ glucose: 95, hba1c: 5.6, cholesterol: 180, triglycerides: 120, wbc: 7.2, rbc: 4.8 }), createdAt: "2026-02-28T10:00:00Z" },
    { id: r2, patientId: pid, title: "Cardiology Report – ECG",          category: "Cardiology",  doctor: "Dr. Sarah Chen",  status: "Review",  sensitive: false, locked: false, encrypted: false, content: JSON.stringify({ rhythm: "Sinus", pr_interval: "160ms", qrs: "Normal", qt: "420ms", interpretation: "Borderline findings" }), createdAt: "2026-02-15T14:00:00Z" },
    { id: r3, patientId: pid, title: "Mental Health Assessment",          category: "Psychiatry",  doctor: "Dr. James Park",  status: "Active",  sensitive: true,  locked: false, encrypted: false, content: JSON.stringify({ diagnosis: "Generalised Anxiety Disorder", severity: "Moderate", therapy: "CBT recommended", medication: "Sertraline 50mg" }), createdAt: "2026-01-20T09:00:00Z" },
    { id: r4, patientId: pid, title: "Genetic Profile – BRCA Screen",    category: "Genomics",    doctor: "Dr. Sarah Chen",  status: "Normal",  sensitive: true,  locked: false, encrypted: false, content: JSON.stringify({ brca1: "Negative", brca2: "Negative", lynch: "Not tested", notes: "No pathogenic variants detected" }), createdAt: "2026-01-12T11:00:00Z" },
    { id: r5, patientId: pid, title: "HIV / STI Screening",               category: "Infectious",  doctor: "Dr. Sarah Chen",  status: "Normal",  sensitive: true,  locked: false, encrypted: false, content: JSON.stringify({ hiv: "Non-reactive", hepatitis_b: "Negative", syphilis: "Non-reactive", chlamydia: "Negative" }), createdAt: "2025-12-10T08:00:00Z" },
  ]);

  // Vitals
  write("vitals", [
    { id: uid(), patientId: pid, nurseId: nid, systolic: 120, diastolic: 80,  hr: 72, temp: 36.8, spo2: 98, notes: "Routine check",             recordedAt: "2026-02-28T08:30:00Z" },
    { id: uid(), patientId: pid, nurseId: nid, systolic: 135, diastolic: 88,  hr: 80, temp: 37.1, spo2: 97, notes: "Slightly elevated — monitor", recordedAt: "2026-02-20T09:00:00Z" },
    { id: uid(), patientId: pid, nurseId: nid, systolic: 118, diastolic: 76,  hr: 68, temp: 36.6, spo2: 99, notes: "Post-medication check",       recordedAt: "2026-02-10T10:00:00Z" },
    { id: uid(), patientId: pid, nurseId: nid, systolic: 142, diastolic: 92,  hr: 88, temp: 37.4, spo2: 96, notes: "Elevated — reported to doctor", recordedAt: "2026-01-30T14:00:00Z" },
    { id: uid(), patientId: pid, nurseId: nid, systolic: 125, diastolic: 82,  hr: 74, temp: 36.9, spo2: 98, notes: "Stable",                      recordedAt: "2026-01-15T11:00:00Z" },
  ]);

  // Tasks for nurse
  write("tasks", [
    { id: uid(), text: "Administer Metformin 500mg — Alex Johnson", due: "10:00 AM", done: true,  patientId: pid },
    { id: uid(), text: "Record vitals — Ward 3 patients",           due: "10:30 AM", done: false, patientId: pid },
    { id: uid(), text: "Change IV line — Room 3B",                  due: "11:00 AM", done: false, patientId: pid },
    { id: uid(), text: "Post-op check — Alex Johnson",              due: "12:00 PM", done: false, patientId: pid },
    { id: uid(), text: "Administer evening medications",            due: "06:00 PM", done: false, patientId: pid },
  ]);

  // Privacy settings
  write("privacy", { mental: true, genetics: true, hiv: false, substance: true });

  // Access requests
  write("requests", [
    { id: uid(), requesterId: did, patientId: pid, requesterName: "Dr. Sarah Chen", reason: "Cardiac follow-up review", status: "pending",  emergency: false, createdAt: "2026-03-01T09:00:00Z" },
    { id: uid(), requesterId: nid, patientId: pid, requesterName: "Nurse Maria Lopez", reason: "Pre-op vitals check",  status: "approved", emergency: false, createdAt: "2026-02-28T08:00:00Z" },
  ]);

  // Audit log with chain
  const logs = [];
  const entries = [
    { actor: "System",       action: "SYSTEM_INIT",       detail: "QuantumShield v2.0 initialised" },
    { actor: "Dr. Sarah Chen", action: "LOGIN",           detail: "Authenticated via password" },
    { actor: "Dr. Sarah Chen", action: "RECORD_ACCESSED", detail: "Blood Panel — Patient QS-4821" },
    { actor: "Nurse Maria Lopez", action: "VITALS_RECORDED", detail: "BP 120/80 HR 72 SpO2 98%" },
    { actor: "UNKNOWN_IP",   action: "LOGIN_FAILED×5",    detail: "Brute force blocked — IP banned" },
  ];
  let prevHash = "0000000000000000";
  for (const e of entries) {
    const entry = { ...e, id: uid(), createdAt: now() };
    entry.blockHash = await chainHash(entry, prevHash);
    entry.prevHash  = prevHash;
    prevHash = entry.blockHash;
    logs.push(entry);
  }
  write("audit", logs);

  // Notes
  write("notes", [
    { id: uid(), patientId: pid, patientName: "Alex Johnson", doctorId: did, doctorName: "Dr. Sarah Chen", category: "Cardiology", text: "Patient reports occasional palpitations. ECG ordered. Recommend Holter monitor for 48h. Follow up in 2 weeks.", createdAt: "2026-02-15T15:00:00Z" },
  ]);

  write("seeded", true);
}

// ─── USER OPERATIONS ─────────────────────────────────────────────
export const Users = {
  all: ()          => read("users"),
  byRole: (role)   => read("users").filter(u => u.role === role),
  byId: (id)       => read("users").find(u => u.id === id),
  byEmail: (email) => read("users").find(u => u.email.toLowerCase() === email.toLowerCase()),
  update: (id, data) => {
    const users = read("users").map(u => u.id === id ? { ...u, ...data } : u);
    write("users", users); return users.find(u => u.id === id);
  },
  create: async (data) => {
    const users = read("users");
    if (users.find(u => u.email.toLowerCase() === data.email.toLowerCase())) throw new Error("Email already registered");
    const pw = await hashPassword(data.password);
    const user = { id: uid(), ...data, password: pw, createdAt: now() };
    write("users", [...users, user]);
    return user;
  },
  authenticate: async (email, password) => {
    const user = read("users").find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) return null;
    const pw = await hashPassword(password);
    return pw === user.password ? user : null;
  },
  suspend: (id) => {
    const users = read("users").map(u => u.id === id ? { ...u, suspended: !u.suspended } : u);
    write("users", users);
  },
};

// ─── SESSION ──────────────────────────────────────────────────────
export const Session = {
  save: (user) => { write("session", user); },
  get:  ()     => read("session", null),
  clear:()     => { try { localStorage.removeItem(KEY("session")); } catch {} },
};

// ─── RECORDS ─────────────────────────────────────────────────────
export const Records = {
  byPatient: (pid) => read("records").filter(r => r.patientId === pid).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
  all:       ()    => read("records").sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
  byId:      (id)  => read("records").find(r => r.id === id),
  create: (data) => {
    const rec = { id: uid(), ...data, locked: false, encrypted: false, createdAt: now() };
    write("records", [...read("records"), rec]);
    return rec;
  },
  update: (id, data) => {
    const recs = read("records").map(r => r.id === id ? { ...r, ...data } : r);
    write("records", recs); return recs.find(r => r.id === id);
  },
};

// ─── VITALS ──────────────────────────────────────────────────────
export const Vitals = {
  byPatient: (pid) => read("vitals").filter(v => v.patientId === pid).sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt)),
  create: (data) => {
    const v = { id: uid(), ...data, recordedAt: now() };
    write("vitals", [...read("vitals"), v]);
    return v;
  },
};

// ─── NOTES ───────────────────────────────────────────────────────
export const Notes = {
  all:       ()    => read("notes").sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
  byDoctor:  (did) => read("notes").filter(n => n.doctorId === did),
  create: (data) => {
    const n = { id: uid(), ...data, createdAt: now() };
    write("notes", [...read("notes"), n]);
    return n;
  },
};

// ─── AUDIT LOG ───────────────────────────────────────────────────
export const Audit = {
  all:   ()       => read("audit").sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
  recent:(limit)  => Audit.all().slice(0, limit),
  add: async (actor, action, detail) => {
    const logs = read("audit");
    const last = logs[logs.length - 1];
    const prevHash = last?.blockHash || "0000000000000000";
    const entry = { id: uid(), actor, action, detail, createdAt: now() };
    entry.blockHash = await chainHash(entry, prevHash);
    entry.prevHash  = prevHash;
    write("audit", [...logs, entry]);
    return entry;
  },
};

// ─── ACCESS REQUESTS ─────────────────────────────────────────────
export const Requests = {
  forPatient:  (pid) => read("requests").filter(r => r.patientId  === pid),
  byRequester: (rid) => read("requests").filter(r => r.requesterId === rid),
  all:         ()    => read("requests"),
  create: (data) => {
    const r = { id: uid(), ...data, status: "pending", createdAt: now() };
    write("requests", [...read("requests"), r]);
    return r;
  },
  respond: (id, status) => {
    const reqs = read("requests").map(r => r.id === id ? { ...r, status, respondedAt: now() } : r);
    write("requests", reqs);
  },
};

// ─── PRIVACY ─────────────────────────────────────────────────────
export const Privacy = {
  get:    ()       => read("privacy", { mental: true, genetics: true, hiv: false, substance: true }),
  set:    (data)   => write("privacy", data),
  toggle: (key)    => { const p = Privacy.get(); p[key] = !p[key]; Privacy.set(p); return p; },
};

// ─── TASKS ───────────────────────────────────────────────────────
export const Tasks = {
  all:    ()  => read("tasks"),
  toggle: (id) => {
    const tasks = read("tasks").map(t => t.id === id ? { ...t, done: !t.done } : t);
    write("tasks", tasks); return tasks;
  },
  create: (data) => {
    const t = { id: uid(), ...data, done: false };
    write("tasks", [...read("tasks"), t]);
    return t;
  },
};

// ─── QUANTUM KEYS ────────────────────────────────────────────────
export const QuantumKeys = {
  save: (recordId, keyData) => {
    const keys = read("qkeys");
    write("qkeys", [...keys, { id: uid(), recordId, ...keyData, savedAt: now() }]);
  },
  forRecord: (recordId) => read("qkeys").find(k => k.recordId === recordId),
};
