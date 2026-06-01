import type { ElementType } from 'react';

interface EmptyStateProps {
  icon: ElementType;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

const EmptyState = ({ icon: Icon, title, description, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
      <Icon size={28} className="text-gray-300" />
    </div>
    <h3 className="text-sm font-semibold text-school-primary mb-1">{title}</h3>
    {description && <p className="text-xs text-school-muted max-w-xs mb-4">{description}</p>}
    {action && (
      <button
        onClick={action.onClick}
        className="text-xs px-4 py-2 rounded-lg bg-school-primary text-white font-semibold hover:opacity-90 transition-opacity"
      >
        {action.label}
      </button>
    )}
  </div>
);

export default EmptyState;
