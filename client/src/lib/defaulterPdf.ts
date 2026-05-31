import jsPDF from 'jspdf';
import { getMonthNameShort, fmt } from './financeReportPdf';

export function defaulterPDF(params: {
  displayData: any[];
  monthRange: string[];
  classLabel: string;
  subtitle: string;
  totalDueAll: number;
  totalPaidAll: number;
  filterClass: string;
  monthFrom: string;
  monthTo: string;
}) {
  const { displayData, monthRange, classLabel, subtitle, totalDueAll, totalPaidAll, filterClass, monthFrom, monthTo } = params;
  const doc = new jsPDF({ orientation: 'landscape', format: 'a4', unit: 'mm' });
  const M = 10, PW = 277;
  let y = 10;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(26, 26, 46);
  doc.text('AL RAWA English School', M, y + 6);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(130, 124, 114);
  doc.text('ESTD: 2022  ·  Read in the name of your Lord', M, y + 11);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(26, 26, 46);
  doc.text('FEE DEFAULTER REPORT', M, y + 22);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(130, 124, 114);
  doc.text(`${classLabel}  |  ${subtitle}  |  ${displayData.length} students`, M, y + 27);
  doc.text(`Total Due: ${fmt(totalDueAll)} /-   |   Total Paid: ${fmt(totalPaidAll)} /-`, M, y + 32);
  y += 38;

  const nameW = 40, classW = 22, feeW = 44;
  const colW = monthRange.length > 0 ? Math.max(16, Math.floor((PW - nameW - classW - feeW - 42) / monthRange.length)) : 0;
  const dueW = 22, paidW = 22, balW = 22;

  function drawHeader() {
    doc.setFillColor(26, 26, 46);
    doc.rect(M, y, PW, 7, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(255, 255, 255);
    doc.text('Student', M + 2, y + 4.5);
    doc.text('Class', M + nameW + 2, y + 4.5);
    doc.text('Fee (Amount)', M + nameW + classW + 2, y + 4.5);
    let cx = M + nameW + classW + feeW;
    monthRange.forEach(m => {
      const [yr, mn] = m.split('-');
      doc.text(`${getMonthNameShort(Number(mn) - 1)} '${yr.slice(2)}`, cx + 2, y + 4.5);
      cx += colW;
    });
    doc.text('Due', cx + 2, y + 4.5);
    doc.text('Paid', cx + dueW + 2, y + 4.5);
    doc.text('Balance', cx + dueW + paidW + 2, y + 4.5);
    y += 7;
  }

  drawHeader();

  displayData.forEach((row: any) => {
    const recurring = row.fees.filter((f: any) => f.type === 'recurring' || f.type === 'special');
    const onetime = row.fees.filter((f: any) => f.type === 'onetime' || f.type === 'global');
    const allFees = [...recurring, ...onetime];

    allFees.forEach((fee: any, idx: number) => {
      if (y > 185) { doc.addPage(); y = 14; drawHeader(); }
      if (idx % 2 === 0) { doc.setFillColor(255, 253, 247); doc.rect(M, y, PW, 6, 'F'); }

      if (idx === 0) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(26, 26, 46);
        doc.text(row.name.substring(0, 22), M + 2, y + 4);
      }
      if (idx === 0) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
        doc.text(`${row.class}${row.roll ? `-${row.roll}` : ''}`, M + nameW + 2, y + 4);
      }

      const badgeColor: [number, number, number] = fee.type === 'special' ? [245, 158, 11] :
                         fee.type === 'global' ? [168, 85, 247] :
                         fee.type === 'recurring' ? [59, 130, 246] : [107, 114, 128];
      doc.setFillColor(...badgeColor);
      doc.roundedRect(M + nameW + classW + 1, y + 0.5, doc.getTextWidth(fee.name.substring(0, 16)) + 4, 4.5, 1, 1, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(5.5); doc.setTextColor(255, 255, 255);
      doc.text(fee.name.substring(0, 16), M + nameW + classW + 3, y + 3.5);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(100, 100, 100);
      const feeX = M + nameW + classW + feeW - 2;
      doc.text(fmt(fee.amount) + ' /-', feeX, y + 4, { align: 'right' });

      let cx = M + nameW + classW + feeW;
      monthRange.forEach(m => {
        if (fee.months) {
          const md = fee.months.find((x: any) => x.month === m);
          if (md) {
            const boxX = cx + (colW - 5) / 2;
            const boxY = y + 0.5;
            if (md.paid) {
              doc.setFillColor(209, 250, 229);
              doc.roundedRect(boxX, boxY, 5, 5, 0.5, 0.5, 'F');
              doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
              doc.setTextColor(22, 101, 52);
              doc.text('\u2713', boxX + 2.5, boxY + 4, { align: 'center' });
            } else {
              doc.setFillColor(254, 226, 226);
              doc.roundedRect(boxX, boxY, 5, 5, 0.5, 0.5, 'F');
              doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
              doc.setTextColor(185, 28, 28);
              doc.text('\u2717', boxX + 2.5, boxY + 4, { align: 'center' });
            }
          }
        }
        cx += colW;
      });

      if (idx === 0) {
        const sumX = M + nameW + classW + feeW + colW * monthRange.length;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);
        doc.setTextColor(26, 26, 46);
        doc.text(fmt(row.totalDue) + ' /-', sumX + dueW - 2, y + 4, { align: 'right' });
        doc.setTextColor(22, 101, 52);
        doc.text(fmt(row.totalPaid) + ' /-', sumX + dueW + paidW - 2, y + 4, { align: 'right' });
        doc.setTextColor(row.balance > 0 ? 185 : 22, row.balance > 0 ? 28 : 101, row.balance > 0 ? 28 : 52);
        doc.text(fmt(Math.abs(row.balance)) + ' /-', sumX + dueW + paidW + balW - 2, y + 4, { align: 'right' });
      }

      doc.setTextColor(26, 26, 46);
      y += 6;
    });
  });

  y += 2;
  doc.setFillColor(26, 26, 46);
  doc.rect(M, y, PW, 7, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(255, 255, 255);
  doc.text('GRAND TOTAL', M + 2, y + 4.5);
  const gx = M + nameW + classW + feeW + colW * monthRange.length;
  doc.text(fmt(totalDueAll) + ' /-', gx + dueW - 2, y + 4.5, { align: 'right' });
  doc.text(fmt(totalPaidAll) + ' /-', gx + dueW + paidW - 2, y + 4.5, { align: 'right' });
  const gBal = totalDueAll - totalPaidAll;
  doc.setTextColor(gBal > 0 ? 255 : 255, gBal > 0 ? 255 : 255, gBal > 0 ? 255 : 255);
  doc.text(fmt(Math.abs(gBal)) + ' /-', gx + dueW + paidW + balW - 2, y + 4.5, { align: 'right' });

  doc.save(`Defaulter_Report_${filterClass || 'All'}_${monthFrom}_to_${monthTo}.pdf`);
}
