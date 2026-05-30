// ════════════════════════════════════════
//  results.js — v2
//  - Subject-wise bulk mark entry
//  - Concurrent-safe per-mark Firebase writes
//  - Tabulation sheet PDF (per-term + combined)
//  - Bulk report card PDF download
//  - Average only when Term 3 exists
//  - Teacher comments + 3 signature lines
//  - Mother's name in report card
// ════════════════════════════════════════

// ── State ──
let rActiveClass   = null;
let rActiveStudent = null;
let rSubjects      = [];
let rResults       = {};
let rActiveTerm    = '1';
let rViewMode      = 'picker'; // picker | class | subject | studentlist | student | report

const TERM_NAMES = { '1':'1st Term', '2':'2nd Term', '3':'Final Exam' };


function _getTermAtt(res, term) {
    const att = res?.attendance;
    if (!att) return null;
    // New per-term format
    if (att[term] && typeof att[term] === 'object' && 'days' in att[term]) return att[term];
    // Legacy flat format: show for all terms
    if (typeof att.days === 'number' && !att['1']) return att;
    return null;
}

// ── Firebase key sanitiser (no . # $ [ ] / ) ──
function _fk(name) { return String(name).replace(/[.#$\[\]/]/g,'_'); }

// ── School logo from DOM (avoids re-embedding base64) ──
function _logo() { return document.querySelector('header img')?.src || ''; }

// ══════════════════════════════════════
//  GRADING
// ══════════════════════════════════════
function getGrade(pct) {
    if (pct >= 80) return { grade:'A+', gpa:5.00 };
    if (pct >= 75) return { grade:'A',  gpa:4.75 };
    if (pct >= 70) return { grade:'A-', gpa:4.50 };
    if (pct >= 65) return { grade:'B+', gpa:4.25 };
    if (pct >= 60) return { grade:'B',  gpa:4.00 };
    if (pct >= 55) return { grade:'B-', gpa:3.75 };
    if (pct >= 50) return { grade:'C+', gpa:3.50 };
    if (pct >= 45) return { grade:'C',  gpa:3.25 };
    if (pct >= 40) return { grade:'D',  gpa:3.00 };
    return { grade:'F', gpa:0.00 };
}
function gradeFromMarks(obt, full) {
    if (!full || full <= 0) return { grade:'—', gpa:0 };
    return getGrade((obt / full) * 100);
}
function gpaToGrade(gpa) {
    if (gpa >= 5.00) return 'A+'; if (gpa >= 4.75) return 'A';
    if (gpa >= 4.50) return 'A-'; if (gpa >= 4.25) return 'B+';
    if (gpa >= 4.00) return 'B';  if (gpa >= 3.75) return 'B-';
    if (gpa >= 3.50) return 'C+'; if (gpa >= 3.25) return 'C';
    if (gpa >= 3.00) return 'D';  return 'F';
}
function gradeChip(grade) {
    const cls = (grade||'—').replace('+','p').replace('-','m').replace('—','x');
    return `<span class="r-grade-chip r-grade-${cls}">${grade||'—'}</span>`;
}


// ══════════════════════════════════════
//  CONCURRENT-SAFE FIREBASE WRITES
//  Each teacher writes only their own path → no overwrites
// ══════════════════════════════════════
function _rBase() { return 'school/results/'+classToKey(rActiveClass); }

async function saveMarkConcurrent(sid, term, subjName, mark) {
    if (!isUnlocked || !rActiveClass) return;
    const path = `${_rBase()}/results/${sid}/terms/${term}/${_fk(subjName)}`;
    try {
        if (mark === null || mark === undefined || mark === '') await db.ref(path).remove();
        else await db.ref(path).set(+mark);
        // Keep local cache in sync
        if (!rResults[sid])               rResults[sid] = {};
        if (!rResults[sid].terms)         rResults[sid].terms = {};
        if (!rResults[sid].terms[term])   rResults[sid].terms[term] = {};
        if (mark === null || mark === undefined || mark === '')
            delete rResults[sid].terms[term][subjName];
        else
            rResults[sid].terms[term][subjName] = +mark;
    } catch(e) { console.error('saveMarkConcurrent', e); }
}

async function saveAttendanceConcurrent(sid, term, days, present) {
    if (!isUnlocked || !rActiveClass) return;
    try {
        await db.ref(`${_rBase()}/results/${sid}/attendance/${term}`)
                .set({ days:+days||0, present:+present||0 });
        if (!rResults[sid]) rResults[sid] = {};
        // Migrate legacy flat format
        if (rResults[sid].attendance && typeof rResults[sid].attendance.days === 'number')
            rResults[sid].attendance = {};
        if (!rResults[sid].attendance) rResults[sid].attendance = {};
        rResults[sid].attendance[term] = { days:+days||0, present:+present||0 };
    } catch(e) { console.error('saveAttendance', e); }
}

function updStudentAttPct(term) {
    const d  = +(document.getElementById('att_d_'+term)?.value||0);
    const p  = +(document.getElementById('att_p_'+term)?.value||0);
    const el = document.getElementById('att_pct_'+term);
    if (el) el.textContent = calcAttendPct({ days:d, present:p });
}


async function saveStudentAllAttendance() {
    const { sid } = rActiveStudent;
    setStatus('syncing','Saving…');
    await Promise.all(['1','2','3'].map(t => {
        const d = +(document.getElementById('att_d_'+t)?.value||0);
        const p = +(document.getElementById('att_p_'+t)?.value||0);
        return saveAttendanceConcurrent(sid, t, d, p);
    }));
    setStatus('connected','Saved ✓');
    toast('Attendance saved ✓','success');
}

async function saveCommentConcurrent(sid, comment) {
    if (!isUnlocked || !rActiveClass) return;
    try {
        await db.ref(`${_rBase()}/results/${sid}/comment`).set(comment || '');
        if (!rResults[sid]) rResults[sid] = {};
        rResults[sid].comment = comment || '';
    } catch(e) { console.error('saveComment', e); }
}

// ══════════════════════════════════════
//  1. ENTRY POINT
// ══════════════════════════════════════
function renderResults() {
    rActiveClass = null; rActiveStudent = null; rViewMode = 'picker';
    renderResultClassPicker();
}

// ══════════════════════════════════════
//  2. CLASS PICKER
// ══════════════════════════════════════
function renderResultClassPicker() {
    rViewMode = 'picker';
    const sec = document.getElementById('resultSection');
    sec.innerHTML = `
        <div class="panel-header">
            <h3>📊 Results</h3>
        </div>
        <p style="font-size:.85rem;color:var(--muted);margin-bottom:14px;">Select a class:</p>
        <div class="picker-grid" id="rClassGrid"></div>`;
    const grid = document.getElementById('rClassGrid');
    CLASSES.forEach(cls => {
        const count = students.filter(s => s.class === cls).length;
        const tile  = document.createElement('div');
        tile.className = 'picker-tile';
        tile.innerHTML = `
            <div class="tile-icon">${classIcon(cls)}</div>
            <div class="tile-name">${cls}</div>
            <div class="tile-count">${count} student${count!==1?'s':''}</div>
            ${isAdmin() ? `<button class="r-del-result-btn" onclick="event.stopPropagation();deleteClassResults('${cls}')">🗑 Clear</button>` : ''}`;
        tile.onclick = () => openResultClass(cls);
        grid.appendChild(tile);
    });
}

// ══════════════════════════════════════
//  3. LOAD CLASS & SHOW CLASS VIEW
// ══════════════════════════════════════
async function openResultClass(cls) {
    rActiveClass = cls;
    setStatus('syncing','Loading…');
    try {
        const data = await dbRead('school/results/'+classToKey(cls));
        rSubjects = (data?.subjects) ? toArray(data.subjects) : [];
        rResults  = (data?.results && !Array.isArray(data.results)) ? data.results : {};
    } catch(e) { rSubjects=[]; rResults={}; }
    setStatus('connected','Ready');
    renderResultClassView();
}

async function syncClassResults() {
    if (!rActiveClass) return;
    setStatus('syncing','Syncing…');
    try {
        const data = await dbRead('school/results/'+classToKey(rActiveClass));
        rSubjects = (data?.subjects) ? toArray(data.subjects) : [];
        rResults  = (data?.results && !Array.isArray(data.results)) ? data.results : {};
        setStatus('connected','Synced ✓');
        toast('Synced from server ✓','success');
        // Re-render current view
        if      (rViewMode === 'subject')     showSubjectEntry();
        else if (rViewMode === 'student')     renderStudentResultPage();
        else                                  showStudentList();
    } catch(e) {
        setStatus('connected','Ready');
        toast('Sync error: '+e.message,'error');
    }
}

function renderResultClassView() {
    rViewMode = 'class';
    const cls = rActiveClass;
    const sec = document.getElementById('resultSection');
    sec.innerHTML = `
        <!-- Top bar -->
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
            <button class="back-btn" onclick="renderResultClassPicker()">← All Classes</button>
            <h3 style="font-family:'DM Serif Display',serif;font-size:1.1rem;">${cls}</h3>
            <div style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap;">
                <button class="btn btn-outline btn-sm" onclick="syncClassResults()">🔄 Sync</button>
                ${isAdmin() ? `<button class="btn btn-danger btn-sm" onclick="deleteClassResults('${cls}')">🗑 Delete All</button>` : ''}
            </div>
        </div>

        <!-- Action tiles -->
        <div class="r-action-row">
            <button class="r-action-btn" onclick="showSubjectEntry()">
                <span style="font-size:1.4rem;">📝</span>
                <span>Enter by Subject</span>
                <small>All students at once</small>
            </button>
            <button class="r-action-btn" onclick="showStudentList()">
                <span style="font-size:1.4rem;">👤</span>
                <span>Enter by Student</span>
                <small>Individual entry</small>
            </button>
            <button class="r-action-btn" onclick="showTabulationOptions()">
                <span style="font-size:1.4rem;">📋</span>
                <span>Tabulation Sheet</span>
                <small>Download PDF</small>
            </button>
            <button class="r-action-btn" onclick="showAllReportCardsOptions()">
                <span style="font-size:1.4rem;">📑</span>
                <span>All Report Cards</span>
                <small>Bulk download</small>
            </button>
        </div>

        <!-- Subject Setup (collapsible) -->
        <div class="r-card" style="margin-bottom:16px;">
            <div class="r-card-header" onclick="toggleRSection('rSubjectBody')">
                <span>📚 Subject Setup</span>
                <span class="arrow" style="transform:rotate(-90deg);">▼</span>
            </div>
            <div id="rSubjectBody" class="r-card-body" style="display:none;">
                <div class="book-table-wrap">
                    <table class="book-table" id="rSubjectTable">
                        <thead><tr><th>#</th><th>Subject Name</th><th class="num">Full Marks</th>${isAdmin()?'<th></th>':''}</tr></thead>
                        <tbody id="rSubjectTbody"></tbody>
                    </table>
                </div>
                ${isAdmin() ? `
                <div class="r-add-row" style="margin-top:12px;">
                    <input type="text"   id="rNewSubjName"  placeholder="Subject name" maxlength="40">
                    <input type="number" id="rNewSubjMarks" placeholder="Full marks" min="1" max="9999" style="width:110px;">
                    <button class="btn btn-primary btn-sm" onclick="addSubject()">+ Add</button>
                </div>` : ''}
            </div>
        </div>

        <!-- Dynamic content area -->
        <div id="rDynamicArea"></div>`;

    renderSubjectTable();
    showStudentList();
}

// ══════════════════════════════════════
//  SUBJECT SETUP
// ══════════════════════════════════════
function renderSubjectTable() {
    const tbody = document.getElementById('rSubjectTbody');
    if (!tbody) return;
    if (!rSubjects.length) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:16px;color:var(--muted);">No subjects yet. Add above.</td></tr>`;
        return;
    }
    tbody.innerHTML = '';
    rSubjects.forEach((subj,i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${i+1}</td>
            <td><input class="r-inline-input" value="${_h(subj.name)}"
                onchange="updateSubject(${i},'name',this.value)" ${isAdmin()?'':'readonly'}></td>
            <td class="num"><input class="r-inline-input r-num-input" type="number"
                value="${subj.fullMarks}" min="1"
                onchange="updateSubject(${i},'fullMarks',+this.value)" ${isAdmin()?'':'readonly'}></td>
            ${isAdmin() ? `<td><button class="cm-btn cm-del" onclick="deleteSubject(${i})">✕</button></td>` : ''}`;
        tbody.appendChild(tr);
    });
}

function addSubject() {
    if (!isAdmin()) return;
    const name  = document.getElementById('rNewSubjName').value.trim();
    const marks = parseInt(document.getElementById('rNewSubjMarks').value)||0;
    if (!name)    { toast('Enter subject name.','error'); return; }
    if (marks<1)  { toast('Enter valid full marks.','error'); return; }
    if (rSubjects.some(s=>s.name===name)) { toast('Subject already exists.','error'); return; }
    rSubjects.push({ name, fullMarks:marks });
    document.getElementById('rNewSubjName').value  = '';
    document.getElementById('rNewSubjMarks').value = '';
    renderSubjectTable();
    saveResultConfig();
    toast(`"${name}" added ✓`,'success');
}
function updateSubject(i, field, val) {
    if (!isAdmin()) return;
    if (field==='fullMarks' && val<1) return;
    rSubjects[i][field] = val;
    saveResultConfig();
}
function deleteSubject(i) {
    if (!isAdmin()) return;
    if (!confirm(`Delete "${rSubjects[i].name}"? All marks for this subject will be lost.`)) return;
    rSubjects.splice(i,1);
    renderSubjectTable();
    saveResultConfig();
}

// ══════════════════════════════════════
//  4. SUBJECT-WISE BULK ENTRY
// ══════════════════════════════════════
function showSubjectEntry() {
    rViewMode = 'subject';
    const area = document.getElementById('rDynamicArea');
    if (!area) return;

    if (!rSubjects.length) {
        area.innerHTML = `<div class="empty-state"><p>Add subjects in Subject Setup first.</p></div>`;
        return;
    }

    area.innerHTML = `
        <div class="r-bulk-controls">
            <h4 style="font-family:'DM Serif Display',serif;margin-bottom:12px;">📝 Enter Marks by Subject</h4>
            <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">
                <div class="field-group" style="margin:0;flex:1;min-width:140px;">
                    <label>Subject / Section</label>
                    <select id="rBulkSubject" onchange="renderBulkTable()"
                        style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;background:var(--paper);font-family:'DM Sans',sans-serif;font-size:.9rem;">
                        <option value="">— Select —</option>
                        ${rSubjects.map(s=>`<option value="${_h(s.name)}">${_h(s.name)} (/${s.fullMarks})</option>`).join('')}
                        <option value="__attendance__">📅 Attendance</option>
                        <option value="__comment__">💬 Teacher's Comment</option>
                    </select>
                </div>

                <div class="field-group" style="margin:0;flex:1;min-width:120px;" id="rBulkTermWrap">
                    <label>Term</label>
                    <select id="rBulkTerm" onchange="renderBulkTable()"
                        style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;background:var(--paper);font-family:'DM Sans',sans-serif;font-size:.9rem;">
                        ${['1','2','3'].map(t=>`<option value="${t}">${TERM_NAMES[t]}</option>`).join('')}
                    </select>
                </div>
            </div>
        </div>
        <div id="rBulkTableWrap" style="margin-top:14px;">
            <p style="color:var(--muted);font-size:.85rem;">Select a subject above to begin.</p>
        </div>`;
}

function renderBulkTable() {
    const wrap     = document.getElementById('rBulkTableWrap');
    const subjName = document.getElementById('rBulkSubject')?.value;
    const term     = document.getElementById('rBulkTerm')?.value || '1';
    const termWrap = document.getElementById('rBulkTermWrap');
    if (!wrap) return;

    if (!subjName) {
        wrap.innerHTML = `<p style="color:var(--muted);font-size:.85rem;">Select a subject above to begin.</p>`;
        return;
    }

    const isAtt = subjName === '__attendance__';
    const isCmt = subjName === '__comment__';

    // Show term selector for BOTH marks and attendance, hide for comment (global)
    if (termWrap) termWrap.style.display = isCmt ? 'none' : '';

    const clsStudents = students
        .filter(s=>s.class===rActiveClass)
        .sort((a,b)=>(+a.roll||999)-(+b.roll||999)||a.name.localeCompare(b.name));
    const subj = rSubjects.find(s=>s.name===subjName);

    if (isCmt) {
        wrap.innerHTML = `
            <div class="book-table-wrap">
            <table class="book-table">
                <thead><tr>
                    <th>#</th><th>Student</th><th>Roll</th>
                    <th>Teacher's Comment</th>
                </tr></thead>
                <tbody>${clsStudents.map((s,i)=>{
                    const sid = studentId(s);
                    const cmt = rResults[sid]?.comment || '';
                    return `<tr>
                        <td>${i+1}</td><td>${_h(s.name)}</td><td>${s.roll||'—'}</td>
                        <td>
                            <textarea class="r-inline-input" id="bcmt_${sid}" 
                                style="width:100%; min-height:60px; padding:8px; font-family:inherit; line-height:1.4;"
                                placeholder="Write about performance and behaviour…">${_h(cmt)}</textarea>
                        </td>
                    </tr>`;
                }).join('')}</tbody>
            </table>
            </div>
            <div style="margin-top:12px;">
                <button class="btn btn-success write-action" onclick="saveBulkComments()">
                    💾 Save All Comments
                </button>
            </div>`;
    } else if (isAtt) {
        wrap.innerHTML = `
            <div class="book-table-wrap">
            <table class="book-table">
                <thead><tr>
                    <th>#</th><th>Student</th><th>Roll</th>
                    <th class="num">Total Days</th><th class="num">Present</th><th class="num">%</th>
                </tr></thead>
                <tbody>${clsStudents.map((s,i)=>{
                    const sid = studentId(s);
                    const att = _getTermAtt(rResults[sid]||{}, term) || {};
                    return `<tr>
                        <td>${i+1}</td><td>${_h(s.name)}</td><td>${s.roll||'—'}</td>
                        <td class="num">
                            <input class="r-marks-input" type="number" min="0" style="width:70px;"
                                id="batd_${sid}" value="${att.days||''}" placeholder="—"
                                oninput="updBulkAttPct('${sid}')">
                        </td>
                        <td class="num">
                            <input class="r-marks-input" type="number" min="0" style="width:70px;"
                                id="batp_${sid}" value="${att.present||''}" placeholder="—"
                                oninput="updBulkAttPct('${sid}')">
                        </td>
                        <td class="num" id="batpct_${sid}">${calcAttendPct(att)}</td>
                    </tr>`;
                }).join('')}</tbody>
            </table>
            </div>
            <div style="margin-top:12px;">
                <button class="btn btn-success write-action" onclick="saveBulkAttendance()">
                    💾 Save ${TERM_NAMES[term]} Attendance
                </button>
            </div>`;
    } else {
        wrap.innerHTML = `
            <div class="book-table-wrap">
            <table class="book-table">
                <thead><tr>
                    <th>#</th><th>Student</th><th>Roll</th>
                    <th class="num">Full Marks</th>
                    <th class="num">Marks (${TERM_NAMES[term]})</th>
                    <th>Grade</th>
                </tr></thead>
                <tbody>${clsStudents.map((s,i)=>{
                    const sid  = studentId(s);
                    const mark = rResults[sid]?.terms?.[term]?.[subjName]??'';
                    const g    = (mark!==''&&mark!==null) ? gradeFromMarks(+mark, subj?.fullMarks||100) : null;
                    return `<tr id="brow_${sid}">
                        <td>${i+1}</td><td>${_h(s.name)}</td><td>${s.roll||'—'}</td>
                        <td class="num">${subj?.fullMarks||'?'}</td>
                        <td class="num">
                            <input class="r-marks-input" type="number" min="0"
                                max="${subj?.fullMarks||9999}" style="width:80px;"
                                id="bm_${sid}" value="${mark}" placeholder="—"
                                oninput="updBulkGrade('${sid}',${subj?.fullMarks||100})">
                        </td>
                        <td id="bg_${sid}">${g?gradeChip(g.grade):'—'}</td>
                    </tr>`;
                }).join('')}</tbody>
            </table>
            </div>
            <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
                <button class="btn btn-success write-action"
                    onclick="saveBulkMarks('${subjName.replace(/'/g,"\\'")}','${term}',${subj?.fullMarks||100})">
                    💾 Save All Marks
                </button>
                <button class="btn btn-outline" onclick="clearBulkInputs()">✕ Clear</button>
            </div>`;
    }
    applyRoleUI();
}



function updBulkGrade(sid, fullMarks) {
    const inp = document.getElementById('bm_'+sid);
    const gel = document.getElementById('bg_'+sid);
    if (!inp||!gel) return;
    const v = inp.value.trim();
    if (v!=='' && !isNaN(+v)) {
        if (+v > fullMarks) inp.value = fullMarks;
        const g = gradeFromMarks(Math.min(+v,fullMarks), fullMarks);
        gel.innerHTML = gradeChip(g.grade);
    } else { gel.textContent = '—'; }
}

function updAttPct(sid) {
    const d = +(document.getElementById('att_d_'+sid)?.value||0);
    const p = +(document.getElementById('att_p_'+sid)?.value||0);
    const el = document.getElementById('att_pct_'+sid);
    if (el) el.textContent = calcAttendPct({days:d,present:p});
}

async function saveBulkMarks(subjName, term, fullMarks) {
    const cls = students.filter(s=>s.class===rActiveClass);
    setStatus('syncing','Saving…');
    const promises = cls.map(s => {
        const sid = studentId(s);
        const inp = document.getElementById('bm_'+sid);
        if (!inp) return Promise.resolve();
        const v = inp.value.trim();
        const mark = (v!==''&&!isNaN(+v)) ? Math.min(+v, fullMarks) : null;
        return saveMarkConcurrent(sid, term, subjName, mark);
        
    });
    await Promise.all(promises);
    setStatus('connected','Saved ✓');
    toast(`Marks saved for ${cls.length} students ✓`,'success');
}

async function saveBulkAttendance() {
    const term = document.getElementById('rBulkTerm')?.value || '1';
    const cls  = students.filter(s=>s.class===rActiveClass);
    setStatus('syncing','Saving…');
    await Promise.all(cls.map(s => {
        const sid = studentId(s);
        const d   = +(document.getElementById('batd_'+sid)?.value||0);
        const p   = +(document.getElementById('batp_'+sid)?.value||0);
        return saveAttendanceConcurrent(sid, term, d, p);
    }));
    setStatus('connected','Saved ✓');
    toast(`${TERM_NAMES[term]} attendance saved ✓`,'success');
}

async function saveBulkComments() {
    const cls = students.filter(s=>s.class===rActiveClass);
    setStatus('syncing','Saving…');
    await Promise.all(cls.map(s => {
        const sid = studentId(s);
        const cmt = document.getElementById('bcmt_'+sid)?.value || '';
        return saveCommentConcurrent(sid, cmt);
    }));
    setStatus('connected','Saved ✓');
    toast(`Comments saved for ${cls.length} students ✓`,'success');
}

// UPDATED bulk attendance — uses selected term, fixed input IDs
function updBulkAttPct(sid) {
    const d  = +(document.getElementById('batd_'+sid)?.value||0);
    const p  = +(document.getElementById('batp_'+sid)?.value||0);
    const el = document.getElementById('batpct_'+sid);
    if (el) el.textContent = calcAttendPct({ days:d, present:p });
}

function clearBulkInputs() {
    document.querySelectorAll('[id^="bm_"]').forEach(i=>i.value='');
    document.querySelectorAll('[id^="bg_"]').forEach(e=>e.textContent='—');
    document.querySelectorAll('[id^="batd_"]').forEach(i=>i.value='');
    document.querySelectorAll('[id^="batp_"]').forEach(i=>i.value='');
    document.querySelectorAll('[id^="bcmt_"]').forEach(t=>t.value='');
}

// ══════════════════════════════════════
//  5. STUDENT LIST VIEW
// ══════════════════════════════════════
function showStudentList() {
    rViewMode = 'studentlist';
    const area = document.getElementById('rDynamicArea');
    if (!area) return;

    const clsStudents = students
        .filter(s=>s.class===rActiveClass)
        .sort((a,b)=>(+a.roll||999)-(+b.roll||999)||a.name.localeCompare(b.name));

    const yearRanks = calcYearRanks(clsStudents);

    area.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
            <h4 style="font-family:'DM Serif Display',serif;">Students</h4>
            <span class="count-badge">${clsStudents.length}</span>
        </div>
        ${clsStudents.length===0
            ? `<div class="empty-state"><div class="big-icon">🎓</div><p>No students in ${rActiveClass}.</p></div>`
            : `<div class="cards-grid" id="rStudentCards"></div>`}`;

    if (!clsStudents.length) return;
    const grid = document.getElementById('rStudentCards');
    clsStudents.forEach(s => {
        const sid = studentId(s);
        const chips = ['1','2','3'].map(t=>{
            const tc = calcTermSummary(sid,t);
            return tc ? `<span class="r-term-mini-chip">${gradeChip(tc.grade)}</span>` : '';
        }).filter(Boolean).join('');

        const { finalGPA } = calcYearSummary(sid);
        const yearRank = finalGPA!==null ? `<div style="font-size:.7rem;color:var(--accent2);font-weight:700;margin-bottom:4px;">Year Rank: ${yearRanks[sid]||'—'}</div>` : '';

        const card = document.createElement('div');
        card.className = 'student-card r-student-card';
        card.innerHTML = `
            ${s.photo ? `<img src="${s.photo}" alt="${_h(s.name)}">` : `<div style="width:64px;height:64px;border-radius:50%;background:var(--ink);color:var(--paper);display:flex;align-items:center;justify-content:center;font-size:1.4rem;margin:0 auto 8px;border:2px solid var(--border);">👤</div>`}
            <div class="s-name">${_h(s.name)}</div>
            <div class="s-class">${s.roll?'Roll: '+s.roll:rActiveClass}</div>
            <div style="margin:6px 0;display:flex;flex-wrap:wrap;gap:3px;justify-content:center;">${chips||'<span style="font-size:.7rem;color:var(--muted);">No marks yet</span>'}</div>
            ${yearRank}
            <div style="display:flex;gap:5px;margin-top:6px;">
                <button class="btn btn-primary btn-sm" style="flex:1;" onclick="openStudentResult('${sid}')">📝 Marks</button>
                <button class="btn btn-outline btn-sm" style="flex:1;" onclick="openReportCard('${sid}')">📄 Report</button>
            </div>`;
        grid.appendChild(card);
    });
}

// ══════════════════════════════════════
//  6. STUDENT RESULT ENTRY (per-student)
// ══════════════════════════════════════
function openStudentResult(sid) {
    const s = students.find(st=>studentId(st)===sid && st.class===rActiveClass);
    if (!s) return;
    rActiveStudent = { sid, student:s };
    rActiveTerm = '1';
    rViewMode = 'student';
    renderStudentResultPage();
}

function renderStudentResultPage() {
    const { sid, student:s } = rActiveStudent;
    const res    = rResults[sid] || {};
    const avatar = s.photo || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Crect width='80' height='80' rx='40' fill='%231a1a2e'/%3E%3Ccircle cx='40' cy='30' r='16' fill='%23f5f0e8' opacity='.85'/%3E%3Cellipse cx='40' cy='68' rx='24' ry='16' fill='%23f5f0e8' opacity='.7'/%3E%3C/svg%3E";
    const area   = document.getElementById('rDynamicArea');

    // Build per-term attendance inputs
    const attInputs = ['1','2','3'].map(t => {
        const att = _getTermAtt(res, t) || {};
        return `
        <div style="margin-bottom:12px;">
            <div style="font-weight:700;font-size:.82rem;color:var(--ink);margin-bottom:8px;
                        padding-bottom:4px;border-bottom:1px solid var(--border);">
                ${TERM_NAMES[t]}
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
                <div class="field-group" style="flex:1;min-width:90px;margin:0;">
                    <label>Total Days</label>
                    <input type="number" class="r-attend-input" id="att_d_${t}" min="0"
                        value="${att.days||''}" placeholder="—"
                        oninput="updStudentAttPct('${t}')">
                </div>
                <div class="field-group" style="flex:1;min-width:90px;margin:0;">
                    <label>Days Present</label>
                    <input type="number" class="r-attend-input" id="att_p_${t}" min="0"
                        value="${att.present||''}" placeholder="—"
                        oninput="updStudentAttPct('${t}')">
                </div>
                <div class="field-group" style="flex:0 0 70px;margin:0;">
                    <label>%</label>
                    <div class="r-attend-pct" id="att_pct_${t}">${calcAttendPct(att)}</div>
                </div>
            </div>
        </div>`;
    }).join('<hr style="border:none;border-top:1px solid var(--border);margin:8px 0;">');

    area.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
            <button class="back-btn" onclick="showStudentList()">← All Students</button>
            <button class="btn btn-success btn-sm" style="margin-left:auto;"
                onclick="openReportCard('${sid}')">📄 Report Card</button>
        </div>

        <div class="r-student-header">
            <img src="${avatar}" alt="${_h(s.name)}" class="r-student-avatar">
            <div>
                <div style="font-family:'DM Serif Display',serif;font-size:1.15rem;">${_h(s.name)}</div>
                <div style="font-size:.78rem;color:var(--muted);">
                    ${rActiveClass}${s.roll?' · Roll: '+s.roll:''}
                </div>
            </div>
        </div>

        <div class="r-term-tabs" id="rTermTabs">
            ${['1','2','3'].map(t=>
                `<button class="r-tab${rActiveTerm===t?' active':''}"
                    onclick="switchTerm('${t}')">${TERM_NAMES[t]}</button>`
            ).join('')}
        </div>

        <div class="r-card" style="margin-top:0;border-radius:0 0 var(--radius) var(--radius);">
            <div class="r-card-body" id="rMarksBody"></div>
        </div>

        <!-- Per-term attendance -->
        <div class="r-card" style="margin-top:12px;">
            <div class="r-card-header" onclick="toggleRSection('rAttBody')">
                <span>📅 Attendance (per term)</span><span class="arrow">▼</span>
            </div>
            <div id="rAttBody" class="r-card-body">
                ${attInputs}
                <button class="btn btn-success btn-sm" style="margin-top:10px;"
                    onclick="saveStudentAllAttendance()">💾 Save All Attendance</button>
            </div>
        </div>

        <!-- Teacher Comment -->
        <div class="r-card" style="margin-top:12px;">
            <div class="r-card-header" onclick="toggleRSection('rCmtBody')">
                <span>💬 Teacher's Comment</span><span class="arrow">▼</span>
            </div>
            <div id="rCmtBody" class="r-card-body">
                <textarea class="r-remarks" id="rTeacherComment" rows="3"
                    placeholder="Write about the student's performance and behaviour…">${_h(res.comment||'')}</textarea>
                <button class="btn btn-success btn-sm" style="margin-top:8px;"
                    onclick="saveStudentComment()">💾 Save Comment</button>
            </div>
        </div>`;

    renderMarksTable();
}



function switchTerm(t) {
    rActiveTerm = String(t);
    document.querySelectorAll('.r-tab').forEach((btn,i)=>btn.classList.toggle('active',String(i+1)===t));
    renderMarksTable();
}

function renderMarksTable() {
    const { sid } = rActiveStudent;
    const res       = rResults[sid] || {};
    const termMarks = res.terms?.[rActiveTerm] || {};
    const body      = document.getElementById('rMarksBody');
    if (!body) return;

    if (!rSubjects.length) {
        body.innerHTML = `<div class="empty-state" style="padding:24px;"><p>No subjects set up yet.</p></div>`;
        return;
    }

    let totObt=0, totFull=0, gpas=[], hasF=false;
    rSubjects.forEach(subj=>{
        const obt = termMarks[subj.name]??'';
        if (obt!==''&&obt!==null) {
            const g = gradeFromMarks(+obt, subj.fullMarks);
            gpas.push(g.gpa); if(g.grade==='F') hasF=true;
            totObt+=+obt; totFull+=subj.fullMarks;
        }
    });
    const tGPA   = gpas.length ? gpas.reduce((a,b)=>a+b,0)/gpas.length : null;
    const tGrade = hasF ? 'F' : (tGPA!==null ? gpaToGrade(tGPA) : '—');

    const clsStudents = students.filter(s=>s.class===rActiveClass);
    const myRank = calcTermRanks(clsStudents, rActiveTerm)[sid] || '—';

    body.innerHTML = `
        <h4 style="font-family:'DM Serif Display',serif;margin-bottom:12px;">${TERM_NAMES[rActiveTerm]}</h4>
        <div class="book-table-wrap" style="margin-bottom:12px;">
            <table class="book-table">
                <thead><tr><th>Subject</th><th class="num">Full</th><th class="num">Marks</th><th>Grade</th><th class="num">GPA</th></tr></thead>
                <tbody id="rMarksTbody"></tbody>
                <tfoot><tr>
                    <td style="font-weight:700;font-size:.72rem;text-transform:uppercase;letter-spacing:.04em;">Total</td>
                    <td class="num" style="font-weight:700;">${totFull||'—'}</td>
                    <td class="num" style="font-weight:700;">${gpas.length?totObt:'—'}</td>
                    <td>${gradeChip(tGrade)}</td>
                    <td class="num" style="font-weight:700;">${tGPA!==null?tGPA.toFixed(2):'—'}</td>
                </tr></tfoot>
            </table>
        </div>
        <div class="r-term-summary-row">
            <div class="r-summary-chip"><span>Total</span><strong>${gpas.length?totObt+'/'+totFull:'—'}</strong></div>
            <div class="r-summary-chip"><span>GPA</span><strong>${tGPA!==null?tGPA.toFixed(2):'—'}</strong></div>
            <div class="r-summary-chip"><span>Grade</span><strong>${tGrade}</strong></div>
            <div class="r-summary-chip"><span>Term Rank</span><strong>${myRank}</strong></div>
        </div>
        <button class="btn btn-success btn-sm" style="margin-top:12px;"
            onclick="saveStudentTermMarks()">💾 Save ${TERM_NAMES[rActiveTerm]} Marks</button>`;

    const tbody = document.getElementById('rMarksTbody');
    rSubjects.forEach(subj=>{
        const obt = termMarks[subj.name]??'';
        const g   = (obt!==''&&obt!==null) ? gradeFromMarks(+obt,subj.fullMarks) : null;
        const tr  = document.createElement('tr');
        tr.innerHTML = `
            <td>${_h(subj.name)}</td>
            <td class="num">${subj.fullMarks}</td>
            <td class="num"><input class="r-marks-input" type="number" min="0" max="${subj.fullMarks}"
                value="${obt}" placeholder="—"
                oninput="onMarkInput(this,'${_h(subj.name)}',${subj.fullMarks})"></td>
            <td>${g?gradeChip(g.grade):'—'}</td>
            <td class="num">${g?g.gpa.toFixed(2):'—'}</td>`;
        tbody.appendChild(tr);
    });
}

function onMarkInput(input, subjName, fullMarks) {
    const v = parseFloat(input.value);
    input.style.borderColor = (!isNaN(v)&&v>fullMarks) ? '#ef4444' : '';
    // Update local cache immediately
    const { sid } = rActiveStudent;
    if (!rResults[sid])               rResults[sid]={};
    if (!rResults[sid].terms)         rResults[sid].terms={};
    if (!rResults[sid].terms[rActiveTerm]) rResults[sid].terms[rActiveTerm]={};
    const val = input.value.trim();
    if (val===''||isNaN(+val)) delete rResults[sid].terms[rActiveTerm][subjName];
    else rResults[sid].terms[rActiveTerm][subjName] = Math.min(+val, fullMarks);
}

async function saveStudentTermMarks() {
    const { sid } = rActiveStudent;
    const inputs  = document.querySelectorAll('#rMarksTbody .r-marks-input');
    setStatus('syncing','Saving…');
    const promises = [];
    inputs.forEach((inp,i)=>{
        if (i<rSubjects.length) {
            const v    = inp.value.trim();
            const mark = (v!==''&&!isNaN(+v)) ? Math.min(+v,rSubjects[i].fullMarks) : null;
            promises.push(saveMarkConcurrent(sid, rActiveTerm, rSubjects[i].name, mark));
        }
    });
    await Promise.all(promises);
    setStatus('connected','Saved ✓');
    toast(`${TERM_NAMES[rActiveTerm]} marks saved ✓`,'success');
    renderMarksTable();
}

async function saveStudentAttendance() {
    const { sid } = rActiveStudent;
    const days    = parseInt(document.getElementById('rTotDays').value)||0;
    const present = parseInt(document.getElementById('rPresDays').value)||0;
    await saveAttendanceConcurrent(sid, days, present);
    toast('Attendance saved ✓','success');
}

async function saveStudentComment() {
    const { sid } = rActiveStudent;
    const cmt = document.getElementById('rTeacherComment').value.trim();
    await saveCommentConcurrent(sid, cmt);
    toast('Comment saved ✓','success');
}

// ══════════════════════════════════════
//  7. TABULATION OPTIONS
// ══════════════════════════════════════
function showTabulationOptions() {
    const area = document.getElementById('rDynamicArea');
    area.innerHTML = `
        <div class="r-card">
            <div class="r-card-header" style="cursor:default;"><span>📋 Tabulation Sheet</span></div>
            <div class="r-card-body">
                <p style="font-size:.85rem;color:var(--muted);margin-bottom:14px;">
                    Download a marks grid for your records. "Final Combined" only available after Term 3 is entered.
                </p>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    ${['1','2','3'].map(t=>`<button class="btn btn-outline" onclick="downloadTabulationPDF('${t}')">⬇ ${TERM_NAMES[t]}</button>`).join('')}
                    <button class="btn btn-primary" onclick="downloadTabulationPDF('final')">⬇ Final Combined</button>
                </div>
            </div>
        </div>`;
}

// ══════════════════════════════════════
//  RANKING & SUMMARY HELPERS
// ══════════════════════════════════════
function calcTermSummary(sid, term) {
    const res = rResults[sid];
    if (!res?.terms?.[term]) return null;
    const tm = res.terms[term];
    let total=0, fullTotal=0, gpas=[], hasF=false, count=0;
    rSubjects.forEach(subj=>{
        const obt = tm[subj.name];
        if (obt!==undefined&&obt!==null&&obt!=='') {
            const g = gradeFromMarks(+obt, subj.fullMarks);
            gpas.push(g.gpa); if(g.grade==='F') hasF=true;
            total+=+obt; fullTotal+=subj.fullMarks; count++;
        }
    });
    if (!count) return null;
    const gpa   = gpas.reduce((a,b)=>a+b,0)/gpas.length;
    return { gpa, grade: hasF?'F':gpaToGrade(gpa), total, fullTotal };
}

function calcTermRanks(clsStudents, term) {
    const scores = clsStudents.map(s=>{
        const tc = calcTermSummary(studentId(s), term);
        return { sid:studentId(s), gpa:tc?tc.gpa:-1, total:tc?tc.total:-1 };
    }).filter(x=>x.gpa>=0);
    scores.sort((a,b)=>b.gpa-a.gpa||b.total-a.total);
    const ranks = {};
    scores.forEach((sc,i)=>{
        const prev = scores[i-1];
        ranks[sc.sid] = (i>0&&sc.gpa===prev.gpa&&sc.total===prev.total) ? ranks[prev.sid] : i+1;
    });
    return ranks;
}

// ── Year summary: ONLY computed when Term 3 has at least one mark ──
function calcYearSummary(sid) {
    const res = rResults[sid]||{};
    const t3  = res.terms?.['3'];
    const hasTerm3 = t3 && rSubjects.some(s => t3[s.name]!==undefined && t3[s.name]!==null && t3[s.name]!=='');
    if (!hasTerm3) return { finalGPA:null, avgTotalMarks:0 };

    const subjSums = rSubjects.map(subj=>{
        const vals = ['1','2','3'].map(t=>{
            const m = res.terms?.[t]?.[subj.name];
            return (m!==undefined&&m!==null&&m!=='') ? +m : null;
        }).filter(m=>m!==null);
        const avg = vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
        const g   = avg!==null ? gradeFromMarks(avg, subj.fullMarks) : null;
        return { avg, gpa:g?.gpa??null };
    }).filter(x=>x.gpa!==null);

    if (!subjSums.length) return { finalGPA:null, avgTotalMarks:0 };
    const finalGPA      = subjSums.reduce((a,x)=>a+x.gpa,0)/subjSums.length;
    const avgTotalMarks = subjSums.reduce((a,x)=>a+x.avg,0);
    return { finalGPA, avgTotalMarks };
}

function calcYearRanks(clsStudents) {
    const scores = clsStudents.map(s=>{
        const sid = studentId(s);
        const { finalGPA, avgTotalMarks } = calcYearSummary(sid);
        return { sid, finalGPA, avgTotalMarks };
    }).filter(x=>x.finalGPA!==null);
    scores.sort((a,b)=>b.finalGPA-a.finalGPA||b.avgTotalMarks-a.avgTotalMarks);
    const ranks={};
    scores.forEach((sc,i)=>{
        const prev=scores[i-1];
        ranks[sc.sid]=(i>0&&sc.finalGPA===prev.finalGPA&&sc.avgTotalMarks===prev.avgTotalMarks)?ranks[prev.sid]:i+1;
    });
    return ranks;
}

function calcAttendPct(att) {
    if (!att||!att.days||att.days<=0) return '—';
    return ((att.present/att.days)*100).toFixed(1)+'%';
}

// ══════════════════════════════════════
//  8. TABULATION PDF
// ══════════════════════════════════════

function _pdfGradeChip(doc, cx, cy, grade) {
    const map = {
        'A+':[[209,250,229],[6,95,70]],   'A': [[220,252,231],[22,101,52]],
        'A-':[[209,250,229],[21,128,61]],  'B+':[[219,234,254],[30,64,175]],
        'B': [[239,246,255],[29,78,216]],  'B-':[[240,249,255],[3,105,161]],
        'C+':[[254,249,195],[133,77,14]],  'C': [[254,252,232],[161,98,7]],
        'D': [[255,237,213],[194,65,12]],  'F': [[254,226,226],[185,28,28]],
    };
    const [bg, fg] = map[grade] || [[243,244,246],[107,114,128]];
    doc.setFillColor(...bg);
    doc.roundedRect(cx-9, cy-3, 18, 6, 3, 3, 'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(7.5);
    doc.setTextColor(...fg);
    doc.text(grade, cx, cy+0.8, {align:'center'});
    doc.setTextColor(26,26,46); doc.setFont('helvetica','normal');
}

async function downloadTabulationPDF(term) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });

    const W=297, H=210, M=10, CW=277;
    const clsStudents = students.filter(s => s.class === rActiveClass);
    if (!clsStudents.length) { toast('No students.','error'); return; }

    const isFinal = term === 'final';
    const tLabel  = isFinal ? 'Annual Combined' : TERM_NAMES[term];

    const NAVY=[26,26,46], GREEN=[45,106,79], WHITE=[255,255,255], MUTED=[140,134,124];
    const ROW1=[255,253,247], ROW2=[244,239,230];

    // ── Column widths ──────────────────────────────────────
    const NAME_W  = 38;
    const SUM_COLS = [['Total',16],['GPA',14],['Grade',14],['Rank',12]]; // 56mm
    const SUM_W   = 56;
    const n       = rSubjects.length;
    const SW      = Math.max(13, Math.min(26, Math.floor((CW-NAME_W-SUM_W)/n)));
    const HH = 12; // header height
    const RH = 14; // data row height

    let y = M;

    function drawHeader() {
        y = M;
        // ── Title ──────────────────────────────────────────────
        doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(...NAVY);
        doc.text(`${rActiveClass}  —  Tabulation Sheet  (${tLabel})`, W/2, y+6, {align:'center'});
        y += 13;

        // ── Header row ─────────────────────────────────────────
        // Name
        doc.setFillColor(...NAVY); doc.rect(M,y,NAME_W,HH,'F');

        // Subject columns
        let ax = M+NAME_W;
        rSubjects.forEach(subj => {
            doc.setFillColor(...NAVY); doc.rect(ax,y,SW,HH,'F');
            ax += SW;
        });
        // Summary columns
        SUM_COLS.forEach(([,w]) => {
            doc.setFillColor(...(isFinal?GREEN:NAVY)); doc.rect(ax,y,w,HH,'F');
            ax += w;
        });

        // Header texts (all after rects to avoid overwrite)
        doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...WHITE);
        doc.text('Student Name', M+3, y+HH/2+1);

        ax = M+NAME_W;
        rSubjects.forEach(subj => {
            doc.setFontSize(6.5);
            let nm = subj.name;
            while(doc.getTextWidth(nm) > SW-2 && nm.length > 2) nm = nm.slice(0,-1);
            doc.text(nm, ax+(SW-doc.getTextWidth(nm))/2, y+4.5);
            doc.setFontSize(6);
            const fm = `(${subj.fullMarks})`;
            doc.text(fm, ax+(SW-doc.getTextWidth(fm))/2, y+9.5);
            ax += SW;
        });
        SUM_COLS.forEach(([h,w]) => {
            doc.setFontSize(7.5);
            doc.text(h, ax+(w-doc.getTextWidth(h))/2, y+HH/2+1);
            ax += w;
        });
        y += HH;
    }

    drawHeader();

    // ── Ranks ──────────────────────────────────────────────
    const allRanks = isFinal ? calcYearRanks(clsStudents) : calcTermRanks(clsStudents, term);

    // ── Data rows ──────────────────────────────────────────
    clsStudents.forEach((s, ri) => {
        // Check for page break (H is 210mm, leave margin at bottom)
        if (y + RH > H - M) {
            doc.addPage();
            drawHeader();
        }

        const sid = studentId(s);
        const res = rResults[sid] || {};
        const bg  = ri%2===0 ? ROW1 : ROW2;
        let ax = M;

        // Pass 1 — all background rects
        doc.setFillColor(...bg);
        doc.rect(ax,y,NAME_W,RH,'F'); ax+=NAME_W;
        rSubjects.forEach(() => { doc.rect(ax,y,SW,RH,'F'); ax+=SW; });
        SUM_COLS.forEach(([,w]) => { doc.rect(ax,y,w,RH,'F'); ax+=w; });

        // Pass 2 — all texts
        doc.setTextColor(...NAVY);
        doc.setFont('helvetica','bold'); doc.setFontSize(7.5);
        let nm = s.name;
        while(doc.getTextWidth(nm) > NAME_W-4 && nm.length > 2) nm = nm.slice(0,-1);
        doc.text(nm, M+3, y+RH/2+0.8);

        // Subject cells
        ax = M+NAME_W;
        let totObt=0, gpas=[], hasF=false;

        rSubjects.forEach(subj => {
            let obt=null, g=null;
            if (isFinal) {
                const ms = ['1','2','3'].map(t=>{
                    const v=res.terms?.[t]?.[subj.name];
                    return (v!==undefined&&v!==null&&v!=='') ? +v : null;
                }).filter(v=>v!==null);
                if (ms.length) {
                    obt = ms.reduce((a,b)=>a+b,0)/ms.length;
                    g   = gradeFromMarks(obt, subj.fullMarks);
                }
            } else {
                const v = res.terms?.[term]?.[subj.name];
                if (v!==undefined&&v!==null&&v!=='') {
                    obt=+v; g=gradeFromMarks(obt,subj.fullMarks);
                }
            }

            if (obt!==null && g) {
                totObt += obt;
                gpas.push(g.gpa);
                if (g.grade==='F') hasF=true;
                doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(...NAVY);
                const ms = isFinal ? obt.toFixed(1) : String(obt);
                doc.text(ms, ax+(SW-doc.getTextWidth(ms))/2, y+5.5);
                doc.setFont('helvetica','normal'); doc.setFontSize(6); doc.setTextColor(70,70,110);
                const chip = `(${g.grade}, ${g.gpa.toFixed(2)})`;
                doc.text(chip, ax+(SW-doc.getTextWidth(chip))/2, y+10.5);
            } else {
                doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...MUTED);
                doc.text('—', ax+(SW-doc.getTextWidth('—'))/2, y+RH/2+0.8);
            }
            doc.setDrawColor(215,210,200); doc.setLineWidth(0.2);
            doc.rect(ax,y,SW,RH,'S');
            ax += SW;
        });

        // Summary values
        const tGPA   = gpas.length ? gpas.reduce((a,b)=>a+b,0)/gpas.length : null;
        const tGrade = tGPA!==null ? (hasF?'F':gpaToGrade(tGPA)) : '—';
        const tRank  = allRanks[sid] || '—';
        const sVals  = [
            gpas.length ? totObt.toFixed(1) : '—',
            tGPA!==null ? tGPA.toFixed(2)   : '—',
            tGrade,
            String(tRank),
        ];
        SUM_COLS.forEach(([,w],si) => {
            doc.setFont('helvetica', si===2?'bold':'normal');
            doc.setFontSize(8.5); doc.setTextColor(...NAVY);
            const sv = sVals[si];
            doc.text(sv, ax+(w-doc.getTextWidth(sv))/2, y+RH/2+0.8);
            doc.setDrawColor(215,210,200); doc.setLineWidth(0.2);
            doc.rect(ax,y,w,RH,'S');
            ax += w;
        });
        doc.setDrawColor(215,210,200); doc.setLineWidth(0.2);
        doc.rect(M,y,NAME_W,RH,'S');
        y += RH;
    });

    doc.save(`${rActiveClass.replace(/\s+/g,'_')}_Tabulation_${tLabel.replace(/\s+/g,'_')}.pdf`);
}

// ══════════════════════════════════════
//  9. BULK REPORT CARDS DOWNLOAD
// ══════════════════════════════════════
async function downloadAllReportCards(term) {
    const cls = students.filter(s=>s.class===rActiveClass)
        .sort((a,b)=>(+a.roll||999)-(+b.roll||999)||a.name.localeCompare(b.name));
    if (!cls.length) { toast('No students.','error'); return; }
    const label = term==='final' ? 'Annual' : TERM_NAMES[term];
    toast(`Generating ${cls.length} ${label} report cards…`,'');
    const { jsPDF } = window.jspdf;
    const doc   = new jsPDF({ format:'a4', unit:'mm' });
    const ranks = term==='final'
        ? calcYearRanks(cls)
        : calcTermRanks(cls, term);
    for (let i=0;i<cls.length;i++) {
        if (i>0) doc.addPage();
        await _drawReportCard(doc, cls[i], studentId(cls[i]), ranks, term);
    }
    const fname = `${rActiveClass.replace(/ /g,'_')}_${label.replace(/ /g,'_')}_Report_Cards.pdf`;
    doc.save(fname);
    toast('All report cards downloaded ✓','success');
}

// ══════════════════════════════════════
//  10. REPORT CARD PREVIEW
// ══════════════════════════════════════

function loadReportCard(sid, term) {
    const s = students.find(st=>studentId(st)===sid&&st.class===rActiveClass);
    if (!s) return;
    const res   = rResults[sid] || {};
    const clsS  = students.filter(st=>st.class===rActiveClass);
    const ranks = term==='final'
        ? calcYearRanks(clsS)
        : calcTermRanks(clsS, term);
    const rank  = ranks[sid] || '—';
    const label = term==='final' ? 'Annual Result' : TERM_NAMES[term];
    const area  = document.getElementById('rDynamicArea');

    area.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
            <button class="back-btn" onclick="openReportCard('${sid}')">← Change Term</button>
            <span style="font-family:'DM Serif Display',serif;">${label} Report Card</span>
            <div style="margin-left:auto;display:flex;gap:8px;">
                <button class="btn btn-primary btn-sm"
                    onclick="downloadReportCardPDF('${sid}','${term}')">⬇ Download PDF</button>
            </div>
        </div>
        <div id="rcPreview">${_buildRCHtml(s, res, term, rank)}</div>`;
}

function showAllReportCardsOptions() {
    const area = document.getElementById('rDynamicArea');
    area.innerHTML = `
        <div class="r-card">
            <div class="r-card-body" style="padding:20px;">
                <h4 style="font-family:'DM Serif Display',serif;margin-bottom:8px;">⬇ Download All Report Cards</h4>
                <p style="color:var(--muted);font-size:.88rem;margin-bottom:16px;">
                    Select which term to generate for all ${rActiveClass} students:
                </p>
                <div style="display:flex;gap:10px;flex-wrap:wrap;">
                    <button class="btn btn-outline" onclick="downloadAllReportCards('1')">📝 1st Term</button>
                    <button class="btn btn-outline" onclick="downloadAllReportCards('2')">📝 2nd Term</button>
                    <button class="btn btn-primary" onclick="downloadAllReportCards('final')">🏆 Annual Result</button>
                </div>
            </div>
        </div>`;
}

function openReportCard(sid) {
    const s = students.find(st=>studentId(st)===sid&&st.class===rActiveClass);
    if (!s) return;
    rViewMode = 'report';
    const area = document.getElementById('rDynamicArea');
    area.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
            <button class="back-btn" onclick="showStudentList()">← All Students</button>
        </div>
        <div class="r-card">
            <div class="r-card-body" style="text-align:center;padding:24px 16px;">
                <div style="font-size:1.3rem;font-family:'DM Serif Display',serif;margin-bottom:8px;">
                    ${_h(s.name)}
                </div>
                <p style="color:var(--muted);font-size:.88rem;margin-bottom:20px;">
                    Which term report card do you want to generate?
                </p>
                <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
                    <button class="btn btn-outline" style="min-width:120px;flex:1;max-width:160px;"
                        onclick="loadReportCard('${sid}','1')">
                        📝 1st Term
                    </button>
                    <button class="btn btn-outline" style="min-width:120px;flex:1;max-width:160px;"
                        onclick="loadReportCard('${sid}','2')">
                        📝 2nd Term
                    </button>
                    <button class="btn btn-primary" style="min-width:120px;flex:1;max-width:160px;"
                        onclick="loadReportCard('${sid}','final')">
                        🏆 Annual Result
                    </button>
                </div>
            </div>
        </div>`;
}

function _buildRCHtml(s, res, term, yearRank) {
    const sid     = studentId(s);
    const isFinal = term === 'final';
    const label   = isFinal ? 'Annual Result' : TERM_NAMES[term];

    // ── Student info ──
    const photoHtml = s.photo
        ? `<img src="${s.photo}" class="rc-student-photo" alt="${_h(s.name)}">`
        : `<div class="rc-student-photo rc-no-photo" style="display:flex;align-items:center;justify-content:center;font-size:2rem;">👤</div>`;

    // ══ MARKS SECTION ══
    let marksHtml = '';

    if (!isFinal) {
        // ── Single term: Subject | Full Marks | Marks | Grade | GPA ──
        const tm = res.terms?.[term] || {};
        let totObt=0, totFull=0, gpas=[], hasF=false;

        const rows = rSubjects.map(subj => {
            const m   = tm[subj.name];
            const obt = (m!==undefined&&m!==null&&m!=='') ? +m : null;
            const g   = obt!==null ? gradeFromMarks(obt, subj.fullMarks) : null;
            if (g) { gpas.push(g.gpa); if(g.grade==='F')hasF=true; totObt+=obt; totFull+=subj.fullMarks; }
            return `<tr>
                <td class="rc-subj-td">
                    <strong>${_h(subj.name)}</strong>
                    <small style="display:block;color:var(--muted);">(${subj.fullMarks} marks)</small>
                </td>
                <td style="text-align:center;">${obt!==null?obt:'—'}</td>
                <td style="text-align:center;">${g?gradeChip(g.grade):'—'}</td>
                <td style="text-align:center;">${g?g.gpa.toFixed(2):'—'}</td>
            </tr>`;
        }).join('');

        const tGPA   = gpas.length ? gpas.reduce((a,b)=>a+b,0)/gpas.length : null;
        const tGrade = hasF?'F':(tGPA!==null?gpaToGrade(tGPA):'—');

        marksHtml = `
        <div class="rc-section-title" style="margin-bottom:8px;">${label} — Academic Result</div>
        <table class="rc-marks-table">
            <thead>
                <tr class="rc-term-th" style="background:var(--ink);color:var(--paper);">
                    <th class="rc-subj-th" style="text-align:left;">Subject (Full Marks)</th>
                    <th>Marks Obtained</th>
                    <th>Grade</th>
                    <th>GPA</th>
                </tr>
            </thead>
            <tbody>${rows||`<tr><td colspan="4" style="text-align:center;padding:16px;color:var(--muted);">No marks entered yet</td></tr>`}</tbody>
            ${gpas.length?`
            <tfoot>
                <tr style="background:var(--ink);color:var(--paper);">
                    <td class="rc-subj-td" style="font-weight:700;font-size:.78rem;letter-spacing:.04em;text-transform:uppercase;">Total</td>
                    <td style="text-align:center;font-weight:700;">${totObt} / ${totFull}</td>
                    <td colspan="2"></td>
                </tr>
            </tfoot>`:''}
        </table>
        ${gpas.length?`
        <div class="rc-final-row" style="margin-top:10px;">
            <div class="rc-final-chip"><span>${label} GPA</span><strong>${tGPA!==null?tGPA.toFixed(2):'—'}</strong></div>
            <div class="rc-final-chip"><span>Grade</span><strong>${tGrade}</strong></div>
            <div class="rc-final-chip"><span>Class Rank</span><strong>${yearRank}</strong></div>
        </div>`:''}`;

    } else {
        // ── Final/Annual: Subject | Full | T1 | T2 | Final | Average | Grade | GPA ──
        const { finalGPA } = calcYearSummary(sid);
        const finalGrade  = finalGPA!==null ? gpaToGrade(finalGPA) : '—';
        const finalGPAStr = finalGPA!==null ? finalGPA.toFixed(2) : '—';

        const rows = rSubjects.map(subj => {
            const getM = t => { const m=res.terms?.[t]?.[subj.name]; return(m!==undefined&&m!==null&&m!=='') ? +m : null; };
            const m1=getM('1'), m2=getM('2'), m3=getM('3');
            const vals=[m1,m2,m3].filter(m=>m!==null);
            const avg = vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
            const gAvg = avg!==null ? gradeFromMarks(avg, subj.fullMarks) : null;
            return `<tr>
                <td class="rc-subj-td">
                    <strong>${_h(subj.name)}</strong>
                    <small style="display:block;color:var(--muted);">(${subj.fullMarks})</small>
                </td>
                <td style="text-align:center;">${m1!==null?m1:'—'}</td>
                <td style="text-align:center;">${m2!==null?m2:'—'}</td>
                <td style="text-align:center;">${m3!==null?m3:'—'}</td>
                <td style="text-align:center;font-weight:600;">${avg!==null?avg.toFixed(1):'—'}</td>
                <td style="text-align:center;">${gAvg?gradeChip(gAvg.grade):'—'}</td>
                <td style="text-align:center;">${gAvg?gAvg.gpa.toFixed(2):'—'}</td>
            </tr>`;
        }).join('');

        marksHtml = `
        <div class="rc-section-title" style="margin-bottom:8px;">Annual Academic Result</div>
        <div style="overflow-x:auto;">
        <table class="rc-marks-table">
            <thead>
                <tr>
                    <th class="rc-subj-th" rowspan="2" style="vertical-align:middle;background:var(--ink);color:var(--paper);">
                        Subject<br><small style="font-weight:400;font-size:.7rem;">(Full Marks)</small>
                    </th>
                    <th colspan="3" class="rc-term-th">Term Marks</th>
                    <th colspan="3" class="rc-avg-th">Annual Result</th>
                </tr>
                <tr class="rc-sub-hdr">
                    <th>1st Term</th><th>2nd Term</th><th>Final Exam</th>
                    <th>Average</th><th>Grade</th><th>GPA</th>
                </tr>
            </thead>
            <tbody>${rows||`<tr><td colspan="7" style="text-align:center;padding:16px;color:var(--muted);">No marks entered</td></tr>`}</tbody>
        </table>
        </div>
        <div class="rc-final-row" style="margin-top:10px;">
            <div class="rc-final-chip"><span>Annual GPA</span><strong>${finalGPAStr}</strong></div>
            <div class="rc-final-chip"><span>Final Grade</span><strong>${finalGrade}</strong></div>
            <div class="rc-final-chip"><span>Year Rank</span><strong>${yearRank}</strong></div>
        </div>`;
    }

    // ══ ATTENDANCE ══
    let attHtml = '';
    if (!isFinal) {
        const att = _getTermAtt(res, term);
        attHtml = `
        <div class="rc-section-title" style="margin-bottom:8px;">Attendance — ${label}</div>
        <table class="rc-info-table" style="width:100%;">
            <tr><td style="color:var(--muted);">Total School Days</td><td><strong>${att?.days||'—'}</strong></td></tr>
            <tr><td style="color:var(--muted);">Days Present</td><td><strong>${att?.present||'—'}</strong></td></tr>
            <tr><td style="color:var(--muted);">Attendance</td><td><strong>${calcAttendPct(att)}</strong></td></tr>
        </table>`;
    } else {
        const attRows = ['1','2','3'].map(t => {
            const att = _getTermAtt(res, t);
            return `<tr>
                <td class="att-term-cell">${TERM_NAMES[t]}</td>
                <td>${att?.days||'—'}</td>
                <td>${att?.present||'—'}</td>
                <td>${calcAttendPct(att)}</td>
            </tr>`;
        }).join('');
        attHtml = `
        <div class="rc-section-title" style="margin-bottom:8px;">Attendance Summary</div>
        <table class="rc-att-table">
            <thead><tr>
                <th style="text-align:left;">Term</th>
                <th>Total Days</th><th>Present</th><th>Attendance</th>
            </tr></thead>
            <tbody>${attRows}</tbody>
        </table>`;
    }

    return `
    <div class="report-card">
        <div class="rc-header">
            <img src="${_logo()}" class="rc-logo" alt="Logo">
            <div class="rc-school-info">
                <div class="rc-school-name">AL RAWA English School</div>
                <div class="rc-school-sub">ESTD: 2022 &nbsp;·&nbsp; Read in the name of your Lord</div>
                <div class="rc-report-title">${(isFinal?'ANNUAL':'TERM')} REPORT CARD — ${label.toUpperCase()}</div>
            </div>
        </div>
        <div class="rc-divider"></div>

        <div class="rc-student-row">
            ${photoHtml}
            <table class="rc-info-table">
                <tr><td>Student Name</td><td><strong>${_h(s.name)}</strong></td></tr>
                <tr><td>Class</td><td><strong>${_h(rActiveClass)}</strong></td></tr>
                ${s.roll       ? `<tr><td>Roll No.</td><td><strong>${s.roll}</strong></td></tr>` : ''}
                ${s.fatherName ? `<tr><td>Father's Name</td><td>${_h(s.fatherName)}</td></tr>` : ''}
                ${s.motherName ? `<tr><td>Mother's Name</td><td>${_h(s.motherName)}</td></tr>` : ''}
            </table>
        </div>
        <div class="rc-divider"></div>

        ${marksHtml}

        <div class="rc-divider"></div>
        <div class="rc-two-col">
            <div>${attHtml}</div>
            <div>
                <div class="rc-section-title" style="margin-bottom:8px;">Teacher's Comment</div>
                <div class="rc-remarks-box">
                    ${_h(res.comment||'')||'<em style="color:var(--muted);">No comment added.</em>'}
                </div>
            </div>
        </div>

        <div class="rc-sig-row">
            <div class="rc-sig"><div class="rc-sig-line"></div><div class="rc-sig-label">Class Teacher</div></div>
            <div class="rc-sig"><div class="rc-sig-line"></div><div class="rc-sig-label">Co-ordinator</div></div>
            <div class="rc-sig"><div class="rc-sig-line"></div><div class="rc-sig-label">Principal</div></div>
        </div>
    </div>`;
}


// ══════════════════════════════════════
//  11. REPORT CARD PDF (single + bulk helper)
// ══════════════════════════════════════
async function downloadReportCardPDF(sid, term) {
    const s = students.find(st=>studentId(st)===sid&&st.class===rActiveClass);
    if (!s) return;
    const { jsPDF } = window.jspdf;
    const doc  = new jsPDF({ format:'a4', unit:'mm' });
    const clsS = students.filter(st=>st.class===rActiveClass);
    const ranks = term==='final' ? calcYearRanks(clsS) : calcTermRanks(clsS, term);
    await _drawReportCard(doc, s, sid, ranks, term);
    doc.save(`${s.name.replace(/\s+/g,'_')}_${term==='final'?'Annual':TERM_NAMES[term].replace(/ /g,'_')}_Report.pdf`);
    toast('Report card downloaded ✓','success');
}

async function _drawReportCard(doc, s, sid, ranks, term) {
    const res     = rResults[sid] || {};
    const isFinal = term === 'final';
    const rank    = ranks[sid] || '—';
    const label   = isFinal ? 'Annual Result' : TERM_NAMES[term];
    const W=210, M=12, CW=W-M*2; // 186mm content

    // ── Palette ──
    const NAVY  = [26,26,46];
    const GREEN = [45,106,79];
    const RED   = [200,75,49];
    const WHITE = [255,255,255];
    const MUTED = [130,124,114];
    const ROW1  = [255,253,247];
    const ROW2  = [244,239,230];

    let y = 10;

    // ══════════════════════════════════════
    //  HEADER
    // ══════════════════════════════════════
    try { const lg=_logo(); if(lg) doc.addImage(lg,'JPEG',M,y,22,22); } catch(e){}

    doc.setFont('helvetica','bold'); doc.setFontSize(20);
    doc.setTextColor(...NAVY);
    doc.text('AL RAWA English School', M+26, y+10);

    doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text('ESTD: 2022  ·  Read in the name of your Lord', M+26, y+16);

    // Badge pill
    const badge = isFinal
        ? 'ANNUAL REPORT CARD — ANNUAL RESULT'
        : `TERM REPORT CARD — ${label.toUpperCase()}`;
    const bw = doc.getTextWidth(badge) + 14;
    doc.setFillColor(...RED);
    doc.roundedRect(M+26, y+19, bw, 6.5, 3.25, 3.25, 'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(7);
    doc.setTextColor(...WHITE);
    doc.text(badge, M+26+bw/2, y+23.5, {align:'center'});

    y += 30;

    // ══════════════════════════════════════
    //  STUDENT INFO
    // ══════════════════════════════════════
    if (s.photo) {
        try { doc.addImage(s.photo,'JPEG',W-M-26,y,26,30,'','FAST'); } catch(e){}
    }

    const infoRows = [
        ['Student Name', s.name],
        ['Class',        rActiveClass],
        s.roll       ? ['Roll No.',      s.roll]       : null,
        s.fatherName ? ["Father's Name", s.fatherName] : null,
        s.motherName ? ["Mother's Name", s.motherName] : null,
    ].filter(Boolean);

    doc.setFontSize(9.5);
    infoRows.forEach(([k,v])=>{
        doc.setFont('helvetica','normal'); doc.setTextColor(...MUTED);
        doc.text(k, M, y+5.5);
        doc.setFont('helvetica','bold'); doc.setTextColor(...NAVY);
        doc.text(String(v), M+36, y+5.5);
        y+=7;
    });
    y = Math.max(y, 72);

    // Divider
    doc.setDrawColor(215,210,200); doc.setLineWidth(0.3);
    doc.line(M, y, W-M, y); y+=6;

    // ══════════════════════════════════════
    //  SECTION TITLE
    // ══════════════════════════════════════
    doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(...NAVY);
    doc.text(isFinal?'ANNUAL ACADEMIC RESULT':`${label.toUpperCase()} — ACADEMIC RESULT`, M, y);
    y+=5;

    // ══════════════════════════════════════
    //  MARKS TABLE
    // ══════════════════════════════════════

    if (!isFinal) {
        // ── Single term: Subject | Marks Obtained | Grade | GPA ──
        const C = {
            s : {x:M,     w:78},
            mo: {x:M+78,  w:52},
            gr: {x:M+130, w:30},
            gp: {x:M+160, w:26},
        };
        const TW=CW, HH=8, RH=9;

        // Header row
        doc.setFillColor(...NAVY);
        doc.rect(M, y, TW, HH, 'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(...WHITE);
        doc.text('Subject (Full Marks)', C.s.x+4, y+HH/2+1);
        doc.text('Marks Obtained', C.mo.x+C.mo.w/2, y+HH/2+1, {align:'center'});
        doc.text('Grade', C.gr.x+C.gr.w/2, y+HH/2+1, {align:'center'});
        doc.text('GPA', C.gp.x+C.gp.w/2, y+HH/2+1, {align:'center'});
        y+=HH;

        const tm=res.terms?.[term]||{};
        let totObt=0,totFull=0,gpas=[],hasF=false;

        rSubjects.forEach((subj,ri)=>{
            if(y>248){doc.addPage();y=14;}
            const m   = tm[subj.name];
            const obt = (m!==undefined&&m!==null&&m!=='') ? +m : null;
            const g   = obt!==null ? gradeFromMarks(obt,subj.fullMarks) : null;
            if(g){gpas.push(g.gpa);if(g.grade==='F')hasF=true;totObt+=obt;totFull+=subj.fullMarks;}

            doc.setFillColor(...(ri%2===0?ROW1:ROW2));
            doc.rect(M,y,TW,RH,'F');

            // Subject name
            doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...NAVY);
            let nm=subj.name;
            while(doc.getTextWidth(nm)>C.s.w-6&&nm.length>2) nm=nm.slice(0,-1);
            doc.text(nm, C.s.x+4, y+4);
            doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...MUTED);
            doc.text(`(${subj.fullMarks} marks)`, C.s.x+4, y+7.8);

            // Marks
            doc.setFont('helvetica','normal'); doc.setFontSize(9.5); doc.setTextColor(...NAVY);
            if(obt!==null) doc.text(String(obt), C.mo.x+C.mo.w/2, y+6, {align:'center'});
            else { doc.setTextColor(...MUTED); doc.text('—', C.mo.x+C.mo.w/2, y+6, {align:'center'}); doc.setTextColor(...NAVY); }

            // Grade chip
            if(g) _pdfGradeChip(doc, C.gr.x+C.gr.w/2, y+RH/2, g.grade);

            // GPA
            doc.setFont('helvetica','normal'); doc.setFontSize(9.5); doc.setTextColor(...NAVY);
            if(g) doc.text(g.gpa.toFixed(2), C.gp.x+C.gp.w/2, y+6, {align:'center'});

            doc.setDrawColor(215,210,200); doc.setLineWidth(0.15);
            doc.line(M,y+RH,M+TW,y+RH); y+=RH;
        });

        // TOTAL row
        if(gpas.length){
            doc.setFillColor(...NAVY);
            doc.rect(M,y,TW,7,'F');
            doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(...WHITE);
            doc.text('TOTAL', C.s.x+4, y+4.5);
            doc.text(`${totObt} / ${totFull}`, C.mo.x+C.mo.w/2, y+4.5, {align:'center'});
            y+=7;
        }
        y+=6;

        // Result summary bar
        if(gpas.length){
            if(y>248){doc.addPage();y=14;}
            const tGPA  = gpas.reduce((a,b)=>a+b,0)/gpas.length;
            const tGr   = hasF?'F':gpaToGrade(tGPA);
            const BH    = 22;
            doc.setFillColor(...NAVY);
            doc.rect(M,y,CW,BH,'F');
            const sw=CW/3;
            [[`${label.toUpperCase()} GPA`,tGPA.toFixed(2)],
             ['GRADE',tGr],
             ['CLASS RANK',String(rank)]
            ].forEach(([lbl,val],i)=>{
                const cx=M+i*sw+sw/2;
                if(i>0){ doc.setDrawColor(255,255,255); doc.setLineWidth(0.3); doc.line(M+i*sw,y+4,M+i*sw,y+BH-4); }
                doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(160,155,145);
                doc.text(lbl, cx, y+7, {align:'center'});
                doc.setFont('helvetica','bold'); doc.setFontSize(18); doc.setTextColor(...WHITE);
                doc.text(val, cx, y+18, {align:'center'});
            });
            y+=BH+8;
        }

    } else {
        // ── Annual: Subject | 1st | 2nd | Final | Average | Grade | GPA ──
        const C = {
            s  :{x:M,     w:50},
            t1 :{x:M+50,  w:22},
            t2 :{x:M+72,  w:22},
            t3 :{x:M+94,  w:22},
            avg:{x:M+116, w:22},
            gr :{x:M+138, w:26},
            gp :{x:M+164, w:22},
        };
        const TW=CW, H1=8, H2=7, RH=8;

        // ── Header row 1 ──
        // Subject cell (spans both rows)
        doc.setFillColor(...NAVY);
        doc.rect(C.s.x,  y, C.s.w, H1+H2, 'F');
        // Term Marks spanning T1+T2+T3
        doc.rect(C.t1.x, y, C.t1.w+C.t2.w+C.t3.w, H1, 'F');
        // Annual Result spanning Avg+Gr+GPA
        doc.setFillColor(...GREEN);
        doc.rect(C.avg.x, y, C.avg.w+C.gr.w+C.gp.w, H1, 'F');

        doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(...WHITE);
        // Subject label centred in full (H1+H2) height
        doc.text('Subject', C.s.x+C.s.w/2, y+H1/2+0.5, {align:'center'});
        doc.setFontSize(7); doc.setFont('helvetica','normal');
        doc.text('(Full Marks)', C.s.x+C.s.w/2, y+H1/2+4, {align:'center'});
        doc.setFont('helvetica','bold'); doc.setFontSize(8.5);
        doc.text('Term Marks', C.t1.x+(C.t1.w+C.t2.w+C.t3.w)/2, y+H1/2+1, {align:'center'});
        doc.text('Annual Result', C.avg.x+(C.avg.w+C.gr.w+C.gp.w)/2, y+H1/2+1, {align:'center'});
        y+=H1;

        // ── Header row 2 ──
        doc.setFillColor(38,38,60);  // slightly lighter navy
        [C.t1,C.t2,C.t3,C.avg].forEach(col=>doc.rect(col.x,y,col.w,H2,'F'));
        doc.setFillColor(36,84,62);  // slightly lighter green
        [C.gr,C.gp].forEach(col=>doc.rect(col.x,y,col.w,H2,'F'));

        doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(...WHITE);
        [['1st Term',C.t1],['2nd Term',C.t2],['Final Exam',C.t3],
         ['Average',C.avg],['Grade',C.gr],['GPA',C.gp]].forEach(([lbl,col])=>{
            doc.text(lbl, col.x+col.w/2, y+H2/2+0.8, {align:'center'});
        });
        y+=H2;

        // ── Data rows ──
        rSubjects.forEach((subj,ri)=>{
            if(y>248){doc.addPage();y=14;}
            const getM=t=>{const m=res.terms?.[t]?.[subj.name];return(m!==undefined&&m!==null&&m!=='') ? +m : null;};
            const m1=getM('1'),m2=getM('2'),m3=getM('3');
            const vals=[m1,m2,m3].filter(m=>m!==null);
            const avg=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;
            const gAvg=avg!==null?gradeFromMarks(avg,subj.fullMarks):null;

            doc.setFillColor(...(ri%2===0?ROW1:ROW2));
            doc.rect(M,y,TW,RH,'F');

            // Subject
            doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(...NAVY);
            let nm=subj.name;
            while(doc.getTextWidth(nm)>C.s.w-5&&nm.length>2) nm=nm.slice(0,-1);
            doc.text(nm, C.s.x+3, y+3.8);
            doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(...MUTED);
            doc.text(`(${subj.fullMarks})`, C.s.x+3, y+7.2);

            // Term marks
            doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...NAVY);
            [[m1,C.t1],[m2,C.t2],[m3,C.t3]].forEach(([m,col])=>{
                if(m!==null) doc.text(String(m), col.x+col.w/2, col===C.t1?y+5.5:y+5.5, {align:'center'});
                else { doc.setTextColor(...MUTED); doc.text('—',col.x+col.w/2,y+5.5,{align:'center'}); doc.setTextColor(...NAVY); }
            });

            // Average
            if(avg!==null){
                doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...NAVY);
                doc.text(avg.toFixed(1), C.avg.x+C.avg.w/2, y+5.5, {align:'center'});
            }

            // Grade chip
            if(gAvg) _pdfGradeChip(doc, C.gr.x+C.gr.w/2, y+RH/2, gAvg.grade);

            // GPA
            doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...NAVY);
            if(gAvg) doc.text(gAvg.gpa.toFixed(2), C.gp.x+C.gp.w/2, y+5.5, {align:'center'});

            doc.setDrawColor(215,210,200); doc.setLineWidth(0.15);
            doc.line(M,y+RH,M+TW,y+RH); y+=RH;
        });
        y+=6;

        // Annual result bar
        const { finalGPA } = calcYearSummary(sid);
        const finalGrade  = finalGPA!==null ? gpaToGrade(finalGPA) : '—';
        const finalGPAStr = finalGPA!==null ? finalGPA.toFixed(2) : '—';

        if(y>248){doc.addPage();y=14;}
        const BH=22;
        doc.setFillColor(...NAVY);
        doc.rect(M,y,CW,BH,'F');
        const sw=CW/3;
        [['ANNUAL GPA',finalGPAStr],['FINAL GRADE',finalGrade],['YEAR RANK',String(rank)]].forEach(([lbl,val],i)=>{
            const cx=M+i*sw+sw/2;
            if(i>0){ doc.setDrawColor(255,255,255); doc.setLineWidth(0.3); doc.line(M+i*sw,y+4,M+i*sw,y+BH-4); }
            doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(160,155,145);
            doc.text(lbl, cx, y+7, {align:'center'});
            doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(...WHITE);
            doc.text(val, cx, y+18, {align:'center'});
        });
        y+=BH+8;
    }

    // ══════════════════════════════════════
    //  ATTENDANCE
    // ══════════════════════════════════════
    const GAP    = 8;
    const COLW   = (CW - GAP) / 2;   // ~89mm each
    const attX   = M;
    const cmtX   = M + COLW + GAP;
    const topY   = y;

    // ── Labels (both at same y) ──
    doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(...NAVY);
    doc.text(isFinal?'ATTENDANCE SUMMARY':`ATTENDANCE — ${label.toUpperCase()}`, attX, y+4.5);
    doc.text("TEACHER'S COMMENT", cmtX, y+4.5);
    y += 8;

    // ── Left: Attendance ──
    const attStartY = y;
    if (!isFinal) {
        const att = _getTermAtt(res, term);
        [['Total School Days', att?.days||'—'],
         ['Days Present',      att?.present||'—'],
         ['Attendance',        calcAttendPct(att)]
        ].forEach(([k,v])=>{
            doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(...MUTED);
            doc.text(k, attX+2, y+4);
            doc.setFont('helvetica','normal'); doc.setTextColor(...NAVY);
            doc.text(String(v), attX+COLW-2, y+4, {align:'right'});
            y+=6.5;
        });
    } else {
        // ── Annual attendance table ──
    const aC = [31, 22, 18, 18]; // Term | Total Days | Present | Att% → total 89mm = COLW
    const AH = 6;
    const hdrs = ['Term', 'Total Days', 'Present', 'Att%'];

    // Pass 1: draw ALL header background rects first
    let ax = attX;
    doc.setFillColor(26, 26, 46);
    aC.forEach(w => { doc.rect(ax, y, w, AH, 'F'); ax += w; });

    // Pass 2: draw ALL header texts on top
    ax = attX;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    hdrs.forEach((h, i) => {
        doc.setTextColor(255, 255, 255); // explicit white before every text
        const tw = doc.getTextWidth(h);
        const tx = i === 0 ? ax + 2 : ax + (aC[i] - tw) / 2;
        doc.text(h, tx, y + AH / 2 + 0.8);
        ax += aC[i];
    });
    y += AH;

    // Data rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    ['1', '2', '3'].forEach((t, ri) => {
        const att = _getTermAtt(res, t);
        const vals = [TERM_NAMES[t], att?.days||'—', att?.present||'—', calcAttendPct(att)];

        // Pass 1: draw all row background rects
        ax = attX;
        doc.setFillColor(...(ri % 2 === 0 ? ROW1 : ROW2));
        aC.forEach(w => { doc.rect(ax, y, w, AH, 'F'); ax += w; });

        // Pass 2: draw all row texts on top
        ax = attX;
        vals.forEach((v, i) => {
            doc.setTextColor(26, 26, 46); // explicit navy before every text
            const tw = doc.getTextWidth(String(v));
            const tx = i === 0 ? ax + 2 : ax + (aC[i] - tw) / 2;
            doc.text(String(v), tx, y + AH / 2 + 0.8);
            ax += aC[i];
        });

        doc.setDrawColor(215, 210, 200);
        doc.setLineWidth(0.15);
        doc.line(attX, y + AH, attX + aC.reduce((a, b) => a + b, 0), y + AH);
        y += AH;
    });
    }
    const attEndY = y;

    // ── Right: Comment box (height matches attendance section) ──
    const boxH = Math.max(attEndY - attStartY, 20);
    const comment = res.comment || '';
    doc.setFillColor(250,248,243); doc.setDrawColor(210,205,195); doc.setLineWidth(0.3);
    doc.roundedRect(cmtX, attStartY, COLW, boxH, 2, 2, 'FD');
    const cmtLines = doc.splitTextToSize(comment||'No comment added.', COLW-8);
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
    doc.setTextColor(!comment?MUTED[0]:NAVY[0], !comment?MUTED[1]:NAVY[1], !comment?MUTED[2]:NAVY[2]);
    doc.text(cmtLines, cmtX+4, attStartY+5);

    y = attEndY + 8;

    // ══════════════════════════════════════
    //  SIGNATURES — near page bottom
    // ══════════════════════════════════════
    const sigY = Math.max(y, 270);
    const sigW = (CW-20)/3;
    doc.setDrawColor(100,100,100); doc.setLineWidth(0.5);
    ['CLASS TEACHER','CO-ORDINATOR','PRINCIPAL'].forEach((lbl,i)=>{
        const sx = M+i*(sigW+10);
        doc.line(sx, sigY, sx+sigW, sigY);
        doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
        doc.setTextColor(...MUTED);
        doc.text(lbl, sx+sigW/2, sigY+5.5, {align:'center'});
    });
}

// ── PDF table header helper ──
function _pdfTableHeader(doc, x, y, cols, headers, sectionTitle) {
    const totalW=cols.reduce((a,b)=>a+b,0);
    doc.setFillColor(26,26,46); doc.setTextColor(245,240,232);
    doc.setFont('helvetica','bold'); doc.setFontSize(7.5);
    doc.rect(x,y,totalW,5,'F');
    doc.text(sectionTitle,x+totalW/2,y+3.5,{align:'center'});
    y+=5;
    doc.setFillColor(230,225,215); doc.setTextColor(26,26,46);
    doc.rect(x,y,totalW,5,'F');
    let cx=x;
    headers.forEach((h,i)=>{
        if(i>0) doc.text(h,cx+cols[i]-1,y+3.5,{align:'right'}); else doc.text(h,cx+2,y+3.5);
        cx+=cols[i];
    });
}

// ══════════════════════════════════════
//  FIREBASE CONFIG SAVE
// ══════════════════════════════════════
async function saveResultConfig() {
    if (!isUnlocked||!rActiveClass) return;
    try { await dbWrite('school/results/'+classToKey(rActiveClass)+'/subjects', rSubjects); }
    catch(e) { toast('Save error: '+e.message,'error'); }
}

async function deleteClassResults(cls) {
    if (!isAdmin()) { toast('Admin access required.','error'); return; }
    if (!confirm(`Delete ALL results for "${cls}"? This cannot be undone.`)) return;
    try {
        setStatus('syncing','Deleting…');
        await dbWrite('school/results/'+classToKey(cls), null);
        setStatus('connected','Ready');
        toast(`Results for "${cls}" deleted.`,'success');
        if (rActiveClass===cls) { rSubjects=[]; rResults={}; rActiveClass=null; rActiveStudent=null; }
        renderResultClassPicker();
    } catch(e) { setStatus('connected','Ready'); toast('Delete failed: '+e.message,'error'); }
}

function toggleRSection(id) {
    const el=document.getElementById(id);
    if (!el) return;
    const hidden=el.style.display==='none';
    el.style.display=hidden?'':'none';
    const arrow=el.previousElementSibling?.querySelector('.arrow');
    if (arrow) arrow.style.transform=hidden?'':'rotate(-90deg)';
}