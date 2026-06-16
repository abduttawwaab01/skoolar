import { useState, useEffect } from 'react';
import { HandCoins, ArrowUpCircle, CheckCircle, XCircle, Clock } from 'lucide-react';

const STATUS_ICONS: Record<string, any> = {
  PENDING: Clock,
  APPROVED: CheckCircle,
  PAID: ArrowUpCircle,
  COMPLETED: CheckCircle,
  REJECTED: XCircle,
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  PAID: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-gray-100 text-gray-800',
  REJECTED: 'bg-red-100 text-red-800',
};

export default function SalaryMyAdvances() {
  const [advances, setAdvances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetch('/api/salary/my/advances')
      .then(r => r.json())
      .then(res => { setAdvances(res.data || []); setLoading(false); })
      .catch(() => { setError('Failed to load advances'); setLoading(false); });
  }, []);

  const handleRequestSubmitted = () => {
    setShowForm(false);
    setLoading(true);
    fetch('/api/salary/my/advances')
      .then(r => r.json())
      .then(res => { setAdvances(res.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  if (loading) return <div className="p-6 text-gray-500">Loading advances...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">My Salary Advances</h2>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
        >
          <HandCoins className="w-4 h-4" /> Request Advance
        </button>
      </div>

      {advances.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <HandCoins className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No advance requests yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left p-3">Amount</th>
                <th className="text-left p-3">Monthly Deduction</th>
                <th className="text-left p-3">Remaining</th>
                <th className="text-left p-3">Repayment Months</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {advances.map((adv: any) => {
                const StatusIcon = STATUS_ICONS[adv.status] || Clock;
                return (
                  <tr key={adv.id} className="hover:bg-gray-50">
                    <td className="p-3 font-medium">₦{Number(adv.amount).toLocaleString()}</td>
                    <td className="p-3">₦{Number(adv.monthlyDeduction).toLocaleString()}</td>
                    <td className="p-3">₦{Number(adv.remainingBalance).toLocaleString()}</td>
                    <td className="p-3">{adv.repaymentMonths}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[adv.status] || ''}`}>
                        <StatusIcon className="w-3 h-3" /> {adv.status}
                      </span>
                    </td>
                    <td className="p-3 text-gray-500">{new Date(adv.createdAt).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <AdvanceRequestForm
          onClose={() => setShowForm(false)}
          onSaved={handleRequestSubmitted}
        />
      )}
    </div>
  );
}

function AdvanceRequestForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState('');
  const [repaymentMonths, setRepaymentMonths] = useState('1');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const monthlyDeduction = Number(amount) / Number(repaymentMonths);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/salary/advances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount), repaymentMonths: Number(repaymentMonths), reason }),
      });
      if (res.ok) onSaved();
      else { const d = await res.json(); alert(d.error || 'Failed'); }
    } catch { alert('Failed to submit'); }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4">Request Salary Advance</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₦)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} required min="1" className="w-full border rounded-lg p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Repayment Months</label>
            <input type="number" value={repaymentMonths} onChange={e => setRepaymentMonths(e.target.value)} required min="1" max="24" className="w-full border rounded-lg p-2" />
          </div>
          {Number(amount) > 0 && (
            <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-sm">
              Monthly deduction: <strong>₦{Math.round(monthlyDeduction).toLocaleString()}</strong> x {repaymentMonths} months
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} className="w-full border rounded-lg p-2" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
