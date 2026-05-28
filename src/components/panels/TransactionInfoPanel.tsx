'use client';

import React from 'react';
import Image from 'next/image';
import type { ChainKey } from '../../../config/blockchain_config';
import Panel from '../Panel';
import { SpinningLogo } from '../SpinningLogo';

export type TransactionInfoPanelState = {
  id: number;
  txKey: string | null;
  txHash: string | null;
  sellChain: ChainKey;
  buyChain: ChainKey;
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  buyAmount: string | null;
  buyBalanceBeforeRaw: string | null;
  buyTokenDecimals: number | null;
  status: 'pending' | 'complete';
};

type TransactionInfoPanelProps = {
  panel: TransactionInfoPanelState;
  panelType: 'transaction-sidepanel' | 'transaction-inchat';
  width: number;
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
  paddingBottom: number;
  closePaddingTop: number;
  closePaddingRight: number;
  closeSize: number;
  closeFontFamily: string;
  arrowColor: string;
  arrowFontSize: number;
  arrowFontFamily: string;
  leftAlignItems: string;
  rightAlignItems: string;
  statusExecutingLabel: string;
  statusExecutedLabel: string;
  statusFontSize: number;
  statusFontFamily: string;
  statusExecutingFontStyle: string;
  statusExecutedFontStyle: string;
  statusExecutingColor: string;
  statusExecutedColor: string;
  statusPaddingBottom: number;
  viewTransactionLabel: string;
  viewTransactionFontSize: number;
  viewTransactionFontFamily: string;
  viewTransactionColor: string;
  viewTransactionHighlightColor: string;
  viewTransactionPaddingTop: number;
  viewTransactionUnderline: boolean;
  resolveTransactionUrl: (chainKey: ChainKey, txHash: string) => string | null;
  chainNameFontSize: number;
  chainNameFontFamily: string;
  chainNameColor: string;
  chainNameAllCaps: boolean;
  chainNameLetterSpacing: string;
  chainNamePaddingBottom: number;
  tokenSymbolFontSize: number;
  tokenSymbolFontFamily: string;
  tokenSymbolColor: string;
  tokenSymbolPaddingTop: number;
  tokenAmountFontSize: number;
  tokenAmountFontFamily: string;
  tokenAmountColor: string;
  tokenAmountDecimals: number;
  tokenAmountPaddingTop: number;
  pendingLabel: string;
  pendingFontStyle: string;
  pendingColor: string;
  tokenIconSize: number;
  tokenIconBorderPosition: string;
  tokenIconBorderColor: string | null;
  tokenIconBorderWidth: number | null;
  tokenIconPlaceholderColor: string;
  tokenIconPlaceholderFontColor: string;
  tokenIconPlaceholderFontSize: number;
  tokenIconSpinEnabled: boolean;
  resolveTokenIconSrc: (symbol: string) => string | null;
  resolveChainLabel: (chainKey: ChainKey) => string;
  formatAmount: (amount: string) => string;
  onClose: () => void;
};

