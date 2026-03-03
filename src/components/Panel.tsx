'use client';

import React from 'react';

type PanelProps = {
  width: number | string;
  className?: string;
  style?: React.CSSProperties;
  onClose?: () => void;
  closeLabel?: string;
  closeClassName?: string;
  closeStyle?: React.CSSProperties;
  children: React.ReactNode;
};

export default function Panel({
  width,
  className,
  style,
  onClose,
  closeLabel = 'Close panel',
  closeClassName,
  closeStyle,
  children,
}: PanelProps) {
  return (
    <div
      className={className}
      style={{ width: typeof width === 'number' ? `${width}px` : width, ...style }}
    >
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className={closeClassName}
          style={closeStyle}
        >
          ×
        </button>
      ) : null}
      {children}
    </div>
  );
}
