'use client';

import { useState, useRef, useEffect } from 'react';
import { ArrowUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
} from '@/components/ui/prompt-input';

interface AssistantInputProps {
  onSubmit: (message: string) => Promise<void> | void;
  isLoading: boolean;
  disabled?: boolean;
  disabledMessage?: string;
  placeholder?: string;
}

export function AssistantInput({
  onSubmit,
  isLoading,
  disabled = false,
  disabledMessage,
  placeholder = 'Message TaskFlow...',
}: AssistantInputProps) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const wasLoadingRef = useRef(false);

  // Focus input when loading completes
  useEffect(() => {
    if (wasLoadingRef.current && !isLoading) {
      // Loading just completed, focus the input
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
    wasLoadingRef.current = isLoading;
  }, [isLoading]);

  const handleSubmit = () => {
    if (!input.trim() || isLoading || disabled) return;
    const nextMessage = input.trim();
    setInput('');
    void onSubmit(nextMessage);
  };

  return (
    <div className="border-t border-white/8 bg-[#131313]/96 px-2.5 pt-3 pb-5 backdrop-blur safe-area-bottom sm:px-3">
      <PromptInput
        value={input}
        onValueChange={setInput}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        disabled={isLoading || disabled}
        maxHeight={200}
        inputRef={inputRef}
        className="relative mb-3 flex items-end gap-2 rounded-[26px] border-white/10 bg-white/[0.045] p-2 pl-4 shadow-[0_-1px_0_rgba(255,255,255,0.04),0_12px_32px_rgba(0,0,0,0.28)]"
      >
        <PromptInputTextarea
          placeholder={placeholder}
          className="min-h-[42px] py-2.5 text-[15px] leading-6 !text-[#f3f3f3] placeholder:text-white/32 sm:min-h-[38px] sm:text-sm"
        />
        <PromptInputActions>
          <Button
            type="button"
            size="icon"
            disabled={isLoading || disabled || !input.trim()}
            onClick={handleSubmit}
            className="h-10 w-10 shrink-0 rounded-full bg-[#f3f3f3] text-[#111111] hover:bg-white sm:h-9 sm:w-9"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </Button>
        </PromptInputActions>
      </PromptInput>
      {disabledMessage ? (
        <p className="px-1 text-xs leading-5 text-white/40">{disabledMessage}</p>
      ) : null}
    </div>
  );
}
