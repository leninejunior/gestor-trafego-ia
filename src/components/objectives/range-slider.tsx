'use client';

import { useState, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface RangeSliderProps {
  min: number;
  max: number;
  step: number;
  value: [number, number];
  onValueChange: (value: [number, number]) => void;
  formatValue?: (value: number) => string;
  label?: string;
  className?: string;
}

export function RangeSlider({
  min,
  max,
  step,
  value,
  onValueChange,
  formatValue = (v) => v.toString(),
  label,
  className = ''
}: RangeSliderProps) {
  const [isDragging, setIsDragging] = useState<'min' | 'max' | null>(null);

  const handleMinChange = useCallback((newMin: number) => {
    const clampedMin = Math.max(min, Math.min(newMin, value[1] - step));
    onValueChange([clampedMin, value[1]]);
  }, [min, step, value, onValueChange]);

  const handleMaxChange = useCallback((newMax: number) => {
    const clampedMax = Math.min(max, Math.max(newMax, value[0] + step));
    onValueChange([value[0], clampedMax]);
  }, [max, step, value, onValueChange]);

  const getPercentage = (val: number) => {
    return ((val - min) / (max - min)) * 100;
  };

  const minPercentage = getPercentage(value[0]);
  const maxPercentage = getPercentage(value[1]);

  return (
    <div className={`space-y-4 ${className}`}>
      {label && <Label className="text-base font-medium">{label}</Label>}
      
      {/* Visual Range Slider */}
      <div className="relative">
        <div className="h-2 bg-muted rounded-full relative">
          {/* Active range */}
          <div
            className="absolute h-2 bg-primary rounded-full"
            style={{
              left: `${minPercentage}%`,
              width: `${maxPercentage - minPercentage}%`
            }}
          />
          
          {/* Min handle */}
          <div
            className={`absolute w-5 h-5 bg-white border-2 border-primary rounded-full cursor-pointer transform -translate-y-1.5 -translate-x-2.5 transition-all ${
              isDragging === 'min' ? 'scale-110 shadow-lg' : 'hover:scale-105'
            }`}
            style={{ left: `${minPercentage}%` }}
            onMouseDown={() => setIsDragging('min')}
          />
          
          {/* Max handle */}
          <div
            className={`absolute w-5 h-5 bg-white border-2 border-primary rounded-full cursor-pointer transform -translate-y-1.5 -translate-x-2.5 transition-all ${
              isDragging === 'max' ? 'scale-110 shadow-lg' : 'hover:scale-105'
            }`}
            style={{ left: `${maxPercentage}%` }}
            onMouseDown={() => setIsDragging('max')}
          />
        </div>

        {/* Value labels */}
        <div className="flex justify-between mt-2 text-sm text-muted-foreground">
          <span>{formatValue(min)}</span>
          <span>{formatValue(max)}</span>
        </div>
      </div>

      {/* Input controls */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="min-value" className="text-sm">Valor Mínimo</Label>
          <div className="flex items-center gap-2">
            <Input
              id="min-value"
              type="number"
              value={value[0]}
              onChange={(e) => handleMinChange(parseFloat(e.target.value) || min)}
              min={min}
              max={value[1] - step}
              step={step}
              className="text-center"
            />
            <span className="text-sm text-muted-foreground min-w-0">
              {formatValue(value[0])}
            </span>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="max-value" className="text-sm">Valor Máximo</Label>
          <div className="flex items-center gap-2">
            <Input
              id="max-value"
              type="number"
              value={value[1]}
              onChange={(e) => handleMaxChange(parseFloat(e.target.value) || max)}
              min={value[0] + step}
              max={max}
              step={step}
              className="text-center"
            />
            <span className="text-sm text-muted-foreground min-w-0">
              {formatValue(value[1])}
            </span>
          </div>
        </div>
      </div>

      {/* Range info */}
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg text-sm">
        <div>
          <span className="text-muted-foreground">Range: </span>
          <span className="font-medium">
            {formatValue(value[0])} - {formatValue(value[1])}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Amplitude: </span>
          <span className="font-medium">
            {formatValue(value[1] - value[0])}
          </span>
        </div>
      </div>
    </div>
  );
}