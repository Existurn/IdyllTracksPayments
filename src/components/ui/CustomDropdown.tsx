import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Check } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: string;
  image?: string;
}

interface CustomDropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export default function CustomDropdown({ options, value, onChange, placeholder = "Select...", icon, className = "", disabled = false }: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isNaturalTheme = typeof document !== "undefined" && document.documentElement.dataset.theme === "natural";

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border bg-transparent transition-colors focus:outline-hidden ${disabled ? 'opacity-50 cursor-not-allowed bg-stone-50' : ''}`}
        style={
          isNaturalTheme
            ? {
                borderColor: isOpen ? "var(--theme-border-strong)" : "var(--theme-border)",
                background: "var(--theme-surface)",
                color: "var(--theme-text)",
                boxShadow: isOpen ? "0 0 0 1px var(--theme-border-strong) inset" : "none",
              }
            : {
                borderColor: isOpen ? "#111827" : "#E7E5E4",
                background: "transparent",
                color: "#1F2937",
                boxShadow: isOpen ? "0 0 0 1px rgba(255,116,27,0.12) inset" : "none",
              }
        }
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {icon && <span className="text-stone-400 shrink-0">{icon}</span>}
          {selectedOption?.image && <img src={selectedOption.image} alt={selectedOption.label} style={{ height: '18px', width: '28px', objectFit: 'contain' }} className="shrink-0" />}
          <span className={`truncate text-sm ${!selectedOption ? 'text-stone-400' : 'text-stone-700'}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-stone-500 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute z-50 mt-1 w-full min-w-[200px] max-h-60 overflow-y-auto rounded-lg shadow-xl py-1"
            style={
              isNaturalTheme
                ? { transformOrigin: 'top center', background: 'var(--theme-surface)', border: '1px solid var(--theme-border)', boxShadow: '0 10px 15px -3px rgba(23,23,23,0.08)' }
                : { transformOrigin: 'top center', background: 'white', border: '1px solid #E7E5E4', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }
            }
          >
            {/* Options list */}
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between group"
                  style={
                    isSelected
                      ? isNaturalTheme
                        ? { background: 'var(--theme-selected)', color: 'var(--theme-text)', fontWeight: 500 }
                        : { background: '#111827', color: '#FFFFFF', fontWeight: 500 }
                      : isNaturalTheme
                        ? { color: 'var(--theme-text)', background: 'transparent' }
                        : { color: '#374151', background: 'transparent' }
                  }
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    {option.image && <img src={option.image} alt={option.label} style={{ height: '18px', width: '28px', objectFit: 'contain' }} className="shrink-0" />}
                    <span className="truncate">{option.label}</span>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-white shrink-0" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
