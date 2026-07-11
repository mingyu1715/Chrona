import { LoaderCircle } from 'lucide-react';

export interface ActiveOperation {
  kind: 'backup' | 'restore' | 'statistics' | 'integrity';
  label: string;
  currentFile: string | null;
  processedBytes: number;
  totalBytes: number;
  phase: string;
  progressPercent?: number;
  amountText?: string;
}

interface OperationBarProps {
  operation: ActiveOperation | null;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KiB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GiB`;
}

export function OperationBar({ operation }: OperationBarProps) {
  if (!operation) return null;

  const progress = operation.progressPercent ?? (operation.totalBytes > 0
    ? Math.min(100, Math.round((operation.processedBytes / operation.totalBytes) * 100))
    : null);
  const amountText = operation.amountText ?? (operation.totalBytes > 0
    ? `${formatBytes(operation.processedBytes)} / ${formatBytes(operation.totalBytes)}`
    : operation.phase);

  return (
    <div className="operation-bar" role="status" aria-live="polite">
      <LoaderCircle className="operation-bar__spinner" size={18} aria-hidden="true" />
      <div className="operation-bar__summary">
        <strong>{operation.label}</strong>
        <span>{operation.currentFile ?? operation.phase}</span>
      </div>
      <div className="operation-bar__progress-wrap">
        <div
          className="operation-bar__progress"
          role="progressbar"
          aria-label={operation.label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress ?? undefined}
        >
          <span style={{ width: progress === null ? '24%' : `${progress}%` }} />
        </div>
        <span className="operation-bar__amount">
          {amountText}
        </span>
      </div>
    </div>
  );
}
