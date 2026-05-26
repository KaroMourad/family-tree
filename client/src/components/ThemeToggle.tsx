import { Laptop, Moon, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/theme/ThemeProvider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Toggle theme"
        className="relative inline-flex items-center justify-center size-9 rounded-md border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-input dark:bg-input/30 dark:hover:bg-input/50"
      >
        <Sun className="h-[1.1rem] w-[1.1rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-[1.1rem] w-[1.1rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" /> Light
          {theme === "light" && <span className="ml-auto text-xs">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" /> Dark
          {theme === "dark" && <span className="ml-auto text-xs">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Laptop className="mr-2 h-4 w-4" /> System
          {theme === "system" && <span className="ml-auto text-xs">✓</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
