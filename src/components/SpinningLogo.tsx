'use client';

import React, { useState } from 'react';
import Image, { type ImageProps } from 'next/image';
import { LOGO_SPIN_MIN_MS, LOGO_SPIN_MAX_MS } from '../../config/ui_config';

type SpinningLogoProps = Omit<ImageProps, 'style'> & {
  className?: string;
};

export function SpinningLogo({ className, ...rest }: SpinningLogoProps) {
  const { onMouseEnter, onTouchStart, ...imageProps } = rest;
  const [spinConfig, setSpinConfig] = useState<{ name: string; duration: string; key: number } | null>(null);

  const triggerSpin = () => {
    const clockwise = Math.random() < 0.5;
    const durationMs = LOGO_SPIN_MIN_MS + Math.random() * (LOGO_SPIN_MAX_MS - LOGO_SPIN_MIN_MS);
    const name = clockwise ? 'spinClock' : 'spinCounter';
    setSpinConfig({ name, duration: `${durationMs}ms`, key: Date.now() });
  };

  return (
    <Image
      {...imageProps}
      className={className}
      onMouseEnter={(event) => {
        onMouseEnter?.(event);
        triggerSpin();
      }}
      onTouchStart={(event) => {
        onTouchStart?.(event);
        triggerSpin();
      }}
      key={spinConfig?.key ?? imageProps.alt ?? 'logo'}
      style={
        spinConfig
          ? {
              animationName: spinConfig.name,
              animationDuration: spinConfig.duration,
              animationTimingFunction: 'cubic-bezier(0.25, 0.8, 0.5, 1)',
              animationFillMode: 'forwards',
              animationIterationCount: 1,
            }
          : undefined
      }
    />
  );
}
