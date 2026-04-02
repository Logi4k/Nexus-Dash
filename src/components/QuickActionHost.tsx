import { useEffect, useState } from "react";
import type { QuickAction } from "@/lib/quickActions";
import Modal from "./Modal";

interface QuickActionHostProps {
  action: QuickAction | null;
  onClose: () => void;
}

export default function QuickActionHost({ action, onClose }: QuickActionHostProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (action) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [action]);

  if (!action) return null;

  return (
    <Modal open={open} onClose={onClose} title="Quick Action" size="md">
      <div className="p-4">
        <p className="text-sm text-tx-2">Quick action: {action}</p>
        <p className="text-xs text-tx-4 mt-2">
          This feature is being set up. The quick action "{action}" will be available soon.
        </p>
      </div>
    </Modal>
  );
}
