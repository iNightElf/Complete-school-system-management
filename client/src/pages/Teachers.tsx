import React, { useEffect, useState } from 'react';
import { useSchoolStore } from '../store';
import Layout from '../components/Layout';
import { Users, Search, UserPlus, Phone, Mail, Award } from 'lucide-react';
import axios from 'axios';

const Teachers: React.FC = () => {
  const { teachers, fetchTeachers } = useSchoolStore() as any; // Need to ensure fetchTeachers exists
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Check if fetchTeachers is in store, if not implement a quick one or ensure store has it
    const store = useSchoolStore.getState() as any;
    if (store.fetchTeachers) store.fetchTeachers();
  }, []);

  const filteredTeachers = (teachers || []).filter((t: any) => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.designation.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Layout title="Teachers" showBack>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-school-muted" size={18} />
            <input
              type="text"
              placeholder="Search by name or designation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-school-border pl-10 pr-4 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-school-accent transition-all"
            />
          </div>
          <button className="bg-school-primary text-white px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-school-secondary transition-all shadow-md active:scale-95">
            <UserPlus size={20} />
            <span className="font-bold text-sm">Add Teacher</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeachers.map((teacher: any) => (
            <div key={teacher.id} className="bg-white p-5 rounded-3xl border border-school-border shadow-sm flex flex-col items-center text-center group hover:border-school-accent transition-all">
              <div className="w-20 h-20 rounded-full bg-school-paper border-2 border-school-border group-hover:border-school-accent overflow-hidden mb-4 transition-colors">
                {teacher.photo ? (
                  <img 
                    src={`data:image/jpeg;base64,${btoa(String.fromCharCode(...new Uint8Array(teacher.photo.data)))}`} 
                    alt={teacher.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-school-muted">
                    <Users size={32} />
                  </div>
                )}
              </div>
              <h4 className="font-bold text-school-primary mb-1">{teacher.name}</h4>
              <div className="bg-school-accent/10 text-school-accent px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
                {teacher.designation}
              </div>
              
              <div className="w-full border-t border-school-border pt-4 flex justify-center gap-6">
                <a href={`tel:${teacher.contact}`} className="text-school-muted hover:text-school-accent transition-colors">
                  <Phone size={18} />
                </a>
                <a href={`mailto:${teacher.email}`} className="text-school-muted hover:text-school-accent transition-colors">
                  <Mail size={18} />
                </a>
                <button className="text-school-muted hover:text-school-accent transition-colors">
                  <Award size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default Teachers;
