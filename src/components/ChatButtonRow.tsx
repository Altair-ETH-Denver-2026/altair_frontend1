'use client';

import React, { useState } from 'react';
import { CHAT_PANEL } from '../../config/ui_config';
import type { ChatButtonItem, ChatButtonRowModel } from '../lib/chatButtonRows';

type ChatButtonRowProps = {
  row: ChatButtonRowModel;
  disabled?: boolean;
  onAction?: (button: ChatButtonItem, row: ChatButtonRowModel) => void;
};

export default function ChatButtonRow({ row, disabled = false, onAction }: ChatButtonRowProps) {
  const config = CHAT_PANEL.chatButtonRow;
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  if (!row?.buttons?.length) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={`chat-button-row-${row.template}`}>
      {row.buttons.map((button) => {
        const isHovered = hoveredId === button.id;
        const isSelected = row.selectedButtonId === button.id;
        const isActive = isSelected || activeId === button.id;
        const isDisabled = disabled;
        const isLocked = row.isLocked === true;
        const isNativeDisabled = isDisabled || (!isSelected && (isLocked || row.isActive === false));
        const isInteractive = !isNativeDisabled && !isSelected;
        const backgroundColor = isActive
          ? config.activeColor
          : isHovered
            ? config.highlightColor
            : config.buttonColor;
        const borderColor = isActive ? config.activeBorderColor : config.borderColor;

        return (
          <button
            key={button.id}
            type="button"
            disabled={isNativeDisabled}
            onClick={() => {
              if (!isInteractive || isSelected) return;
              onAction?.(button, row);
            }}
            onMouseEnter={() => {
              if (!isInteractive) return;
              setHoveredId(button.id);
            }}
            onMouseLeave={() => {
              setHoveredId((current) => (current === button.id ? null : current));
              setActiveId((current) => (current === button.id ? null : current));
            }}
            onMouseDown={() => {
              if (!isInteractive) return;
              setActiveId(button.id);
            }}
            onMouseUp={() => setActiveId((current) => (current === button.id ? null : current))}
            className="transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              color: config.textColor,
              backgroundColor,
              borderColor,
              borderStyle: 'solid',
              borderWidth: `${config.borderWidth}px`,
              borderRadius: `${config.borderRadius}px`,
              paddingLeft: `${config.paddingLeft}px`,
              paddingRight: `${config.paddingRight}px`,
              paddingTop: `${config.paddingTop}px`,
              paddingBottom: `${config.paddingBottom}px`,
              fontSize: `${config.fontSize}px`,
              fontFamily: config.fontName,
              opacity: isNativeDisabled ? 0.5 : 1,
              cursor: isInteractive && !isSelected ? 'pointer' : 'default',
            }}
          >
            {button.label}
          </button>
        );
      })}
    </div>
  );
}

