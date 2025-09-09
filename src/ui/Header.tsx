import { Button, Chip } from "@/ui/kit";

export function HeaderStatus({ text }: { text?: string }) {
  if (!text) return null;
  return <Chip>{text}</Chip>;
}

export function HeaderButtons({
  onGenerate,
  onExport,
  busy,
}: {
  onGenerate?: () => void;
  onExport?: () => void;
  busy?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <Button onClick={onGenerate} disabled={busy}>
        Generate
      </Button>
      <Button variant="ok" onClick={onExport} disabled={busy}>
        Export
      </Button>
    </div>
  );
}
