// ════════════════════════════════════════
//  staff.js — Staff CRUD & rendering
// ════════════════════════════════════════

function submitStaff() {
    const role    = document.getElementById('stRole').value.trim();
    const name    = document.getElementById('stName').value.trim();
    const email   = document.getElementById('stEmail').value.trim();
    const contact = formatBDPhone(document.getElementById('stContact').value.trim());

    if (!role || !name || !contact) {
        toast('Please fill in Role, Name and Contact.', 'error');
        return;
    }

    const photo = getPhotoData('st') || (stEditIndex >= 0 ? staff[stEditIndex].photo : '');
    finalizeStaff({ role, name, email, contact, photo });
}

function finalizeStaff(d) {
    const category = document.getElementById('stCategory').value;

    const s = {
        role:          d.role,
        name:          d.name,
        email:         d.email,
        contactNumber: d.contact,
        photo:         d.photo
    };

    if (stEditIndex >= 0 && category === 'teacher') {
        // Move from Staff to Teacher
        staff.splice(stEditIndex, 1);
        const t = {
            designation:   s.role,
            name:          s.name,
            email:         s.email,
            contactNumber: s.contactNumber,
            photo:         s.photo
        };
        teachers.push(t);
        saveStaffToDatabase();
        saveTeachersToDatabase();
        toast(`${s.name} moved to Teachers ✓`, 'success');
        stEditIndex = -1;
    } else if (stEditIndex >= 0) {
        staff[stEditIndex] = s;
        stEditIndex = -1;
    } else {
        staff.push(s);
    }

    resetStaffForm();
    renderStaff();
    saveStaffToDatabase();
    collapseForm('st');
    setTimeout(() => {
        const el = document.getElementById('stListWrap');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

function editStaff(i) {
    if (!isAdmin()) { toast("Admin access required.", "error"); return; }
    const s     = staff[i];
    stEditIndex = i;

    document.getElementById('stCategory').value    = 'staff';
    document.getElementById('stCategoryGroup').style.display = 'block';
    document.getElementById('stRole').value    = s.role;
    document.getElementById('stName').value    = s.name;
    document.getElementById('stEmail').value   = s.email || '';
    document.getElementById('stContact').value = s.contactNumber;

    if (s.photo) {
        document.getElementById('stPhotoPreview').src           = s.photo;
        document.getElementById('stPhotoPreview').style.display = 'block';
        document.getElementById('stPhotoPlaceholder').style.display = 'none';
    }

    document.getElementById('stFormTitle').textContent   = '✏️ Edit Staff';
    document.getElementById('stAddBtn').style.display    = 'none';
    document.getElementById('stUpdateBtn').style.display = 'inline-flex';
    document.getElementById('stCancelBtn').style.display = 'inline-flex';
    expandForm('st');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteStaff(i) {
    if (!isAdmin()) { toast("Admin access required.", "error"); return; }
    if (!confirm(`Delete ${staff[i].name}?`)) return;
    staff.splice(i, 1);
    renderStaff();
    saveStaffToDatabase();
}

function cancelStaffEdit() {
    stEditIndex = -1;
    resetStaffForm();
}

function resetStaffForm() {
    document.getElementById('stCategory').value    = 'staff';
    document.getElementById('stCategoryGroup').style.display = 'none';
    document.getElementById('stRole').value    = '';
    document.getElementById('stName').value    = '';
    document.getElementById('stEmail').value   = '';
    document.getElementById('stContact').value = '';
    const hint = document.getElementById('stContactHint'); if (hint) hint.textContent = '';

    const pi = document.getElementById('stPhotoInput');
    if (pi) pi.value = '';
    document.getElementById('stPhotoPreview').src                = '';
    document.getElementById('stPhotoPreview').style.display      = 'none';
    document.getElementById('stPhotoPlaceholder').style.display  = 'block';
    document.getElementById('stFormTitle').textContent           = 'Add New Staff';
    document.getElementById('stAddBtn').style.display            = 'inline-flex';
    document.getElementById('stUpdateBtn').style.display         = 'none';
    document.getElementById('stCancelBtn').style.display         = 'none';
}

function renderStaff() {
    const list = document.getElementById('stStaffList');
    document.getElementById('stCountBadge').textContent = staff.length;

    if (staff.length === 0) {
        list.innerHTML = `<div class="empty-state"><div class="big-icon">🏢</div><p>No staff members yet.</p></div>`;
        return;
    }

    list.innerHTML = '';
    staff.forEach((s, i) => {
        const card     = document.createElement('div');
        card.className = 'teacher-card staff-card';
        const avatar   = s.photo || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Crect width='80' height='80' rx='40' fill='%231a1a2e'/%3E%3Ccircle cx='40' cy='30' r='16' fill='%23f5f0e8' opacity='.85'/%3E%3Cellipse cx='40' cy='68' rx='24' ry='16' fill='%23f5f0e8' opacity='.7'/%3E%3C/svg%3E";
        card.innerHTML = `
            <img src="${avatar}" alt="${s.name}">
            <div class="t-name">${s.name}</div>
            <div class="t-designation" style="color:var(--accent2)">${s.role}</div>
            <div class="t-info">
                ${s.email ? `<strong>Email:</strong> ${s.email}<br>` : ''}
                <strong>Contact:</strong> <span class="contact-wrap">${contactLinks(s.contactNumber)}</span>
            </div>
            <div class="card-actions">
                ${isAdmin() ? `<button class="btn btn-edit btn-sm" onclick="editStaff(${i})">✏️ Edit</button>
                <button class="btn btn-danger btn-sm" onclick="deleteStaff(${i})">🗑️ Delete</button>` : ""}
            </div>`;
        list.appendChild(card);
    });
}

function downloadStaffPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Staff List', 105, 14, { align: 'center' });

    let y = 22;
    staff.forEach((s, i) => {
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(45, 106, 79);
        doc.text(`${i + 1}. ${s.name}`, 15, y); y += 7;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(0, 0, 0);
        const lines = [
            `Role: ${s.role}`,
            s.email ? `Email: ${s.email}` : null,
            `Contact: ${s.contactNumber}`
        ].filter(Boolean);
        if (s.photo) {
            try { doc.addImage(s.photo, 'JPEG', 15, y, 22, 22); } catch (e) {}
            lines.forEach((l, li) => doc.text(l, 42, y + 5 + li * 5));
            y += 28;
        } else {
            lines.forEach(l => { doc.text(l, 15, y); y += 5; });
        }
        doc.setDrawColor(200); doc.setLineWidth(0.3); doc.setLineDash([4, 4]);
        doc.line(15, y + 2, 195, y + 2); doc.setLineDash([]); y += 8;
    });
    doc.save('Staff_List.pdf');
}
