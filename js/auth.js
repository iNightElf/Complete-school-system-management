// ════════════════════════════════════════
//  auth.js — Advanced Role-Based PIN Auth
//  Roles:
//  - 'admin'      : Full access (All sections + Settings)
//  - 'teacher'    : ID Card, Book List, Results (Full Write) | No Fees
//  - 'accountant' : ID Card, Book List, Fees (Full Write) | Results (Read-Only)
//  - 'viewer'     : All sections (Read-Only)
// ════════════════════════════════════════

// SHA-256 → hex
async function sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

// ── Permission Helpers ──
function isAdmin() { return currentRole === 'admin'; }

function canAccess(module) {
    if (isAdmin()) return true;
    if (currentRole === 'viewer') return true; // Viewers can see everything but not write

    if (currentRole === 'teacher') {
        return ['idcard','booklist','results','student','teacher','staff'].includes(module);
    }
    if (currentRole === 'accountant') {
        return ['idcard','booklist','fees','results','student','teacher','staff'].includes(module);
    }
    return false;
}

function canWrite(module) {
    if (isAdmin()) return true;
    if (currentRole === 'viewer') return false;

    if (currentRole === 'teacher') {
        return ['idcard','booklist','results','student','teacher','staff'].includes(module);
    }
    if (currentRole === 'accountant') {
        // Accountant can write in ID, Book, Fees. Results is Read-only for them.
        return ['idcard','booklist','fees','student','teacher','staff'].includes(module);
    }
    return false;
}

function applyRoleUI() {
    // Hide/Show Top Level Tiles based on access
    ['idcard','booklist','results','fees'].forEach(m => {
        const t = document.getElementById('tile-'+m);
        if (t) t.style.display = canAccess(m) ? '' : 'none';
    });

    // Handle generic admin-only elements
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = isAdmin() ? '' : 'none');
    
    // Hide write actions if role cannot write in current module
    const module = ['student','teacher','staff'].includes(currentMode) ? 'idcard' : currentMode;
    document.querySelectorAll('.write-action').forEach(el => {
        el.style.display = canWrite(module) ? '' : 'none';
    });

    // Special case for Fees dashboard (Viewer should only see Reports)
    if (currentMode === 'fees' && currentRole === 'viewer') {
        document.querySelectorAll('.f-action-btn').forEach(btn => {
            // Check if it's the Reports button
            const isReports = btn.getAttribute('onclick')?.includes('reports');
            btn.style.display = isReports ? '' : 'none';
        });
    }

    const badge = document.getElementById('roleBadge');
    if (badge) {
        const labels = { admin:'👑 Admin', teacher:'👨‍🏫 Teacher', accountant:'💰 Accountant', viewer:'👁️ Viewer' };
        const colors = { admin:'#1a1a2e', teacher:'#0369a1', accountant:'#059669', viewer:'#6b7280' };
        badge.textContent = labels[currentRole] || 'Guest';
        badge.style.background = colors[currentRole] || '#6b7280';
    }
}

async function initAuth() {
    const s = getStoredSession();
    if (s) { isUnlocked = true; currentRole = s.role; showConnectedUI(); syncFromDatabase(); return; }
    localStorage.removeItem('unlocked');
    try {
        const cfg = await dbRead('school/config');
        if (!cfg?.adminPinHash) { showSetupScreen(); }
        else                    { showAuthBanner(); setTimeout(()=>document.getElementById('pinInput')?.focus(), 300); }
    } catch(e) { showAuthBanner(); setTimeout(()=>document.getElementById('pinInput')?.focus(), 300); }
}

function showSetupScreen() {
    document.getElementById('authBanner').style.display       = 'none';
    document.getElementById('configBar').style.display        = 'none';
    document.getElementById('modeSelectorWrap').style.display = 'none';
    document.getElementById('setupScreen').style.display      = 'flex';
}

async function submitSetupPin() {
    const p1 = document.getElementById('setupPin1').value.trim();
    const p2 = document.getElementById('setupPin2').value.trim();
    const err = document.getElementById('setupError');
    err.style.display = 'none';
    if (!p1)        { err.textContent='Enter a PIN.'; err.style.display='block'; return; }
    if (p1.length<4){ err.textContent='PIN must be at least 4 characters.'; err.style.display='block'; return; }
    if (p1!==p2)    { err.textContent='PINs do not match.'; err.style.display='block'; return; }
    const btn = document.getElementById('setupBtn');
    btn.disabled=true; btn.textContent='Setting up…';
    try {
        const hash = await sha256(p1);
        await dbWrite('school/config/adminPinHash', hash);
        document.getElementById('setupScreen').style.display = 'none';
        grantAccess('admin');
        toast('Admin PIN set! Welcome 👑', 'success');
    } catch(e) {
        err.textContent = 'Error: '+e.message; err.style.display='block';
        btn.disabled=false; btn.textContent='Set Admin PIN →';
    }
}

async function checkPin() {
    const entered = document.getElementById('pinInput').value.trim();
    if (!entered) return;
    const btn = document.querySelector('#authBanner .btn-primary');
    btn.disabled = true; btn.textContent = 'Checking…';
    document.getElementById('pinError').style.display = 'none';
    try {
        const config = await dbRead('school/config');
        const hash   = await sha256(entered);
        
        if (hash === config.adminPinHash) {
            grantAccess('admin');
        } else if (config.teacherPinHash && hash === config.teacherPinHash) {
            grantAccess('teacher');
        } else if (config.accountantPinHash && hash === config.accountantPinHash) {
            grantAccess('accountant');
        } else if (config.viewerPinHash && hash === config.viewerPinHash) {
            grantAccess('viewer');
        } else {
            await new Promise(r => setTimeout(r, 600));
            const err = document.getElementById('pinError');
            err.textContent = 'Incorrect PIN. Try again.'; err.style.display = 'block';
            document.getElementById('pinInput').value = ''; document.getElementById('pinInput').focus();
        }
    } catch(e) {
        const err = document.getElementById('pinError');
        err.textContent = 'Connection error. Check your internet.'; err.style.display = 'block';
        console.error(e);
    } finally { btn.disabled = false; btn.textContent = '🔑 Enter'; }
}

