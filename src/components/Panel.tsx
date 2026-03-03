'use client';

import React, { useState } from 'react';
import { SpinningLogo } from './SpinningLogo';
import { useLogoAsset } from '../lib/logo';
import { ADD_PANEL_DISPLAY, PANEL_DISPLAY, WALLET_DISPLAY } from '../../config/ui_config';

type PanelProps = {
  width: number | string;
  className?: string;
  style?: React.CSSProperties;
  onClose?: () => void;
  panelType?: 'wallet' | 'add';
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
  panelType,
  closeLabel = 'Close panel',
  closeClassName,
  closeStyle,
  children,
}: PanelProps) {
  const logoAsset = useLogoAsset();
  const logoConfig = PANEL_DISPLAY.logo;
  const panelLogoSize = logoConfig.size;
  const [isLogoHovered, setIsLogoHovered] = useState(false);
  const baseOpacity = Math.min(
    1,
    Math.max(0, Number(logoConfig.opacity ?? 100) / 100)
  );
  const isLogoEnabled = panelType === 'add'
    ? Boolean(ADD_PANEL_DISPLAY.logo)
    : panelType === 'wallet'
      ? Boolean(WALLET_DISPLAY.logo)
      : false;

  return (
    <div
      className={className}
      style={{ width: typeof width === 'number' ? `${width}px` : width, ...style }}
    >
      {isLogoEnabled ? (
        <div
          className="absolute z-10 flex items-center justify-center"
          style={{
            top: logoConfig.paddingTop ?? 0,
            left: logoConfig.paddingLeft ?? 0,
            width: `${panelLogoSize}px`,
            height: `${panelLogoSize}px`,
            opacity: isLogoHovered ? 1 : baseOpacity,
          }}
          onMouseEnter={() => setIsLogoHovered(true)}
          onMouseLeave={() => setIsLogoHovered(false)}
        >
          <SpinningLogo
            src={logoAsset}
            alt="Altair logo"
            className="h-full w-full object-contain"
          />
        </div>
      ) : null}
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
