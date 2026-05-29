// ════════════════════════════════════════
//  booklist.js — Book list CRUD & PDF
// ════════════════════════════════════════

let bEditClass = null;  // tracks which class is being edited (locked during edit)

// ── Submit form ──
function submitBook() {
    const cls           = document.getElementById('bClass').value;
    const name          = document.getElementById('bName').value.trim();
    const publication   = document.getElementById('bPublication').value.trim();
    const mrp           = parseFloat(document.getElementById('bMRP').value) || 0;
    const discountedPrice = parseFloat(document.getElementById('bDiscounted').value) || 0;
    const sellPrice     = parseFloat(document.getElementById('bSell').value) || 0;

    if (!cls || !name) {
        toast('Please select a class and enter the book name.', 'error');
        return;
    }

    finalizeBook({ cls, name, publication, mrp, discountedPrice, sellPrice });
}

function finalizeBook(d) {
    const b = {
        name:            d.name,
        publication:     d.publication,
        mrp:             d.mrp,
        discountedPrice: d.discountedPrice,
        sellPrice:       d.sellPrice
    };

    // When editing, use the locked original class — not the (disabled) form value
    const targetCls = (bEditIndex >= 0 && bEditClass) ? bEditClass : d.cls;

    if (!books[targetCls]) books[targetCls] = [];

    if (bEditIndex >= 0) {
        books[targetCls][bEditIndex] = b;
        bEditIndex = -1;
        bEditClass = null;
    } else {
        books[targetCls].push(b);
    }

    resetBookForm();
    renderBookList(targetCls);
    saveBooksToDatabase(targetCls);
    collapseForm('b');
}

