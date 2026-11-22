import { useEffect, useState } from 'react'
import { ArrowLeft, Building2, CirclePlus, Pencil, Trash2, X } from 'lucide-react'
import { createBankAccount, deleteBankAccount, getBankAccounts, updateBankAccount } from '../lib/api.js'

export default function BankMaster({ user, onBack }) {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  useEffect(() => {
    getBankAccounts().then(({ data }) => setAccounts(data.accounts))
      .catch((requestError) => setError(requestError.response?.data?.message || 'Could not load bank accounts.'))
      .finally(() => setLoading(false))
  }, [])

  async function saveAccount(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const account = {
      bankName: String(form.get('bankName')).trim(),
      accountName: String(form.get('accountName')).trim(),
      accountNumber: String(form.get('accountNumber')).trim(),
      ifscCode: String(form.get('ifscCode')).trim().toUpperCase(),
      branch: String(form.get('branch')).trim(),
      upiId: String(form.get('upiId')).trim(),
      isDefault: form.get('isDefault') === 'on',
    }
    setSaving(true)
    setError('')
    try {
      const { data } = editing ? await updateBankAccount(editing.id, account) : await createBankAccount(account)
      setAccounts((current) => {
        const next = editing ? current.map((item) => item.id === editing.id ? data.account : item) : [...current, data.account]
        return next.map((item) => item.id === data.account.id ? data.account : data.account.isDefault ? { ...item, isDefault: false } : item).sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.bankName.localeCompare(b.bankName))
      })
      setModalOpen(false)
      setEditing(null)
      setNotice(editing ? 'Bank account updated.' : 'Bank account added.')
      window.setTimeout(() => setNotice(''), 3000)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not save this bank account.')
    } finally { setSaving(false) }
  }

  async function removeAccount(account) {
    if (!window.confirm(`Delete the ${account.bankName} account ending ${account.accountNumber.slice(-4)}?`)) return
    try {
      await deleteBankAccount(account.id)
      setAccounts((current) => current.filter((item) => item.id !== account.id))
      setNotice('Bank account deleted.')
      window.setTimeout(() => setNotice(''), 3000)
    } catch (requestError) { setError(requestError.response?.data?.message || 'Could not delete this bank account.') }
  }

  const initials = user.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()

  return <main className="min-h-screen bg-brand-paper text-slate-900">
    <header className="sticky top-0 z-10 border-b border-brand-line bg-white/95 backdrop-blur"><div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 md:px-8"><div className="flex items-center gap-3"><button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Back to overview"><ArrowLeft size={17} /></button><span className="brand-logo-mark flex h-9 w-9 items-center justify-center rounded-lg"><Building2 size={18} /></span><div><p className="text-sm font-bold">My Bill Book</p><p className="text-xs text-slate-500">Bank master</p></div></div><div className="flex items-center gap-3"><span className="hidden text-sm text-slate-500 sm:block">{user.name}</span><span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-black text-xs font-bold text-white">{initials}</span></div></div></header>
    <div className="mx-auto max-w-7xl space-y-7 px-5 py-8 md:px-8"><section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="brand-eyebrow text-xs font-bold uppercase tracking-[0.16em]">BUSINESS SETTINGS</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Bank master</h1><p className="mt-2 text-sm text-slate-500">Save bank details to add payment information to your invoices.</p></div><button onClick={() => { setEditing(null); setModalOpen(true) }} className="brand-button inline-flex items-center gap-2 self-start rounded-xl px-4 py-2.5 text-sm font-semibold sm:self-auto"><CirclePlus size={17} />Add bank account</button></section>
      <section className="grid gap-4 sm:grid-cols-2"><Summary label="Bank accounts" value={accounts.length} detail="Saved for this business" /><Summary label="Default account" value={accounts.find((account) => account.isDefault)?.bankName || 'Not set'} detail="Selected automatically for new invoices" /></section>
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      <section className="overflow-hidden rounded-2xl border border-brand-line bg-white shadow-sm"><div className="border-b border-brand-line px-5 py-5 md:px-6"><h2 className="font-bold">Your bank accounts</h2><p className="mt-1 text-sm text-slate-500">Account numbers are only visible in your signed-in business account.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-stone-50 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-6 py-3 font-semibold">Bank and account holder</th><th className="px-4 py-3 font-semibold">Account number</th><th className="px-4 py-3 font-semibold">IFSC / branch</th><th className="px-4 py-3 font-semibold">UPI</th><th className="px-6 py-3 text-right font-semibold">Actions</th></tr></thead><tbody className="divide-y divide-brand-line">{accounts.map((account) => <tr key={account.id} className="hover:bg-stone-50/70"><td className="px-6 py-4"><span className="block font-semibold">{account.bankName}{account.isDefault && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">Default</span>}</span><span className="mt-1 block text-xs text-slate-500">{account.accountName}</span></td><td className="px-4 py-4 text-slate-600">•••• {account.accountNumber.slice(-4)}</td><td className="px-4 py-4"><span className="block font-medium">{account.ifscCode}</span><span className="mt-1 block text-xs text-slate-500">{account.branch || '—'}</span></td><td className="px-4 py-4 text-slate-600">{account.upiId || '—'}</td><td className="px-6 py-4"><div className="flex justify-end gap-1"><button onClick={() => { setEditing(account); setModalOpen(true) }} className="rounded-lg p-2 text-slate-500 hover:bg-stone-100 hover:text-brand-red" aria-label={`Edit ${account.bankName}`}><Pencil size={16} /></button><button onClick={() => removeAccount(account)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700" aria-label={`Delete ${account.bankName}`}><Trash2 size={16} /></button></div></td></tr>)}</tbody></table>{loading ? <div className="p-12 text-center text-sm text-slate-500">Loading bank accounts…</div> : accounts.length === 0 && <div className="p-12 text-center"><Building2 className="mx-auto text-slate-300" size={28} /><h3 className="mt-4 font-semibold">No bank accounts yet</h3><p className="mt-1 text-sm text-slate-500">Add an account to show payment details on invoices.</p></div>}</div></section></div>
    {notice && <div role="status" className="fixed bottom-5 right-5 rounded-xl bg-brand-black px-5 py-3 text-sm font-medium text-white shadow-xl">{notice}</div>}
    {modalOpen && <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) { setModalOpen(false); setEditing(null) } }}><section role="dialog" aria-modal="true" aria-labelledby="bank-form-title" className="my-6 w-full max-w-2xl rounded-2xl bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-brand-line px-6 py-5"><div><h2 id="bank-form-title" className="text-lg font-bold">{editing ? 'Edit bank account' : 'Add bank account'}</h2><p className="mt-1 text-sm text-slate-500">Enter the account details you want printed on invoices.</p></div><button onClick={() => { setModalOpen(false); setEditing(null) }} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close"><X size={18} /></button></div><form onSubmit={saveAccount} className="grid gap-4 p-6 sm:grid-cols-2"><BankField label="Bank name" name="bankName" required maxLength="120" defaultValue={editing?.bankName} placeholder="e.g. State Bank of India" /><BankField label="Account holder name" name="accountName" required maxLength="160" defaultValue={editing?.accountName} placeholder="Name as registered with the bank" /><BankField label="Account number" name="accountNumber" required maxLength="34" defaultValue={editing?.accountNumber} placeholder="Account number" /><BankField label="IFSC code" name="ifscCode" required maxLength="11" defaultValue={editing?.ifscCode} placeholder="e.g. SBIN0001234" /><BankField label="Branch" name="branch" maxLength="120" defaultValue={editing?.branch} placeholder="Branch name (optional)" /><BankField label="UPI ID" name="upiId" maxLength="120" defaultValue={editing?.upiId} placeholder="name@bank (optional)" /><label className="flex items-center gap-2.5 text-sm text-slate-600 sm:col-span-2"><input type="checkbox" name="isDefault" defaultChecked={editing?.isDefault ?? accounts.length === 0} className="h-4 w-4 rounded border-slate-300 text-brand-red focus:ring-brand-red" />Use as default for new invoices</label><div className="mt-2 flex justify-end gap-3 border-t border-brand-line pt-5 sm:col-span-2"><button type="button" onClick={() => { setModalOpen(false); setEditing(null) }} className="rounded-xl border border-brand-line px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-stone-50">Cancel</button><button type="submit" disabled={saving} className="brand-button rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-60">{saving ? 'Saving…' : editing ? 'Save changes' : 'Save account'}</button></div></form></section></div>}
  </main>
}

function BankField({ label, name, ...props }) {
  return <label className="block text-sm font-medium text-slate-700">{label}<input name={name} className="brand-focus mt-2 h-11 w-full rounded-lg border border-brand-line px-3 text-sm outline-none" {...props} /></label>
}

function Summary({ label, value, detail }) {
  return <article className="rounded-2xl border border-brand-line bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-3 text-2xl font-bold tracking-tight">{value}</p><p className="mt-1 text-xs text-slate-400">{detail}</p></article>
}
