import React, { useState, useEffect } from 'react';
import { DollarSign } from 'lucide-react';

const CurrencyConverter = () => {
  const [usd, setUsd] = useState('1');
  const [inr, setInr] = useState('83.50');
  const [rate, setRate] = useState(83.50); // Fallback static rate
  
  // Simulate live fetch
  useEffect(() => {
    fetch('https://api.exchangerate-api.com/v4/latest/USD')
      .then(res => res.json())
      .then(data => {
        if (data && data.rates && data.rates.INR) {
          setRate(data.rates.INR);
          setInr((Number(usd) * data.rates.INR).toFixed(2));
        }
      })
      .catch(err => console.error("Could not fetch rates, using fallback"));
  }, []); // eslint-disable-line

  const handleUsdChange = (e) => {
    const val = e.target.value;
    setUsd(val);
    setInr((Number(val) * rate).toFixed(2));
  };

  const handleInrChange = (e) => {
    const val = e.target.value;
    setInr(val);
    setUsd((Number(val) / rate).toFixed(2));
  };

  return (
    <div className="card mb-4" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
      <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <DollarSign size={20} className="text-primary" /> Live Converter
      </h3>
      <div className="flex-col gap-2">
        <label>USD</label>
        <input type="number" value={usd} onChange={handleUsdChange} style={{ backgroundColor: 'var(--white)' }} />
        <label style={{ marginTop: '0.5rem' }}>INR</label>
        <input type="number" value={inr} onChange={handleInrChange} style={{ backgroundColor: 'var(--white)' }} />
        <span style={{ fontSize: '0.8rem', color: 'var(--gray-400)', marginTop: '0.5rem' }}>1 USD = {rate.toFixed(2)} INR</span>
        <span style={{ fontSize: '0.75rem', color: '#4B5563', marginTop: '0.25rem', display: 'block' }}>
          Note: This is not the exact real-time rate of USD or INR. Rates may vary as the API doesn't update by the second. It provides an estimated amount for general understanding.
        </span>
      </div>
    </div>
  );
};

export default CurrencyConverter;
