import React, { useState } from 'react';
import { Percent, Copy, Check } from 'lucide-react';

const PercentageCalculator = ({ onCopy }) => {
  const [amount, setAmount] = useState('');
  const [percentage, setPercentage] = useState('');
  const [copied, setCopied] = useState(false);

  // Parse safely to calculate
  const amountVal = parseFloat(amount) || 0;
  const percentVal = parseFloat(percentage) || 0;
  
  // Calculate percentage
  const result = (amount && percentage) 
    ? ((amountVal * percentVal) / 100).toFixed(2) 
    : '0.00';

  const handleCopy = () => {
    if (result && result !== '0.00') {
      navigator.clipboard.writeText(result);
      setCopied(true);
      if (onCopy) onCopy(result);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
      <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Percent size={20} className="text-primary" /> Percentage
      </h3>
      <div className="flex-col gap-4">
        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--gray-600)', marginBottom: '0.25rem', display: 'block', fontWeight: '600', textTransform: 'uppercase' }}>Amount</label>
          <input 
            type="number" 
            value={amount} 
            onChange={e => setAmount(e.target.value)} 
            placeholder="e.g. 1500" 
            style={{ padding: '0.75rem' }}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--gray-600)', marginBottom: '0.25rem', display: 'block', fontWeight: '600', textTransform: 'uppercase' }}>Percentage (%)</label>
          <input 
            type="number" 
            value={percentage} 
            onChange={e => setPercentage(e.target.value)} 
            placeholder="e.g. 20" 
            style={{ padding: '0.75rem' }}
          />
        </div>
        
        <div style={{ marginTop: '0.5rem' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--gray-600)', marginBottom: '0.25rem', display: 'block', fontWeight: '600', textTransform: 'uppercase' }}>Result</label>
          <div style={{ position: 'relative' }}>
            <input 
              type="text" 
              value={result} 
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
        </div>
      </div>
    </div>
  );
};

export default PercentageCalculator;
