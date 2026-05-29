// ════════════════════════════════════════
//  students.js — Student CRUD & rendering
// ════════════════════════════════════════

// ── Submit form (add or update) ──
function submitStudent() {
    const cls     = document.getElementById('fClass').value;
    const roll    = document.getElementById('fRoll').value.trim();
    const name    = document.getElementById('fName').value.trim();
    const father  = document.getElementById('fFather').value.trim();
    const mother  = document.getElementById('fMother').value.trim();
    const contact = formatBDPhone(document.getElementById('fContact').value.trim());

    if (!cls || !name || !father || !mother || !contact) {
        toast('Please fill in all fields.', 'error');
        return;
    }

    const photo = getPhotoData('s') || (sEditIndex >= 0 ? students[sEditIndex].photo : '');
    finalizeStudent({ cls, roll, name, father, mother, contact, photo });
}

function finalizeStudent(d) {
    const s = {
        class:         d.cls,
        roll:          d.roll || '',
        name:          d.name,
        fatherName:    d.father,
        motherName:    d.mother,
        contactNumber: d.contact,
        photo:         d.photo
    };

    if (sEditIndex >= 0) {
        students[sEditIndex] = s;
        sEditIndex = -1;
    } else {
        students.push(s);
    }

    resetStudentForm();
    renderStudents();
    saveClassToDatabase(s.class);
    collapseForm('s');
    setTimeout(() => {
        const el = document.getElementById('sClassPicker');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

// ── Edit ──
function editStudent(i) {
    if (!isAdmin()) { toast("Admin access required.", "error"); return; }
    const s    = students[i];
    sEditIndex = i;

    // If student's class is not in CLASSES (was deleted), add it back temporarily
    const sel = document.getElementById('fClass');
    const hasOption = Array.from(sel.options).some(o => o.value === s.class);
    if (!hasOption) {
        const opt = document.createElement('option');
        opt.value = s.class;
        opt.textContent = s.class + ' (restored)';
        sel.appendChild(opt);
    }

    document.getElementById('fClass').value   = s.class;
    document.getElementById('fRoll').value    = s.roll || '';
    document.getElementById('fName').value    = s.name;
    document.getElementById('fFather').value  = s.fatherName;
    document.getElementById('fMother').value  = s.motherName;
    document.getElementById('fContact').value = s.contactNumber;

    if (s.photo) {
        document.getElementById('sPhotoPreview').src          = s.photo;
        document.getElementById('sPhotoPreview').style.display = 'block';
        document.getElementById('sPhotoPlaceholder').style.display = 'none';
    }

    document.getElementById('sFormTitle').textContent    = '✏️ Edit Student';
    document.getElementById('sAddBtn').style.display     = 'none';
    document.getElementById('sUpdateBtn').style.display  = 'inline-flex';
    document.getElementById('sCancelBtn').style.display  = 'inline-flex';
    expandForm('s');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Delete ──
function deleteStudent(i) {
    if (!isAdmin()) { toast("Admin access required.", "error"); return; }
    if (!confirm(`Delete ${students[i].name}?`)) return;
    const cls = students[i].class;
    students.splice(i, 1);
    renderStudents();
    saveClassToDatabase(cls);
}

// ── Cancel edit ──
function cancelStudentEdit() {
    sEditIndex = -1;
    resetStudentForm();
}

// ── Reset form ──
function resetStudentForm() {
    document.getElementById('fClass').value  = '';
    document.getElementById('fRoll').value   = '';
    document.getElementById('fName').value   = '';
    document.getElementById('fFather').value = '';
    document.getElementById('fMother').value = '';
    document.getElementById('fContact').value = '';
    const hint = document.getElementById('fContactHint'); if (hint) hint.textContent = '';

    const spi = document.getElementById('sPhotoInput');
    if (spi) spi.value = '';
    document.getElementById('sPhotoPreview').src           = '';
    document.getElementById('sPhotoPreview').style.display = 'none';
    document.getElementById('sPhotoPlaceholder').style.display = 'block';
    document.getElementById('sFormTitle').textContent      = 'Add New Student';
    document.getElementById('sAddBtn').style.display       = 'inline-flex';
    document.getElementById('sUpdateBtn').style.display    = 'none';
    document.getElementById('sCancelBtn').style.display    = 'none';
}

// ── Render: picker or class list ──
function renderStudents() {
    activeClass !== null ? renderClassStudents(activeClass) : renderClassPicker();
}

function renderClassPicker() {
    document.getElementById('sClassPicker').style.display = 'block';
    document.getElementById('sStudentList').style.display = 'none';
    document.getElementById('sPanelTitle').textContent    = 'Students';

    const existing = document.getElementById('sSBackBtn');
    if (existing) existing.remove();

    const grid = document.getElementById('sClassGrid');
    grid.innerHTML = '';

    CLASSES.forEach(cls => {
        const count = students.filter(s => s.class === cls).length;
        const tile  = document.createElement('div');
        tile.className = 'picker-tile';
        tile.innerHTML = `
            <div class="tile-icon">${classIcon(cls)}</div>
            <div class="tile-name">${cls}</div>
            <div class="tile-count">${count} student${count !== 1 ? 's' : ''}</div>`;
        tile.onclick = () => {
            activeClass = cls;
            document.getElementById('fClass').value = cls;
            renderClassStudents(cls);
        };
        grid.appendChild(tile);
    });

    document.getElementById('sCountBadge').textContent = students.length;
}

function renderClassStudents(cls) {
    document.getElementById('sClassPicker').style.display = 'none';
    const list     = document.getElementById('sStudentList');
    list.style.display = 'grid';
    const filtered = students.map((s, i) => ({ s, i })).filter(({ s }) => s.class === cls);

    document.getElementById('sPanelTitle').textContent  = cls;
    document.getElementById('sCountBadge').textContent  = filtered.length;

    if (!document.getElementById('sSBackBtn')) {
        const btn = document.createElement('button');
        btn.className = 'back-btn';
        btn.id        = 'sSBackBtn';
        btn.innerHTML = '&#8592; All Classes';
        btn.onclick   = () => { activeClass = null; renderClassPicker(); };
        list.parentElement.insertBefore(btn, list);
    }

    if (filtered.length === 0) {
        list.innerHTML = `<div class="empty-state"><div class="big-icon">🎓</div><p>No students in ${cls} yet.</p></div>`;
        return;
    }

    list.innerHTML = '';
    filtered.forEach(({ s, i }) => {
        const card      = document.createElement('div');
        card.className  = 'student-card';
        const avatar    = s.photo || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Crect width='80' height='80' rx='40' fill='%231a1a2e'/%3E%3Ccircle cx='40' cy='30' r='16' fill='%23f5f0e8' opacity='.85'/%3E%3Cellipse cx='40' cy='68' rx='24' ry='16' fill='%23f5f0e8' opacity='.7'/%3E%3C/svg%3E";
        card.innerHTML  = `
            <img src="${avatar}" alt="${s.name}">
            <div class="s-name">${s.name}</div>
            <div class="s-class">${s.class}${s.roll ? ' &nbsp;·&nbsp; Roll: ' + s.roll : ''}</div>
            <div class="s-info">
                <strong>Father:</strong> ${s.fatherName}<br>
                <strong>Mother:</strong> ${s.motherName}<br>
                <strong>Contact:</strong> <span class="contact-wrap">${contactLinks(s.contactNumber)}</span>
            </div>
            <div class="card-actions">
                ${isAdmin() ? `<button class="btn btn-edit btn-sm" onclick="editStudent(${i})">✏️ Edit</button>
                <button class="btn btn-danger btn-sm" onclick="deleteStudent(${i})">🗑️ Delete</button>` : ""}
            </div>`;
        list.appendChild(card);
    });
}

// ── PDF Export ──
function downloadStudentPDF() {
    const { jsPDF } = window.jspdf;
    const doc   = new jsPDF();
    const title = activeClass ? activeClass + ' — Students' : 'All Students';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(title, 105, 14, { align: 'center' });

    let y    = 22;
    const list = activeClass ? students.filter(s => s.class === activeClass) : students;

    list.forEach((s, i) => {
        if (y > 250) { doc.addPage(); y = 20; }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(200, 75, 49);
        doc.text(`${i + 1}. ${s.name}`, 15, y);
        y += 7;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        const lines = [
            `Class: ${s.class}${s.roll ? '   Roll No: ' + s.roll : ''}`,
            `Father: ${s.fatherName}`,
            `Mother: ${s.motherName}`,
            `Contact: ${s.contactNumber}`
        ];

        if (s.photo) {
            try { doc.addImage(s.photo, 'JPEG', 15, y, 22, 22); } catch (e) {}
            lines.forEach((l, li) => doc.text(l, 42, y + 5 + li * 5));
            y += 28;
        } else {
            lines.forEach(l => { doc.text(l, 15, y); y += 5; });
        }

        doc.setDrawColor(200);
        doc.setLineWidth(0.3);
        doc.setLineDash([4, 4]);
        doc.line(15, y + 2, 195, y + 2);
        doc.setLineDash([]);
        y += 8;
    });

    doc.save((activeClass || 'All_Students') + '_List.pdf');
}
