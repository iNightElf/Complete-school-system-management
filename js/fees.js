// ════════════════════════════════════════
//  fees.js — School Fee Management System
// ════════════════════════════════════════

// ── State ──
let fActiveView = 'dashboard'; // dashboard | config | payments | reports
let fActiveTab  = 'heads';     // heads | defaults | overrides (for config)

// ══════════════════════════════════════
//  1. ENTRY POINT
// ══════════════════════════════════════
function renderFees() {
    const sec = document.getElementById('feesSection');
    if (!sec) return;

    if (fActiveView === 'dashboard') {
        renderFeesDashboard();
    } else if (fActiveView === 'config') {
        renderFeesConfig();
    } else if (fActiveView === 'payments') {
        renderFeesPayments();
    } else if (fActiveView === 'reports') {
        renderFeesReports();
    }
    applyRoleUI();
}

// ══════════════════════════════════════
//  2. DASHBOARD
// ══════════════════════════════════════
function renderFeesDashboard() {
    const sec = document.getElementById('feesSection');
    sec.innerHTML = `
        <div class="panel-header">
            <h3>💰 Fee Management</h3>
        </div>
        
        <div class="f-action-row">
            <button class="f-action-btn write-action" onclick="fSwitchView('payments')">
                <span style="font-size:1.4rem;">💸</span>
                <span>Collect Fees</span>
                <small>Record payments</small>
            </button>
            <button class="f-action-btn write-action" onclick="fSwitchView('config')">
                <span style="font-size:1.4rem;">⚙️</span>
                <span>Setup</span>
                <small>Heads & Defaults</small>
            </button>
            <button class="f-action-btn" onclick="fSwitchView('reports')">
                <span style="font-size:1.4rem;">📋</span>
                <span>Reports</span>
                <small>Defaulters & Income</small>
            </button>
        </div>

        <div class="f-card">
            <div class="f-card-header" style="cursor:default;">
                <span>📈 Quick Summary</span>
            </div>
            <div class="f-card-body">
                <div style="display:flex;gap:12px;flex-wrap:wrap;">
                    <div class="f-summary-chip">
                        <span>Total Heads</span>
                        <strong>${feeHeads.length}</strong>
                    </div>
                    <div class="f-summary-chip">
                        <span>Active Classes</span>
                        <strong>${CLASSES.length}</strong>
                    </div>
                </div>
                <p style="margin-top:16px;font-size:.85rem;color:var(--muted);">
                    Use the tiles above to manage fee structures, record student payments, or generate reports.
                </p>
            </div>
        </div>
    `;
}

function fSwitchView(view) {
    fActiveView = view;
    renderFees();
}

