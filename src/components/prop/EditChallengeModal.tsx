import { useState } from "react";
import DatePicker from "@/components/DatePicker";
import Modal from "@/components/Modal";
import type { PassedChallenge } from "@/types";

const FIRMS = [
  "Lucid Trading",
  "Tradeify",
  "Topstep",
  "FundingTicks",
  "MyFundedFX",
  "Take Profit Trader",
  "Maven Trading",
] as const;

export function EditChallengeModal({
  challenge, onClose, onSave,
}: {
  challenge: PassedChallenge;
  onClose: () => void;
  onSave: (patch: Partial<PassedChallenge>) => void;
}) {
  const [firm, setFirm] = useState(challenge.firm);
  const [type, setType] = useState(challenge.type);
  const [name, setName] = useState(challenge.name ?? "");
  const [passedDate, setPassedDate] = useState(challenge.passedDate);
  const [finalBalance, setFinalBalance] = useState(String(challenge.finalBalance));
  const [initialBalance, setInitialBalance] = useState(String(challenge.initialBalance));
  const [profitTarget, setProfitTarget] = useState(String(challenge.profitTarget));

  function handleSave() {
    onSave({
      firm, type, name: name || undefined,
      passedDate,
      finalBalance: parseFloat(finalBalance) || 0,
      initialBalance: parseFloat(initialBalance) || 0,
      profitTarget: parseFloat(profitTarget) || 0,
    });
  }

  return (
    <Modal open onClose={onClose} title="Edit Passed Challenge" size="md">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-tx-3 text-xs block mb-1">Firm</label>
          <select className="nx-select" value={firm} onChange={(e) => setFirm(e.target.value)}>
            {FIRMS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className="text-tx-3 text-xs block mb-1">Type / Plan</label>
          <input className="nx-input" value={type} onChange={(e) => setType(e.target.value)} placeholder="e.g. Evaluation 50K" />
        </div>
        <div>
          <label className="text-tx-3 text-xs block mb-1">Nickname <span className="opacity-50">(optional)</span></label>
          <input className="nx-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main account" />
        </div>
        <div>
          <label className="text-tx-3 text-xs block mb-1">Date Passed</label>
          <DatePicker value={passedDate} onChange={setPassedDate} />
        </div>
        <div>
          <label className="text-tx-3 text-xs block mb-1">Initial Balance ($)</label>
          <input className="nx-input" type="number" value={initialBalance} onChange={(e) => setInitialBalance(e.target.value)} min="0" step="100" />
        </div>
        <div>
          <label className="text-tx-3 text-xs block mb-1">Final Balance ($)</label>
          <input className="nx-input" type="number" value={finalBalance} onChange={(e) => setFinalBalance(e.target.value)} min="0" step="100" />
        </div>
        <div className="col-span-2">
          <label className="text-tx-3 text-xs block mb-1">Profit Target ($)</label>
          <input className="nx-input" type="number" value={profitTarget} onChange={(e) => setProfitTarget(e.target.value)} min="0" step="100" />
        </div>
        <div className="modal-action-bar col-span-2">
          <button className="btn-ghost flex-1 btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1 btn-sm" onClick={handleSave}>Save Changes</button>
        </div>
      </div>
    </Modal>
  );
}
