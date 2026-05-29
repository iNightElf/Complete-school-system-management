import admin from 'firebase-admin';
import { PrismaClient } from '@prisma/client';
import "dotenv/config";

// Updated to use provided service account key
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('C:/Users/Owner/Downloads/firebasefile.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://student-info-41f18-default-rtdb.asia-southeast1.firebasedatabase.app"
});

const prisma = new PrismaClient();

async function migrate() {
  console.log("Starting migration...");
  const db = admin.database();
  const schoolRef = db.ref('school');
  const snapshot = await schoolRef.get();
  const data = snapshot.val();

  if (!data) {
    console.error("No data found in Firebase.");
    return;
  }

  // 1. Classes & Subjects
  const classList = data.classList || [];
  for (const className of classList) {
    const schoolClass = await prisma.schoolClass.upsert({
      where: { name: className },
      update: {},
      create: { name: className },
    });

    // Handle Subjects (from results config)
    const resultData = data.results?.[className.toLowerCase().replace(/\s+/g,'_')];
    if (resultData?.subjects) {
      const subjects = Array.isArray(resultData.subjects) ? resultData.subjects : Object.values(resultData.subjects);
      for (const sub of subjects as any) {
        await prisma.subject.create({
          data: {
            name: sub.name,
            fullMarks: sub.fullMarks,
            classId: schoolClass.id
          }
        });
      }
    }

    // Handle Books
    const bookData = data.books?.[className.toLowerCase().replace(/\s+/g,'_')];
    if (bookData) {
      const books = Array.isArray(bookData) ? bookData : Object.values(bookData);
      for (const b of books as any) {
        await prisma.book.create({
          data: {
            name: b.name,
            publication: b.publication,
            mrp: b.mrp,
            discounted: b.discounted,
            sell: b.sell,
            classId: schoolClass.id
          }
        });
      }
    }
  }

  // 2. Students & Results
  if (data.students) {
    for (const [classKey, studentsObj] of Object.entries(data.students)) {
      const students = Array.isArray(studentsObj) ? studentsObj : Object.values(studentsObj as any);
      for (const s of students as any) {
        // Convert Base64 photo to Buffer for DB storage
        let photoBuffer = null;
        if (s.photo && s.photo.startsWith('data:image')) {
          const base64Data = s.photo.split(',')[1];
          photoBuffer = Buffer.from(base64Data, 'base64');
        }

        const student = await prisma.student.create({
          data: {
            name: s.name,
            class: s.class,
            roll: s.roll ? String(s.roll) : null,
            fatherName: s.fatherName,
            motherName: s.motherName,
            contact: s.contact,
            photo: photoBuffer
          }
        });

        // Migrate Results
        const sid = (s.roll ? 'r'+s.roll : 'n'+s.name.replace(/\s+/g,'_')).toLowerCase();
        const classResults = data.results?.[classKey]?.results;
        const studentResult = classResults?.[sid];
        if (studentResult) {
          // Clean attendance data (remove undefined/null)
          let cleanAttendance = null;
          if (studentResult.attendance) {
            if (Array.isArray(studentResult.attendance)) {
              cleanAttendance = studentResult.attendance.filter((a: any) => a !== null && a !== undefined);
            } else {
              cleanAttendance = studentResult.attendance;
            }
          }

          if (studentResult.terms) {
            for (const [term, marks] of Object.entries(studentResult.terms)) {
              // Clean marks data if it's an array or object with undefined
              let cleanMarks = marks;
              if (Array.isArray(marks)) {
                cleanMarks = marks.filter(m => m !== null && m !== undefined);
              }

              await prisma.result.create({
                data: {
                  studentId: student.id,
                  term: String(term),
                  marks: cleanMarks as any,
                  attendance: cleanAttendance as any
                }
              });
            }
          }
        }
      }
    }
  }

  // 3. Teachers
  if (data.teachers) {
    const teachers = Array.isArray(data.teachers) ? data.teachers : Object.values(data.teachers);
    for (const t of teachers as any) {
      let photoBuffer = null;
      if (t.photo && t.photo.startsWith('data:image')) {
        const base64Data = t.photo.split(',')[1];
        photoBuffer = Buffer.from(base64Data, 'base64');
      }

      await prisma.teacher.create({
        data: {
          name: t.name,
          designation: t.designation,
          email: t.email,
          contact: t.contact,
          photo: photoBuffer
        }
      });
    }
  }

  // 4. Staff
  if (data.staff) {
    const staff = Array.isArray(data.staff) ? data.staff : Object.values(data.staff);
    for (const st of staff as any) {
      let photoBuffer = null;
      if (st.photo && st.photo.startsWith('data:image')) {
        const base64Data = st.photo.split(',')[1];
        photoBuffer = Buffer.from(base64Data, 'base64');
      }

      await prisma.staff.create({
        data: {
          name: st.name,
          role: st.role,
          email: st.email,
          contact: st.contact,
          photo: photoBuffer
        }
      });
    }
  }

  console.log("Migration complete!");
}

migrate()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
