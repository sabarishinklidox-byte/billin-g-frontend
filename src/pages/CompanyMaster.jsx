import { useEffect, useState } from 'react'
import { ArrowLeft, Building2, Save } from 'lucide-react'
import { saveCompanyDetails } from '../lib/api.js'

export default function CompanyMaster({ user, onBack, onSave }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function submit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const details = {
      companyName: String(form.get('companyName')).trim(),
      address: String(form.get('address')).trim(),
      gstin: String(form.get('gstin')).trim().toUpperCase(),
      phone: String(form.get('phone')).trim(),
      companyEmail: String(form.get('companyEmail')).trim(),
      nextInvoiceNumber: Number(form.get('nextInvoiceNumber')),
    }
    setSaving(true)
    setError('')
    try {
      const { data } = await saveCompanyDetails(details)
      onSave(data.user)
      setNotice('Company details saved.')
      window.setTimeout(() => setNotice(''), 3000)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not save company details.')
    } finally { setSaving(false) }
  }

  const initials = (user.companyName || user.name).split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()

  return <main className="min-h-screen bg-brand-paper text-slate-900">
    <header className="sticky top-0 z-10 border-b border-brand-line bg-white/95 backdrop-blur"><div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 md:px-8"><div className="flex items-center gap-3"><button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Back to overview"><ArrowLeft size={17} /></button><span className="brand-logo-mark flex h-9 w-9 items-center justify-center rounded-lg"><Building2 size={18} /></span><div><p className="text-sm font-bold">My Bill Book</p><p className="text-xs text-slate-500">Company details</p></div></div><span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-black text-xs font-bold text-white">{initials}</span></div></header>
    <div className="mx-auto max-w-4xl space-y-6 px-5 py-8 md:px-8"><section><p className="brand-eyebrow text-xs font-bold uppercase tracking-[0.16em]">BUSINESS SETTINGS</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Company details</h1><p className="mt-2 text-sm text-slate-500">These details appear at the top of your invoices.</p></section>
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      <form onSubmit={submit} className="grid gap-5 rounded-2xl border border-brand-line bg-white p-5 shadow-sm sm:grid-cols-2 md:p-7"><Field label="Company name" name="companyName" required maxLength="160" defaultValue={user.companyName || user.name} placeholder="Registered business name" /><Field label="GSTIN" name="gstin" maxLength="15" defaultValue={user.gstin} placeholder="15-character GSTIN" /><label className="block text-sm font-medium text-slate-700 sm:col-span-2">Company address<textarea name="address" rows="3" maxLength="1000" defaultValue={user.address} placeholder="Street, city, state, PIN code" className="brand-focus mt-2 w-full rounded-lg border border-brand-line px-3 py-2.5 text-sm outline-none" /></label><Field label="Phone number" name="phone" type="tel" maxLength="24" defaultValue={user.phone} placeholder="Business phone" /><Field label="Company email" name="companyEmail" type="email" maxLength="254" defaultValue={user.companyEmail || user.email} placeholder="accounts@company.com" /><div className="sm:col-span-2 rounded-xl border border-brand-line bg-stone-50 p-4"><h2 className="font-semibold">Invoice numbering</h2><p className="mt-1 text-xs text-slate-500">The next automatic number is used when you leave the invoice number blank. Start at 1 to get 001.</p><label className="mt-3 block text-sm font-medium text-slate-700">Next invoice number<input name="nextInvoiceNumber" type="number" min="1" max="999999999" step="1" required defaultValue={user.nextInvoiceNumber ?? 1} className="brand-focus mt-2 h-11 w-full rounded-lg border border-brand-line bg-white px-3 text-sm outline-none sm:max-w-xs" /></label></div><div className="flex items-center justify-between border-t border-brand-line pt-5 sm:col-span-2"><span className="text-xs text-slate-500">Printed on invoices as your business information.</span><button type="submit" disabled={saving} className="brand-button inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-60"><Save size={16} />{saving ? 'Saving…' : 'Save details'}</button></div></form>
    </div>{notice && <div role="status" className="fixed bottom-5 right-5 rounded-xl bg-brand-black px-5 py-3 text-sm font-medium text-white shadow-xl">{notice}</div>}
  </main>
}

function Field({ label, name, type = 'text', ...props }) {
  return <label className="block text-sm font-medium text-slate-700">{label}<input name={name} type={type} className="brand-focus mt-2 h-11 w-full rounded-lg border border-brand-line px-3 text-sm outline-none" {...props} /></label>
}