// ── Edit ──
function editBook(cls, i) {
    if (!isAdmin()) { toast("Admin access required.", "error"); return; }
    const b    = books[cls][i];
    bEditIndex = i;
    bEditClass = cls;  // lock the class for this edit

    document.getElementById('bClass').value       = cls;
    document.getElementById('bClass').disabled    = true;  // prevent class change during edit
    document.getElementById('bName').value        = b.name;
    document.getElementById('bPublication').value = b.publication || '';
    document.getElementById('bMRP').value         = b.mrp || '';
    document.getElementById('bDiscounted').value  = b.discountedPrice || '';
    document.getElementById('bSell').value        = b.sellPrice || '';

    document.getElementById('bFormTitle').textContent   = '✏️ Edit Book';
    document.getElementById('bAddBtn').style.display    = 'none';
    document.getElementById('bUpdateBtn').style.display = 'inline-flex';
    document.getElementById('bCancelBtn').style.display = 'inline-flex';
    expandForm('b');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Delete ──
function deleteBook(cls, i) {
    if (!isAdmin()) { toast("Admin access required.", "error"); return; }
    if (!confirm(`Delete "${books[cls][i].name}"?`)) return;
    books[cls].splice(i, 1);
    renderBookList(cls);
    saveBooksToDatabase(cls);
}

// ── Cancel ──
function cancelBookEdit() {
    bEditIndex = -1;
    bEditClass = null;
    document.getElementById('bClass').disabled = false;
    resetBookForm();
}

// ── Reset form ──
function resetBookForm() {
    document.getElementById('bClass').disabled    = false;
    document.getElementById('bClass').value       = activeBookClass || '';
    document.getElementById('bName').value        = '';
    document.getElementById('bPublication').value = '';
    document.getElementById('bMRP').value         = '';
    document.getElementById('bDiscounted').value  = '';
    document.getElementById('bSell').value        = '';
    document.getElementById('bFormTitle').textContent   = 'Add Book';
    document.getElementById('bAddBtn').style.display    = 'inline-flex';
    document.getElementById('bUpdateBtn').style.display = 'none';
    document.getElementById('bCancelBtn').style.display = 'none';
}

// ── Render class picker ──
function renderBookPicker() {
    activeBookClass = null;
    document.getElementById('bClassPicker').style.display = 'block';
    document.getElementById('bListWrap').style.display    = 'none';
    document.getElementById('bPanelTitle').textContent    = 'Book List';
    const existing = document.getElementById('bBackBtn');
    if (existing) existing.remove();

    const grid = document.getElementById('bClassGrid');
    grid.innerHTML = '';
    CLASSES.forEach(cls => {
        const count = (books[cls] || []).length;
        const total = ((books[cls] || []).reduce((s, b) => s + (b.sellPrice || 0), 0)).toFixed(0);
        const tile  = document.createElement('div');
        tile.className = 'picker-tile';
        tile.innerHTML = `
            <div class="tile-icon">${classIcon(cls)}</div>
            <div class="tile-name">${cls}</div>
            <div class="tile-count">${count} book${count !== 1 ? 's' : ''}</div>
            ${count > 0 ? `<div class="tile-total">৳${total}</div>` : ''}`;
        tile.onclick = () => {
            activeBookClass = cls;
            document.getElementById('bClass').value = cls;
            renderBookList(cls);
        };
        grid.appendChild(tile);
    });
    document.getElementById('bTotalBadge').textContent = Object.values(books).flat().length;
}

// ── Render book list for a class ──
function renderBookList(cls) {
    activeBookClass = cls;
    document.getElementById('bClassPicker').style.display = 'none';
    document.getElementById('bListWrap').style.display    = 'block';
    document.getElementById('bPanelTitle').textContent    = cls + ' — Books';
    document.getElementById('bClass').value = cls;

    // Back button
    if (!document.getElementById('bBackBtn')) {
        const btn = document.createElement('button');
        btn.className = 'back-btn';
        btn.id        = 'bBackBtn';
        btn.innerHTML = '&#8592; All Classes';
        btn.onclick   = () => renderBookPicker();
        document.getElementById('bListWrap').insertAdjacentElement('beforebegin', btn);
    }

    const list = books[cls] || [];
    const total = list.reduce((s, b) => s + (b.sellPrice || 0), 0);

    document.getElementById('bCountBadge').textContent = list.length;
    document.getElementById('bTotalBadge').textContent = Object.values(books).flat().length;

    const tbody = document.getElementById('bTableBody');
    tbody.innerHTML = '';

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--muted);">No books added yet for ${cls}</td></tr>`;
    } else {
        list.forEach((b, i) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${i + 1}</td>
                <td>${b.name}</td>
                <td>${b.publication || '—'}</td>
                <td class="num">৳${(b.mrp || 0).toFixed(0)}</td>
                <td class="num">৳${(b.discountedPrice || 0).toFixed(0)}</td>
                <td class="num sell-price">৳${(b.sellPrice || 0).toFixed(0)}</td>
                <td class="td-actions">
                    ${isAdmin() ? `<button class="btn btn-edit btn-sm" onclick="editBook('${cls}',${i})">✏️</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteBook('${cls}',${i})">🗑️</button>` : ""}
                </td>`;
            tbody.appendChild(tr);
        });
    }

    document.getElementById('bTotalRow').textContent = '৳' + total.toFixed(0);
}

// ── PDF — table format ──
function downloadBookPDF() {
    const cls  = activeBookClass;
    if (!cls) { toast('Please select a class first.', 'error'); return; }
    const list = books[cls] || [];

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(26, 26, 46);
    doc.text('Book List — ' + cls, 105, 14, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text('Generated: ' + new Date().toLocaleDateString(), 105, 20, { align: 'center' });

    // Table columns
    const cols   = ['#', 'Book Name', 'Publication', 'MRP (৳)', 'Disc. Price (৳)', 'Sell Price (৳)'];
    const widths = [10, 60, 45, 22, 28, 26];
    const startX = 10;
    let   y      = 28;
    const rowH   = 8;

    // Header row
    doc.setFillColor(26, 26, 46);
    doc.setTextColor(245, 240, 232);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.rect(startX, y, widths.reduce((a, b) => a + b, 0), rowH, 'F');
    let x = startX;
    cols.forEach((col, ci) => {
        doc.text(col, x + 2, y + 5.5);
        x += widths[ci];
    });
    y += rowH;

    // Data rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    list.forEach((b, i) => {
        if (y > 265) { doc.addPage(); y = 20; }
        const bg = i % 2 === 0 ? [255, 253, 247] : [245, 240, 232];
        doc.setFillColor(...bg);
        doc.setTextColor(26, 26, 46);
        const totalW = widths.reduce((a, b) => a + b, 0);
        doc.rect(startX, y, totalW, rowH, 'F');

        x = startX;
        const cells = [
            String(i + 1),
            b.name,
            b.publication || '—',
            (b.mrp || 0).toFixed(0),
            (b.discountedPrice || 0).toFixed(0),
            (b.sellPrice || 0).toFixed(0)
        ];
        cells.forEach((cell, ci) => {
            // Right-align numbers
            if (ci >= 3) {
                doc.text(cell, x + widths[ci] - 2, y + 5.5, { align: 'right' });
            } else {
                // Truncate long text
                const maxW = widths[ci] - 4;
                let txt = cell;
                while (doc.getTextWidth(txt) > maxW && txt.length > 3) txt = txt.slice(0, -1);
                if (txt !== cell) txt = txt.slice(0, -1) + '…';
                doc.text(txt, x + 2, y + 5.5);
            }
            x += widths[ci];
        });

        // Row border
        doc.setDrawColor(212, 207, 196);
        doc.setLineWidth(0.2);
        doc.line(startX, y + rowH, startX + widths.reduce((a, b) => a + b, 0), y + rowH);
        y += rowH;
    });

    // Total row
    if (y > 265) { doc.addPage(); y = 20; }
    const total = list.reduce((s, b) => s + (b.sellPrice || 0), 0);
    doc.setFillColor(200, 75, 49);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    const totalW = widths.reduce((a, b) => a + b, 0);
    doc.rect(startX, y, totalW, rowH, 'F');
    doc.text('TOTAL SELL PRICE', startX + 2, y + 5.5);
    doc.text('৳' + total.toFixed(0), startX + totalW - 2, y + 5.5, { align: 'right' });

    doc.save(cls.replace(/ /g, '_') + '_Book_List.pdf');
}
