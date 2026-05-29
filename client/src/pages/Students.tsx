import React, { useState, useEffect } from 'react';
import { useSchoolStore } from '../store';
import { GraduationCap, Search, UserPlus, Filter, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CLASSES = ['Play', 'Nursery', 'KG', 'Class One', 'Class Two', 'Class Three', 'Class Four', 'Class Five'];

const Students: React.FC = () => {
  const navigate = useNavigate();
  const { students, fetchStudents } = useSchoolStore();
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchStudents();
  }, []);

  const filteredStudents = students.filter(s => {
    const matchesClass = selectedClass ? s.class === selectedClass : true;
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (s.roll && s.roll.includes(searchQuery));
    return matchesClass && matchesSearch;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-school-muted" size={18} />
          <input
            type="text"
            placeholder="Search by name or roll..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-school-border pl-10 pr-4 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-school-accent transition-all"
          />
        </div>
        <button className="bg-school-primary text-white px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-school-secondary transition-all shadow-md active:scale-95">
          <UserPlus size={20} />
          <span className="font-bold text-sm">Add Student</span>
        </button>
      </div>

      {/* Class Picker Horizontal Scroll */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
        <button
          onClick={() => setSelectedClass(null)}
          className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
            !selectedClass ? 'bg-school-primary text-white border-school-primary shadow-md' : 'bg-white text-school-muted border-school-border hover:border-school-accent'
          }`}
        >
          All Classes
        </button>
        {CLASSES.map(cls => (
          <button
            key={cls}
            onClick={() => setSelectedClass(cls)}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
              selectedClass === cls ? 'bg-school-primary text-white border-school-primary shadow-md' : 'bg-white text-school-muted border-school-border hover:border-school-accent'
            }`}
          >
            {cls}
          </button>
        ))}
      </div>

      {/* Students Grid */}
      {filteredStudents.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStudents.map(student => (
            <button
              key={student.id}
              onClick={() => navigate(`/students/${student.id}`)}
              className="group bg-white p-4 rounded-2xl border border-school-border hover:border-school-accent transition-all duration-300 flex items-center gap-4 text-left shadow-sm hover:shadow-md"
            >
              <div className="w-16 h-16 rounded-full bg-school-primary/5 border-2 border-school-border group-hover:border-school-accent overflow-hidden flex-shrink-0 flex items-center justify-center transition-colors">
                {student.photo ? (
                  <img 
                    src={`data:image/jpeg;base64,${btoa(String.fromCharCode(...new Uint8Array(student.photo.data)))}`} 
                    alt={student.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <GraduationCap className="text-school-muted group-hover:text-school-accent transition-colors" size={28} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-school-primary truncate group-hover:text-school-accent transition-colors">
                  {student.name}
                </h4>
                <p className="text-[10px] text-school-muted font-bold uppercase tracking-tighter">
                  {student.class} {student.roll ? `· Roll: ${student.roll}` : ''}
                </p>
              </div>
              <ChevronRight size={18} className="text-school-border group-hover:text-school-accent transition-all transform group-hover:translate-x-1" />
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-school-border">
          <GraduationCap size={48} className="mx-auto text-school-border mb-4 opacity-50" />
          <h3 className="text-lg font-serif text-school-primary">No students found</h3>
          <p className="text-sm text-school-muted mt-1">Try adjusting your filters or search query.</p>
        </div>
      )}
    </div>
  );
};

export default Students;
