import { SWAP_SUBMITTED } from './ui_messages';

export const LLM_MODELS = {
  runningSummary: [
    //  'llama-3.3-70b-versatile',
    //  'qwen3-32b',
    //  'openai/gpt-oss-20b',
    //  'openai/gpt-oss-120b',
    //  'llama-3.1-8b-instant',
     'grok-4-fast',
     'grok-4',
     'gpt-4o-mini'], // model fallback order for generating running chat summaries in Altair
  mainChat: [
    //  'llama-3.3-70b-versatile',
    //  'qwen3-32b',
    //  'openai/gpt-oss-20b',
    //  'openai/gpt-oss-120b',
    //  'llama-3.1-8b-instant',
     'grok-4-fast',
     'grok-4',
     'gpt-4o-mini'], // primary assistant response models for the trading assistant experience
  options: {
    // OpenAI Models
    'gpt-4o-mini': 'OpenAI', // map model ID to provider for API routing
    'gpt-4o': 'OpenAI', // map model ID to provider for API routing
    'gpt-4.1': 'OpenAI', // map model ID to provider for API routing
    'gpt-4.1-mini': 'OpenAI', // map model ID to provider for API routing
    'gpt-4.1-nano': 'OpenAI', // map model ID to provider for API routing
    'o4-mini': 'OpenAI', // map model ID to provider for API routing
    'o3-mini': 'OpenAI', // map model ID to provider for API routing
    
    // Anthropic Models
    'claude-3-5-sonnet-20241022': 'Anthropic', // map model ID to provider for API routing
    'claude-3-5-haiku-20241022': 'Anthropic', // map model ID to provider for API routing
    'claude-3-opus-20240229': 'Anthropic', // map model ID to provider for API routing
    'claude-3-sonnet-20240229': 'Anthropic', // map model ID to provider for API routing
    'claude-3-haiku-20240307': 'Anthropic', // map model ID to provider for API routing
    
    // Google Models
    'gemini-1.5-pro': 'Google', // map model ID to provider for API routing
    'gemini-1.5-flash': 'Google', // map model ID to provider for API routing
    'gemini-1.5-flash-8b': 'Google', // map model ID to provider for API routing
    
    // Perplexity Models
    'sonar': 'Perplexity', // map model ID to provider for API routing
    'sonar-pro': 'Perplexity', // map model ID to provider for API routing
    'sonar-reasoning': 'Perplexity', // map model ID to provider for API routing
    'sonar-reasoning-pro': 'Perplexity', // map model ID to provider for API routing
    
    // XAI Models
    'grok-4': 'X', // map model ID to provider for API routing
    'grok-4-fast': 'X', // map model ID to provider for API routing
    'grok-4-fast-reasoning': 'X', // map model ID to provider for API routing
    'grok-4-fast-non-reasoning': 'X', // map model ID to provider for API routing
    'grok-4-1-fast-reasoning': 'X', // map model ID to provider for API routing
    'grok-code-fast-1': 'X', // map model ID to provider for API routing
    'grok-3': 'X', // map model ID to provider for API routing
    'grok-3-mini': 'X', // map model ID to provider for API routing
    'grok-2': 'X', // map model ID to provider for API routing
    'grok-2-mini': 'X', // map model ID to provider for API routing

    // Groq Models
    'llama-3.1-8b-instant': 'Groq',
    'llama-4-scout-17b-16e-instruct': 'Groq',
    'openai/gpt-oss-20b': 'Groq',
    'openai/gpt-oss-120b': 'Groq',
    'llama-3.3-70b-versatile': 'Groq',
    'qwen3-32b': 'Groq',
  },
};

export const PROVIDER_KEYS = {
  'X': 'XAI_API_KEY', // env var containing X/XAI credentials for Altair's LLM calls
  'OpenAI': 'OPENAI_API_KEY', // env var containing OpenAI credentials for Altair's LLM calls
  'Anthropic': 'ANTHROPIC_API_KEY', // env var containing Anthropic credentials for Altair's LLM calls
  'Google': 'GOOGLE_API_KEY', // env var containing Google AI credentials for Altair's LLM calls
  'Perplexity': 'PERPLEXITY_API_KEY', // env var containing Perplexity credentials for Altair's LLM calls
  'Groq': 'GROQ_API_KEY',
};

export const PROVIDER_BASE_URLS: Partial<Record<keyof typeof PROVIDER_KEYS, string>> = {
  X: 'https://api.x.ai/v1', // custom base URL for xAI/Grok; all other providers use the OpenAI SDK default
  Groq: 'https://api.groq.com/openai/v1', // custom base URL for Groq; required for OpenAI SDK compatibility
};

export const INTENTS = {
  SWAP_INTENTS: {
    SINGLE_CHAIN_SWAP_INTENT: `If you only need to signal execution for a same-chain swap, return JSON:
      { "type": "SINGLE_CHAIN_SWAP_INTENT", "sell": "<SELL_TOKEN>", "buy": "<BUY_TOKEN>", "amount": "<AMOUNT>" }`,
    CROSS_CHAIN_SWAP_INTENT: `If the user specifies different source and destination chains for a swap, return JSON:
      { "type": "CROSS_CHAIN_SWAP_INTENT", "sell": "<SELL_TOKEN>", "buy": "<BUY_TOKEN>", "amount": "<AMOUNT>", "sellTokenChain": "<SELL_TOKEN_CHAIN>", "buyTokenChain": "<BUY_TOKEN_CHAIN>" }`,
    BRIDGE_INTENT: `If the user wants to bridge a token (same token across chains), return JSON:
      { "type": "BRIDGE_INTENT", "sell": "<SELL_TOKEN>", "amount": "<AMOUNT>", "sellTokenChain": "<SELL_TOKEN_CHAIN>", "buyTokenChain": "<BUY_TOKEN_CHAIN>" }`,
  },
  // DEFI_INTENTS {
  //    deposit/withdraw into LP
  //    deposit/withdraw loan}
  // UI_INTENTS {
  //    BUTTONS}
};

