import React, { useEffect, useState } from 'react';
import { useSchoolStore } from '../store';
import Layout from '../components/Layout';
import { UserCog, Search, UserPlus, Phone, Mail } from 'lucide-react';

const Staff: React.FC = () => {
  const { staff, fetchStaff } = useSchoolStore() as any;
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const store = useSchoolStore.getState() as any;
    if (store.fetchStaff) store.fetchStaff();
  }, []);

  const filteredStaff = (staff || []).filter((s: any) => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Layout title="Staff" showBack>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-school-muted" size={18} />
            <input
              type="text"
              placeholder="Search by name or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-school-border pl-10 pr-4 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-school-accent transition-all"
            />
          </div>
          <button className="bg-school-primary text-white px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-school-secondary transition-all shadow-md active:scale-95">
            <UserPlus size={20} />
            <span className="font-bold text-sm">Add Staff</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStaff.map((person: any) => (
            <div key={person.id} className="bg-white p-5 rounded-3xl border border-school-border shadow-sm flex items-center gap-4 group hover:border-school-accent transition-all">
              <div className="w-16 h-16 rounded-2xl bg-school-primary/5 border-2 border-school-border group-hover:border-school-accent overflow-hidden shrink-0 flex items-center justify-center transition-colors">
                {person.photo ? (
                  <img 
                    src={`data:image/jpeg;base64,${btoa(String.fromCharCode(...new Uint8Array(person.photo.data)))}`} 
                    alt={person.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserCog className="text-school-muted group-hover:text-school-accent transition-colors" size={28} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-school-primary truncate">{person.name}</h4>
                <p className="text-[10px] text-school-muted font-bold uppercase tracking-tighter mb-2">{person.role}</p>
                <div className="flex gap-3">
                  <a href={`tel:${person.contact}`} className="text-school-muted hover:text-school-accent transition-colors">
                    <Phone size={14} />
                  </a>
                  <a href={`mailto:${person.email}`} className="text-school-muted hover:text-school-accent transition-colors">
                    <Mail size={14} />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default Staff;
