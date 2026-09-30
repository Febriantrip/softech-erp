import React from 'react';
import { Plus } from 'lucide-react';

export default function PageHeader({ eyebrow, title, description, actionLabel, onAction }) {
  return (
    <div className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actionLabel && (
        <button className="btn btn-primary" onClick={onAction}>
          <Plus size={17} /> {actionLabel}
        </button>
      )}
    </div>
  );
}
