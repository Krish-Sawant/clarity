"use client";

import { useEffect, useId, useRef } from "react";
import { setDesign, useDesign, type Palette } from "../state/design-store";
import { Icon } from "./icon";

export function DesignControls({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const design = useDesign();

  useEffect(() => {
    const node = dialog.current;
    if (open && !node?.open) node?.showModal();
    if (!open && node?.open) node.close();
  }, [open]);

  return <dialog ref={dialog} className="design-dialog" aria-labelledby={titleId} onCancel={onClose} onClose={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} onKeyDown={(event) => {
    if (event.key !== "Tab") return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]'));
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }}>
    <div className="design-dialog__content">
      <div className="dialog-heading"><span className="eyebrow">THE STUDIO / DESIGN CONTROLS</span><button className="icon-button" aria-label="Close design settings" onClick={onClose}><Icon name="close" /></button></div>
      <h2 id={titleId}>Make it<br /><em>your own.</em></h2>
      <p>A different mood. The same clarity. These preferences stay on this device.</p>
      <fieldset className="palette-options"><legend className="eyebrow">01 / COLOR PALETTE</legend>{(["citron", "tidal", "iris", "coral"] as Palette[]).map((palette) => <label key={palette} className={`palette-option ${design.palette === palette ? "is-selected" : ""}`}><input type="radio" name="palette" checked={design.palette === palette} onChange={() => setDesign({ palette })} /><span className={`palette-swatch palette-swatch--${palette}`} /><span>{palette[0].toUpperCase() + palette.slice(1)}</span><span aria-hidden="true">{design.palette === palette ? "✓" : ""}</span></label>)}</fieldset>
      <label className="design-field"><span className="eyebrow">02 / CORNER RADIUS <output>{design.radius}px</output></span><input type="range" aria-label="Corner radius" min={0} max={8} value={design.radius} onChange={(event) => setDesign({ radius: Number(event.target.value) })} /><span className="range-labels"><span>Sharp</span><span>Softened</span></span></label>
      <label className="field"><span className="eyebrow">03 / ELEVATION</span><select aria-label="Elevation" value={design.elevation} onChange={(event) => setDesign({ elevation: event.target.value as "flat" | "soft" | "lifted" })}><option value="flat">Flat — ink on paper</option><option value="soft">Soft — a little depth</option><option value="lifted">Lifted — more presence</option></select></label>
      <div className="design-preview"><span className="eyebrow">LIVE PREVIEW</span><strong>Small shifts.<br />Fresh perspective.</strong><span className="preview-marker"><Icon name="sparkles" size={28} /></span></div>
      <button className="button button--secondary" onClick={() => setDesign({ palette: "citron", radius: 0, elevation: "flat" })}>Reset design <Icon name="refresh" size={16} /></button>
    </div>
  </dialog>;
}
