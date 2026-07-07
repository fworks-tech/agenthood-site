"use client";

import { useState, useRef, useEffect } from "react";
import { Textarea, ActionIcon, Alert, Group } from "@mantine/core";
import { IconSquare, IconSend, IconInfoCircle } from "@tabler/icons-react";
import HelpTip from "./HelpTip";

interface ChatComposerProps {
  onSend: (content: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export default function ChatComposer({ onSend, onStop, isStreaming, disabled }: ChatComposerProps) {
  const [input, setInput] = useState("");
  const [imageWarning, setImageWarning] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const warningTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isStreaming && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isStreaming]);

  const showWarning = (msg: string) => {
    setImageWarning(msg);
    if (warningTimeout.current) clearTimeout(warningTimeout.current);
    warningTimeout.current = setTimeout(() => setImageWarning(null), 5000);
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming || disabled) return;
    onSend(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        e.preventDefault();
        showWarning("This model does not support image input. Text only.");
        return;
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    const files = e.dataTransfer.files;
    for (let i = 0; i < files.length; i++) {
      if (files[i].type.startsWith("image/")) {
        e.preventDefault();
        showWarning("This model does not support image input. Text only.");
        return;
      }
    }
  };

  return (
    <div className="border-t border-zinc-800 bg-zinc-950 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
      {imageWarning && (
        <div className="mx-auto mb-2 max-w-3xl">
          <Alert
            variant="outline"
            color="yellow"
            icon={<IconInfoCircle size={16} />}
            py="xs"
            px="sm"
          >
            <Group gap="xs">
              {imageWarning}
              <HelpTip text="This provider only supports text input. Images are ignored." side="right" />
            </Group>
          </Alert>
        </div>
      )}
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          placeholder="Type a message..."
          minRows={1}
          maxRows={4}
          disabled={isStreaming || disabled}
          className="flex-1"
          autosize
        />

        {isStreaming ? (
          <Group gap={4}>
            <ActionIcon
              onClick={onStop}
              size="lg"
              variant="filled"
              color="red"
              aria-label="Stop streaming"
            >
              <IconSquare size={16} />
            </ActionIcon>
            <HelpTip text="Halts the currently streaming response. The partial response remains visible." side="right" />
          </Group>
        ) : (
          <Group gap={4}>
            <ActionIcon
              onClick={handleSend}
              disabled={!input.trim() || disabled}
              size="lg"
              variant="filled"
              color="emerald"
              aria-label="Send message"
            >
              <IconSend size={16} />
            </ActionIcon>
            <HelpTip text="Sends your message. Press Enter to send, Shift+Enter for a new line." side="right" />
          </Group>
        )}
      </div>
    </div>
  );
}
