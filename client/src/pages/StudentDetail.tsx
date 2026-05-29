import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSchoolStore } from '../store';
import Layout from '../components/Layout';
import { GraduationCap, FileText, Download, Calendar } from 'lucide-react';

const TERM_NAMES: Record<string, string> = { '1': '1st Term', '2': '2nd Term', '3': 'Final Exam' };

const StudentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { students, fetchStudents } = useSchoolStore();
  const [activeTerm, setActiveTerm] = useState('1');

  const student = students.find(s => s.id === id);

  useEffect(() => {
    if (students.length === 0) fetchStudents();
  }, []);

  if (!student) return <Layout showBack title="Loading..."><div className="animate-pulse">Loading student data...</div></Layout>;

  const avatar = student.photo 
    ? `data:image/jpeg;base64,${btoa(String.fromCharCode(...new Uint8Array(student.photo.data)))}` 
    : null;

  // Grade Calculation Logic (Exact Parity with old results.js)
  const getGrade = (pct: number) => {
    if (pct >= 80) return { grade: 'A+', gpa: 5.00, color: 'text-green-600 bg-green-50' };
    if (pct >= 75) return { grade: 'A', gpa: 4.75, color: 'text-green-600 bg-green-50' };
    if (pct >= 70) return { grade: 'A-', gpa: 4.50, color: 'text-green-600 bg-green-50' };
    if (pct >= 65) return { grade: 'B+', gpa: 4.25, color: 'text-blue-600 bg-blue-50' };
    if (pct >= 60) return { grade: 'B', gpa: 4.00, color: 'text-blue-600 bg-blue-50' };
    if (pct >= 55) return { grade: 'B-', gpa: 3.75, color: 'text-blue-600 bg-blue-50' };
    if (pct >= 50) return { grade: 'C+', gpa: 3.50, color: 'text-amber-600 bg-amber-50' };
    if (pct >= 45) return { grade: 'C', gpa: 3.25, color: 'text-amber-600 bg-amber-50' };
    if (pct >= 40) return { grade: 'D', gpa: 3.00, color: 'text-rose-600 bg-rose-50' };
    return { grade: 'F', gpa: 0.00, color: 'text-red-600 bg-red-50' };
  };

  const termResult = student.results?.find((r: any) => r.term === activeTerm);
  const marks = termResult?.marks || {};

  return (
    <Layout showBack title={student.name}>
      <div className="space-y-6 pb-20">
        {/* Student Header Card */}
        <div className="bg-white p-6 rounded-3xl border border-school-border shadow-sm flex flex-col sm:flex-row items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-school-primary/5 border-2 border-school-border overflow-hidden flex-shrink-0 flex items-center justify-center">
            {avatar ? (
              <img src={avatar} alt={student.name} className="w-full h-full object-cover" />
            ) : (
              <GraduationCap className="text-school-muted" size={40} />
            )}
          </div>
          <div className="text-center sm:text-left flex-1">
            <h3 className="text-2xl font-serif text-school-primary">{student.name}</h3>
            <div className="flex flex-wrap justify-center sm:justify-start gap-x-4 gap-y-1 mt-1">
              <span className="text-xs font-bold text-school-muted uppercase tracking-tighter">Class: {student.class}</span>
              {student.roll && <span className="text-xs font-bold text-school-muted uppercase tracking-tighter">Roll: {student.roll}</span>}
              {student.fatherName && <span className="text-xs font-bold text-school-muted uppercase tracking-tighter">Father: {student.fatherName}</span>}
            </div>
          </div>
          <button className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-md active:scale-95 text-sm font-bold">
            <FileText size={18} />
            Report Card
          </button>
        </div>

        {/* Results Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-serif text-lg text-school-primary flex items-center gap-2">
              <Calendar size={20} className="text-school-accent" />
              Academic Results
            </h4>
          </div>

          {/* Term Tabs */}
          <div className="flex bg-white p-1 rounded-2xl border border-school-border mb-4">
            {['1', '2', '3'].map(t => (
              <button
                key={t}
                onClick={() => setActiveTerm(t)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTerm === t ? 'bg-school-primary text-white shadow-lg' : 'text-school-muted hover:bg-school-paper'
                }`}
              >
                {TERM_NAMES[t]}
              </button>
            ))}
          </div>

          {/* Marksheet Design Parity */}
          <div className="bg-white rounded-3xl border border-school-border shadow-sm overflow-hidden">
             {termResult ? (
               <div className="p-0 sm:p-4">
                 <div className="overflow-x-auto">
                   <table className="w-full text-left text-sm">
                     <thead>
                       <tr className="bg-school-paper/50 border-b border-school-border text-school-muted text-[10px] uppercase tracking-widest font-bold">
                         <th className="px-4 py-3">Subject</th>
                         <th className="px-4 py-3 text-center">Marks</th>
                         <th className="px-4 py-3 text-center">Grade</th>
                         <th className="px-4 py-3 text-center">GPA</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-school-border">
                       {Object.entries(marks).map(([subject, score]: [string, any]) => {
                         const fullMarks = 100; // Simplified for now, should come from Subjects table
                         const g = getGrade((score / fullMarks) * 100);
                         return (
                           <tr key={subject} className="hover:bg-school-paper/20 transition-colors">
                             <td className="px-4 py-4 font-semibold text-school-primary">{subject}</td>
                             <td className="px-4 py-4 text-center font-serif text-lg">{score}</td>
                             <td className="px-4 py-4 text-center">
                               <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${g.color}`}>
                                 {g.grade}
                               </span>
                             </td>
                             <td className="px-4 py-4 text-center font-mono text-school-muted font-bold">{g.gpa.toFixed(2)}</td>
                           </tr>
                         );
                       })}
                     </tbody>
                     <tfoot className="bg-school-primary/5 font-bold border-t border-school-border">
                        <tr>
                          <td className="px-4 py-4 uppercase tracking-tighter text-xs">Term Summary</td>
                          <td colSpan={3} className="px-4 py-4 text-right">
                             <div className="flex items-center justify-end gap-4">
                               <span className="text-xs text-school-muted">GPA: <span className="text-school-primary font-serif text-lg ml-1">4.50</span></span>
                               <span className="text-xs text-school-muted">Grade: <span className="bg-green-600 text-white px-2 py-0.5 rounded text-[10px] ml-1">A-</span></span>
                             </div>
                          </td>
                        </tr>
                     </tfoot>
                   </table>
                 </div>
               </div>
             ) : (
               <div className="p-12 text-center">
                 <FileText size={48} className="mx-auto text-school-border mb-4 opacity-50" />
                 <p className="text-school-muted text-sm font-bold uppercase tracking-tighter">No marks recorded for {TERM_NAMES[activeTerm]}</p>
                 <button className="mt-4 text-school-accent text-xs font-black uppercase hover:underline">+ Add Marks Now</button>
               </div>
             )}
          </div>
        </section>

        {/* Download Section */}
        <div className="grid grid-cols-2 gap-4">
           <button className="flex flex-col items-center justify-center p-6 bg-white rounded-3xl border border-school-border hover:border-school-accent transition-all group">
             <Download size={24} className="text-school-muted group-hover:text-school-accent mb-2" />
             <span className="text-[10px] font-black uppercase tracking-widest text-school-muted group-hover:text-school-primary">Marksheet PDF</span>
           </button>
           <button className="flex flex-col items-center justify-center p-6 bg-white rounded-3xl border border-school-border hover:border-school-accent transition-all group">
             <Download size={24} className="text-school-muted group-hover:text-school-accent mb-2" />
             <span className="text-[10px] font-black uppercase tracking-widest text-school-muted group-hover:text-school-primary">Tabulation PDF</span>
           </button>
        </div>
      </div>
    </Layout>
  );
};

export default StudentDetail;
