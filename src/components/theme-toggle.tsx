'use client';

import * as React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  quiet?: boolean;
  buttonClassName?: string;
}

export function ThemeToggle({ quiet = false, buttonClassName }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  const buttonClasses = quiet
    ? 'h-9 w-9 rounded-xl border border-white/8 bg-white/[0.03] text-white/64 hover:bg-white/[0.08] hover:text-white'
    : 'h-8 w-8 group transition-all duration-200 hover:bg-primary hover:scale-110';
  const iconClasses = quiet
    ? 'h-4 w-4'
    : 'h-4 w-4 transition-all duration-200';

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={cn(buttonClasses, buttonClassName)}
      >
        <Sun
          className={cn(
            iconClasses,
            quiet ? 'text-current' : 'group-hover:text-primary-foreground group-hover:rotate-180',
          )}
        />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(buttonClasses, buttonClassName)}
            >
              {theme === 'dark' ? (
                <Moon
                  className={cn(
                    iconClasses,
                    quiet ? 'text-current' : 'group-hover:text-primary-foreground group-hover:-rotate-12',
                  )}
                />
              ) : theme === 'light' ? (
                <Sun
                  className={cn(
                    iconClasses,
                    quiet ? 'text-current' : 'group-hover:text-primary-foreground group-hover:rotate-180',
                  )}
                />
              ) : (
                <Monitor
                  className={cn(
                    iconClasses,
                    quiet ? 'text-current' : 'group-hover:text-primary-foreground group-hover:scale-110',
                  )}
                />
              )}
              <span className="sr-only">Toggle theme</span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="font-medium">
          Toggle theme
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('light')}>
          <Sun className="mr-2 h-4 w-4" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          <Moon className="mr-2 h-4 w-4" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          <Monitor className="mr-2 h-4 w-4" />
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
