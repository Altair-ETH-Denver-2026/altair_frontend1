'use client';

import { CHAT_BUTTON_ROW_TEMPLATES as AI_CHAT_BUTTON_ROW_TEMPLATES } from '../../../altair_backend1/config/ai_config';

export type ChatSwapIntent = {
  type: 'SINGLE_CHAIN_SWAP_INTENT' | 'CROSS_CHAIN_SWAP_INTENT' | 'BRIDGE_INTENT';
  sell: string;
  buy?: string;
  amount: number | string;
  sellTokenChain?: string | null;
  buyTokenChain?: string | null;
};

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

export type ChatButtonRowTemplateKey = 'CONFIRM_SWAP' | 'SWAP_FOLLOWUP';
export type ChatButtonRowLogicTrigger = 'TRANSACTION_SUBMITTED';

export type ChatButtonRowModel = {
  id: string;
  template: ChatButtonRowTemplateKey;
  buttons: ChatButtonItem[];
  context?: {
    intent?: ChatSwapIntent | null;
    cid?: string | null;
  };
  isActive?: boolean;
  isLocked?: boolean;
  selectedButtonId?: string | null;
};

type ChatButtonRowTemplateFactory = (params: {
  intent: ChatSwapIntent;
  cid?: string | null;
}) => ChatButtonRowModel;

const isSwapIntent = (intent: ChatSwapIntent | null): intent is ChatSwapIntent =>
  Boolean(
    intent &&
      (intent.type === 'SINGLE_CHAIN_SWAP_INTENT' ||
        intent.type === 'CROSS_CHAIN_SWAP_INTENT' ||
        intent.type === 'BRIDGE_INTENT')
  );

const buildTemplateFromConfig = (params: {
  template: ChatButtonRowTemplateKey;
  intent: ChatSwapIntent;
  cid?: string | null;
}): ChatButtonRowModel => {
  const templateConfig = CHAT_BUTTON_ROW_TEMPLATES[params.template];
  const tokenLabel = String(params.intent.buy ?? params.intent.sell ?? 'TOKEN').toUpperCase();
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
};

export const buildChatButtonRowFromLogicTrigger = (params: {
  trigger: ChatButtonRowLogicTrigger;
  intent: ChatSwapIntent;
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
  intent: ChatSwapIntent | null;
  cid?: string | null;
}): ChatButtonRowModel | null => {
  if (!isSwapIntent(params.intent)) return null;
  return CHAT_BUTTON_ROW_TEMPLATES.CONFIRM_SWAP({
    intent: params.intent,
    cid: params.cid ?? null,
  });
};

