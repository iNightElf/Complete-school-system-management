// ════════════════════════════════════════
//  ui.js — Shared UI helpers & globals
// ════════════════════════════════════════

// ── Global state ──
let isUnlocked   = false;
let currentRole  = null; // 'admin' | 'viewer' — set by auth.js

let students = [], teachers = [], staff = [], books = {};
let sEditIndex = -1, tEditIndex = -1, stEditIndex = -1, bEditIndex = -1;
let activeClass = null, activeDesig = null, activeBookClass = null, currentMode = null;

// ── Class list (loaded from Firebase, falls back to defaults) ──
let CLASSES = ['Play','Nursery','KG','Class One','Class Two','Class Three','Class Four','Class Five'];
const CLASS_ICONS = { Play:'🧸', Nursery:'🌱', KG:'🎨', 'Class One':'1️⃣', 'Class Two':'2️⃣', 'Class Three':'3️⃣', 'Class Four':'4️⃣', 'Class Five':'5️⃣' };
const classIcon = cls => CLASS_ICONS[cls] || '📖';

// ── Class dropdowns ──
function populateClassDropdowns() {
    ['fClass','bClass'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const cur = sel.value;
        sel.innerHTML = '<option value="" disabled selected>Select class</option>';
        CLASSES.forEach(cls => {
            const opt = document.createElement('option');
            opt.value = opt.textContent = cls;
            sel.appendChild(opt);
        });
        if (cur && CLASSES.includes(cur)) sel.value = cur;
    });
}

// ── Class Manager Modal ──
function openClassManager() {
    if (!isAdmin()) { toast('Admin access required.', 'error'); return; }
    renderClassManagerList();
    document.getElementById('classManagerModal').classList.add('open');
}
function closeClassManager() {
    document.getElementById('classManagerModal').classList.remove('open');
    document.getElementById('newClassName').value = '';
}
function renderClassManagerList() {
    const ul = document.getElementById('classManagerList');
    ul.innerHTML = '';
    CLASSES.forEach((cls, i) => {
        const li = document.createElement('li');
        li.className = 'cm-item';
        li.innerHTML = `
            <span class="cm-icon">${classIcon(cls)}</span>
            <span class="cm-name">${cls}</span>
            <div class="cm-actions">
                ${i > 0 ? `<button class="cm-btn" onclick="moveClass(${i},-1)" title="Move up">▲</button>` : '<span class="cm-btn-placeholder"></span>'}
                ${i < CLASSES.length-1 ? `<button class="cm-btn" onclick="moveClass(${i},1)" title="Move down">▼</button>` : '<span class="cm-btn-placeholder"></span>'}
                <button class="cm-btn cm-del" onclick="deleteClass(${i})" title="Delete">✕</button>
            </div>`;
        ul.appendChild(li);
    });
}
function addNewClass() {
    const input = document.getElementById('newClassName');
    const name  = input.value.trim();
    if (!name) { toast('Enter a class name.', 'error'); return; }
    if (CLASSES.includes(name)) { toast('Class already exists.', 'error'); return; }
    CLASSES.push(name);
    input.value = '';
    afterClassChange();
    toast(`"${name}" added ✓`, 'success');
}
function deleteClass(i) {
    const cls = CLASSES[i];
    if ((students.some(s => s.class === cls) || (books[cls] || []).length) &&
        !confirm(`"${cls}" has existing data. Delete anyway?`)) return;
    CLASSES.splice(i, 1);
    afterClassChange();
    toast(`"${cls}" removed.`);
}
function moveClass(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= CLASSES.length) return;
    [CLASSES[i], CLASSES[j]] = [CLASSES[j], CLASSES[i]];
    afterClassChange();
}
async function afterClassChange() {
    renderClassManagerList();
    populateClassDropdowns();
    if (currentMode === 'student')  renderStudents();
    if (currentMode === 'booklist') renderBookPicker();
    if (currentMode === 'results')  renderResults();
    await saveClassListToDatabase();
}

// ── Mode selector ──
function setMode(mode) {
    currentMode = mode;
    // Top-level tiles: idcard | booklist | results
    ['idcard','booklist','results'].forEach(m => {
        const t = document.getElementById('tile-'+m);
        if (t) t.className = 'mode-tile' + (['student','teacher','staff'].includes(mode) && m==='idcard' ? ' active-idcard' : mode===m ? ' active-'+m : '');
    });
    // Sub-tabs inside ID section
    ['student','teacher','staff'].forEach(m => {
        const t = document.getElementById('subtile-'+m);
        if (t) t.className = 'id-sub-tile' + (mode===m ? ' active' : '');
    });
    // Sections visibility
    const isID = ['student','teacher','staff'].includes(mode);
    document.getElementById('idSection').style.display       = isID ? 'block' : 'none';
    document.getElementById('bookSection').style.display     = mode==='booklist' ? 'block' : 'none';
    document.getElementById('resultSection').style.display   = mode==='results'  ? 'block' : 'none';
    // ID sub-sections
    document.getElementById('studentSection').style.display  = mode==='student' ? 'block' : 'none';
    document.getElementById('teacherSection').style.display  = mode==='teacher' ? 'block' : 'none';
    document.getElementById('staffSection').style.display    = mode==='staff'   ? 'block' : 'none';
    if (window.innerWidth < 768) ['s','t','st','b'].forEach(collapseForm);
    if (mode==='student')  renderStudents();
    if (mode==='teacher')  renderTeachers();
    if (mode==='staff')    renderStaff();
    if (mode==='booklist') renderBookPicker();
    if (mode==='results')  renderResults();
}

