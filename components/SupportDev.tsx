import { Heart } from "lucide-react";
import { Button } from "./shadcn_ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./shadcn_ui/popover";

export default function SupportDev() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="p-2 gap-1.5 font-mono text-[10px] text-muted-foreground underline cursor-pointer"
        >
          <Heart className="size-3" />
          Support
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="w-80 p-4">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Support the Developer</h3>
          <a
            href="https://buymeacoffee.com/tareqhrh"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#FFDD00] px-4 text-sm font-semibold text-[#0D0C22] transition-opacity hover:opacity-90"
          >
            Buy me a coffee
          </a>
        </div>
      </PopoverContent>
    </Popover>
  );
}