// ══════════════════════════════════════
//  3. CONFIGURATION (Heads, Defaults)
// ══════════════════════════════════════
function renderFeesConfig() {
    const sec = document.getElementById('feesSection');
    sec.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
            <button class="back-btn" onclick="fSwitchView('dashboard')">← Dashboard</button>
            <h3 style="font-family:'DM Serif Display',serif;font-size:1.1rem;">Fee Setup</h3>
        </div>

        <div class="r-term-tabs">
            <button class="r-tab ${fActiveTab==='heads'?'active':''}" onclick="fSwitchTab('heads')">Fee Heads</button>
            <button class="r-tab ${fActiveTab==='defaults'?'active':''}" onclick="fSwitchTab('defaults')">Class Defaults</button>
            <button class="r-tab ${fActiveTab==='overrides'?'active':''}" onclick="fSwitchTab('overrides')">Student Discounts</button>
        </div>

        <div id="fConfigArea"></div>
    `;

    if (fActiveTab === 'heads')     renderFeeHeads();
    if (fActiveTab === 'defaults')  renderClassDefaults();
    if (fActiveTab === 'overrides') renderStudentOverrides();
}

function fSwitchTab(tab) {
    fActiveTab = tab;
    renderFeesConfig();
}

// ── Fee Heads ──
function renderFeeHeads() {
    const area = document.getElementById('fConfigArea');
    area.innerHTML = `
        <div class="f-card">
            <div class="f-card-body">
                <div class="book-table-wrap">
                    <table class="book-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Fee Name</th>
                                <th>Frequency</th>
                                ${isAdmin() ? '<th>Action</th>' : ''}
                            </tr>
                        </thead>
                        <tbody id="fHeadsTbody"></tbody>
                    </table>
                </div>
                ${isAdmin() ? `
                <div class="r-add-row" style="margin-top:16px;">
                    <input type="text" id="fNewHeadName" placeholder="e.g. Tuition Fee" style="flex:2;">
                    <select id="fNewHeadFreq" style="flex:1;">
                        <option value="monthly">Monthly</option>
                        <option value="one-time">One-time / Yearly</option>
                    </select>
                    <button class="btn btn-primary btn-sm" onclick="addFeeHead()">+ Add Head</button>
                </div>` : ''}
            </div>
        </div>
    `;

    const tbody = document.getElementById('fHeadsTbody');
    if (!feeHeads.length) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--muted);">No fee heads defined yet.</td></tr>`;
        return;
    }

    feeHeads.forEach((h, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${i+1}</td>
            <td><strong>${_h(h.name)}</strong></td>
            <td><span style="text-transform:capitalize;">${h.frequency}</span></td>
            ${isAdmin() ? `<td><button class="cm-btn cm-del" onclick="deleteFeeHead(${i})">✕</button></td>` : ''}
        `;
        tbody.appendChild(tr);
    });
}

function addFeeHead() {
    const name = document.getElementById('fNewHeadName').value.trim();
    const freq = document.getElementById('fNewHeadFreq').value;
    if (!name) { toast('Enter fee name.', 'error'); return; }
    
    const id = Date.now().toString();
    feeHeads.push({ id, name, frequency: freq });
    saveFeeHeadsToDatabase();
    renderFeeHeads();
}

function deleteFeeHead(i) {
    if (!confirm(`Delete "${feeHeads[i].name}"? This will not remove existing payment records but will remove it from configuration.`)) return;
    feeHeads.splice(i, 1);
    saveFeeHeadsToDatabase();
    renderFeeHeads();
}

// ── Class Defaults ──
function renderClassDefaults() {
    const area = document.getElementById('fConfigArea');
    if (!feeHeads.length) {
        area.innerHTML = `<div class="empty-state"><p>Add Fee Heads first.</p></div>`;
        return;
    }

    area.innerHTML = `
        <div class="f-card">
            <div class="f-card-body">
                <p style="font-size:.85rem;color:var(--muted);margin-bottom:14px;">Set default fee amounts for each class:</p>
                <div class="book-table-wrap">
                    <table class="book-table">
                        <thead>
                            <tr>
                                <th>Class</th>
                                ${feeHeads.map(h => `<th>${_h(h.name)}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${CLASSES.map(cls => `
                                <tr>
                                    <td><strong>${cls}</strong></td>
                                    ${feeHeads.map(h => {
                                        const val = classFees[classToKey(cls)]?.[h.id] || 0;
                                        return `<td>
                                            <input type="number" class="f-inline-input f-num-input" 
                                                value="${val}" min="0" 
                                                onchange="updateClassFee('${cls}', '${h.id}', this.value)"
                                                ${isAdmin() ? '' : 'readonly'}>
                                        </td>`;
                                    }).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function updateClassFee(cls, headId, val) {
    const key = classToKey(cls);
    if (!classFees[key]) classFees[key] = {};
    classFees[key][headId] = parseInt(val) || 0;
    saveClassFeesToDatabase();
}

// ── Student Overrides (Bulk by Class) ──
function renderStudentOverrides() {
    const area = document.getElementById('fConfigArea');
    area.innerHTML = `
        <div class="f-card">
            <div class="f-card-body">
                <div class="field-group" style="margin-bottom:20px; max-width:300px;">
                    <label>Select Class for Individual Fees / Discounts</label>
                    <select id="fDiscClass" onchange="renderDiscountTable()">
                        <option value="">— Select Class —</option>
                        ${CLASSES.map(cls => `<option value="${cls}">${cls}</option>`).join('')}
                    </select>
                </div>
                <div id="fDiscountTableWrap">
                    <p style="color:var(--muted);font-size:.85rem;">Select a class above to manage individual overrides.</p>
                </div>
            </div>
        </div>
    `;
}

function renderDiscountTable() {
    const wrap = document.getElementById('fDiscountTableWrap');
    const cls  = document.getElementById('fDiscClass').value;
    if (!wrap) return;

    if (!cls) {
        wrap.innerHTML = `<p style="color:var(--muted);font-size:.85rem;">Select a class above to manage individual overrides.</p>`;
        return;
    }

    if (!feeHeads.length) {
        wrap.innerHTML = `<div class="empty-state"><p>Add Fee Heads first.</p></div>`;
        return;
    }

    const clsStudents = students
        .filter(s => s.class === cls)
        .sort((a,b) => (+a.roll||999)-(+b.roll||999)||a.name.localeCompare(b.name));

    if (!clsStudents.length) {
        wrap.innerHTML = `<div class="empty-state"><p>No students found in ${cls}.</p></div>`;
        return;
    }

    wrap.innerHTML = `
        <p style="font-size:.8rem;color:var(--muted);margin-bottom:12px;">
            Enter custom amounts below to override Class Defaults for specific students. Leave blank to use defaults.
        </p>
        <div class="book-table-wrap">
            <table class="book-table">
                <thead>
                    <tr>
                        <th style="position:sticky;left:0;background:var(--ink);z-index:2;">Student</th>
                        <th style="min-width:60px;">Roll</th>
                        ${feeHeads.map(h => `<th class="num">${_h(h.name)}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${clsStudents.map(s => {
                        const sid = studentId(s);
                        return `
                            <tr>
                                <td style="position:sticky;left:0;background:inherit;z-index:1;"><strong>${_h(s.name)}</strong></td>
                                <td>${s.roll || '—'}</td>
                                ${feeHeads.map(h => {
                                    const val = studentFees[sid]?.[h.id] ?? '';
                                    return `
                                        <td class="num">
                                            <input type="number" class="f-inline-input f-num-input" 
                                                style="width:85px;" placeholder="Def"
                                                value="${val}" 
                                                onchange="updateStudentFeeBulk('${sid}', '${h.id}', this.value)"
                                                ${isAdmin() ? '' : 'readonly'}>
                                        </td>
                                    `;
                                }).join('')}
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function updateStudentFeeBulk(sid, headId, val) {
    if (!studentFees[sid]) studentFees[sid] = {};
    
    if (val === '' || val === null) {
        delete studentFees[sid][headId];
        if (Object.keys(studentFees[sid]).length === 0) delete studentFees[sid];
    } else {
        studentFees[sid][headId] = parseInt(val) || 0;
    }
    
    // Using the same silent save as class defaults for a smooth "type-and-save" experience
    saveStudentOverridesToDatabase();
}

// ── Period Picker Helpers ──
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function renderCustomPeriodPicker(idPrefix, onChangeFn, showMonth=true) {
    const now = new Date();
    const curYear = now.getFullYear();
    const years = [];
    // Show 5 years past and 15 years future (total 20 years)
    for(let y=curYear-5; y<=curYear+15; y++) years.push(y);

    return `
        <div class="f-period-picker" id="${idPrefix}_wrap">
            ${showMonth ? `
            <select class="f-period-select" id="${idPrefix}_month" onchange="${onChangeFn}">
                ${MONTHS_SHORT.map((m, i) => `<option value="${String(i+1).padStart(2,'0')}" ${i===now.getMonth()?'selected':''}>${m}</option>`).join('')}
            </select>
            <span class="f-period-sep">|</span>
            ` : ''}
            <select class="f-period-select" id="${idPrefix}_year" onchange="${onChangeFn}">
                ${years.map(y => `<option value="${y}" ${y===curYear?'selected':''}>${y}</option>`).join('')}
            </select>
        </div>
    `;
}

function getPickerValue(idPrefix) {
    const m = document.getElementById(idPrefix + '_month')?.value;
    const y = document.getElementById(idPrefix + '_year')?.value;
    return m ? `${y}-${m}` : y;
}

// ══════════════════════════════════════
//  4. PAYMENTS (Bulk Entry)
// ══════════════════════════════════════
function renderFeesPayments() {
    const sec = document.getElementById('feesSection');
    sec.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
            <button class="back-btn" onclick="fSwitchView('dashboard')">← Dashboard</button>
            <h3 style="font-family:'DM Serif Display',serif;font-size:1.1rem;">Collect Fees</h3>
        </div>

        <div class="r-bulk-controls">
            <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">
                <div class="field-group" style="margin:0;flex:1;min-width:120px;">
                    <label>Class</label>
                    <select id="fPayClass" onchange="renderPaymentTable()">
                        <option value="">— Select —</option>
                        ${CLASSES.map(cls => `<option value="${cls}">${cls}</option>`).join('')}
                    </select>
                </div>
                <div class="field-group" style="margin:0;flex:1;min-width:120px;">
                    <label>Fee Head</label>
                    <select id="fPayHead" onchange="onPayHeadChange()">
                        <option value="">— Select —</option>
                        ${feeHeads.map(h => `<option value="${h.id}">${h.name}</option>`).join('')}
                    </select>
                </div>
                <div class="field-group" style="margin:0;min-width:140px;" id="fPayPeriodWrap">
                    <label id="fPayPeriodLabel">Period</label>
                    <div id="fPayPickerCont">
                        ${renderCustomPeriodPicker('fPay', 'renderPaymentTable()')}
                    </div>
                </div>
            </div>
        </div>

        <div id="fPaymentTableWrap" style="margin-top:14px;">
            <p style="color:var(--muted);font-size:.85rem;">Select Class and Fee Head above.</p>
        </div>
    `;
}

function onPayHeadChange() {
    const headId = document.getElementById('fPayHead').value;
    const head   = feeHeads.find(h => h.id === headId);
    if (!head) return;

    const isMonthly = head.frequency === 'monthly';
    const cont = document.getElementById('fPayPickerCont');
    cont.innerHTML = renderCustomPeriodPicker('fPay', 'renderPaymentTable()', isMonthly);
    document.getElementById('fPayPeriodLabel').textContent = isMonthly ? 'Month' : 'Year';

    renderPaymentTable();
}

function renderPaymentTable() {
    const wrap   = document.getElementById('fPaymentTableWrap');
    const cls    = document.getElementById('fPayClass').value;
    const headId = document.getElementById('fPayHead').value;
    if (!wrap) return;

    if (!cls || !headId) {
        wrap.innerHTML = `<p style="color:var(--muted);font-size:.85rem;">Select Class and Fee Head above.</p>`;
        return;
    }

    const head = feeHeads.find(h => h.id === headId);
    const period = getPickerValue('fPay');
    if (!period) {
        wrap.innerHTML = `<p style="color:var(--muted);font-size:.85rem;">Select a valid ${head.frequency === 'monthly' ? 'month' : 'year'}.</p>`;
        return;
    }

    const clsStudents = students
        .filter(s => s.class === cls)
        .sort((a,b) => (+a.roll||999)-(+b.roll||999)||a.name.localeCompare(b.name));

    const defaultAmt = classFees[classToKey(cls)]?.[headId] || 0;

    wrap.innerHTML = `
        <div class="book-table-wrap">
            <table class="book-table">
                <thead>
                    <tr>
                        <th>#</th><th>Student</th><th>Roll</th>
                        <th class="num">Fee Amount</th>
                        <th class="num">Paid Amount</th>
                        <th>Status</th>
                        <th>Quick Pay</th>
                    </tr>
                </thead>
                <tbody id="fPayTbody">
                    ${clsStudents.map((s, i) => {
                        const sid = studentId(s);
                        const due = studentFees[sid]?.[headId] ?? defaultAmt;
                        const record = feePayments[sid]?.[headId]?.[period] || { amount: 0 };
                        const status = record.amount >= due ? 'paid' : (record.amount > 0 ? 'partial' : 'unpaid');
                        return `
                            <tr>
                                <td>${i+1}</td>
                                <td>${_h(s.name)}</td>
                                <td>${s.roll || '—'}</td>
                                <td class="num">৳${due}</td>
                                <td class="num">
                                    <input type="number" class="f-inline-input f-num-input" 
                                        style="width:80px;" id="pay_${sid}" 
                                        value="${record.amount || ''}" placeholder="0">
                                </td>
                                <td>
                                    <span class="f-status-pill f-status-${status}">${status}</span>
                                </td>
                                <td>
                                    <div style="display:flex;gap:4px;">
                                        ${status !== 'paid' ? `
                                            <button class="btn btn-primary btn-sm" style="padding:4px 8px;font-size:.75rem;background:var(--success);" 
                                                onclick="payStudentSingle('${sid}', '${_h(s.name)}', '${s.roll||'—'}', '${headId}', '${_h(head.name)}', '${period}', ${due})">
                                                ✅ Pay Full
                                            </button>
                                        ` : `
                                            <button class="btn btn-outline btn-sm" style="padding:4px 8px;font-size:.75rem;opacity:.5;" disabled>
                                                Settled
                                            </button>
                                        `}
                                        
                                        ${record.amount > 0 ? `
                                            <button class="btn btn-outline btn-sm" style="padding:4px 8px;font-size:.75rem;color:var(--accent);border-color:var(--accent);" 
                                                onclick="resetStudentPayment('${sid}', '${_h(s.name)}', '${headId}', '${_h(head.name)}', '${period}')">
                                                ↺ Reset
                                            </button>
                                        ` : ''}
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
        <div style="margin-top:16px;">
            <button class="btn btn-success" onclick="saveBulkPayments()">💾 Save All (Custom Amounts)</button>
        </div>
    `;
}

async function resetStudentPayment(sid, name, headId, headName, period) {
    if (!confirm(`REVERSE payment for ${name}?\n\nThis will delete the payment record for ${headName} (${period}).`)) return;

    if (feePayments[sid] && feePayments[sid][headId]) {
        delete feePayments[sid][headId][period];
        if (Object.keys(feePayments[sid][headId]).length === 0) delete feePayments[sid][headId];
        if (Object.keys(feePayments[sid]).length === 0) delete feePayments[sid];
    }

    setStatus('syncing', 'Deleting…');
    try {
        await saveFeePaymentsToDatabase(sid);
        setStatus('connected', 'Deleted ✓');
        toast(`Payment reversed for ${name} ✓`, 'info');
        renderPaymentTable();
    } catch (e) {
        console.error(e);
        setStatus('error', 'Failed to delete');
        toast('Error reversing payment.', 'error');
    }
}

async function payStudentSingle(sid, name, roll, headId, headName, period, amount) {
    const msg = `Record FULL payment of ৳${amount}?\n\n` +
                `Student: ${name}\n` +
                `Roll: ${roll}\n` +
                `Fee: ${headName}\n` +
                `Period: ${period}`;
                
    if (!confirm(msg)) return;

    if (!feePayments[sid]) feePayments[sid] = {};
    if (!feePayments[sid][headId]) feePayments[sid][headId] = {};
    
    const now = new Date().toISOString();
    feePayments[sid][headId][period] = { amount, date: now };
    
    setStatus('syncing', 'Saving…');
    try {
        await saveFeePaymentsToDatabase(sid);
        setStatus('connected', 'Saved ✓');
        toast(`Payment recorded for ${name} ✓`, 'success');
        renderPaymentTable();
    } catch (e) {
        console.error(e);
        setStatus('error', 'Failed to save');
        toast('Error saving payment.', 'error');
    }
}

async function saveBulkPayments() {
    const cls    = document.getElementById('fPayClass').value;
    const headId = document.getElementById('fPayHead').value;
    const head   = feeHeads.find(h => h.id === headId);
    const period = getPickerValue('fPay');
    
    const clsStudents = students.filter(s => s.class === cls);
    setStatus('syncing', 'Saving…');
    
    const now = new Date().toISOString();
    const promises = clsStudents.map(s => {
        const sid = studentId(s);
        const inp = document.getElementById('pay_'+sid);
        if (!inp) return Promise.resolve();
        
        const amt = parseInt(inp.value) || 0;
        if (!feePayments[sid]) feePayments[sid] = {};
        if (!feePayments[sid][headId]) feePayments[sid][headId] = {};
        
        if (amt <= 0) delete feePayments[sid][headId][period];
        else feePayments[sid][headId][period] = { amount: amt, date: now };
        
        return saveFeePaymentsToDatabase(sid);
    });

    await Promise.all(promises);
    setStatus('connected', 'Saved ✓');
    toast(`Payments saved for ${clsStudents.length} students ✓`, 'success');
    renderPaymentTable();
}

// ══════════════════════════════════════
//  5. REPORTS
// ══════════════════════════════════════
let fActiveRepTab = 'defaulters'; // defaulters | recent

function renderFeesReports() {
    const sec = document.getElementById('feesSection');
    sec.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
            <button class="back-btn" onclick="fSwitchView('dashboard')">← Dashboard</button>
            <h3 style="font-family:'DM Serif Display',serif;font-size:1.1rem;">Fees Reports</h3>
        </div>

        <div class="r-term-tabs" style="margin-bottom:16px;">
            <button class="r-tab ${fActiveRepTab==='defaulters'?'active':''}" onclick="fSwitchRepTab('defaulters')">Defaulter List</button>
            <button class="r-tab ${fActiveRepTab==='recent'?'active':''}" onclick="fSwitchRepTab('recent')">Recent Payments</button>
        </div>

        <div id="fRepArea"></div>
    `;

    if (fActiveRepTab === 'defaulters') renderDefaultersUI();
    else renderRecentPayments();
}

function fSwitchRepTab(tab) {
    fActiveRepTab = tab;
    renderFeesReports();
}

function renderDefaultersUI() {
    const area = document.getElementById('fRepArea');
    area.innerHTML = `
        <div class="r-bulk-controls">
            <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">
                <div class="field-group" style="margin:0;flex:1;min-width:120px;">
                    <label>Class</label>
                    <select id="fRepClass" onchange="renderDefaulters()">
                        <option value="">— Select —</option>
                        ${CLASSES.map(cls => `<option value="${cls}">${cls}</option>`).join('')}
                    </select>
                </div>
                <div class="field-group" style="margin:0;flex:1;min-width:120px;">
                    <label>Fee Head</label>
                    <select id="fRepHead" onchange="onRepHeadChange()">
                        <option value="">— Select —</option>
                        ${feeHeads.map(h => `<option value="${h.id}">${h.name}</option>`).join('')}
                    </select>
                </div>
                <div class="field-group" style="margin:0;min-width:140px;display:none;" id="fRepStartWrap">
                    <label id="fRepStartLabel">From</label>
                    <div id="fRepStartCont"></div>
                </div>
                <div class="field-group" style="margin:0;min-width:140px;display:none;" id="fRepEndWrap">
                    <label>To</label>
                    <div id="fRepEndCont"></div>
                </div>
            </div>
        </div>

        <div id="fReportTableWrap" style="margin-top:14px;">
            <p style="color:var(--muted);font-size:.85rem;">Select criteria above to see defaulters.</p>
        </div>
    `;
}

function renderRecentPayments() {
    const area = document.getElementById('fRepArea');
    
    // Flatten all payments into a sortable list
    const history = [];
    Object.keys(feePayments).forEach(sid => {
        const student = students.find(s => studentId(s) === sid);
        if (!student) return;
        
        Object.keys(feePayments[sid]).forEach(headId => {
            const head = feeHeads.find(h => h.id === headId);
            if (!head) return;
            
            Object.keys(feePayments[sid][headId]).forEach(period => {
                const rec = feePayments[sid][headId][period];
                history.push({
                    sid,
                    studentName: student.name,
                    studentClass: student.class,
                    studentRoll: student.roll,
                    headId,
                    headName: head.name,
                    period,
                    amount: rec.amount,
                    date: rec.date || ''
                });
            });
        });
    });

    // Sort by date (descending)
    history.sort((a, b) => b.date.localeCompare(a.date));

    // Only show last 100 payments for performance
    const displayList = history.slice(0, 100);

    area.innerHTML = `
        <div class="f-card">
            <div class="f-card-body">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <h4 style="margin:0;">Recent Payments Log</h4>
                    <span style="font-size:.75rem;color:var(--muted);">Showing last ${displayList.length} records</span>
                </div>
                <div class="book-table-wrap">
                    <table class="book-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Student</th>
                                <th>Fee Type</th>
                                <th class="num">Amount</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${displayList.map(h => `
                                <tr>
                                    <td style="font-size:.75rem;white-space:nowrap;">
                                        ${h.date ? new Date(h.date).toLocaleDateString('en-GB', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'}) : '—'}
                                    </td>
                                    <td>
                                        <div style="font-weight:700;">${_h(h.studentName)}</div>
                                        <div style="font-size:.7rem;color:var(--muted);">${h.studentClass} | Roll: ${h.studentRoll || '—'}</div>
                                    </td>
                                    <td>
                                        <div style="font-size:.85rem;">${_h(h.headName)}</div>
                                        <div style="font-size:.7rem;color:var(--muted);">${h.period}</div>
                                    </td>
                                    <td class="num" style="font-weight:700;color:var(--success);">৳${h.amount}</td>
                                    <td>
                                        <button class="btn btn-outline btn-sm" style="padding:4px 8px;font-size:.7rem;color:var(--accent);border-color:var(--accent);" 
                                            onclick="resetStudentPayment('${h.sid}', '${_h(h.studentName)}', '${h.headId}', '${_h(h.headName)}', '${h.period}')">
                                            ↺ Undo
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                            ${displayList.length === 0 ? '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--muted);">No payment records found.</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function onRepHeadChange() {
    const headId = document.getElementById('fRepHead').value;
    const head   = feeHeads.find(h => h.id === headId);
    if (!head) return;

    const isMonthly = head.frequency === 'monthly';
    const sWrap = document.getElementById('fRepStartWrap');
    const eWrap = document.getElementById('fRepEndWrap');
    const sCont = document.getElementById('fRepStartCont');
    const eCont = document.getElementById('fRepEndCont');

    sWrap.style.display = 'block';
    eWrap.style.display = isMonthly ? 'block' : 'none';
    
    document.getElementById('fRepStartLabel').textContent = isMonthly ? 'From Month' : 'Year';
    
    sCont.innerHTML = renderCustomPeriodPicker('fRepStart', 'renderDefaulters()', isMonthly);
    if (isMonthly) eCont.innerHTML = renderCustomPeriodPicker('fRepEnd', 'renderDefaulters()', true);

    renderDefaulters();
}

function getMonthsInRange(start, end) {
    let current = new Date(start + '-01');
    const stop = new Date(end + '-01');
    if (current > stop) return [start];
    const months = [];
    while (current <= stop) {
        months.push(current.toISOString().slice(0, 7));
        current.setMonth(current.getMonth() + 1);
        if (months.length > 24) break; 
    }
    return months;
}

function renderDefaulters() {
    const wrap   = document.getElementById('fReportTableWrap');
    const cls    = document.getElementById('fRepClass').value;
    const headId = document.getElementById('fRepHead').value;
    if (!wrap) return;

    if (!cls || !headId) {
        wrap.innerHTML = `<p style="color:var(--muted);font-size:.85rem;">Select criteria above.</p>`;
        return;
    }

    const head = feeHeads.find(h => h.id === headId);
    const isMonthly = head.frequency === 'monthly';
    const startVal = getPickerValue('fRepStart');
    const periods = isMonthly 
        ? getMonthsInRange(startVal, getPickerValue('fRepEnd'))
        : [startVal];
    
    if (periods.length === 0 || !periods[0]) {
        wrap.innerHTML = `<p style="color:var(--muted);font-size:.85rem;">Select a valid period.</p>`;
        return;
    }

    const clsStudents = students.filter(s => s.class === cls);
    const defaultAmt = classFees[classToKey(cls)]?.[headId] || 0;

    const defaulters = clsStudents.map(s => {
        const sid = studentId(s);
        const duePerPeriod = studentFees[sid]?.[headId] ?? defaultAmt;
        const totalDue = duePerPeriod * periods.length;
        
        let totalPaid = 0;
        periods.forEach(p => {
            totalPaid += feePayments[sid]?.[headId]?.[p]?.amount || 0;
        });

        return { s, due: totalDue, paid: totalPaid, balance: totalDue - totalPaid };
    }).filter(d => d.balance > 0);

    if (!defaulters.length) {
        wrap.innerHTML = `<div class="empty-state"><p>No defaulters found for this period. ✅</p></div>`;
        return;
    }

    const totalOutstanding = defaulters.reduce((acc, d) => acc + d.balance, 0);

    wrap.innerHTML = `
        <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
            <div class="f-summary-chip" style="border-color:var(--accent);background:#fff5f5;">
                <span>Total Defaulters</span>
                <strong style="color:var(--accent);">${defaulters.length}</strong>
            </div>
            <div class="f-summary-chip">
                <span>Total Outstanding</span>
                <strong>৳${totalOutstanding.toLocaleString()}</strong>
            </div>
        </div>

        <div class="panel-header" style="margin-bottom:12px;">
            <h4 style="margin:0;">Defaulter List</h4>
            <button class="btn btn-outline btn-sm" onclick="downloadDefaultersPDF()">⬇ PDF Report</button>
        </div>
        <div class="book-table-wrap">
            <table class="book-table">
                <thead>
                    <tr><th>Student</th><th>Roll</th><th>Total Due</th><th>Total Paid</th><th>Balance</th></tr>
                </thead>
                <tbody>
                    ${defaulters.map(d => `
                        <tr>
                            <td>${_h(d.s.name)}</td>
                            <td>${d.s.roll || '—'}</td>
                            <td class="num">৳${d.due}</td>
                            <td class="num">৳${d.paid}</td>
                            <td class="num" style="color:var(--accent);font-weight:700;">৳${d.balance}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function downloadDefaultersPDF() {
    const cls    = document.getElementById('fRepClass').value;
    const headId = document.getElementById('fRepHead').value;
    const head   = feeHeads.find(h => h.id === headId);
    if (!head) return;
    
    const isMonthly = head.frequency === 'monthly';
    const startVal  = getPickerValue('fRepStart');
    const endVal    = getPickerValue('fRepEnd');
    
    const periods = isMonthly ? getMonthsInRange(startVal, endVal) : [startVal];
    const periodLabel = isMonthly ? (startVal === endVal ? startVal : `${startVal} to ${endVal}`) : startVal;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Defaulters Report', 105, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Class: ${cls} | Fee: ${head.name} | Period: ${periodLabel}`, 105, 22, { align: 'center' });

    const clsStudents = students.filter(s => s.class === cls);
    const defaultAmt = classFees[classToKey(cls)]?.[headId] || 0;

    const defaulterData = clsStudents.map(s => {
        const sid = studentId(s);
        const duePerPeriod = studentFees[sid]?.[headId] ?? defaultAmt;
        const totalDue = duePerPeriod * periods.length;
        let totalPaid = 0;
        periods.forEach(p => { totalPaid += feePayments[sid]?.[headId]?.[p]?.amount || 0; });
        return { s, due: totalDue, paid: totalPaid, balance: totalDue - totalPaid };
    }).filter(d => d.balance > 0);

    const totalOutstanding = defaulterData.reduce((acc, d) => acc + d.balance, 0);

    doc.setFontSize(10);
    doc.text(`Total Defaulters: ${defaulterData.length}  |  Total Outstanding: ${totalOutstanding.toLocaleString()}/-`, 15, 30);

    const rows = defaulterData.map(d => [
        d.s.name,
        d.s.roll || '—',
        d.due + '/-',
        d.paid + '/-',
        d.balance + '/-'
    ]);

    doc.autoTable({
        startY: 35,
        head: [['Student Name', 'Roll', 'Total Due', 'Total Paid', 'Balance']],
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: [26, 26, 46] }
    });

    doc.save(`Defaulters_${cls}_${head.name.replace(/ /g,'_')}_${periodLabel}.pdf`);
}
