'use client';

import React from 'react';
import { Wallet, Check } from 'lucide-react';
import type { ChainKey } from '../../../config/blockchain_config';
import Panel from '../Panel';

type AddPanelProps = {
  width: number;
  closePaddingTop: number;
  closePaddingRight: number;
  closeSize: number;
  closeFontFamily: string;
  iconPaddingTop: number;
  iconPaddingBottom: number;
  paddingLeft: number;
  paddingRight: number;
  labelFontSize: number;
  labelFontFamily: string;
  labelColor: string;
  iconContainerSize: number;
  iconBorderWidth: number;
  iconSize: number;
  iconButtons: {
    icon_color: string;
    container_color: string;
    border_color: string;
    highlight_color: string;
  };
  chainDropdownFontSize: number;
  chainDropdownWidth: number;
  titlePaddingBottom: number;
  isChainOpen: boolean;
  isIconHovered: boolean;
  addPanelChain: ChainKey | 'ALL';
  walletPanels: Array<{ id: number; chainKey: ChainKey | 'ALL' }>;
  walletChainOptions: ReadonlyArray<{ key: ChainKey | 'ALL'; label: string }>;
  onToggleChainOpen: () => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onClose: () => void;
  onSelectChain: (chainKey: ChainKey | 'ALL') => void;
};

export default function AddPanel({
  width,
  closePaddingTop,
  closePaddingRight,
  closeSize,
  closeFontFamily,
  iconPaddingTop,
  iconPaddingBottom,
  paddingLeft,
  paddingRight,
  labelFontSize,
  labelFontFamily,
  labelColor,
  iconContainerSize,
  iconBorderWidth,
  iconSize,
  iconButtons,
  chainDropdownFontSize,
  chainDropdownWidth,
  titlePaddingBottom,
  isChainOpen,
  isIconHovered,
  addPanelChain,
  walletPanels,
  walletChainOptions,
  onToggleChainOpen,
  onHoverStart,
  onHoverEnd,
  onClose,
  onSelectChain,
}: AddPanelProps) {
  return (
    <Panel
      width={width}
      className="relative rounded-xl bg-gray-900 border border-gray-700 shadow-2xl overflow-visible flex flex-col"
      panelType="add"
      onClose={onClose}
      closeLabel="Close wallet panel"
      closeClassName="absolute z-10 text-gray-400 hover:text-gray-200 cursor-pointer"
      closeStyle={{
        top: `${closePaddingTop}px`,
        right: `${closePaddingRight}px`,
        fontSize: `${closeSize}px`,
        fontFamily: closeFontFamily,
        lineHeight: 1,
      }}
    >
      <div
        className="relative flex items-center justify-start gap-3 pointer-events-none"
        style={{
          paddingTop: `${iconPaddingTop}px`,
          paddingBottom: `${iconPaddingBottom}px`,
          paddingLeft: `${paddingLeft}px`,
          paddingRight: `${paddingRight}px`,
        }}
      >
        <span
          className="text-left"
          style={{
            fontSize: `${labelFontSize}px`,
            fontFamily: labelFontFamily,
            color: labelColor,
          }}
        >
          Add Panel:
        </span>
        <button
          type="button"
          onClick={onToggleChainOpen}
          onMouseEnter={onHoverStart}
          onMouseLeave={onHoverEnd}
          className="group inline-flex items-center justify-center cursor-pointer pointer-events-auto"
        >
          <span
            className="flex items-center justify-center rounded-full border transition-colors"
            style={{
              width: `${iconContainerSize}px`,
              height: `${iconContainerSize}px`,
              backgroundColor: iconButtons.container_color,
              borderColor: isChainOpen || isIconHovered
                ? iconButtons.highlight_color
                : iconButtons.border_color,
              borderWidth: `${iconBorderWidth}px`,
              boxSizing: 'content-box',
            }}
          >
            <Wallet
              className="transition-colors"
              color={iconButtons.icon_color}
              style={{ width: `${iconSize}px`, height: `${iconSize}px` }}
            />
          </span>
        </button>
        {isChainOpen && (
          <div
            className="absolute left-1/2 top-full z-[120] -translate-x-1/2 rounded-xl border border-gray-500 bg-gray-900 shadow-2xl pointer-events-auto overflow-hidden"
            style={{
              fontSize: `${chainDropdownFontSize}px`,
              fontFamily: labelFontFamily,
              marginTop: `${titlePaddingBottom}px`,
              width: `${chainDropdownWidth}px`,
            }}
          >
            {walletChainOptions
              .filter((option) => option.key !== addPanelChain)
              .filter((option) => {
                const openChains = new Set<ChainKey | 'ALL'>(walletPanels.map((panel) => panel.chainKey));
                return !openChains.has(option.key);
              })
              .map((option) => {
                const isSelected = addPanelChain === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => onSelectChain(option.key)}
                    className="flex w-full items-center uppercase tracking-[0.3em] text-gray-300 hover:bg-gray-800 transition-colors cursor-pointer"
                    style={{
                      paddingLeft: `${paddingLeft}px`,
                      paddingRight: `${paddingRight}px`,
                      paddingTop: '8px',
                      paddingBottom: '8px',
                    }}
                  >
                    <span className="mr-2 w-4 flex justify-center">
                      {isSelected ? <Check className="w-4 h-4 text-white" /> : null}
                    </span>
                    <span className="flex-1 text-left">{option.label}</span>
                  </button>
                );
              })}
          </div>
        )}
      </div>
    </Panel>
  );
}
