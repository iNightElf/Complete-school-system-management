import { useRef } from 'react';
import { CalendarDays } from 'lucide-react';

interface DatePickerProps {
  type: 'date' | 'month';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  label?: string;
}

function formatDisplay(type: 'date' | 'month', value: string, placeholder?: string): string {
  if (!value) return placeholder || (type === 'month' ? 'Pick a month' : 'Pick a date');
  if (type === 'month') {
    const [y, m] = value.split('-').map(Number);
    const d = new Date(y, m - 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  const d = new Date(value + 'T00:00:00');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function DatePicker({ type, value, onChange, placeholder, required, className = '', label }: DatePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleWrapperClick = () => {
    if (inputRef.current) {
      if ('showPicker' in HTMLInputElement.prototype) {
        (inputRef.current as any).showPicker();
      } else {
        inputRef.current.click();
      }
    }
  };

  const isEmpty = !value;
  const display = formatDisplay(type, value, placeholder);

  return (
    <div className={className}>
      {label && <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">{label}</label>}
      <div
        onClick={handleWrapperClick}
        className={`relative flex items-center gap-2 w-full border rounded-xl px-3 py-2.5 text-sm cursor-pointer transition-colors focus-within:border-school-accent ${isEmpty ? 'text-school-muted' : 'text-school-primary'} border-school-border hover:border-school-accent`}
      >
        <CalendarDays size={16} className="flex-shrink-0 text-school-muted" />
        <span className="flex-1 select-none">{display}</span>
        <input
          ref={inputRef}
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          required={required}
          className="absolute inset-0 opacity-0 cursor-pointer hide-native-indicator"
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