// ── Collapsible forms ──
function toggleForm(type) {
    const body = document.getElementById(type+'FormBody');
    const btn  = document.getElementById(type+'FormToggle');
    const hide = !body.classList.contains('hidden');
    body.classList.toggle('hidden', hide);
    btn.classList.toggle('collapsed', hide);
}
function expandForm(type) {
    document.getElementById(type+'FormBody')?.classList.remove('hidden');
    document.getElementById(type+'FormToggle')?.classList.remove('collapsed');
}
function collapseForm(type) {
    if (window.innerWidth >= 768) return;
    document.getElementById(type+'FormBody')?.classList.add('hidden');
    document.getElementById(type+'FormToggle')?.classList.add('collapsed');
}

// ── Photo helpers ──
let activeCameraTarget = null, cameraStream = null;

function handlePhotoFile(previewId, placeholderId, input) {
    if (!input.files?.[0]) return;
    const img = new Image(), reader = new FileReader();
    reader.onload = e => {
        img.onload = () => {
            const MAX = 400;
            let w = img.width, h = img.height;
            if (w > MAX || h > MAX) {
                if (w > h) { h = Math.round(h*MAX/w); w = MAX; }
                else       { w = Math.round(w*MAX/h); h = MAX; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            setPhotoPreview(previewId, placeholderId, canvas.toDataURL('image/jpeg', 0.6));
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(input.files[0]);
}
function setPhotoPreview(previewId, placeholderId, dataUrl) {
    const prev = document.getElementById(previewId);
    prev.src = dataUrl; prev.style.display = 'block';
    document.getElementById(placeholderId).style.display = 'none';
}
function getPhotoData(t) {
    const ids = { s:'sPhotoPreview', t:'tPhotoPreview', st:'stPhotoPreview' };
    const prev = document.getElementById(ids[t] || t+'PhotoPreview');
    return (prev?.style.display !== 'none' && prev?.src?.startsWith('data:')) ? prev.src : '';
}

// ── Camera ──
function openCamera(target) {
    activeCameraTarget = target;
    document.getElementById('cameraModal').classList.add('open');
    navigator.mediaDevices.getUserMedia({ video: { facingMode:'user', width:{ideal:1280}, height:{ideal:720} } })
        .then(stream => { cameraStream = stream; document.getElementById('cameraVideo').srcObject = stream; })
        .catch(err  => { closeCamera(); toast('Camera denied: '+err.message, 'error'); });
}
function capturePhoto() {
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('cameraCanvas');
    const MAX = 400;
    let w = video.videoWidth, h = video.videoHeight;
    if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h*MAX/w); w = MAX; }
        else       { w = Math.round(w*MAX/h); h = MAX; }
    }
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(video, 0, 0, w, h);
    const ids = { s:['sPhotoPreview','sPhotoPlaceholder'], t:['tPhotoPreview','tPhotoPlaceholder'], st:['stPhotoPreview','stPhotoPlaceholder'] };
    const [pid, plid] = ids[activeCameraTarget] || [activeCameraTarget+'PhotoPreview', activeCameraTarget+'PhotoPlaceholder'];
    setPhotoPreview(pid, plid, canvas.toDataURL('image/jpeg', 0.6));
    closeCamera();
}
function closeCamera() {
    if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
    document.getElementById('cameraModal').classList.remove('open');
    document.getElementById('cameraVideo').srcObject = null;
}

// ── Toast & status ──
function toast(msg, type='') {
    const el = document.getElementById('toast');
    el.textContent = msg; el.className = 'show '+type;
    setTimeout(() => el.className = '', 3000);
}
function setStatus(cls, text) {
    document.getElementById('driveStatus').className       = cls;
    document.getElementById('driveStatusText').textContent = text;
}

// ── BD phone helpers ──
function formatBDPhone(raw) {
    if (!raw) return '';
    let n = raw.replace(/[\s().+-]/g, '');
    if (n.startsWith('880')) n = n.slice(3);
    if (n.startsWith('0'))   n = n.slice(1);
    return (n.length === 10 && n.startsWith('1')) ? '+880'+n : raw;
}
function contactLinks(raw) {
    if (!raw) return '—';
    const e164 = formatBDPhone(raw);
    if (!(e164.startsWith('+880') && e164.length === 14)) return `<span>${raw}</span>`;
    const wa = e164.slice(1);
    return `<a href="tel:${e164}" class="contact-link">📞 ${e164}</a>` +
           `<a href="https://wa.me/${wa}" class="contact-link wa-link" target="_blank">💬 WhatsApp</a>`;
}
