/**
 * Input Component
 * Reusable input component with validation support
 */

'use client';

import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

export function Input({
  label,
  error,
  helperText,
  fullWidth = true,
  className = '',
  ...props
}: InputProps) {
  const baseStyles = 'px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors duration-200';
  const errorStyles = error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-pink-500';
  const widthStyle = fullWidth ? 'w-full' : '';

  return (
    <div className={widthStyle}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <input
        className={`${baseStyles} ${errorStyles} ${widthStyle} ${className}`}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-sm text-gray-500">{helperText}</p>
      )}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

export function Textarea({
  label,
  error,
  helperText,
  fullWidth = true,
  className = '',
  ...props
}: TextareaProps) {
  const baseStyles = 'px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors duration-200 resize-none';
  const errorStyles = error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-pink-500';
  const widthStyle = fullWidth ? 'w-full' : '';

  return (
    <div className={widthStyle}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <textarea
        className={`${baseStyles} ${errorStyles} ${widthStyle} ${className}`}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-sm text-gray-500">{helperText}</p>
      )}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
  options: Array<{ value: string; label: string }>;
}

export function Select({
  label,
  error,
  helperText,
  fullWidth = true,
  options,
  className = '',
  ...props
}: SelectProps) {
  const baseStyles = 'px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors duration-200';
  const errorStyles = error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-pink-500';
  const widthStyle = fullWidth ? 'w-full' : '';

  return (
    <div className={widthStyle}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <select
        className={`${baseStyles} ${errorStyles} ${widthStyle} ${className}`}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-sm text-gray-500">{helperText}</p>
      )}
    </div>
  );
}