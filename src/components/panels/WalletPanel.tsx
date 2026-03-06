'use client';

import React from 'react';
import { Copy, Check, ChevronDown } from 'lucide-react';
import type { ChainKey } from '../../../config/blockchain_config';
import Panel from '../Panel';

type WalletPanelProps = {
  panel: { id: number; chainKey: ChainKey | 'ALL'; isChainOpen: boolean };
  walletWidth: number;
  closePaddingTop: number;
  closePaddingRight: number;
  closeSize: number;
  closeFontFamily: string;
  titlePaddingTop: number;
  titlePaddingBottom: number;
  containerPaddingLeft: number;
  containerPaddingRight: number;
  titleFontSize: number;
  titleFontFamily: string;
  chainDropdownFontSize: number;
  chainDropdownWidth: number;
  walletChainOptions: ReadonlyArray<{ key: ChainKey | 'ALL'; label: string }>;
  resolveWalletTitle: (chainKey: ChainKey | 'ALL') => string;
  onToggleChainOpen: (panelId: number) => void;
  onSelectChain: (panelId: number, chainKey: ChainKey | 'ALL') => void;
  buttonHeight: number;
  buttonPaddingX: number;
  buttonFontSize: number;
  topRowButtonColor: string;
  topRowButtonBorderColor: string;
  topRowButtonHighlightColor: string;
  topRowButtonHighlightBorderColor: string;
  topRowButtonActiveColor: string;
  topRowButtonActiveBorderColor: string;
  withdrawSymbolPaddingLeft: number;
  withdrawSymbolPaddingRight: number;
  tokenDropdownWidth: number | string;
  tokenDropdownFontSize: number;
  tokenDropdownFontFamily: string;
  withdrawAmountInputPaddingLeft: number;
  withdrawAmountInputPaddingRight: number;
  withdrawAmountInputFontSize: number;
  withdrawAmountInputColor: string;
  withdrawMaxFontSize: number;
  withdrawMaxColor: string;
  withdrawMaxHighlightColor: string;
  withdrawMaxInactiveColor: string;
  withdrawDollarValueFontSize: number;
  withdrawDollarValueFontFamily: string;
  withdrawDollarValueColor: string;
  withdrawDollarValueWidth: number;
  withdrawDollarValuePaddingLeft: number;
  withdrawDollarValuePaddingRight: number;
  withdrawAddressInputPaddingLeft: number;
  withdrawAddressInputPaddingRight: number;
  withdrawAddressInputFontSize: number;
  withdrawAddressInputColor: string;
  withdrawSubmitButtonConfig: { textColor: string; borderColor: string; buttonColor: string; highlightColor?: string; activeColor?: string; activeBorderColor?: string; paddingLeft?: number; paddingRight?: number };
  withdrawCancelButtonConfig: { textColor: string; borderColor: string; buttonColor: string; highlightColor?: string; activeColor?: string; activeBorderColor?: string; paddingLeft?: number; paddingRight?: number };
  withdrawSubmitBorderWidth: number;
  withdrawCancelBorderWidth: number;
  withdrawSubmitHighlightColor: string;
  withdrawSubmitActiveColor: string;
  withdrawSubmitActiveBorderColor: string;
  withdrawCancelHighlightColor: string;
  withdrawCancelActiveColor: string;
  withdrawCancelActiveBorderColor: string;
  resolveTokenRows: (chainKey: ChainKey | 'ALL') => string[];
  resolveWithdrawState: (panelId: number) => { active: boolean; token: string; amount: string; address: string };
  resolveWithdrawReceipt: (panelId: number) => { active: boolean; status?: 'submitted' | 'executed'; txHash?: string | null };
  resolveWithdrawError: (panelId: number) => string | null;
  resolveWithdrawDots: (panelId: number) => number;
  resolveTokenDropdownOpen: (panelId: number) => boolean;
  resolveTokenDropdownForceAll: (panelId: number) => boolean;
  resolveWalletCopyActive: (key: string) => boolean;
  resolveWalletAddress: (chainKey: ChainKey | 'ALL') => string;
  formatDisplayAddress: (address: string) => string;
  triggerWalletCopyState: (key: string) => void;
  toggleWithdrawPanel: (panelId: number, options?: { clearOnClose?: boolean }) => void;
  updateWithdrawToken: (panelId: number, token: string) => void;
  updateWithdrawAmount: (panelId: number, amount: string) => void;
  updateWithdrawAddress: (panelId: number, address: string) => void;
  setTokenDropdownOpen: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  setTokenDropdownForceAll: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  isMaxHovering: boolean;
  setIsMaxHovering: (next: boolean) => void;
  onMaxClick: (panelId: number) => void;
  resolveTxUrl: (panelId: number, chainKey: ChainKey | 'ALL') => string;
  onClose: () => void;
  onSubmitWithdraw: () => void;
  renderBalances: (chainKey: ChainKey | 'ALL') => React.ReactNode;
};

