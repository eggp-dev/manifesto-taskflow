'use client';

import { X, MessageSquare, Github, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AssistantHeaderProps {
  onClose: () => void;
  onResetSession?: () => Promise<void> | void;
  isResetting?: boolean;
}

export function AssistantHeader({
  onClose,
  onResetSession,
  isResetting = false,
}: AssistantHeaderProps) {
  return (
    <div className="flex h-14 items-center justify-between border-b border-white/8 bg-[#151515]/95 px-2.5 backdrop-blur sm:px-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
          <MessageSquare className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#f3f3f3]">Assistant</p>
          <p className="truncate text-[11px] text-white/42">TaskFlow agent feed</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl border border-white/8 bg-white/[0.03] text-white/64 hover:bg-white/[0.08] hover:text-white"
              onClick={() => {
                void onResetSession?.();
              }}
              disabled={isResetting}
            >
              <RotateCcw className={isResetting ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="font-medium">
            Reset session
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl border border-white/8 bg-white/[0.03] text-white/64 hover:bg-white/[0.08] hover:text-white"
              asChild
            >
              <a href="https://github.com/manifesto-ai/taskflow" target="_blank" rel="noopener noreferrer">
                <Github className="h-4 w-4" />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="font-medium">
            Go to GitHub
          </TooltipContent>
        </Tooltip>
        <ThemeToggle quiet />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl border border-white/8 bg-white/[0.03] text-white/64 hover:bg-white/[0.08] hover:text-white"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="font-medium">
            Close
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
