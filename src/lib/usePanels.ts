'use client';

import { useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { ChainKey } from '../../config/blockchain_config';

export type WalletPanelState = { id: number; chainKey: ChainKey | 'ALL'; isChainOpen: boolean };

export type UsePanelsParams = {
  initialChain: ChainKey;
};

export type UsePanelsResult = {
  walletPanels: WalletPanelState[];
  setWalletPanels: Dispatch<SetStateAction<WalletPanelState[]>>;
  walletPanelIdRef: MutableRefObject<number>;
  isWalletPanelOpen: boolean;
  setIsWalletPanelOpen: Dispatch<SetStateAction<boolean>>;
  isAddPanelOpen: boolean;
  setIsAddPanelOpen: Dispatch<SetStateAction<boolean>>;
  isAddPanelChainOpen: boolean;
  setIsAddPanelChainOpen: Dispatch<SetStateAction<boolean>>;
  addPanelChain: ChainKey | 'ALL';
  setAddPanelChain: Dispatch<SetStateAction<ChainKey | 'ALL'>>;
  walletPanelHasCustomChain: boolean;
  setWalletPanelHasCustomChain: Dispatch<SetStateAction<boolean>>;
  addPanelHasCustomChain: boolean;
  setAddPanelHasCustomChain: Dispatch<SetStateAction<boolean>>;
  addPanelIconHovered: boolean;
  setAddPanelIconHovered: Dispatch<SetStateAction<boolean>>;
  initWalletPanels: () => void;
  closeWalletPanel: (panelId: number, onCloseLast?: () => void) => void;
  addWalletPanel: (chainKey: ChainKey | 'ALL') => number;
};

export const usePanels = ({ initialChain }: UsePanelsParams): UsePanelsResult => {
  const [isWalletPanelOpen, setIsWalletPanelOpen] = useState(false);
  const [isAddPanelOpen, setIsAddPanelOpen] = useState(true);
  const [isAddPanelChainOpen, setIsAddPanelChainOpen] = useState(false);
  const [addPanelChain, setAddPanelChain] = useState<ChainKey | 'ALL'>('ALL');
  const [walletPanels, setWalletPanels] = useState<WalletPanelState[]>([]);
  const walletPanelIdRef = useRef(0);
  const [walletPanelHasCustomChain, setWalletPanelHasCustomChain] = useState(false);
  const [addPanelHasCustomChain, setAddPanelHasCustomChain] = useState(false);
  const [addPanelIconHovered, setAddPanelIconHovered] = useState(false);

  const initWalletPanels = () => {
    const nextId = walletPanelIdRef.current + 1;
    setWalletPanels((existing) =>
      existing.length > 0
        ? existing
        : [
            {
              id: nextId,
              chainKey: initialChain,
              isChainOpen: false,
            },
          ]
    );
    if (walletPanelIdRef.current < nextId) {
      walletPanelIdRef.current = nextId;
    }
    setWalletPanelHasCustomChain(false);
    setAddPanelChain(initialChain);
    setAddPanelHasCustomChain(false);
    setIsAddPanelOpen(true);
  };

  const closeWalletPanel = (panelId: number, onCloseLast?: () => void) => {
    setWalletPanels((current) => {
      const next = current.filter((entry) => entry.id !== panelId);
      if (next.length === 0) {
        onCloseLast?.();
      }
      return next;
    });
  };

  const addWalletPanel = (chainKey: ChainKey | 'ALL') => {
    const nextId = walletPanelIdRef.current + 1;
    setWalletPanels((current) => [
      ...current,
      {
        id: nextId,
        chainKey,
        isChainOpen: false,
      },
    ]);
    walletPanelIdRef.current = nextId;
    return nextId;
  };

  return {
    walletPanels,
    setWalletPanels,
    walletPanelIdRef,
    isWalletPanelOpen,
    setIsWalletPanelOpen,
    isAddPanelOpen,
    setIsAddPanelOpen,
    isAddPanelChainOpen,
    setIsAddPanelChainOpen,
    addPanelChain,
    setAddPanelChain,
    walletPanelHasCustomChain,
    setWalletPanelHasCustomChain,
    addPanelHasCustomChain,
    setAddPanelHasCustomChain,
    addPanelIconHovered,
    setAddPanelIconHovered,
    initWalletPanels,
    closeWalletPanel,
    addWalletPanel,
  };
};
