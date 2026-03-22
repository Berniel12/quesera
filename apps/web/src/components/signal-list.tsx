import { SignalRow } from "./signal-row";

interface Signal {
  source_name: string;
  signal_type: string;
  current_value: number;
  delta: number | null;
  direction: string;
  freshness: string;
}

interface SignalListProps {
  signals: Signal[];
}

export function SignalList({ signals }: SignalListProps) {
  if (signals.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No signals available yet.
      </p>
    );
  }

  return (
    <div className="divide-y-0">
      {signals.map((s, i) => (
        <SignalRow
          key={`${s.source_name}-${i}`}
          sourceName={s.source_name}
          signalType={s.signal_type}
          currentValue={s.current_value}
          delta={s.delta}
          direction={s.direction}
          freshness={s.freshness}
        />
      ))}
    </div>
  );
}
