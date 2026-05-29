import React, { useEffect, useState } from 'react';
import { useSchoolStore } from '../store';
import Layout from '../components/Layout';
import { BookOpen, Search, ShoppingBag, Tag, Filter } from 'lucide-react';

const CLASSES = ['Play', 'Nursery', 'KG', 'Class One', 'Class Two', 'Class Three', 'Class Four', 'Class Five'];

const Books: React.FC = () => {
  const { books, fetchBooks } = useSchoolStore() as any;
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const store = useSchoolStore.getState() as any;
    if (store.fetchBooks) store.fetchBooks();
  }, []);

  const filteredBooks = (books || []).filter((b: any) => {
    const matchesClass = selectedClass ? b.class?.name === selectedClass : true;
    const matchesSearch = b.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (b.publication && b.publication.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesClass && matchesSearch;
  });

  return (
    <Layout title="Book List" showBack>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-school-muted" size={18} />
            <input
              type="text"
              placeholder="Search by book name or publication..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-school-border pl-10 pr-4 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-school-accent transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
             <div className="bg-school-accent/10 text-school-accent px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2">
               <ShoppingBag size={18} />
               <span>{filteredBooks.length} Books</span>
             </div>
          </div>
        </div>

        {/* Class Filter */}
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

        {/* Books Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBooks.map((book: any) => (
            <div key={book.id} className="bg-white p-5 rounded-3xl border border-school-border shadow-sm flex flex-col justify-between group hover:border-school-accent transition-all">
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="p-3 bg-school-paper rounded-2xl text-school-primary group-hover:bg-school-accent group-hover:text-white transition-colors">
                    <BookOpen size={24} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-tighter px-2 py-1 bg-school-paper rounded-lg text-school-muted">
                    {book.class?.name || 'General'}
                  </span>
                </div>
                <h4 className="font-bold text-school-primary mb-1 line-clamp-2">{book.name}</h4>
                <p className="text-xs text-school-muted italic mb-4">{book.publication || 'Standard Publication'}</p>
              </div>
              
              <div className="pt-4 border-t border-school-border grid grid-cols-2 gap-2">
                <div className="text-center p-2 rounded-xl bg-school-paper/50">
                  <p className="text-[9px] uppercase font-bold text-school-muted mb-0.5">MRP</p>
                  <p className="font-serif text-school-muted line-through text-xs">৳{Number(book.mrp).toLocaleString()}</p>
                </div>
                <div className="text-center p-2 rounded-xl bg-emerald-50">
                  <p className="text-[9px] uppercase font-bold text-emerald-600 mb-0.5">Sell Price</p>
                  <p className="font-serif text-emerald-700 font-bold">৳{Number(book.sell).toLocaleString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredBooks.length === 0 && (
          <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-school-border">
            <BookOpen size={48} className="mx-auto text-school-border mb-4 opacity-50" />
            <p className="text-school-muted text-sm font-bold uppercase tracking-tighter">No books found matching your criteria</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Books;
