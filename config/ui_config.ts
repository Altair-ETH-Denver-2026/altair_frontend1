export const BALANCE_DECIMALS = 8;
export const LOGO_SPIN_MIN_MS = 400;
export const LOGO_SPIN_MAX_MS = 2000;
export const X_SIZE = 25;

export const WALLET_DISPLAY = {
  options: ['panel', 'drop_down'] as const,
  active: 'panel' as 'panel' | 'drop_down',
};

export const MENU_ICONS = {
  x_offset: 3,
  y_offset: 3,
  x_justify: 'right' as 'left' | 'right',
  y_justify: 'top' as 'top' | 'bottom',
  size: 6,
  icon_color: '#dbd1db',
  container_color: '#1f2937',
  border_color: '#374151',
  highlight_color: '#3b82f6',
  border_width: 1,
};

export const HOME_ICON = {
  x_offset: 3,
  y_offset: 3,
  x_justify: 'left' as 'left' | 'right',
  y_justify: 'top' as 'top' | 'bottom',
  size: 15,
};

export const TITLE_PANEL = {
  x_offset: 0,
  y_offset: 0,
  logo_size: 23,
  text_color: '#9ca3af',
  size: 1,
  text_spacing: -1,
  title_gradient: {
    color_start: '#60a5fa',
    color_end: '#9333ea',
  },
};

export const CHAT_PANEL = {
  container_color: '#11182780',
  border_color: '#1f2937',
  border_width: 1,
  user_chat_container_color: '#2563eb',
  agent_chat_container_color: '#1f2937',
  user_chat_text_color: '#ffffff',
  agent_chat_text_color: '#e5e7eb',
  width: 672,
  height: 500,
  agent_icon_border_color: '#374151',
  chat_highlight_color: '#3b82f6',
  chat_button_container_color: '#2563eb',
  chat_button_icon_color: '#ffffff',
};