export default function TransactionInfoPanel({
  panel,
  panelType,
  width,
  paddingLeft,
  paddingRight,
  paddingTop,
  paddingBottom,
  closePaddingTop,
  closePaddingRight,
  closeSize,
  closeFontFamily,
  arrowColor,
  arrowFontSize,
  arrowFontFamily,
  leftAlignItems,
  rightAlignItems,
  statusExecutingLabel,
  statusExecutedLabel,
  statusFontSize,
  statusFontFamily,
  statusExecutingFontStyle,
  statusExecutedFontStyle,
  statusExecutingColor,
  statusExecutedColor,
  statusPaddingBottom,
  viewTransactionLabel,
  viewTransactionFontSize,
  viewTransactionFontFamily,
  viewTransactionColor,
  viewTransactionHighlightColor,
  viewTransactionPaddingTop,
  viewTransactionUnderline,
  resolveTransactionUrl,
  chainNameFontSize,
  chainNameFontFamily,
  chainNameColor,
  chainNameAllCaps,
  chainNameLetterSpacing,
  chainNamePaddingBottom,
  tokenSymbolFontSize,
  tokenSymbolFontFamily,
  tokenSymbolColor,
  tokenSymbolPaddingTop,
  tokenAmountFontSize,
  tokenAmountFontFamily,
  tokenAmountColor,
  tokenAmountPaddingTop,
  pendingLabel,
  pendingFontStyle,
  pendingColor,
  tokenIconSize,
  tokenIconBorderPosition,
  tokenIconBorderColor,
  tokenIconBorderWidth,
  tokenIconPlaceholderColor,
  tokenIconPlaceholderFontColor,
  tokenIconPlaceholderFontSize,
  tokenIconSpinEnabled,
  resolveTokenIconSrc,
  resolveChainLabel,
  formatAmount,
  onClose,
}: TransactionInfoPanelProps) {
  const resolveIconBorderStyle = (
    borderPosition: string,
    borderColor: string | null,
    borderWidth: number | null
  ): React.CSSProperties => {
    if (!borderColor || borderWidth === null || borderWidth <= 0) return {};
    if (borderPosition === 'outer') {
      return { boxShadow: `0 0 0 ${borderWidth}px ${borderColor}` };
    }
    return { borderStyle: 'solid', borderColor, borderWidth: `${borderWidth}px` };
  };

  const iconContainerStyle: React.CSSProperties = {
    width: `${tokenIconSize}px`,
    height: `${tokenIconSize}px`,
    borderRadius: '50%',
    backgroundColor: tokenIconPlaceholderColor,
    ...resolveIconBorderStyle(tokenIconBorderPosition, tokenIconBorderColor, tokenIconBorderWidth),
    position: 'relative',
    overflow: 'hidden',
    flexShrink: 0,
  };

  const placeholderQuestionStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: `${tokenIconPlaceholderFontSize}px`,
    color: tokenIconPlaceholderFontColor,
    userSelect: 'none',
    pointerEvents: 'none',
  };

  const renderSide = (
    chainKey: ChainKey,
    tokenSymbol: string,
    amountNode: React.ReactNode,
    alignItems: string
  ) => {
    const iconSrc = resolveTokenIconSrc(tokenSymbol);
    const chainLabel = resolveChainLabel(chainKey);
    return (
      <div
        className="flex flex-col flex-1 min-w-0"
        style={{ alignItems }}
      >
        <span
          className="whitespace-nowrap"
          style={{
            fontSize: `${chainNameFontSize}px`,
            fontFamily: chainNameFontFamily,
            color: chainNameColor,
            textTransform: chainNameAllCaps ? 'uppercase' : 'none',
            letterSpacing: chainNameLetterSpacing,
            paddingBottom: `${chainNamePaddingBottom}px`,
          }}
        >
          {chainLabel}
        </span>
        <div style={iconContainerStyle}>
          {iconSrc ? (
            <>
              {tokenIconSpinEnabled ? (
                <SpinningLogo
                  src={iconSrc}
                  alt={tokenSymbol}
                  width={tokenIconSize}
                  height={tokenIconSize}
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
                  src={iconSrc}
                  alt={tokenSymbol}
                  width={tokenIconSize}
                  height={tokenIconSize}
                  className="absolute inset-0 h-full w-full object-contain"
                  onError={(e) => {
                    const img = e.currentTarget as HTMLImageElement;
                    img.style.display = 'none';
                    const fallback = img.nextSibling as HTMLElement | null;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
              )}
              <span style={{ ...placeholderQuestionStyle, display: 'none' }}>?</span>
            </>
          ) : (
            <span style={placeholderQuestionStyle}>?</span>
          )}
        </div>
        <span
          className="whitespace-nowrap"
          style={{
            fontSize: `${tokenSymbolFontSize}px`,
            fontFamily: tokenSymbolFontFamily,
            color: tokenSymbolColor,
            paddingTop: `${tokenSymbolPaddingTop}px`,
          }}
        >
          {tokenSymbol}
        </span>
        <span
          className="whitespace-nowrap"
          style={{
            fontSize: `${tokenAmountFontSize}px`,
            fontFamily: tokenAmountFontFamily,
            paddingTop: `${tokenAmountPaddingTop}px`,
          }}
        >
          {amountNode}
        </span>
      </div>
    );
  };

  const sellAmountNode = (
    <span style={{ color: tokenAmountColor }}>{formatAmount(panel.sellAmount)}</span>
  );

  const buyAmountNode = panel.status === 'pending' || panel.buyAmount === null
    ? (
      <span style={{ color: pendingColor, fontStyle: pendingFontStyle }}>
        {pendingLabel}
      </span>
    )
    : (
      <span style={{ color: tokenAmountColor }}>{formatAmount(panel.buyAmount)}</span>
    );

  return (
    <Panel
      width={width}
      className="relative rounded-xl bg-gray-900 border border-gray-700 shadow-2xl overflow-visible flex flex-col"
      panelType={panelType}
      onClose={onClose}
      closeLabel="Close transaction info panel"
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
        className="flex items-center justify-between gap-2"
        style={{
          paddingLeft: `${paddingLeft}px`,
          paddingRight: `${paddingRight}px`,
          paddingTop: `${paddingTop}px`,
          paddingBottom: `${paddingBottom}px`,
        }}
      >
        {renderSide(panel.sellChain, panel.sellToken, sellAmountNode, leftAlignItems)}
        <div className="px-1 self-center flex flex-col items-center">
          <span
            style={{
              fontSize: `${statusFontSize}px`,
              fontFamily: statusFontFamily,
              fontStyle: panel.status === 'pending' ? statusExecutingFontStyle : statusExecutedFontStyle,
              color: panel.status === 'pending' ? statusExecutingColor : statusExecutedColor,
              paddingBottom: `${statusPaddingBottom}px`,
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}
          >
            {panel.status === 'pending' ? statusExecutingLabel : statusExecutedLabel}
          </span>
          <span
            style={{
              color: arrowColor,
              fontSize: `${arrowFontSize}px`,
              fontFamily: arrowFontFamily,
              lineHeight: 1,
            }}
            aria-hidden="true"
          >
            →
          </span>
          {panel.status === 'complete' && panel.txHash
            ? (() => {
                const href = resolveTransactionUrl(panel.sellChain, panel.txHash);
                if (!href) return null;
                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: `${viewTransactionFontSize}px`,
                      fontFamily: viewTransactionFontFamily,
                      color: viewTransactionColor,
                      paddingTop: `${viewTransactionPaddingTop}px`,
                      textDecoration: viewTransactionUnderline ? 'underline' : 'none',
                      lineHeight: 1,
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.color = viewTransactionHighlightColor;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.color = viewTransactionColor;
                    }}
                  >
                    {viewTransactionLabel}
                  </a>
                );
              })()
            : null}
        </div>
        {renderSide(panel.buyChain, panel.buyToken, buyAmountNode, rightAlignItems)}
      </div>
    </Panel>
  );
}
