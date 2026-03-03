'use client';

import React from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { useUserSync } from '../lib/useUserSync';
import UserMenu from '../components/UserMenu';
import Chat from '../components/Chat';
import { SpinningLogo } from '../components/SpinningLogo';
import { useLogoAsset } from '../lib/logo';
import { HOME_ICON, MENU_ICONS, TITLE_PANEL } from '../../config/ui_config';

export default function Home() {
  const { login, authenticated } = usePrivy();
  useUserSync();
  const logoAsset = useLogoAsset();

  return (
    <main className="relative min-h-screen w-full bg-black text-white flex flex-col items-center justify-center p-8">
      {/* HEADER CONTAINER: full width, aligns logo left and menu right at same height */}
      <div
        className="absolute z-50"
        style={{
          top: HOME_ICON.y_justify === 'top' ? `${HOME_ICON.y_offset * 4}px` : undefined,
          bottom: HOME_ICON.y_justify === 'bottom' ? `${HOME_ICON.y_offset * 4}px` : undefined,
          left: HOME_ICON.x_justify === 'left' ? `${HOME_ICON.x_offset * 4}px` : undefined,
          right: HOME_ICON.x_justify === 'right' ? `${HOME_ICON.x_offset * 4}px` : undefined,
        }}
      >
        <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <div style={{ height: `${HOME_ICON.size * 4}px` }}>
            <SpinningLogo
              src={logoAsset}
              alt="Altair logo"
              className="h-full w-auto"
              priority
            />
          </div>
        </Link>
      </div>
      <div
        className="absolute z-50"
        style={{
          top: MENU_ICONS.y_justify === 'top' ? `${MENU_ICONS.y_offset * 4}px` : undefined,
          bottom: MENU_ICONS.y_justify === 'bottom' ? `${MENU_ICONS.y_offset * 4}px` : undefined,
          left: MENU_ICONS.x_justify === 'left' ? `${MENU_ICONS.x_offset * 4}px` : undefined,
          right: MENU_ICONS.x_justify === 'right' ? `${MENU_ICONS.x_offset * 4}px` : undefined,
        }}
      >
        <UserMenu />
      </div>

      {/* Content Container */}
      <div className="w-full flex flex-col items-center gap-8">
        {/* TITLE_PANEL */}
        <div
          className="flex items-center gap-4"
          style={{
            marginLeft: `${TITLE_PANEL.x_offset * 4}px`,
            marginTop: `${TITLE_PANEL.y_offset * 4}px`,
          }}
        >
          <div style={{ height: `${TITLE_PANEL.logo_size * TITLE_PANEL.size * 4}px` }}>
            <SpinningLogo src={logoAsset} alt="Altair logo" className="h-full w-auto" />
          </div>
          <div className="text-left">
            <h1
              className="font-extrabold bg-clip-text text-transparent"
              style={{
                fontSize: `${TITLE_PANEL.size * 3}rem`,
                marginBottom: `${TITLE_PANEL.text_spacing * 4}px`,
                backgroundImage: `linear-gradient(to right, ${TITLE_PANEL.title_gradient.color_start}, ${TITLE_PANEL.title_gradient.color_end})`,
              }}
            >
              Altair
            </h1>
            <p
              className="font-medium italic"
              style={{
                color: TITLE_PANEL.text_color,
                fontSize: `${TITLE_PANEL.size}rem`,
              }}
            >
              {authenticated ? "Your crypto trading assistant." : "Your crypto trading assistant."}
            </p>
          </div>
        </div>

        {authenticated ? (
          <Chat /> // The Chat UI appears here when logged in
        ) : (
          <button 
            onClick={login}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full transition-all shadow-lg shadow-blue-500/20 mt-4"
          >
            Connect to Altair
          </button>
        )}
      </div>

      
    </main>
  );
}
