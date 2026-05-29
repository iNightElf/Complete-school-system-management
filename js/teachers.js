// ════════════════════════════════════════
//  teachers.js — Teacher CRUD & rendering
// ════════════════════════════════════════

// ── Submit form (add or update) ──
function submitTeacher() {
    const designation = document.getElementById('tDesignation').value.trim();
    const name        = document.getElementById('tName').value.trim();
    const email       = document.getElementById('tEmail').value.trim();
    const contact     = formatBDPhone(document.getElementById('tContact').value.trim());

    if (!designation || !name || !contact) {
        toast('Please fill in Designation, Name and Contact.', 'error');
        return;
    }

    const photo = getPhotoData('t') || (tEditIndex >= 0 ? teachers[tEditIndex].photo : '');
    finalizeTeacher({ designation, name, email, contact, photo });
}

function finalizeTeacher(d) {
    const t = {
        designation:   d.designation,
        name:          d.name,
        email:         d.email,
        contactNumber: d.contact,
        photo:         d.photo
    };

    if (tEditIndex >= 0) {
        teachers[tEditIndex] = t;
        tEditIndex = -1;
    } else {
        teachers.push(t);
    }

    resetTeacherForm();
    renderTeachers();
    saveTeachersToDatabase();
    collapseForm('t');
    setTimeout(() => {
        const el = document.getElementById('tDesigPicker');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

// ── Edit ──
function editTeacher(i) {
    if (!isAdmin()) { toast("Admin access required.", "error"); return; }
    const t    = teachers[i];
    tEditIndex = i;

    document.getElementById('tDesignation').value = t.designation;
    document.getElementById('tName').value        = t.name;
    document.getElementById('tEmail').value       = t.email;
    document.getElementById('tContact').value     = t.contactNumber;

    if (t.photo) {
        document.getElementById('tPhotoPreview').src           = t.photo;
        document.getElementById('tPhotoPreview').style.display = 'block';
        document.getElementById('tPhotoPlaceholder').style.display = 'none';
    }

    document.getElementById('tFormTitle').textContent   = '✏️ Edit Teacher';
    document.getElementById('tAddBtn').style.display    = 'none';
    document.getElementById('tUpdateBtn').style.display = 'inline-flex';
    document.getElementById('tCancelBtn').style.display = 'inline-flex';
    expandForm('t');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Delete ──
function deleteTeacher(i) {
    if (!isAdmin()) { toast("Admin access required.", "error"); return; }
    if (!confirm(`Delete ${teachers[i].name}?`)) return;
    teachers.splice(i, 1);
    renderTeachers();
    saveTeachersToDatabase();
}

// ── Cancel edit ──
function cancelTeacherEdit() {
    tEditIndex = -1;
    resetTeacherForm();
}

// ── Reset form ──
function resetTeacherForm() {
    document.getElementById('tDesignation').value = '';
    document.getElementById('tName').value        = '';
    document.getElementById('tEmail').value       = '';
    document.getElementById('tContact').value     = '';
    const hint = document.getElementById('tContactHint'); if (hint) hint.textContent = '';

    const tpi = document.getElementById('tPhotoInput');
    if (tpi) tpi.value = '';
    document.getElementById('tPhotoPreview').src                = '';
    document.getElementById('tPhotoPreview').style.display      = 'none';
    document.getElementById('tPhotoPlaceholder').style.display  = 'block';
    document.getElementById('tFormTitle').textContent           = 'Add New Teacher';
    document.getElementById('tAddBtn').style.display            = 'inline-flex';
    document.getElementById('tUpdateBtn').style.display         = 'none';
    document.getElementById('tCancelBtn').style.display         = 'none';
}

// ── Render: picker or designation list ──
function renderTeachers() {
    activeDesig !== null ? renderDesigTeachers(activeDesig) : renderDesigPicker();
}

function renderDesigPicker() {
    document.getElementById('tDesigPicker').style.display  = 'block';
    document.getElementById('tTeacherList').style.display  = 'none';
    document.getElementById('tPanelTitle').textContent     = 'Teachers';

    const existing = document.getElementById('tTBackBtn');
    if (existing) existing.remove();

    const grid = document.getElementById('tDesigGrid');
    grid.innerHTML = '';

    // "All Teachers" tile
    const allTile       = document.createElement('div');
    allTile.className   = 'picker-tile teacher-tile';
    allTile.innerHTML   = `
        <div class="tile-icon">👩‍🏫</div>
        <div class="tile-name">All Teachers</div>
        <div class="tile-count">${teachers.length} total</div>`;
    allTile.onclick = () => { activeDesig = 'ALL'; renderDesigTeachers('ALL'); };
    grid.appendChild(allTile);

    // One tile per unique designation
    const desigs = [...new Set(teachers.map(t => t.designation))];
    desigs.forEach(d => {
        const count = teachers.filter(t => t.designation === d).length;
        const tile  = document.createElement('div');
        tile.className = 'picker-tile teacher-tile';
        tile.innerHTML = `
            <div class="tile-icon">🏷️</div>
            <div class="tile-name">${d}</div>
            <div class="tile-count">${count} teacher${count !== 1 ? 's' : ''}</div>`;
        tile.onclick = () => { activeDesig = d; renderDesigTeachers(d); };
        grid.appendChild(tile);
    });

    document.getElementById('tCountBadge').textContent = teachers.length;
}

function renderDesigTeachers(desig) {
    document.getElementById('tDesigPicker').style.display = 'none';
    const list     = document.getElementById('tTeacherList');
    list.style.display = 'grid';
    const filtered = desig === 'ALL'
        ? teachers.map((t, i) => ({ t, i }))
        : teachers.map((t, i) => ({ t, i })).filter(({ t }) => t.designation === desig);

    document.getElementById('tPanelTitle').textContent  = desig === 'ALL' ? 'All Teachers' : desig;
    document.getElementById('tCountBadge').textContent  = filtered.length;

    if (!document.getElementById('tTBackBtn')) {
        const btn   = document.createElement('button');
        btn.className = 'back-btn';
        btn.id      = 'tTBackBtn';
        btn.innerHTML = '&#8592; All Designations';
        btn.onclick = () => { activeDesig = null; renderDesigPicker(); };
        list.parentElement.insertBefore(btn, list);
    }

    if (filtered.length === 0) {
        list.innerHTML = `<div class="empty-state"><div class="big-icon">👩‍🏫</div><p>No teachers with this designation yet.</p></div>`;
        return;
    }

    list.innerHTML = '';
    filtered.forEach(({ t, i }) => {
        const card     = document.createElement('div');
        card.className = 'teacher-card';
        const avatar   = t.photo || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Crect width='80' height='80' rx='40' fill='%231a1a2e'/%3E%3Ccircle cx='40' cy='30' r='16' fill='%23f5f0e8' opacity='.85'/%3E%3Cellipse cx='40' cy='68' rx='24' ry='16' fill='%23f5f0e8' opacity='.7'/%3E%3C/svg%3E";
        card.innerHTML = `
            <img src="${avatar}" alt="${t.name}">
            <div class="t-name">${t.name}</div>
            <div class="t-designation">${t.designation}</div>
            <div class="t-info">
                ${t.email ? `<strong>Email:</strong> ${t.email}<br>` : ''}
                <strong>Contact:</strong> <span class="contact-wrap">${contactLinks(t.contactNumber)}</span>
            </div>
            <div class="card-actions">
                ${isAdmin() ? `<button class="btn btn-edit btn-sm" onclick="editTeacher(${i})">✏️ Edit</button>
                <button class="btn btn-danger btn-sm" onclick="deleteTeacher(${i})">🗑️ Delete</button>` : ""}
            </div>`;
        list.appendChild(card);
    });
}

// ── PDF Export ──
function downloadTeacherPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Teacher List', 105, 14, { align: 'center' });

    let y = 22;
    teachers.forEach((t, i) => {
        if (y > 250) { doc.addPage(); y = 20; }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(107, 63, 160);
        doc.text(`${i + 1}. ${t.name}`, 15, y);
        y += 7;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        const lines = [
            `Designation: ${t.designation}`,
            `Email: ${t.email}`,
            `Contact: ${t.contactNumber}`
        ];

        if (t.photo) {
            try { doc.addImage(t.photo, 'JPEG', 15, y, 22, 22); } catch (e) {}
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

    doc.save('Teacher_List.pdf');
}
