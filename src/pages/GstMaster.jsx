import { useEffect, useState } from 'react'
import { ArrowLeft, CirclePlus, Percent, Pencil, Trash2, X } from 'lucide-react'
import { createGstRate, deleteGstRate, getGstRates, updateGstRate } from '../lib/api.js'

export default function GstMaster({ user, onBack }) {
  const [rates, setRates] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  useEffect(() => {
    getGstRates()
      .then(({ data }) => setRates(data.rates))
      .catch((requestError) => setError(requestError.response?.data?.message || 'Could not load GST rates. Check that the API and database are running.'))
      .finally(() => setLoading(false))
  }, [])

  async function saveRate(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const rate = {
      name: String(form.get('name')).trim(),
      percentage: Number(form.get('percentage')),
      description: String(form.get('description')).trim(),
      isActive: form.get('isActive') === 'on',
    }
    setSaving(true)
    setError('')
    try {
      const { data } = editing ? await updateGstRate(editing.id, rate) : await createGstRate(rate)
      setRates((current) => editing
        ? current.map((item) => item.id === editing.id ? data.rate : item)
        : [...current, data.rate].sort((left, right) => left.percentage - right.percentage))
      setModalOpen(false)
      setEditing(null)
      setNotice(editing ? 'GST rate updated.' : 'GST rate added.')
      window.setTimeout(() => setNotice(''), 3000)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not save the GST rate. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function removeRate(rate) {
    if (!window.confirm(`Delete the ${rate.name} rate (${rate.percentage}%)?`)) return
    setError('')
    try {
      await deleteGstRate(rate.id)
      setRates((current) => current.filter((item) => item.id !== rate.id))
      setNotice('GST rate deleted.')
      window.setTimeout(() => setNotice(''), 3000)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not delete the GST rate.')
    }
  }

  const activeCount = rates.filter((rate) => rate.isActive).length
  const initials = user.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()

  return (
    <main className="min-h-screen bg-brand-paper text-slate-900">
      <header className="sticky top-0 z-10 border-b border-brand-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 md:px-8">
          <div className="flex items-center gap-3"><button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Back to overview"><ArrowLeft size={17} /></button><span className="brand-logo-mark flex h-9 w-9 items-center justify-center rounded-lg"><Percent size={18} /></span><div><p className="text-sm font-bold">My Bill Book</p><p className="text-xs text-slate-500">GST master</p></div></div>
          <div className="flex items-center gap-3"><span className="hidden text-sm text-slate-500 sm:block">{user.name}</span><span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-black text-xs font-bold text-white">{initials}</span></div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-7 px-5 py-8 md:px-8">
        <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="brand-eyebrow text-xs font-bold uppercase tracking-[0.16em]">TAX SETTINGS</p><h1 className="mt-2 text-3xl font-bold tracking-tight">GST master</h1><p className="mt-2 text-sm text-slate-500">Create the tax rates your business uses and assign them to products.</p></div><button onClick={() => { setEditing(null); setModalOpen(true) }} className="brand-button inline-flex items-center gap-2 self-start rounded-xl px-4 py-2.5 text-sm font-semibold sm:self-auto"><CirclePlus size={17} />Add GST rate</button></section>

        <section className="grid gap-4 sm:grid-cols-3">
          <SummaryCard label="Tax rates" value={rates.length} detail="Created for this business" />
          <SummaryCard label="Active rates" value={activeCount} detail="Available on product forms" />
          <SummaryCard label="Assigned to products" value={rates.reduce((total, rate) => total + (rate.productCount || 0), 0)} detail="Products using a GST rate" />
        </section>

        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}

        <section className="overflow-hidden rounded-2xl border border-brand-line bg-white shadow-sm">
          <div className="border-b border-brand-line px-5 py-5 md:px-6"><h2 className="font-bold">Your tax rates</h2><p className="mt-1 text-sm text-slate-500">Rates are private to your business. A rate already assigned to products can be deactivated, but not deleted.</p></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-stone-50 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-6 py-3 font-semibold">Rate name</th><th className="px-4 py-3 font-semibold">GST percentage</th><th className="px-4 py-3 font-semibold">Products</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-6 py-3 text-right font-semibold">Actions</th></tr></thead><tbody className="divide-y divide-brand-line">{rates.map((rate) => <tr key={rate.id} className="hover:bg-stone-50/70"><td className="px-6 py-4"><span className="block font-semibold text-slate-800">{rate.name}</span>{rate.description && <span className="mt-1 block text-xs text-slate-500">{rate.description}</span>}</td><td className="px-4 py-4"><span className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-1.5 font-bold text-brand-red"><Percent size={14} />{rate.percentage}%</span></td><td className="px-4 py-4 text-slate-600">{rate.productCount || 0}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${rate.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{rate.isActive ? 'Active' : 'Inactive'}</span></td><td className="px-6 py-4"><div className="flex justify-end gap-1"><button onClick={() => { setEditing(rate); setModalOpen(true) }} className="rounded-lg p-2 text-slate-500 hover:bg-stone-100 hover:text-brand-red" aria-label={`Edit ${rate.name}`}><Pencil size={16} /></button><button onClick={() => removeRate(rate)} disabled={rate.productCount > 0} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-30" aria-label={`Delete ${rate.name}`} title={rate.productCount ? 'Rate is assigned to products' : 'Delete rate'}><Trash2 size={16} /></button></div></td></tr>)}</tbody></table>{loading ? <p className="p-12 text-center text-sm text-slate-500">Loading GST rates…</p> : rates.length === 0 && <div className="p-12 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-brand-red"><Percent size={21} /></div><h3 className="mt-4 font-semibold">No GST rates yet</h3><p className="mt-1 text-sm text-slate-500">Add the rates you use before assigning tax to products.</p></div>}</div>
        </section>
      </div>

      {notice && <div role="status" className="fixed bottom-5 right-5 rounded-xl bg-brand-black px-5 py-3 text-sm font-medium text-white shadow-xl">{notice}</div>}
      {modalOpen && <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) { setModalOpen(false); setEditing(null) } }}><section role="dialog" aria-modal="true" aria-labelledby="gst-form-title" className="my-6 w-full max-w-lg rounded-2xl bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-brand-line px-6 py-5"><div><h2 id="gst-form-title" className="text-lg font-bold">{editing ? 'Edit GST rate' : 'Add GST rate'}</h2><p className="mt-1 text-sm text-slate-500">Enter the percentage and a label your team will recognize.</p></div><button onClick={() => { setModalOpen(false); setEditing(null) }} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close"><X size={18} /></button></div><form onSubmit={saveRate} className="space-y-4 p-6"><label className="block text-sm font-medium text-slate-700">Rate name<input name="name" required maxLength="80" defaultValue={editing?.name} placeholder="e.g. Standard GST" className="brand-focus mt-2 h-11 w-full rounded-lg border border-brand-line px-3 text-sm outline-none" /></label><label className="block text-sm font-medium text-slate-700">GST percentage<div className="relative mt-2"><input name="percentage" type="number" min="0" max="100" step="0.01" required defaultValue={editing?.percentage} placeholder="e.g. 18" className="brand-focus h-11 w-full rounded-lg border border-brand-line px-3 pr-10 text-sm outline-none" /><Percent className="absolute right-3 top-3 text-slate-400" size={16} /></div></label><label className="block text-sm font-medium text-slate-700">Description <span className="font-normal text-slate-400">(optional)</span><textarea name="description" maxLength="240" rows="3" defaultValue={editing?.description || ''} placeholder="Add a note for your team" className="brand-focus mt-2 w-full resize-none rounded-lg border border-brand-line px-3 py-2.5 text-sm outline-none" /></label><label className="flex items-center gap-2.5 text-sm text-slate-600"><input type="checkbox" name="isActive" defaultChecked={editing?.isActive ?? true} className="h-4 w-4 rounded border-slate-300 text-brand-red focus:ring-brand-red" />Active and available for products</label><div className="flex justify-end gap-3 border-t border-brand-line pt-5"><button type="button" onClick={() => { setModalOpen(false); setEditing(null) }} className="rounded-xl border border-brand-line px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-stone-50">Cancel</button><button type="submit" disabled={saving} className="brand-button rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-60">{saving ? 'Saving…' : editing ? 'Save changes' : 'Save rate'}</button></div></form></section></div>}
    </main>
  )
}

function SummaryCard({ label, value, detail }) {
  return <article className="rounded-2xl border border-brand-line bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-3 text-2xl font-bold tracking-tight">{value}</p><p className="mt-1 text-xs text-slate-400">{detail}</p></article>
}
