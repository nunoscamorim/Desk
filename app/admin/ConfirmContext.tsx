"use client";

import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";

type ConfirmOptions = { title: string; description?: string; confirmLabel?: string; danger?: boolean };
type PendingConfirm = ConfirmOptions & { resolve: (confirmed: boolean) => void };

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    setPending({ ...options, resolve });
  }), []);

  const settle = (confirmed: boolean) => { pending?.resolve(confirmed); setPending(null); };

  return <ConfirmContext.Provider value={confirm}>
    {children}
    {pending && <div className="confirm-overlay" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" onClick={() => settle(false)}>
      <div className="confirm-dialog" onClick={(event) => event.stopPropagation()}>
        <h3 id="confirm-title">{pending.title}</h3>
        {pending.description && <p>{pending.description}</p>}
        <div className="confirm-actions">
          <button type="button" className="btn btn-secondary" onClick={() => settle(false)}>Cancel</button>
          <button type="button" className={`btn ${pending.danger ? "btn-danger" : ""}`} onClick={() => settle(true)}>{pending.confirmLabel ?? "Confirm"}</button>
        </div>
      </div>
    </div>}
  </ConfirmContext.Provider>;
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}
