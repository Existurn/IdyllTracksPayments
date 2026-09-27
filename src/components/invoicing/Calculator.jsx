import React, { useState } from 'react';
import { Calculator as CalcIcon, Copy, Check } from 'lucide-react';

const Calculator = ({ onCopy }) => {
  const [display, setDisplay] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (display && display !== 'Error') {
      navigator.clipboard.writeText(display);
      setCopied(true);
      if (onCopy) onCopy(display);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePress = (val) => {
    if (val === 'C') {
      setDisplay('');
    } else if (val === '=') {
      try {
        // Replace % with /100 so eval handles it mathematically correctly
        let expression = display.replace(/%/g, '/100');
        // Use new Function instead of direct eval to avoid bundler warnings in production
        const result = new Function('return ' + expression)();
        
        // Handle floating point imprecision
        const cleanResult = Math.round(result * 10000000) / 10000000;
        setDisplay(String(cleanResult));
      } catch {
        setDisplay('Error');
      }
    } else {
      setDisplay(prev => (prev === 'Error' ? val : prev + val));
    }
  };

  const buttons = [
    'C', '(', ')', '%',
    '7', '8', '9', '/',
    '4', '5', '6', '*',
    '1', '2', '3', '-',
    '0', '.', '=', '+'
  ];

  return (
    <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
      <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <CalcIcon size={20} className="text-primary" /> Calculator
      </h3>
      <div className="flex-col gap-2">
        <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
          <input 
            type="text" 
            value={display} 
            readOnly 
            style={{ 
              backgroundColor: 'var(--bg-light)', 
              textAlign: 'right', 
              fontSize: '1.2rem', 
              fontWeight: 'bold', 
              padding: '1rem',
              paddingRight: '3rem',
              width: '100%',
              marginBottom: 0
            }} 
          />
          <button 
            onClick={handleCopy}
            title="Copy result"
            style={{
              position: 'absolute',
              right: '0.5rem',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: copied ? 'var(--primary)' : 'var(--gray-400)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.25rem'
            }}
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
          {buttons.map((btn, index) => (
            <button 
              key={index} 
              className={`btn ${btn === '=' ? 'btn-primary' : 'btn-outline'}`}
              style={{ 
                padding: '0.75rem 0', 
                fontSize: '1.1rem',
                fontWeight: btn === '=' || btn === 'C' ? 'bold' : 'normal',
                backgroundColor: ['/', '*', '-', '+', '%', '(', ')'].includes(btn) ? 'var(--gray-200)' : undefined,
                color: btn === '=' ? 'white' : 'var(--black)'
              }}
              onClick={() => handlePress(btn)}
            >
              {btn}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Calculator;
