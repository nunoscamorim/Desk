"use client";

import { useAdminConfig } from "./AdminConfigContext";
import { useToast } from "./ToastContext";

// Shared by the Dashboard and Display sections, which both edit the same
// config draft — so a change made in one is reflected here regardless of
// which section you save or revert from.
export function SaveBar() {
  const { dirty, saveState, save, revert } = useAdminConfig();
  const showToast = useToast();
  const handleSave = async () => {
    const ok = await save();
    showToast(ok ? "Saved to the display" : "Couldn’t save — try again", ok ? "success" : "error");
  };
  return <div className="config-actions">
    <span className={`save-status ${saveState === "error" ? "error" : dirty ? "dirty" : "synced"}`}><span />{saveState === "error" ? "Couldn’t save — try again" : dirty ? "Unsaved changes" : "Saved to display"}</span>
    <button type="button" className="btn btn-secondary" onClick={revert} disabled={!dirty || saveState === "saving"}>Revert</button>
    <button type="button" className="btn" onClick={() => void handleSave()} disabled={!dirty || saveState === "saving"}>{saveState === "saving" ? "Saving…" : dirty ? "Save changes" : "Saved"}</button>
  </div>;
}
