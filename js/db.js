// ════════════════════════════════════════
//  db.js — Firebase Realtime Database
// ════════════════════════════════════════

firebase.initializeApp({
    apiKey:            "AIzaSyDVRvXrhQOhm92YZQRgEXg0XSae3vtt7UY",
    authDomain:        "student-info-41f18.firebaseapp.com",
    databaseURL:       "https://student-info-41f18-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId:         "student-info-41f18",
    storageBucket:     "student-info-41f18.firebasestorage.app",
    messagingSenderId: "799269939785",
    appId:             "1:799269939785:web:2738f5184e80983fa12d98"
});
const db = firebase.database();

// ── Primitives ──
const dbRead  = async path => { const s = await db.ref(path).get(); return s.exists() ? s.val() : null; };
const dbWrite = async (path, data) => db.ref(path).set(data);

// Firebase can return {0:{},1:{}} instead of arrays — normalise
const toArray = val => {
    if (!val) return [];
    return Array.isArray(val) ? val.filter(Boolean) : Object.values(val).filter(Boolean);
};

// ── Class → Firebase key mapping ──
// Original 8 classes keep their legacy keys so existing data is never lost
const LEGACY_KEY_MAP = { Play:'play', Nursery:'nursery', KG:'kg', 'Class One':'one', 'Class Two':'two', 'Class Three':'three', 'Class Four':'four', 'Class Five':'five' };
const classToKey = cls => LEGACY_KEY_MAP[cls] || cls.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');

// ── Shared save helper ──
async function _save(label, writeFn) {
    if (!isUnlocked) return;
    setStatus('syncing', 'Saving…');
    try {
        await writeFn();
        setStatus('connected', 'Saved ✓');
        toast(label + ' saved ✓', 'success');
    } catch(e) {
        setStatus('connected', 'Ready');
        toast('Save failed: ' + e.message, 'error');
        console.error(e);
    }
}

// ── Save functions ──
const saveClassListToDatabase = async () => {
    if (!isUnlocked) return;
    try { await dbWrite('school/classList', CLASSES); } catch(e) { console.error(e); }
};
const saveClassToDatabase     = cls  => _save(cls,      () => { const d=students.filter(s=>s.class===cls).map(s=>({...s})); return dbWrite('school/students/'+classToKey(cls), d.length?d:null); });
const saveTeachersToDatabase  = ()   => _save('Teachers',() => dbWrite('school/teachers', teachers.length ? teachers.map(t=>({...t})) : null));
const saveStaffToDatabase     = ()   => _save('Staff',   () => dbWrite('school/staff',    staff.length    ? staff.map(s=>({...s}))    : null));
const saveBooksToDatabase     = cls  => _save(cls+' books', () => { const list=(books[cls]||[]).map(b=>({...b})); return dbWrite('school/books/'+classToKey(cls), list.length?list:null); });

// ── Load all data ──
async function syncFromDatabase() {
    if (!isUnlocked) return;
    setStatus('syncing', 'Loading…');
    try {
        const data = await dbRead('school');
        students = []; teachers = []; staff = []; books = {};

        if (data) {
            if (data.classList?.length) CLASSES = data.classList;

            if (data.students) Object.values(data.students).forEach(cd => students.push(...toArray(cd)));
            teachers = toArray(data.teachers);
            staff    = toArray(data.staff);
            if (data.books) CLASSES.forEach(cls => { books[cls] = toArray(data.books[classToKey(cls)]); });
        }

        populateClassDropdowns();
        if (currentMode==='student')  renderStudents();
        if (currentMode==='teacher')  renderTeachers();
        if (currentMode==='staff')    renderStaff();
        if (currentMode==='booklist') renderBookPicker();
        if (currentMode==='results')  renderResults();
        setStatus('connected', 'Synced ✓');
        toast('Data loaded ✓', 'success');
    } catch(e) {
        setStatus('connected', 'Ready');
        toast('Load error: ' + e.message, 'error');
        console.error(e);
    }
}