function grantAccess(role) {
    isUnlocked = true; currentRole = role;
    localStorage.setItem('sessionToken',  'local-'+Date.now());
    localStorage.setItem('sessionExpiry', (Date.now()+8*60*60*1000).toString());
    localStorage.setItem('sessionRole',   role);
    showConnectedUI(); syncFromDatabase();
}

function getStoredSession() {
    const token = localStorage.getItem('sessionToken');
    const expiry = parseInt(localStorage.getItem('sessionExpiry')||'0');
    const role  = localStorage.getItem('sessionRole');
    return (token && role && Date.now() < expiry) ? { token, role } : null;
}

function signOut() {
    isUnlocked = false; currentRole = null;
    ['sessionToken','sessionExpiry','sessionRole','unlocked'].forEach(k=>localStorage.removeItem(k));
    showAuthBanner();
    const pi = document.getElementById('pinInput'); if (pi) pi.value = '';
    toast('App locked.');
}

function showConnectedUI() {
    setStatus('connected','Ready');
    document.getElementById('authBanner').style.display       = 'none';
    document.getElementById('configBar').style.display        = 'flex';
    document.getElementById('modeSelectorWrap').style.display = 'grid';
    applyRoleUI();
}

function showAuthBanner() {
    document.getElementById('authBanner').style.display       = 'flex';
    document.getElementById('setupScreen').style.display      = 'none';
    document.getElementById('configBar').style.display        = 'none';
    document.getElementById('modeSelectorWrap').style.display = 'none';
    ['idSection','studentSection','teacherSection','staffSection','bookSection','resultSection','feesSection']
        .forEach(id => { const el = document.getElementById(id); if(el) el.style.display = 'none'; });
    students=[]; teachers=[]; staff=[]; books={};
    feeHeads=[]; classFees={}; studentFees={}; feePayments={};
    rActiveClass=null; rActiveStudent=null; rSubjects=[]; rResults={};
    currentMode=null; activeClass=null; activeDesig=null; activeBookClass=null; currentRole=null;
    setStatus('','Locked');
}

// ── PIN Management Modal ──
function openChangePinModal() {
    if (!isAdmin()) { toast('Only admin can manage PINs.', 'error'); return; }
    ['cpAdminOld','cpAdminNew','cpAdminConfirm','cpTeacherNew','cpTeacherConfirm','cpAccountantNew','cpAccountantConfirm','cpViewerNew','cpViewerConfirm']
        .forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
    document.querySelectorAll('.pin-error-box').forEach(el => el.style.display = 'none');
    document.getElementById('changePinModal').classList.add('open');
    setTimeout(()=>document.getElementById('cpAdminOld').focus(), 100);
}
function closeChangePinModal() { document.getElementById('changePinModal').classList.remove('open'); }

function _pinErr(errId, msg) {
    const el = document.getElementById(errId);
    if(el) { el.textContent = msg; el.style.display = 'block'; }
}

async function submitChangeAdminPin() {
    const old=document.getElementById('cpAdminOld').value.trim(),
          nw =document.getElementById('cpAdminNew').value.trim(),
          cf =document.getElementById('cpAdminConfirm').value.trim();
    if (!old||!nw||!cf)        return _pinErr('cpAdminError','Fill in all fields.');
    if (nw.length<4)           return _pinErr('cpAdminError','PIN must be at least 4 characters.');
    if (nw!==cf)               return _pinErr('cpAdminError','New PINs do not match.');
    const btn=document.getElementById('cpAdminSaveBtn');
    btn.disabled=true; btn.textContent='Saving…';
    try {
        const config = await dbRead('school/config');
        if (await sha256(old) !== config.adminPinHash)
            return _pinErr('cpAdminError','Current admin PIN is incorrect.');
        await dbWrite('school/config/adminPinHash', await sha256(nw));
        toast('Admin PIN updated ✓','success'); closeChangePinModal();
    } catch(e) { _pinErr('cpAdminError','Error: '+e.message); }
    finally    { btn.disabled=false; btn.textContent='✓ Update Admin PIN'; }
}

async function updateRolePin(role) {
    const prefix = role.charAt(0).toUpperCase() + role.slice(1);
    const nw = document.getElementById(`cp${prefix}New`).value.trim();
    const cf = document.getElementById(`cp${prefix}Confirm`).value.trim();
    const errId = `cp${prefix}Error`;
    
    if (!nw || !cf)    return _pinErr(errId, 'Fill in both fields.');
    if (nw.length < 4) return _pinErr(errId, 'PIN must be 4+ chars.');
    if (nw !== cf)     return _pinErr(errId, 'PINs do not match.');
    
    try {
        await dbWrite(`school/config/${role}PinHash`, await sha256(nw));
        toast(`${prefix} PIN set ✓`, 'success');
    } catch(e) { _pinErr(errId, 'Error: ' + e.message); }
}

async function removeRolePin(role) {
    if (!confirm(`Remove ${role} access? They will no longer be able to log in.`)) return;
    try {
        await dbWrite(`school/config/${role}PinHash`, null);
        toast(`${role} access removed.`, 'success');
    } catch(e) { toast('Error: ' + e.message, 'error'); }
}
