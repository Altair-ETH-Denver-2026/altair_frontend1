'use client';

import React from 'react';
import Image from 'next/image';
import { Wallet, Check } from 'lucide-react';
import type { ChainKey } from '../../../config/blockchain_config';
import Panel from '../Panel';
import { SpinningLogo } from '../SpinningLogo';

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
  chainDropdownFontName: string;
  chainDropdownFontColor: string;
  chainDropdownAllCaps: boolean;
  chainDropdownLetterSpacing: string;
  chainDropdownItemColor: string;
  chainDropdownItemHighlightColor: string;
  chainDropdownItemHeight: number;
  chainIconSize: number;
  chainIconBorderPosition: string;
  chainIconBorderColor: string | null;
  chainIconBorderWidth: number | null;
  chainIconPlaceholderColor: string;
  chainIconPlaceholderFontColor: string;
  chainIconPlaceholderFontSize: number;
  chainIconSpinEnabled: boolean;
  resolveChainIconSrc: (chainKey: ChainKey | 'ALL') => string | null;
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
  chainDropdownFontName,
  chainDropdownFontColor,
  chainDropdownAllCaps,
  chainDropdownLetterSpacing,
  chainDropdownItemColor,
  chainDropdownItemHighlightColor,
  chainDropdownItemHeight,
  chainIconSize,
  chainIconBorderPosition,
  chainIconBorderColor,
  chainIconBorderWidth,
  chainIconPlaceholderColor,
  chainIconPlaceholderFontColor,
  chainIconPlaceholderFontSize,
  chainIconSpinEnabled,
  resolveChainIconSrc,
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
  const resolveIconBorderStyle = (
    borderPosition: string,
    borderColor: string | null,
    borderWidth: number | null
  ): React.CSSProperties => {
    if (!borderColor || borderWidth === null || borderWidth <= 0) return {};
    if (borderPosition === 'outer') {
      return {
        boxShadow: `0 0 0 ${borderWidth}px ${borderColor}`,
      };
    }
    return {
      borderStyle: 'solid',
      borderColor,
      borderWidth: `${borderWidth}px`,
    };
  };

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
            className="absolute left-1/2 top-full z-[120] -translate-x-1/2 rounded-xl border border-gray-500 shadow-2xl pointer-events-auto overflow-hidden"
            style={{
              fontSize: `${chainDropdownFontSize}px`,
              fontFamily: chainDropdownFontName,
              marginTop: `${titlePaddingBottom}px`,
              width: `${chainDropdownWidth}px`,
              backgroundColor: chainDropdownItemColor,
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
                const chainIconSrc = resolveChainIconSrc(option.key);
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => onSelectChain(option.key)}
                    className="flex w-full items-center transition-colors cursor-pointer"
                    onMouseEnter={(event) => {
                      event.currentTarget.style.backgroundColor = chainDropdownItemHighlightColor;
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.backgroundColor = 'transparent';
                    }}
                    style={{
                      paddingLeft: `${paddingLeft}px`,
                      paddingRight: `${paddingRight}px`,
                      height: `${chainDropdownItemHeight}px`,
                      color: chainDropdownFontColor,
                      textTransform: chainDropdownAllCaps ? 'uppercase' : 'none',
                      letterSpacing: chainDropdownLetterSpacing,
                      backgroundColor: 'transparent',
                    }}
                  >
                    <div
                      className="mr-2 relative flex items-center justify-center shrink-0"
                      style={{
                        width: `${chainIconSize}px`,
                        height: `${chainIconSize}px`,
                        borderRadius: '50%',
                        backgroundColor: chainIconPlaceholderColor,
                        ...resolveIconBorderStyle(
                          chainIconBorderPosition,
                          chainIconBorderColor,
                          chainIconBorderWidth
                        ),
                        overflow: 'hidden',
                      }}
                    >
                      {chainIconSrc ? (
                        <>
                          {chainIconSpinEnabled ? (
                            <SpinningLogo
                              src={chainIconSrc}
                              alt={option.label}
                              width={chainIconSize}
                              height={chainIconSize}
                              className="absolute inset-0 h-full w-full object-contain"
                              onError={(e) => {
                                const img = e.currentTarget as HTMLImageElement;
                                img.style.display = 'none';
                                const fallback = img.nextSibling as HTMLElement | null;
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                          ) : (
                            <Image
                              src={chainIconSrc}
                              alt={option.label}
                              width={chainIconSize}
                              height={chainIconSize}
                              className="absolute inset-0 h-full w-full object-contain"
                              onError={(e) => {
                                const img = e.currentTarget as HTMLImageElement;
                                img.style.display = 'none';
                                const fallback = img.nextSibling as HTMLElement | null;
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                          )}
                          <span
                            style={{
                              display: 'none',
                              position: 'absolute',
                              inset: 0,
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: `${chainIconPlaceholderFontSize}px`,
                              color: chainIconPlaceholderFontColor,
                              userSelect: 'none',
                              pointerEvents: 'none',
                            }}
                          >
                            ?
                          </span>
                        </>
                      ) : (
                        <span
                          style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: `${chainIconPlaceholderFontSize}px`,
                            color: chainIconPlaceholderFontColor,
                            userSelect: 'none',
                            pointerEvents: 'none',
                          }}
                        >
                          ?
                        </span>
                      )}
                      {isSelected ? (
                        <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <Check className="w-4 h-4 text-white" />
                        </span>
                      ) : null}
                    </div>
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
