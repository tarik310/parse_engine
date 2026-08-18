import { Label } from "@/components/shadcn_ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/shadcn_ui/radio-group";

// Dot-track radio selector — RadioGroup dots connected by a horizontal line.
export function SegmentedSelector<T extends string | number | null>({
  options,
  value,
  onChange,
  formatLabel,
}: {
  options: T[];
  value: T;
  onChange: (val: T) => void;
  formatLabel?: (val: T) => string;
}) {
  // RadioGroup requires string values — we stringify for the group and
  // convert back to the original type when the user selects an option.
  const toStr = (v: T): string => String(v === null ? "__null__" : v);
  const fromStr = (s: string): T => {
    if (s === "__null__") return null as T;
    const num = Number(s);
    return (isNaN(num) ? s : num) as T;
  };

  return (
    <RadioGroup
      value={toStr(value)}
      onValueChange={(s) => onChange(fromStr(s))}
      className="relative flex items-center justify-between w-full"
    >
      {/* ── Connecting track line ─────────────────────────────────────── */}
      <div className="absolute left-0 top-2 right-0 h-px bg-border pointer-events-none" />

      {/* ── Radio dots + labels row ───────────────────────────────────── */}
      <div className="relative flex justify-between items-start w-full">
        {options.map((opt) => {
          const label = formatLabel ? formatLabel(opt) : String(opt);
          const strVal = toStr(opt);
          const isSelected = opt === value;
          return (
            <Label
              key={strVal}
              htmlFor={`seg-${strVal}`}
              className="flex flex-col items-center gap-1.5 cursor-pointer group"
            >
              {/* Radio input styled as a dot */}
              <RadioGroupItem
                value={strVal}
                id={`seg-${strVal}`}
                className={`size-4 z-10 transition-all bg-white ${
                  isSelected
                    ? "border-blue-500 text-blue-500"
                    : "border-border group-hover:border-blue-400"
                }`}
              />
              {/* Label */}
              <span
                className={`font-mono text-xs transition-colors ${
                  isSelected ? "text-blue-400" : "text-muted-foreground group-hover:text-foreground"
                }`}
              >
                {label}
              </span>
            </Label>
          );
        })}
      </div>
    </RadioGroup>
  );
}
