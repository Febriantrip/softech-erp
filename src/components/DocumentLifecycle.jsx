import React from 'react';

export default function DocumentLifecycle({ steps, currentIndex = 0, label }) {
  return (
    <div className="surface-card lifecycle-card">
      <div className="lifecycle-head"><strong>Document lifecycle</strong><span>{label}</span></div>
      <div className="lifecycle-track">
        {steps.map((step, index) => (
          <React.Fragment key={step}>
            <div className={`lifecycle-step ${index <= currentIndex ? 'done' : ''} ${index === currentIndex ? 'current' : ''}`}>
              <span>{index + 1}</span><small>{step}</small>
            </div>
            {index < steps.length - 1 && <div className={`lifecycle-line ${index < currentIndex ? 'done' : ''}`} />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
