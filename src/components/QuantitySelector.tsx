import { Plus, Minus } from 'lucide-react';
import { useState, useEffect } from 'react';

interface QuantitySelectorProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  className?: string;
}

export default function QuantitySelector({
  value,
  onChange,
  min = 1,
  max = 10,
  label,
  className = ''
}: QuantitySelectorProps) {
  const [inputValue, setInputValue] = useState(String(value));

  useEffect(() => {
    setInputValue(String(value));
  }, [value]);

  const handleDecrement = () => {
    if (value > min) {
      onChange(value - 1);
    }
  };

  const handleIncrement = () => {
    if (value < max) {
      onChange(value + 1);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newInputValue = e.target.value;

    if (newInputValue === '' || /^\d*$/.test(newInputValue)) {
      setInputValue(newInputValue);

      if (newInputValue !== '') {
        const numValue = parseInt(newInputValue);
        if (!isNaN(numValue) && numValue >= min && numValue <= max) {
          onChange(numValue);
        }
      }
    }
  };

  const handleInputBlur = () => {
    if (inputValue === '' || isNaN(parseInt(inputValue))) {
      setInputValue(String(min));
      onChange(min);
    } else {
      const numValue = parseInt(inputValue);
      if (numValue < min) {
        setInputValue(String(min));
        onChange(min);
      } else if (numValue > max) {
        setInputValue(String(max));
        onChange(max);
      }
    }
  };

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-3 text-center">
          {label}
        </label>
      )}
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleDecrement}
            disabled={value <= min}
            className="w-12 h-12 flex items-center justify-center bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 text-gray-700 rounded-lg font-bold text-xl transition-colors"
          >
            <Minus className="w-5 h-5" />
          </button>
          <input
            type="text"
            inputMode="numeric"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            className="w-16 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            type="button"
            onClick={handleIncrement}
            disabled={value >= max}
            className="w-12 h-12 flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg font-bold text-xl transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>Min: {min}</span>
          <span className="text-gray-300">|</span>
          <span>Max: {max}</span>
        </div>
      </div>
    </div>
  );
}