export default function WalletPanel({
  panel,
  walletWidth,
  closePaddingTop,
  closePaddingRight,
  closeSize,
  closeFontFamily,
  titlePaddingTop,
  titlePaddingBottom,
  containerPaddingLeft,
  containerPaddingRight,
  titleFontSize,
  titleFontFamily,
  chainDropdownFontSize,
  chainDropdownWidth,
  walletChainOptions,
  resolveWalletTitle,
  onToggleChainOpen,
  onSelectChain,
  buttonHeight,
  buttonPaddingX,
  buttonFontSize,
  topRowButtonColor,
  topRowButtonBorderColor,
  topRowButtonHighlightColor,
  topRowButtonHighlightBorderColor,
  topRowButtonActiveColor,
  topRowButtonActiveBorderColor,
  withdrawSymbolPaddingLeft,
  withdrawSymbolPaddingRight,
  tokenDropdownWidth,
  tokenDropdownFontSize,
  tokenDropdownFontFamily,
  withdrawAmountInputPaddingLeft,
  withdrawAmountInputPaddingRight,
  withdrawAmountInputFontSize,
  withdrawAmountInputColor,
  withdrawMaxFontSize,
  withdrawMaxColor,
  withdrawMaxHighlightColor,
  withdrawMaxInactiveColor,
  withdrawDollarValueFontSize,
  withdrawDollarValueFontFamily,
  withdrawDollarValueColor,
  withdrawDollarValueWidth,
  withdrawDollarValuePaddingLeft,
  withdrawDollarValuePaddingRight,
  withdrawAddressInputPaddingLeft,
  withdrawAddressInputPaddingRight,
  withdrawAddressInputFontSize,
  withdrawAddressInputColor,
  withdrawSubmitButtonConfig,
  withdrawCancelButtonConfig,
  withdrawSubmitBorderWidth,
  withdrawCancelBorderWidth,
  withdrawSubmitHighlightColor,
  withdrawSubmitActiveColor,
  withdrawSubmitActiveBorderColor,
  withdrawCancelHighlightColor,
  withdrawCancelActiveColor,
  withdrawCancelActiveBorderColor,
  resolveTokenRows,
  resolveWithdrawState,
  resolveWithdrawReceipt,
  resolveWithdrawError,
  resolveWithdrawDots,
  resolveTokenDropdownOpen,
  resolveTokenDropdownForceAll,
  resolveWalletCopyActive,
  resolveWalletAddress,
  formatDisplayAddress,
  triggerWalletCopyState,
  toggleWithdrawPanel,
  updateWithdrawToken,
  updateWithdrawAmount,
  updateWithdrawAddress,
  setTokenDropdownOpen,
  setTokenDropdownForceAll,
  isMaxHovering,
  setIsMaxHovering,
  onMaxClick,
  resolveTxUrl,
  onClose,
  onSubmitWithdraw,
  renderBalances,
}: WalletPanelProps) {
  return (
    <Panel
      width={walletWidth}
      className="relative rounded-xl bg-gray-900 border border-gray-700 shadow-2xl overflow-visible flex flex-col"
      panelType="wallet"
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
        className="relative flex items-center justify-center pointer-events-none"
        style={{
          paddingTop: `${titlePaddingTop}px`,
          paddingBottom: `${titlePaddingBottom}px`,
          paddingLeft: `${containerPaddingLeft}px`,
          paddingRight: `${containerPaddingRight}px`,
        }}
      >
        <button
          type="button"
          onClick={() => onToggleChainOpen(panel.id)}
          className="group inline-flex items-center justify-center cursor-pointer pointer-events-auto"
        >
          <span
            className="uppercase tracking-[0.3em] text-gray-400 group-hover:text-gray-200"
            style={{ fontSize: `${titleFontSize}px`, fontFamily: titleFontFamily }}
          >
            {resolveWalletTitle(panel.chainKey)}
          </span>
        </button>
        {panel.isChainOpen && (
          <div
            className="absolute left-1/2 top-full z-[120] -translate-x-1/2 rounded-xl border border-gray-500 bg-gray-900 shadow-2xl pointer-events-auto overflow-hidden"
            style={{
              fontSize: `${chainDropdownFontSize}px`,
              fontFamily: titleFontFamily,
              marginTop: `${titlePaddingBottom}px`,
              width: `${chainDropdownWidth}px`,
            }}
          >
            {walletChainOptions.filter((option) => option.key !== panel.chainKey).map((option) => {
              const isSelected = panel.chainKey === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => onSelectChain(panel.id, option.key)}
                  className="flex w-full items-center uppercase tracking-[0.3em] text-gray-300 hover:bg-gray-800 transition-colors cursor-pointer"
                  style={{
                    paddingLeft: `${containerPaddingLeft}px`,
                    paddingRight: `${containerPaddingRight}px`,
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
      <div
        className="flex w-full items-center justify-center gap-2 py-1.5 text-sm text-gray-300"
        style={{
          paddingLeft: `${containerPaddingLeft}px`,
          paddingRight: `${containerPaddingRight}px`,
        }}
      >
        {(() => {
          const withdrawState = resolveWithdrawState(panel.id);
          const withdrawActive = withdrawState.active;
          const tokenOptions = resolveTokenRows(panel.chainKey);
          return (
            <>
              <button
                type="button"
                onClick={() => toggleWithdrawPanel(panel.id)}
                onMouseEnter={(event) => {
                  if (withdrawActive) return;
                  event.currentTarget.style.backgroundColor = topRowButtonHighlightColor;
                  event.currentTarget.style.borderColor = topRowButtonHighlightBorderColor;
                }}
                onMouseLeave={(event) => {
                  if (withdrawActive) return;
                  event.currentTarget.style.backgroundColor = topRowButtonColor;
                  event.currentTarget.style.borderColor = topRowButtonBorderColor;
                }}
                className={`flex items-center justify-center rounded-lg border transition-colors cursor-pointer ${withdrawActive
                  ? 'text-blue-100'
                  : 'text-gray-100'
                }`}
                style={{
                  height: `${buttonHeight}px`,
                  paddingLeft: `${buttonPaddingX}px`,
                  paddingRight: `${buttonPaddingX}px`,
                  fontSize: `${buttonFontSize}px`,
                  backgroundColor: withdrawActive ? topRowButtonActiveColor : topRowButtonColor,
                  borderColor: withdrawActive ? topRowButtonActiveBorderColor : topRowButtonBorderColor,
                }}
              >
                Withdraw
              </button>
              {withdrawActive ? (
                <div className="flex-1 relative">
                  <div className="relative">
                    <input
                      type="text"
                      value={withdrawState.token}
                      onChange={(event) => {
                        updateWithdrawToken(panel.id, event.target.value);
                        setTokenDropdownForceAll((prev) => ({ ...prev, [panel.id]: false }));
                        setTokenDropdownOpen((prev) => ({ ...prev, [panel.id]: true }));
                      }}
                      onFocus={() => {
                        setTokenDropdownOpen((prev) => ({ ...prev, [panel.id]: true }));
                      }}
                      onBlur={() => {
                        setTimeout(() => {
                          setTokenDropdownOpen((prev) => ({ ...prev, [panel.id]: false }));
                          setTokenDropdownForceAll((prev) => ({ ...prev, [panel.id]: false }));
                        }, 150);
                      }}
                      placeholder="Select token..."
                      className="w-full rounded-lg border border-gray-700 bg-gray-800/60 text-gray-100 placeholder-gray-500 focus:border-gray-500 focus:outline-none"
                      style={{
                        height: `${buttonHeight}px`,
                        paddingLeft: `${withdrawSymbolPaddingLeft}px`,
                        paddingRight: `${withdrawSymbolPaddingRight + 20}px`,
                        fontSize: `${buttonFontSize}px`,
                      }}
                    />
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setTokenDropdownForceAll((prev) => ({ ...prev, [panel.id]: true }));
                        setTokenDropdownOpen((prev) => ({ ...prev, [panel.id]: true }));
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                      aria-label="Show all tokens"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                  {(resolveTokenDropdownOpen(panel.id)
                    && (resolveTokenDropdownForceAll(panel.id)
                      || tokenOptions.some((symbol) =>
                        symbol.toLowerCase().includes(withdrawState.token.trim().toLowerCase())
                      ))) ? (
                    <div
                      className="absolute left-0 top-full z-[120] mt-1 rounded-xl border border-gray-500 bg-gray-900 shadow-2xl overflow-hidden"
                      style={{
                        width: typeof tokenDropdownWidth === 'string'
                          ? tokenDropdownWidth
                          : tokenDropdownWidth === 0
                            ? '100%'
                            : `${tokenDropdownWidth}px`,
                        fontSize: `${tokenDropdownFontSize}px`,
                        fontFamily: tokenDropdownFontFamily,
                      }}
                    >
                      {(resolveTokenDropdownForceAll(panel.id)
                        ? tokenOptions
                        : tokenOptions.filter((symbol) =>
                            symbol.toLowerCase().includes(withdrawState.token.trim().toLowerCase())
                          )
                      ).map((symbol) => (
                        <button
                          key={symbol}
                          type="button"
                          onClick={() => {
                            updateWithdrawToken(panel.id, symbol);
                            setTokenDropdownOpen((prev) => ({ ...prev, [panel.id]: false }));
                            setTokenDropdownForceAll((prev) => ({ ...prev, [panel.id]: false }));
                          }}
                          className="flex w-full items-center uppercase tracking-[0.3em] text-gray-300 hover:bg-gray-800 transition-colors cursor-pointer"
                          style={{
                            paddingLeft: `${containerPaddingLeft}px`,
                            paddingRight: `${containerPaddingRight}px`,
                            paddingTop: '8px',
                            paddingBottom: '8px',
                          }}
                        >
                          {symbol}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <button
                  type="button"
                  className="flex items-center justify-center rounded-lg border text-gray-100 transition-colors cursor-pointer"
                  onMouseEnter={(event) => {
                    event.currentTarget.style.backgroundColor = topRowButtonHighlightColor;
                    event.currentTarget.style.borderColor = topRowButtonHighlightBorderColor;
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.backgroundColor = topRowButtonColor;
                    event.currentTarget.style.borderColor = topRowButtonBorderColor;
                  }}
                  style={{
                    height: `${buttonHeight}px`,
                    paddingLeft: `${buttonPaddingX}px`,
                    paddingRight: `${buttonPaddingX}px`,
                    fontSize: `${buttonFontSize}px`,
                    backgroundColor: topRowButtonColor,
                    borderColor: topRowButtonBorderColor,
                  }}
                >
                  Get Crypto
                </button>
              )}
            </>
          );
        })()}
      </div>
      {resolveWithdrawState(panel.id).active ? (
        <>
          <div
            className="flex w-full items-center gap-2 py-1.5 text-sm text-gray-300"
            style={{
              paddingLeft: `${containerPaddingLeft}px`,
              paddingRight: `${containerPaddingRight}px`,
            }}
          >
            <span className="text-sm text-gray-300 whitespace-nowrap">Amount:</span>
            <div className="relative flex flex-1 min-w-0">
              <input
                type="text"
                inputMode="decimal"
                value={resolveWithdrawState(panel.id).amount}
                onChange={(event) => updateWithdrawAmount(panel.id, event.target.value)}
                placeholder="0.00"
                className="flex w-full items-center justify-center rounded-lg border border-gray-700 bg-gray-800/60 leading-none focus:border-gray-500 focus:outline-none"
                style={{
                  height: `${buttonHeight}px`,
                  paddingLeft: `${withdrawAmountInputPaddingLeft}px`,
                  paddingRight: `${withdrawAmountInputPaddingRight}px`,
                  fontSize: `${withdrawAmountInputFontSize}px`,
                  color: withdrawAmountInputColor,
                }}
              />
              {(() => {
                const selectedToken = resolveWithdrawState(panel.id).token;
                const hasSelectedToken = Boolean(selectedToken && selectedToken.trim());
                const maxColor = !hasSelectedToken
                  ? withdrawMaxInactiveColor
                  : isMaxHovering
                    ? withdrawMaxHighlightColor
                    : withdrawMaxColor;
                return (
                  <button
                    type="button"
                    onClick={() => onMaxClick(panel.id)}
                    onMouseEnter={() => {
                      if (hasSelectedToken) setIsMaxHovering(true);
                    }}
                    onMouseLeave={() => setIsMaxHovering(false)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 font-semibold cursor-pointer"
                    style={{
                      fontSize: `${withdrawMaxFontSize}px`,
                      color: maxColor,
                    }}
                  >
                    MAX
                  </button>
                );
              })()}
            </div>
            <span
              className="whitespace-nowrap text-center"
              style={{
                fontSize: `${withdrawDollarValueFontSize}px`,
                fontFamily: withdrawDollarValueFontFamily,
                color: withdrawDollarValueColor,
                width: withdrawDollarValueWidth ? `${withdrawDollarValueWidth}px` : undefined,
                paddingLeft: `${withdrawDollarValuePaddingLeft}px`,
                paddingRight: `${withdrawDollarValuePaddingRight}px`,
                textAlign: 'center',
              }}
            >
              ($XX.XX)
            </span>
          </div>
          <div
            className="flex w-full items-center gap-2 py-1.5 text-sm text-gray-300"
            style={{
              paddingLeft: `${containerPaddingLeft}px`,
              paddingRight: `${containerPaddingRight}px`,
            }}
          >
            <span className="text-sm text-gray-300 whitespace-nowrap">Recipient:</span>
            <textarea
              rows={1}
              value={resolveWithdrawState(panel.id).address}
              onChange={(event) => updateWithdrawAddress(panel.id, event.target.value)}
              placeholder="Recipient Address..."
              className="flex w-full rounded-lg border border-gray-700 bg-gray-800/60 leading-snug focus:border-gray-500 focus:outline-none resize-none text-left
                placeholder:text-[13px] placeholder:pt-2 placeholder:text-center focus:placeholder-transparent"
              style={{
                minHeight: `${buttonHeight + 2}px`,
                paddingLeft: `${withdrawAddressInputPaddingLeft}px`,
                paddingRight: `${withdrawAddressInputPaddingRight}px`,
                fontSize: `${withdrawAddressInputFontSize}px`,
                color: withdrawAddressInputColor,
                textAlign: 'center',
              }}
            />
          </div>
          <div
            className="flex w-full items-center justify-center gap-2 py-1.5 text-sm text-gray-300"
            style={{
              paddingLeft: `${containerPaddingLeft}px`,
              paddingRight: `${containerPaddingRight}px`,
            }}
          >
            <button
              type="button"
              onClick={onSubmitWithdraw}
              onMouseEnter={(event) => {
                event.currentTarget.style.backgroundColor = withdrawSubmitHighlightColor;
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.backgroundColor = withdrawSubmitButtonConfig.buttonColor;
                event.currentTarget.style.borderColor = withdrawSubmitButtonConfig.borderColor;
              }}
              onMouseDown={(event) => {
                event.currentTarget.style.backgroundColor = withdrawSubmitActiveColor;
                event.currentTarget.style.borderColor = withdrawSubmitActiveBorderColor;
              }}
              onMouseUp={(event) => {
                event.currentTarget.style.backgroundColor = withdrawSubmitButtonConfig.buttonColor;
                event.currentTarget.style.borderColor = withdrawSubmitButtonConfig.borderColor;
              }}
              className="flex items-center justify-center rounded-lg transition-colors cursor-pointer"
              style={{
                height: `${buttonHeight}px`,
                paddingLeft: `${withdrawSubmitButtonConfig.paddingLeft}px`,
                paddingRight: `${withdrawSubmitButtonConfig.paddingRight}px`,
                fontSize: `${buttonFontSize}px`,
                color: withdrawSubmitButtonConfig.textColor,
                backgroundColor: withdrawSubmitButtonConfig.buttonColor,
                borderColor: withdrawSubmitButtonConfig.borderColor,
                borderWidth: `${withdrawSubmitBorderWidth}px`,
                borderStyle: 'solid',
              }}
            >
              Submit Withdrawal
            </button>
            <button
              type="button"
              onClick={() => toggleWithdrawPanel(panel.id, { clearOnClose: true })}
              onMouseEnter={(event) => {
                event.currentTarget.style.backgroundColor = withdrawCancelHighlightColor;
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.backgroundColor = withdrawCancelButtonConfig.buttonColor;
                event.currentTarget.style.borderColor = withdrawCancelButtonConfig.borderColor;
              }}
              onMouseDown={(event) => {
                event.currentTarget.style.backgroundColor = withdrawCancelActiveColor;
                event.currentTarget.style.borderColor = withdrawCancelActiveBorderColor;
              }}
              onMouseUp={(event) => {
                event.currentTarget.style.backgroundColor = withdrawCancelButtonConfig.buttonColor;
                event.currentTarget.style.borderColor = withdrawCancelButtonConfig.borderColor;
              }}
              className="flex items-center justify-center rounded-lg transition-colors cursor-pointer"
              style={{
                height: `${buttonHeight}px`,
                paddingLeft: `${withdrawCancelButtonConfig.paddingLeft}px`,
                paddingRight: `${withdrawCancelButtonConfig.paddingRight}px`,
                fontSize: `${buttonFontSize}px`,
                color: withdrawCancelButtonConfig.textColor,
                backgroundColor: withdrawCancelButtonConfig.buttonColor,
                borderColor: withdrawCancelButtonConfig.borderColor,
                borderWidth: `${withdrawCancelBorderWidth}px`,
                borderStyle: 'solid',
              }}
            >
              Cancel
            </button>
          </div>
          {resolveWithdrawReceipt(panel.id).active ? (
            <div
              className="w-full flex items-center justify-center gap-2 text-xs text-gray-400 pb-1"
              style={{
                paddingLeft: `${containerPaddingLeft}px`,
                paddingRight: `${containerPaddingRight}px`,
              }}
            >
              {resolveWithdrawReceipt(panel.id).status === 'executed' ? (
                <>
                  <span>Withdrawal Executed!</span>
                  <a
                    href={resolveTxUrl(panel.id, panel.chainKey)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 hover:text-blue-200"
                  >
                    View Transaction →
                  </a>
                </>
              ) : (
                <span>Withdrawal Submitted{'.'.repeat(resolveWithdrawDots(panel.id))}</span>
              )}
            </div>
          ) : null}
          {resolveWithdrawError(panel.id) ? (
            <div
              className="w-full text-center text-xs text-red-500 pb-1"
              style={{
                paddingLeft: `${containerPaddingLeft}px`,
                paddingRight: `${containerPaddingRight}px`,
              }}
            >
              {resolveWithdrawError(panel.id)}
            </div>
          ) : null}
          <div className="h-[1px] bg-gray-700 w-full" />
        </>
      ) : null}
      <div
        className="flex w-full items-center gap-2 py-1.5 text-sm text-gray-300"
        style={{
          paddingLeft: `${containerPaddingLeft}px`,
          paddingRight: `${containerPaddingRight}px`,
        }}
      >
        <span className="text-sm text-gray-300 whitespace-nowrap">Wallet Address:</span>
        <button
          type="button"
          onClick={() => {
            const address = resolveWalletAddress(panel.chainKey);
            if (address) {
              navigator.clipboard?.writeText(address).catch(() => {});
              triggerWalletCopyState(`panel-${panel.id}`);
            }
          }}
          onMouseEnter={(event) => {
            if (resolveWalletCopyActive(`panel-${panel.id}`)) return;
            event.currentTarget.style.backgroundColor = topRowButtonHighlightColor;
            event.currentTarget.style.borderColor = topRowButtonHighlightBorderColor;
          }}
          onMouseLeave={(event) => {
            if (resolveWalletCopyActive(`panel-${panel.id}`)) return;
            event.currentTarget.style.backgroundColor = topRowButtonColor;
            event.currentTarget.style.borderColor = topRowButtonBorderColor;
          }}
          onMouseDown={(event) => {
            event.currentTarget.style.backgroundColor = topRowButtonActiveColor;
            event.currentTarget.style.borderColor = topRowButtonActiveBorderColor;
          }}
          onMouseUp={(event) => {
            const isActive = resolveWalletCopyActive(`panel-${panel.id}`);
            if (!isActive) {
              event.currentTarget.style.backgroundColor = topRowButtonColor;
              event.currentTarget.style.borderColor = topRowButtonBorderColor;
            }
          }}
          title={resolveWalletAddress(panel.chainKey) || 'Unknown'}
          className="flex flex-1 min-w-0 items-center justify-center rounded-lg border text-gray-100 leading-none transition-colors cursor-pointer overflow-hidden"
          style={{
            height: `${buttonHeight}px`,
            paddingLeft: `${buttonPaddingX / 2}px`,
            paddingRight: `${buttonPaddingX / 2}px`,
            fontSize: `${buttonFontSize}px`,
            backgroundColor: resolveWalletCopyActive(`panel-${panel.id}`) ? topRowButtonActiveColor : topRowButtonColor,
            borderColor: resolveWalletCopyActive(`panel-${panel.id}`) ? topRowButtonActiveBorderColor : topRowButtonBorderColor,
          }}
        >
          <span
            className="flex h-full items-center text-right text-sm leading-none relative top-[1px] truncate"
            title={resolveWalletAddress(panel.chainKey) || 'Unknown'}
          >
            {resolveWalletCopyActive(`panel-${panel.id}`)
              ? 'Copied Address!'
              : formatDisplayAddress(resolveWalletAddress(panel.chainKey))}
          </span>
          {!resolveWalletCopyActive(`panel-${panel.id}`) ? (
            <span className="flex w-4 justify-start ml-2">
              <Copy className="w-4 h-4 inline-flex" />
            </span>
          ) : null}
        </button>
      </div>
      <div className="h-[1px] bg-gray-700 w-full" />
      {renderBalances(panel.chainKey)}
    </Panel>
  );
}
