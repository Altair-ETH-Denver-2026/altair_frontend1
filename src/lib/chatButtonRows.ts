'use client';

import { CHAT_BUTTON_ROW_TEMPLATES as AI_CHAT_BUTTON_ROW_TEMPLATES } from '../../config/ai_config';
import type { ChatLimitOrderIntent } from './limitOrderTypes';
import { isLimitOrderIntent } from './limitOrderTypes';
import type { ChatLendIntent } from './lendTypes';
import { isLendIntent } from './lendTypes';

export type ChatSwapIntent = {
  type: 'SINGLE_CHAIN_SWAP_INTENT' | 'CROSS_CHAIN_SWAP_INTENT' | 'BRIDGE_INTENT';
  sell: string;
  buy?: string;
  amount: number | string;
  sellTokenChain?: string | null;
  buyTokenChain?: string | null;
};

/** Union of all chat intents that can drive a confirm/cancel button row. */
export type ChatActionableIntent = ChatSwapIntent | ChatLimitOrderIntent | ChatLendIntent;

export type ChatButtonAction =
  | {
      kind: 'RUN_LOCAL';
      actionId: string;
      presetAssistantMessage: string;
    }
  | {
      kind: 'ASK_LLM';
      promptSeed: string;
    };

export type ChatButtonItem = {
  id: string;
  label: string;
  action: ChatButtonAction;
};

export type ChatButtonRowTemplateKey =
  | 'CONFIRM_SWAP'
  | 'SWAP_FOLLOWUP'
  | 'CONFIRM_LEND_DEPOSIT'
  | 'CONFIRM_LEND_WITHDRAW'
  | 'CONFIRM_LIMIT_ORDER';
export type ChatButtonRowLogicTrigger = 'TRANSACTION_SUBMITTED';

export type ChatButtonRowModel = {
  id: string;
  template: ChatButtonRowTemplateKey;
  buttons: ChatButtonItem[];
  context?: {
    intent?: ChatActionableIntent | null;
    cid?: string | null;
  };
  isActive?: boolean;
  isLocked?: boolean;
  selectedButtonId?: string | null;
};

type ChatButtonRowTemplateFactory = (params: {
  intent: ChatActionableIntent;
  cid?: string | null;
}) => ChatButtonRowModel;

const isSwapIntent = (intent: ChatActionableIntent | null): intent is ChatSwapIntent =>
  Boolean(
    intent &&
      ((intent as ChatSwapIntent).type === 'SINGLE_CHAIN_SWAP_INTENT' ||
        (intent as ChatSwapIntent).type === 'CROSS_CHAIN_SWAP_INTENT' ||
        (intent as ChatSwapIntent).type === 'BRIDGE_INTENT')
  );

const resolveTokenLabel = (intent: ChatActionableIntent): string => {
  if (isLimitOrderIntent(intent)) {
    return String(intent.side === 'SELL' ? intent.sell : intent.buy ?? intent.sell ?? 'TOKEN').toUpperCase();
  }
  if (isLendIntent(intent)) {
    return String(intent.token ?? 'TOKEN').toUpperCase();
  }
  if (isSwapIntent(intent)) {
    return String(intent.buy ?? intent.sell ?? 'TOKEN').toUpperCase();
  }
  return 'TOKEN';
};

const buildTemplateFromConfig = (params: {
  template: ChatButtonRowTemplateKey;
  intent: ChatActionableIntent;
  cid?: string | null;
}): ChatButtonRowModel => {
  const tokenLabel = resolveTokenLabel(params.intent);
  const templateButtons = AI_CHAT_BUTTON_ROW_TEMPLATES[params.template].buttons;
  return {
    id: `row-${params.template.toLowerCase()}-${Date.now()}`,
    template: params.template,
    isActive: true,
    isLocked: false,
    selectedButtonId: null,
    context: {
      intent: params.intent,
      cid: params.cid ?? null,
    },
    buttons: templateButtons.map((button) => ({
      ...button,
      label: button.label.replace('TOKEN', tokenLabel),
    })),
  };
};

export const CHAT_BUTTON_ROW_TEMPLATES: Record<ChatButtonRowTemplateKey, ChatButtonRowTemplateFactory> = {
  CONFIRM_SWAP: (params) => buildTemplateFromConfig({ template: 'CONFIRM_SWAP', ...params }),
  SWAP_FOLLOWUP: (params) => buildTemplateFromConfig({ template: 'SWAP_FOLLOWUP', ...params }),
  CONFIRM_LIMIT_ORDER: (params) =>
    buildTemplateFromConfig({ template: 'CONFIRM_LIMIT_ORDER', ...params }),
  CONFIRM_LEND_DEPOSIT: (params) => buildTemplateFromConfig({ template: 'CONFIRM_LEND_DEPOSIT', ...params }),
  CONFIRM_LEND_WITHDRAW: (params) => buildTemplateFromConfig({ template: 'CONFIRM_LEND_WITHDRAW', ...params }),
};

export const buildChatButtonRowFromLogicTrigger = (params: {
  trigger: ChatButtonRowLogicTrigger;
  intent: ChatActionableIntent;
  cid?: string | null;
}): ChatButtonRowModel | null => {
  const templates = Object.entries(AI_CHAT_BUTTON_ROW_TEMPLATES) as Array<
    [ChatButtonRowTemplateKey, (typeof AI_CHAT_BUTTON_ROW_TEMPLATES)[ChatButtonRowTemplateKey]]
  >;

  for (const [templateKey, templateConfig] of templates) {
    const rawLogicTriggers =
      'logicTriggers' in templateConfig
        ? (templateConfig as { logicTriggers?: readonly string[] }).logicTriggers
        : undefined;
    const logicTriggers = Array.isArray(rawLogicTriggers)
      ? [...rawLogicTriggers]
      : [];
    if (!logicTriggers.includes(params.trigger)) continue;
    return CHAT_BUTTON_ROW_TEMPLATES[templateKey]({
      intent: params.intent,
      cid: params.cid ?? null,
    });
  }

  return null;
};

export const buildChatButtonRowFromIntent = (params: {
  intent: ChatActionableIntent | null;
  cid?: string | null;
}): ChatButtonRowModel | null => {
  const intent = params.intent;
  if (!intent) return null;

  if (isLendIntent(intent)) {
    const templateKey: ChatButtonRowTemplateKey =
      intent.type === 'LEND_DEPOSIT_INTENT' ? 'CONFIRM_LEND_DEPOSIT' : 'CONFIRM_LEND_WITHDRAW';
    return CHAT_BUTTON_ROW_TEMPLATES[templateKey]({
      intent,
      cid: params.cid ?? null,
    });
  }

  if (isLimitOrderIntent(intent)) {
    return CHAT_BUTTON_ROW_TEMPLATES.CONFIRM_LIMIT_ORDER({
      intent,
      cid: params.cid ?? null,
    });
  }

  if (isSwapIntent(intent)) {
    return CHAT_BUTTON_ROW_TEMPLATES.CONFIRM_SWAP({
      intent,
      cid: params.cid ?? null,
    });
  }

  return null;
};