export const CHAT_BUTTON_ROW_TEMPLATES = {
  CONFIRM_SWAP: {
    intentTriggers: ['SWAP_INTENTS'],
    responseList: SWAP_SUBMITTED,
    buttons: [
      {
        id: 'confirm',
        label: 'Confirm',
        action: {
          kind: 'RUN_LOCAL',
          actionId: 'CONFIRM_SWAP',
          presetAssistantMessage: 'Swap confirmed!',
        },
      },
      {
        id: 'cancel',
        label: 'Cancel',
        action: {
          kind: 'RUN_LOCAL',
          actionId: 'CANCEL_SWAP',
          presetAssistantMessage: 'Swap canceled.',
        },
      },
    ],
  },
  SWAP_FOLLOWUP: {
    intentTriggers: [],
    logicTriggers: ['TRANSACTION_SUBMITTED'],
    responseList: [],
    buttons: [
      {
        id: 'start-earning',
        label: 'Earn with TOKEN',
        action: {
          kind: 'RUN_LOCAL',
          actionId: 'START_EARNING',
          presetAssistantMessage: 'Starting earning flow…',
        },
      },
      {
        id: 'learn-more',
        label: 'Learn About TOKEN',
        action: {
          kind: 'RUN_LOCAL',
          actionId: 'LEARN_MORE',
          presetAssistantMessage: 'Opening token details…',
        },
      },
      {
        id: 'something-else',
        label: 'Something Else',
        action: {
          kind: 'ASK_LLM',
          promptSeed: "The user isn't sure what they want to do next. Suggest practical next steps.",
        },
      },
    ],
  },
} as const;



export const SYSTEM_PROMPT = {
  basePrompt: `
      You are Altair, a friendly cryptocurrency trading assistant.
      Identify: Sell Token, Buy Token, Amount, and any chain references in the user's message.
      Use the injected Selected Chain (from UI) to decide intent:
      - If the user specifies a buy token chain and it differs from the Selected Chain, emit CROSS_CHAIN_SWAP_INTENT.
      - If the user specifies a sell token chain explicitly, emit CROSS_CHAIN_SWAP_INTENT.
      - If the user explicitly says "bridge", emit BRIDGE_INTENT.
      - Otherwise, emit SINGLE_CHAIN_SWAP_INTENT.

      Ask only for missing fields that cannot be inferred from the message or the Selected Chain.

      If you are ready to execute, ask the user for confirmation and include an estimated amount of the buy token they would receive (label it as an estimate). Example:
      "You are about to swap <SELL_AMOUNT> ETH for USDC. Estimated USDC to receive: <BUY_AMOUNT_ESTIMATE> USDC. Do you confirm?"
      Always include the intent JSON when you detect an intent, even before confirmation. Still ask for confirmation before execution.

      ${INTENTS.SWAP_INTENTS.SINGLE_CHAIN_SWAP_INTENT}
      ${INTENTS.SWAP_INTENTS.CROSS_CHAIN_SWAP_INTENT}
      ${INTENTS.SWAP_INTENTS.BRIDGE_INTENT}
      
      Use the user memory context as helpful background, but prioritize the latest user message if there is any conflict.
    `, // core system instruction that defines Altair's trading-assistant persona and swap intent protocol
  contextBlocks: {
    selectedChainBlock: {
      withData: '\nSelected Chain (from UI): ${selectedChain}',
      empty: '\nSelected Chain (from UI): unknown',
    },
    memoryBlock: {
      withData: `\nUser Memory Context (from prior chats; may be stale):\n\${JSON.stringify(memoryContextForPrompt)}`, // injects archived user memory to personalize AI responses
      empty: '\nUser Memory Context: none available yet.', // fallback when no memory exists to ground the AI
    },
    balancesBlock: {
      withData: `\nUser Balances (MongoDB snapshot; may be stale):\n\${JSON.stringify(balanceContextForPrompt)}`, // adds balance context so the AI can reference holdings
      empty: '\nUser Balances: none available yet.', // fallback when balances are unavailable in Altair's datastore
    },
    swapsBlock: {
      withData: `\nRecent Swaps (last 3 from MongoDB; may be stale):\n\${JSON.stringify(swapHistoryContext)}`, // supplies recent swaps for continuity and safety checks
      empty: '\nRecent Swaps: none available yet.', // fallback when no swap history exists
    },
  },
};

export const CHAT_SUMMARY_LATEST = {
  chatQuantity: 20, // number of recent chat turns summarized for AI context in Altair
  source: 'MongoDB' as '0G' | 'MongoDB', // default summary storage source used by the assistant pipeline
  sourceOptions: ['0G', 'MongoDB'] as const, // supported summary storage backends for AI memory
};
