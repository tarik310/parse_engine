import { ModelOptions } from "./types";
import { formatNumCtx } from "./utils";

export function ModelOptionsDisplay({ options }: { options: ModelOptions | undefined }) {
  if (!options)
    return (
      <span className="font-mono text-[11px] text-muted-foreground">No options recorded.</span>
    );
  const items: { label: string; value: string }[] = [
    { label: "Temperature", value: String(options.temperature) },
    ...(options.num_ctx
      ? [
          {
            label: "Context Window",
            value: `${formatNumCtx(options.num_ctx)} tokens`,
          },
        ]
      : []),
    ...(options.think != null ? [{ label: "Thinking", value: String(options.think) }] : []),
  ];

  return (
    <>
      {items.map(({ label, value }) => (
        <div key={label}>
          <span>{label}:</span>
          <span className="text-foreground"> {value}</span>
        </div>
      ))}
    </>
  );
}
