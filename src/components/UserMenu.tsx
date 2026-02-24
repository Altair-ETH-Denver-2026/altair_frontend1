'use client';

import React, { useState, useRef, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useSwap, useWithdraw } from '../lib/useSwap';
import { ethers } from 'ethers';
import { UserRound, LogOut, Settings, Wallet, Wrench, Copy, Globe2, Check, ArrowUpRight } from 'lucide-react';
import { useEffect as useClientEffect, useState as useClientState } from 'react';
import { BLOCKCHAIN, CHAINS, type ChainKey } from '../../config/blockchain_config';
import { BALANCE_DECIMALS, MENU_ICONS, WALLET_DISPLAY, X_SIZE } from '../../config/ui_config';

export default function UserMenu() {
  const { logout, authenticated } = usePrivy();
  const cachedEvmKey = 'cached:evmAddress';
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [isWalletPanelOpen, setIsWalletPanelOpen] = useState(false);
  const [isDevOpen, setIsDevOpen] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapMessage, setSwapMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [ethBalance, setEthBalance] = useClientState<string>('0');
  const [usdcBalance, setUsdcBalance] = useClientState<string>('0');
  const [wethBalance, setWethBalance] = useClientState<string>('0');
  const [daiBalance, setDaiBalance] = useClientState<string>('0');
  const [evmAddress, setEvmAddress] = useClientState<string>('');
  const [isNetworkOpen, setIsNetworkOpen] = useState(false);
  const [selectedChain, setSelectedChain] = useState<ChainKey>(BLOCKCHAIN);
  const executeSwap = useSwap(selectedChain);
  const withdraw = useWithdraw(selectedChain);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [withdrawTo, setWithdrawTo] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isWalletDropDown = WALLET_DISPLAY.active === 'drop_down';
  const isWalletPanel = WALLET_DISPLAY.active === 'panel';

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedChain = localStorage.getItem('selectedChain');
      if (storedChain && storedChain in CHAINS) {
        setSelectedChain(storedChain as ChainKey);
      }
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
        setIsWalletOpen(false);
        setIsDevOpen(false);
        setIsNetworkOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useClientEffect(() => {
    const controller = new AbortController();

    const run = async () => {
      if (!authenticated) {
        setEthBalance('0');
        setUsdcBalance('0');
        setWethBalance('0');
        setDaiBalance('0');
        setEvmAddress('');
        setIsWalletPanelOpen(false);
        if (typeof window !== 'undefined') {
          localStorage.removeItem(cachedEvmKey);
        }
        return;
      }

      const token = typeof window !== 'undefined' ? localStorage.getItem('privy:token') : null;
      const cachedAddress = typeof window !== 'undefined' ? localStorage.getItem(cachedEvmKey) : null;
      if (!token && !cachedAddress) return;

      try {
        const res = await fetch('/api/balances', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ accessToken: token, chain: selectedChain, walletAddress: cachedAddress ?? undefined }),
          signal: controller.signal,
        });

        const data = await res.json();
        if (data?.eth) setEthBalance(data.eth);
        if (data?.usdc) setUsdcBalance(data.usdc);
        if (data?.weth) setWethBalance(data.weth);
        if (data?.dai) setDaiBalance(data.dai);
        if (data?.address) {
          setEvmAddress(data.address);
          if (typeof window !== 'undefined') {
            localStorage.setItem(cachedEvmKey, data.address);
          }
        }
      } catch {
        setEthBalance('0');
        setUsdcBalance('0');
        setWethBalance('0');
        setDaiBalance('0');
        setEvmAddress('');
      }
    };

    run();

    if (typeof window !== 'undefined') {
      window.addEventListener('altair:wallet-open', run);
    }

    const handleSwapComplete = (event: Event) => {
      const detail = (event as CustomEvent).detail as { chain?: ChainKey } | undefined;
      if (detail?.chain && detail.chain !== selectedChain) return;
      run();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('altair:swap-complete', handleSwapComplete);
    }

    return () => {
      controller.abort();
      if (typeof window !== 'undefined') {
        window.removeEventListener('altair:swap-complete', handleSwapComplete);
        window.removeEventListener('altair:wallet-open', run);
      }
    };
  }, [authenticated, selectedChain, setEthBalance, setUsdcBalance, setWethBalance, setDaiBalance, setEvmAddress]);

  if (!authenticated) return null;

  const showSwapMessage = (message: { type: 'success' | 'error'; text: string }) => {
    setSwapMessage(message);
    window.setTimeout(() => {
      setSwapMessage((current) => (current === message ? null : current));
    }, 6000);
  };

  return (
    <div className="relative flex items-center gap-3" ref={menuRef}>
      {swapMessage && (
        <div
          className={`absolute right-0 top-12 z-[110] w-64 rounded-xl border px-4 py-3 text-xs shadow-2xl whitespace-pre-wrap break-words ${
            swapMessage.type === 'success'
              ? 'bg-emerald-900/90 border-emerald-700 text-emerald-100'
              : 'bg-red-900/90 border-red-700 text-red-100'
          }`}
        >
          {swapMessage.text}
        </div>
      )}
      {/* Dev tools dropdown */}
      <div className="relative">
        <button
          onClick={() => {
        setIsDevOpen(!isDevOpen);
        setIsWalletOpen(false);
        setIsProfileOpen(false);
        setIsNetworkOpen(false);
      }}
          title="Dev Tools"
          className="flex items-center justify-center rounded-full border-[var(--border-color)] hover:border-[var(--highlight-color)] transition-all shadow-md cursor-pointer"
          style={{
            width: `${MENU_ICONS.size * 4 * 1.6}px`,
            height: `${MENU_ICONS.size * 4 * 1.6}px`,
            backgroundColor: MENU_ICONS.container_color,
            borderColor: isDevOpen ? MENU_ICONS.highlight_color : undefined,
            borderWidth: `${MENU_ICONS.border_width}px`,
            boxSizing: 'content-box',
            ['--border-color' as never]: MENU_ICONS.border_color,
            ['--highlight-color' as never]: MENU_ICONS.highlight_color,
          }}
        >
          <Wrench
            className=""
            style={{ width: `${MENU_ICONS.size * 4}px`, height: `${MENU_ICONS.size * 4}px` }}
            color={MENU_ICONS.icon_color}
          />
        </button>
        {isDevOpen && (
          <div className="absolute right-0 mt-3 w-48 rounded-xl bg-gray-900 border border-gray-700 shadow-2xl z-[100] overflow-hidden flex flex-col">
            <button
              onClick={async () => {
                setIsSwapping(true);
                try {
                  const txHash = await executeSwap('ETH', '0.000001', 'USDC');
                  console.log('[Test Swap] Swap complete:', txHash);
                  showSwapMessage({
                    type: 'success',
                    text: `Swap complete.\n${txHash}`,
                  });
                } catch (error) {
                  console.error('[Test Swap] Swap failed:', error);
                  const message = error instanceof Error ? error.message : 'Swap failed';
                  showSwapMessage({
                    type: 'error',
                    text: message,
                  });
                } finally {
                  setIsSwapping(false);
                  setIsDevOpen(false);
                }
              }}
              disabled={isSwapping}
              className="flex w-full items-center px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 transition-colors text-left"
            >
              <span className="flex-1">Test Swap: 0.000001 ETH for USDC</span>
            </button>
            <div className="h-[1px] bg-gray-700 w-full" />
            <button
              onClick={async () => {
                setIsSwapping(true);
                try {
                  const txHash = await executeSwap('ETH', '0.000001', 'WETH');
                  console.log('[Test Swap] Swap complete:', txHash);
                  showSwapMessage({
                    type: 'success',
                    text: `Swap complete.\n${txHash}`,
                  });
                } catch (error) {
                  console.error('[Test Swap] Swap failed:', error);
                  const message = error instanceof Error ? error.message : 'Swap failed';
                  showSwapMessage({
                    type: 'error',
                    text: message,
                  });
                } finally {
                  setIsSwapping(false);
                  setIsDevOpen(false);
                }
              }}
              disabled={isSwapping}
              className="flex w-full items-center px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 transition-colors text-left"
            >
              <span className="flex-1">Test Swap: 0.000001 ETH for WETH</span>
            </button>
            <div className="h-[1px] bg-gray-700 w-full" />
            <button
              onClick={async () => {
                setIsSwapping(true);
                try {
                  const txHash = await executeSwap('WETH', '0.000001', 'USDC');
                  console.log('[Test Swap] Swap complete:', txHash);
                  showSwapMessage({
                    type: 'success',
                    text: `Swap complete.\n${txHash}`,
                  });
                } catch (error) {
                  console.error('[Test Swap] Swap failed:', error);
                  const message = error instanceof Error ? error.message : 'Swap failed';
                  showSwapMessage({
                    type: 'error',
                    text: message,
                  });
                } finally {
                  setIsSwapping(false);
                  setIsDevOpen(false);
                }
              }}
              disabled={isSwapping}
              className="flex w-full items-center px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 transition-colors text-left"
            >
              <span className="flex-1">Test Swap: 0.000001 WETH for USDC</span>
            </button>
            <div className="h-[1px] bg-gray-700 w-full" />
            <button
              onClick={async () => {
                setIsSwapping(true);
                try {
                  const txHash = await executeSwap('WETH', '0.00001', 'USDC');
                  console.log('[Test Swap] Swap complete:', txHash);
                  showSwapMessage({
                    type: 'success',
                    text: `Swap complete.\n${txHash}`,
                  });
                } catch (error) {
                  console.error('[Test Swap] Swap failed:', error);
                  const message = error instanceof Error ? error.message : 'Swap failed';
                  showSwapMessage({
                    type: 'error',
                    text: message,
                  });
                } finally {
                  setIsSwapping(false);
                  setIsDevOpen(false);
                }
              }}
              disabled={isSwapping}
              className="flex w-full items-center px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 transition-colors text-left"
            >
              <span className="flex-1">Test Swap: 0.00001 WETH for USDC</span>
            </button>
            <div className="h-[1px] bg-gray-700 w-full" />
            <button
              onClick={() => setIsDevOpen(false)}
              className="flex w-full items-center px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 transition-colors text-left"
            >
              <span className="flex-1">Test Withdraw</span>
            </button>
          </div>
        )}
      </div>

      {/* Network dropdown */}
      <div className="relative">
        <button
          onClick={() => {
            setIsNetworkOpen(!isNetworkOpen);
            setIsWalletOpen(false);
            setIsProfileOpen(false);
            setIsDevOpen(false);
          }}
          title="Switch Chain"
          className="flex items-center justify-center rounded-full border-[var(--border-color)] hover:border-[var(--highlight-color)] transition-all shadow-md cursor-pointer"
          style={{
            width: `${MENU_ICONS.size * 4 * 1.6}px`,
            height: `${MENU_ICONS.size * 4 * 1.6}px`,
            backgroundColor: MENU_ICONS.container_color,
            borderColor: isNetworkOpen ? MENU_ICONS.highlight_color : undefined,
            borderWidth: `${MENU_ICONS.border_width}px`,
            boxSizing: 'content-box',
            ['--border-color' as never]: MENU_ICONS.border_color,
            ['--highlight-color' as never]: MENU_ICONS.highlight_color,
          }}
        >
          <Globe2
            className=""
            style={{ width: `${MENU_ICONS.size * 4}px`, height: `${MENU_ICONS.size * 4}px` }}
            color={MENU_ICONS.icon_color}
          />
        </button>
        {isNetworkOpen && (
          <div className="absolute right-0 mt-3 w-48 rounded-xl bg-gray-900 border border-gray-700 shadow-2xl z-[100] overflow-hidden flex flex-col">
            {[{ label: 'ETH Mainnet', key: 'ETH_MAINNET' as ChainKey }, { label: 'Sepolia Testnet', key: 'ETH_SEPOLIA' as ChainKey }, { label: 'Base Mainnet', key: 'BASE_MAINNET' as ChainKey }, { label: 'Base Testnet', key: 'BASE_SEPOLIA' as ChainKey }, { label: 'Solana Mainnet', key: null as ChainKey | null }].map(({ label, key }) => {
              const isSelected = key ? selectedChain === key : false;
              const handleClick = () => {
                if (!key) {
                  setIsNetworkOpen(false);
                  return;
                }
                setSelectedChain(key);
                if (typeof window !== 'undefined') {
                  localStorage.setItem('selectedChain', key);
                }
                setIsNetworkOpen(false);
              };
              return (
                <button
                  key={label}
                  onClick={handleClick}
                  className="flex w-full items-center px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 transition-colors text-left cursor-pointer"
                >
                  <span className="mr-3 w-4 flex justify-center">{isSelected ? <Check className="w-4 h-4 text-white" /> : null}</span>
                  <span className="flex-1">{label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Wallet dropdown */}
      <div className="relative">
        <button
          onClick={() => {
            if (isWalletDropDown) {
              setIsWalletOpen(!isWalletOpen);
            }
            if (isWalletPanel) {
              setIsWalletPanelOpen((current) => !current);
            }
            setIsProfileOpen(false);
            setIsDevOpen(false);
            setIsNetworkOpen(false);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new Event('altair:wallet-open'));
            }
          }}
          title="Wallet"
          className="flex items-center justify-center rounded-full border-[var(--border-color)] hover:border-[var(--highlight-color)] transition-all shadow-md cursor-pointer"
          style={{
            width: `${MENU_ICONS.size * 4 * 1.6}px`,
            height: `${MENU_ICONS.size * 4 * 1.6}px`,
            borderColor:
              (isWalletDropDown && isWalletOpen) || (isWalletPanel && isWalletPanelOpen)
                ? MENU_ICONS.highlight_color
                : undefined,
            backgroundColor: MENU_ICONS.container_color,
            borderWidth: `${MENU_ICONS.border_width}px`,
            boxSizing: 'content-box',
            ['--border-color' as never]: MENU_ICONS.border_color,
            ['--highlight-color' as never]: MENU_ICONS.highlight_color,
          }}
        >
          <Wallet
            className=""
            style={{ width: `${MENU_ICONS.size * 4}px`, height: `${MENU_ICONS.size * 4}px` }}
            color={MENU_ICONS.icon_color}
          />
        </button>
            {isWalletDropDown && isWalletOpen && (
          <div className="absolute right-0 mt-3 w-48 rounded-xl bg-gray-900 border border-gray-700 shadow-2xl z-[100] overflow-hidden flex flex-col">
            <div className="flex w-full items-center px-4 py-3 text-sm text-gray-300 break-all">
              <button
                type="button"
                onClick={() => {
                  if (evmAddress) navigator.clipboard?.writeText(evmAddress).catch(() => {});
                }}
                className="text-left cursor-pointer"
                title={evmAddress || 'Unknown'}
              >
                <Copy className="w-4 h-4" />
              </button>
              <span className="text-gray-100 px-3 text-right flex-1 text-sm" title={evmAddress || 'Unknown'}>
                {evmAddress ? `${evmAddress.slice(0, 6)}...${evmAddress.slice(-4)}` : '—'}
              </span>
            </div>
            <div className="h-[1px] bg-gray-700 w-full" />
            <div className="flex w-full items-center px-4 py-3 text-sm text-gray-300">
              <span className="flex-1">ETH</span>
              <span
                className="text-gray-100 px-3 text-center whitespace-nowrap hover:whitespace-normal"
                title={ethBalance}
              >
                {Number.isNaN(Number(ethBalance))
                  ? ethBalance
                  : Number(ethBalance).toFixed(BALANCE_DECIMALS)}
              </span>
            </div>
            <div className="h-[1px] bg-gray-700 w-full" />
            <div className="flex w-full items-center px-4 py-3 text-sm text-gray-300">
              <span className="flex-1">USDC</span>
              <span
                className="text-gray-100 px-3 text-center whitespace-nowrap hover:whitespace-normal"
                title={usdcBalance}
              >
                {Number.isNaN(Number(usdcBalance))
                  ? usdcBalance
                  : Number(usdcBalance).toFixed(BALANCE_DECIMALS)}
              </span>
            </div>
            <div className="h-[1px] bg-gray-700 w-full" />
            <div className="flex w-full items-center px-4 py-3 text-sm text-gray-300">
              <span className="flex-1">WETH</span>
              <span
                className="text-gray-100 px-3 text-center whitespace-nowrap hover:whitespace-normal"
                title={wethBalance}
              >
                {Number.isNaN(Number(wethBalance))
                  ? wethBalance
                  : Number(wethBalance).toFixed(BALANCE_DECIMALS)}
              </span>
            </div>
            <div className="h-[1px] bg-gray-700 w-full" />
            <div className="flex w-full items-center px-4 py-3 text-sm text-gray-300">
              <span className="flex-1">DAI</span>
              <span
                className="text-gray-100 px-3 text-center whitespace-nowrap hover:whitespace-normal"
                title={daiBalance}
              >
                {Number.isNaN(Number(daiBalance))
                  ? daiBalance
                  : Number(daiBalance).toFixed(BALANCE_DECIMALS)}
              </span>
            </div>
            <div className="h-[1px] bg-gray-700 w-full" />
            <button
              type="button"
              onClick={() => {
                setIsWithdrawOpen(true);
                setWithdrawError(null);
                setWithdrawTo('');
                setWithdrawAmount('');
                setIsWalletOpen(false);
              }}
              className="flex w-full items-center px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 transition-colors text-left"
            >
              <ArrowUpRight className="w-4 h-4 mr-3" />
              Withdraw
            </button>
          </div>
        )}
      </div>

      {isWalletPanel && isWalletPanelOpen && (
        <div className="absolute right-0 top-full mt-3 w-64 rounded-xl bg-gray-900 border border-gray-700 shadow-2xl z-[90] overflow-hidden flex flex-col">
          <button
            type="button"
            onClick={() => setIsWalletPanelOpen(false)}
            aria-label="Close wallet panel"
            className="absolute right-2 top-0 text-gray-400 hover:text-gray-200 cursor-pointer"
            style={{ fontSize: `${X_SIZE}px` }}
          >
            ×
          </button>
          <div className="flex w-full items-center px-4 py-3 text-sm text-gray-300 break-all">
            <button
              type="button"
              onClick={() => {
                if (evmAddress) navigator.clipboard?.writeText(evmAddress).catch(() => {});
              }}
              className="text-left cursor-pointer"
              title={evmAddress || 'Unknown'}
            >
              <Copy className="w-4 h-4" />
            </button>
            <span className="text-gray-100 px-3 text-right flex-1 text-sm" title={evmAddress || 'Unknown'}>
              {evmAddress ? `${evmAddress.slice(0, 6)}...${evmAddress.slice(-4)}` : '—'}
            </span>
          </div>
          <div className="h-[1px] bg-gray-700 w-full" />
          <div className="flex w-full items-center px-4 py-3 text-sm text-gray-300">
            <span className="flex-1">ETH</span>
            <span
              className="text-gray-100 px-3 text-center whitespace-nowrap hover:whitespace-normal"
              title={ethBalance}
            >
              {Number.isNaN(Number(ethBalance))
                ? ethBalance
                : Number(ethBalance).toFixed(BALANCE_DECIMALS)}
            </span>
          </div>
          <div className="h-[1px] bg-gray-700 w-full" />
          <div className="flex w-full items-center px-4 py-3 text-sm text-gray-300">
            <span className="flex-1">USDC</span>
            <span
              className="text-gray-100 px-3 text-center whitespace-nowrap hover:whitespace-normal"
              title={usdcBalance}
            >
              {Number.isNaN(Number(usdcBalance))
                ? usdcBalance
                : Number(usdcBalance).toFixed(BALANCE_DECIMALS)}
            </span>
          </div>
          <div className="h-[1px] bg-gray-700 w-full" />
          <div className="flex w-full items-center px-4 py-3 text-sm text-gray-300">
            <span className="flex-1">WETH</span>
            <span
              className="text-gray-100 px-3 text-center whitespace-nowrap hover:whitespace-normal"
              title={wethBalance}
            >
              {Number.isNaN(Number(wethBalance))
                ? wethBalance
                : Number(wethBalance).toFixed(BALANCE_DECIMALS)}
            </span>
          </div>
          <div className="h-[1px] bg-gray-700 w-full" />
          <div className="flex w-full items-center px-4 py-3 text-sm text-gray-300">
            <span className="flex-1">DAI</span>
            <span
              className="text-gray-100 px-3 text-center whitespace-nowrap hover:whitespace-normal"
              title={daiBalance}
            >
              {Number.isNaN(Number(daiBalance))
                ? daiBalance
                : Number(daiBalance).toFixed(BALANCE_DECIMALS)}
            </span>
          </div>
          <div className="h-[1px] bg-gray-700 w-full" />
          <button
            type="button"
            onClick={() => {
              setIsWithdrawOpen(true);
              setWithdrawError(null);
              setWithdrawTo('');
              setWithdrawAmount('');
              setIsWalletPanelOpen(false);
            }}
            className="flex w-full items-center px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 transition-colors text-left"
          >
            <ArrowUpRight className="w-4 h-4 mr-3" />
            Withdraw
          </button>
        </div>
      )}

      {/* Withdraw modal */}
      {isWithdrawOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60"
          onClick={() => !isWithdrawing && setIsWithdrawOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-gray-900 border border-gray-700 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white mb-1">Withdraw ETH</h3>
            <p className="text-sm text-gray-400 mb-4">
              Send native ETH on {selectedChain.replace(/_/g, ' ')} to an address.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Recipient address</label>
                <input
                  value={withdrawTo}
                  onChange={(e) => {
                    setWithdrawTo(e.target.value.trim());
                    setWithdrawError(null);
                  }}
                  placeholder="0x..."
                  className="w-full rounded-lg bg-gray-800 border border-gray-600 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                  disabled={isWithdrawing}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Amount (ETH)</label>
                <div className="flex gap-2 items-center">
                  <button
                    type="button"
                    onClick={() => {
                      const bal = Number(ethBalance);
                      const gasBuffer = 0.001;
                      const max =
                        Number.isFinite(bal) && bal > gasBuffer ? bal - gasBuffer : bal > 0 ? bal : 0;
                      setWithdrawAmount(max > 0 ? String(Math.max(0, max)) : '');
                      setWithdrawError(null);
                    }}
                    disabled={isWithdrawing}
                    className="text-xs text-blue-400 hover:text-blue-300 font-medium disabled:opacity-50"
                  >
                    Max
                  </button>
                </div>
                <input
                  value={withdrawAmount}
                  onChange={(e) => {
                    setWithdrawAmount(e.target.value);
                    setWithdrawError(null);
                  }}
                  placeholder="0.01"
                  className="w-full rounded-lg bg-gray-800 border border-gray-600 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none mt-1"
                  disabled={isWithdrawing}
                />
              </div>
              {withdrawError && (
                <p className="text-sm text-red-400">{withdrawError}</p>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => !isWithdrawing && setIsWithdrawOpen(false)}
                className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 text-sm"
                disabled={isWithdrawing}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setWithdrawError(null);
                  const to = withdrawTo.trim();
                  const amount = withdrawAmount.trim();
                  if (!to) {
                    setWithdrawError('Enter a recipient address.');
                    return;
                  }
                  if (!ethers.isAddress(to)) {
                    setWithdrawError('Invalid EVM address.');
                    return;
                  }
                  const num = Number(amount);
                  if (!Number.isFinite(num) || num <= 0) {
                    setWithdrawError('Enter a valid amount (ETH).');
                    return;
                  }
                  setIsWithdrawing(true);
                  try {
                    const txHash = await withdraw(to, amount);
                    showSwapMessage({ type: 'success', text: `Withdrawal sent.\n${txHash}` });
                    setIsWithdrawOpen(false);
                    setWithdrawTo('');
                    setWithdrawAmount('');
                    setTimeout(() => {
                      const token = typeof window !== 'undefined' ? localStorage.getItem('privy:token') : null;
                      const cached = typeof window !== 'undefined' ? localStorage.getItem(cachedEvmKey) : null;
                      fetch('/api/balances', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                          accessToken: token,
                          chain: selectedChain,
                          walletAddress: cached ?? undefined,
                        }),
                      })
                        .then((res) => res.json())
                        .then((data) => {
                          if (data?.eth) setEthBalance(data.eth);
                          if (data?.usdc) setUsdcBalance(data.usdc);
                        })
                        .catch(() => {});
                    }, 2000);
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : 'Withdrawal failed';
                    setWithdrawError(msg);
                  } finally {
                    setIsWithdrawing(false);
                  }
                }}
                disabled={isWithdrawing}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm disabled:opacity-50"
              >
                {isWithdrawing ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative">
        <button
          onClick={() => {
            setIsProfileOpen(!isProfileOpen);
            setIsWalletOpen(false);
          }}
          title="Profile"
          className="flex items-center justify-center rounded-full border-[var(--border-color)] hover:border-[var(--highlight-color)] transition-all shadow-md cursor-pointer"
          style={{
            width: `${MENU_ICONS.size * 4 * 1.6}px`,
            height: `${MENU_ICONS.size * 4 * 1.6}px`,
            backgroundColor: MENU_ICONS.container_color,
            borderColor: isProfileOpen ? MENU_ICONS.highlight_color : undefined,
            borderWidth: `${MENU_ICONS.border_width}px`,
            boxSizing: 'content-box',
            ['--border-color' as never]: MENU_ICONS.border_color,
            ['--highlight-color' as never]: MENU_ICONS.highlight_color,
          }}
        >
          <UserRound
            className=""
            style={{ width: `${MENU_ICONS.size * 4}px`, height: `${MENU_ICONS.size * 4}px` }}
            color={MENU_ICONS.icon_color}
          />
        </button>

        {isProfileOpen && (
          // right-0 ensures the menu grows to the left, staying on screen
          <div className="absolute right-0 mt-3 w-48 rounded-xl bg-gray-900 border border-gray-700 shadow-2xl z-[100] overflow-hidden flex flex-col">
            <button
              onClick={() => { alert('Coming soon!'); setIsProfileOpen(false); }}
              className="flex w-full items-center px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 transition-colors text-left"
            >
              <Settings className="w-4 h-4 mr-3" />
              <span className="flex-1">Edit Profile</span>
            </button>
            
            <div className="h-[1px] bg-gray-700 w-full" />
            
            <button
              onClick={() => { logout(); setIsProfileOpen(false); }}
              className="flex w-full items-center px-4 py-3 text-sm text-red-400 hover:bg-gray-800 transition-colors text-left"
            >
              <LogOut className="w-4 h-4 mr-3" />
              <span className="flex-1">Log Out</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

