import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, CirclePlus, Mail, MapPin, MoreHorizontal, Phone, Search, Users, X } from 'lucide-react'
import { createCustomer, deleteCustomer, getCustomers, lookupCustomerGstin, updateCustomer } from '../lib/api.js'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })

export default function CustomerMaster({ user, onBack }) {
  const [customers, setCustomers] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [customerName, setCustomerName] = useState('')
  const mobileInputRef = useRef(null)
  const [customerDoorNumber, setCustomerDoorNumber] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [customerGstin, setCustomerGstin] = useState('')
  const [customerPan, setCustomerPan] = useState('')
  const [customerPincode, setCustomerPincode] = useState('')
  const [lookupFor, setLookupFor] = useState('')
  const [lookupStatus, setLookupStatus] = useState('')

  useEffect(() => {
    getCustomers()
      .then(({ data }) => setCustomers(data.customers))
      .catch((requestError) => setError(requestError.response?.data?.message || 'Could not load customers. Check that the API and database are running.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!modalOpen || !editing) return
    setCustomerDoorNumber(editing.doorNumber || '')
    setCustomerPan(editing.pan || '')
    setCustomerPincode(editing.pincode || '')
  }, [editing, modalOpen])

  useEffect(() => {
    const gstin = customerGstin.trim().toUpperCase()
    if (!modalOpen || !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/.test(gstin) || lookupFor === gstin) return undefined

    let cancelled = false
    const timer = window.setTimeout(async () => {
      setLookupStatus('Looking up GST registration…')
      try {
        const { data } = await lookupCustomerGstin(gstin)
        if (cancelled) return
        const details = data.details
        const registeredName = details.tradeName || details.legalName
        if (registeredName) setCustomerName(registeredName)
        if (details.address) setCustomerAddress(details.address)
        if (details.doorNumber) setCustomerDoorNumber(details.doorNumber)
        if (details.phone && mobileInputRef.current) mobileInputRef.current.value = details.phone
        if (details.pan) setCustomerPan(details.pan)
        if (details.pincode) setCustomerPincode(details.pincode)
        setLookupStatus(details.status ? `Details found · ${details.status}` : 'Registration details filled in.')
        setLookupFor(gstin)
      } catch (requestError) {
        if (cancelled) return
        setLookupStatus(requestError.response?.data?.message || 'GST lookup is unavailable. You can continue entering details manually.')
        setLookupFor(gstin)
      }
    }, 500)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [customerGstin, lookupFor, modalOpen])

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) return customers
    return customers.filter((customer) => `${customer.name} ${customer.phone} ${customer.email} ${customer.gstin} ${customer.doorNumber} ${customer.pan} ${customer.pincode} ${customer.billingAddress}`.toLowerCase().includes(value))
  }, [customers, query])

  const openingBalanceTotal = customers.reduce((sum, customer) => sum + customer.openingBalance, 0)
  const initials = user.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()

  async function saveCustomer(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const customer = {
      name: String(form.get('name')).trim(),
      phone: String(form.get('phone')).trim(),
      email: String(form.get('email')).trim(),
      gstin: String(form.get('gstin')).trim().toUpperCase(),
      doorNumber: String(form.get('doorNumber')).trim(),
      pan: String(form.get('pan')).trim().toUpperCase(),
      pincode: String(form.get('pincode')).trim(),
      billingAddress: String(form.get('billingAddress')).trim(),
      openingBalance: Number(form.get('openingBalance') || 0),
      notes: String(form.get('notes')).trim(),
    }
    setSaving(true)
    setError('')
    try {
      const { data } = editing ? await updateCustomer(editing.id, customer) : await createCustomer(customer)
      setCustomers((current) => editing
        ? current.map((item) => item.id === editing.id ? data.customer : item).sort((left, right) => left.name.localeCompare(right.name))
        : [...current, data.customer].sort((left, right) => left.name.localeCompare(right.name)))
      setModalOpen(false)
      setEditing(null)
      setNotice(editing ? 'Customer updated.' : 'Customer added to your list.')
      window.setTimeout(() => setNotice(''), 3000)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not save this customer. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function removeCustomer(customer) {
    if (!window.confirm(`Delete ${customer.name} from your customers?`)) return
    setError('')
    try {
      await deleteCustomer(customer.id)
      setCustomers((current) => current.filter((item) => item.id !== customer.id))
      setNotice('Customer deleted.')
      window.setTimeout(() => setNotice(''), 3000)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not delete this customer.')
    }
  }

  function openCreate() {
    setEditing(null)
    setCustomerName('')
    setCustomerDoorNumber('')
    setCustomerAddress('')
    setCustomerGstin('')
    setCustomerPan('')
    setCustomerPincode('')
    setLookupFor('')
    setLookupStatus('')
    setModalOpen(true)
  }

  return (
    <main className="min-h-screen bg-brand-paper text-slate-900">
      <header className="sticky top-0 z-10 border-b border-brand-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 md:px-8">
          <div className="flex items-center gap-3"><button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Back to overview"><ArrowLeft size={17} /></button><span className="brand-logo-mark flex h-9 w-9 items-center justify-center rounded-lg"><Users size={18} /></span><div><p className="text-sm font-bold">My Bill Book</p><p className="text-xs text-slate-500">Customer master</p></div></div>
          <div className="flex items-center gap-3"><span className="hidden text-sm text-slate-500 sm:block">{user.name}</span><span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-black text-xs font-bold text-white">{initials}</span></div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-7 px-5 py-8 md:px-8">
        <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="brand-eyebrow text-xs font-bold uppercase tracking-[0.16em]">CONTACTS</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Customer master</h1><p className="mt-2 text-sm text-slate-500">Keep customer contact, GST, and opening balance details in one place.</p></div><button onClick={openCreate} className="brand-button inline-flex items-center justify-center gap-2 self-start rounded-xl px-4 py-2.5 text-sm font-semibold"><CirclePlus size={17} />Add customer</button></section>

        <section className="grid gap-4 sm:grid-cols-2"><SummaryCard label="Customers" value={customers.length} detail="In your customer list" icon={<Users size={18} />} /><SummaryCard label="Opening balances" value={currency.format(openingBalanceTotal)} detail="Net balance carried forward" icon={<span className="text-sm font-bold">₹</span>} /></section>

        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}

        <section className="overflow-hidden rounded-2xl border border-brand-line bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-brand-line p-5 sm:flex-row sm:items-center sm:justify-between md:px-6"><div><h2 className="font-bold">All customers</h2><p className="mt-1 text-sm text-slate-500">{filtered.length} of {customers.length} customers</p></div><label className="relative"><Search className="absolute left-3 top-2.5 text-slate-400" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, phone, GSTIN" className="brand-focus h-10 w-full rounded-lg border border-brand-line bg-white pl-9 pr-3 text-sm outline-none sm:w-72" /></label></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-stone-50 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-6 py-3 font-semibold">Customer</th><th className="px-4 py-3 font-semibold">GSTIN</th><th className="px-4 py-3 text-right font-semibold">Opening balance</th><th className="px-6 py-3 text-right font-semibold">Action</th></tr></thead><tbody className="divide-y divide-brand-line">{filtered.map((customer) => <tr key={customer.id} className="transition hover:bg-stone-50/70"><td className="px-6 py-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-paper text-sm font-bold text-brand-red">{customer.name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span><span><span className="block font-semibold text-slate-800">{customer.name}</span>{customer.phone && <span className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><Phone size={12} />{customer.phone}</span>}{customer.email && <span className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><Mail size={12} />{customer.email}</span>}{customer.billingAddress && <span className="mt-1 flex items-center gap-1.5 text-xs text-slate-400"><MapPin size={12} />{customer.doorNumber ? `${customer.doorNumber}, ` : ''}{customer.billingAddress}{customer.pincode ? `, PIN ${customer.pincode}` : ''}</span>}{customer.pan && <span className="mt-1 block text-xs text-slate-400">PAN: {customer.pan}</span>}</span></div></td><td className="px-4 py-4 text-slate-600">{customer.gstin || '—'}</td><td className="px-4 py-4 text-right font-semibold">{currency.format(customer.openingBalance)}</td><td className="px-6 py-4 text-right"><button onClick={() => { setEditing(customer); setCustomerName(customer.name); setCustomerAddress(customer.billingAddress || ''); setCustomerGstin(customer.gstin || ''); setLookupFor(customer.gstin || ''); setLookupStatus(''); setModalOpen(true) }} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-brand-red" aria-label={`Edit ${customer.name}`}><MoreHorizontal size={18} /></button><button onClick={() => removeCustomer(customer)} className="ml-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-400 hover:bg-rose-50 hover:text-rose-700">Delete</button></td></tr>)}</tbody></table>{loading ? <div className="p-12 text-center text-sm text-slate-500">Loading customers…</div> : filtered.length === 0 && <div className="p-12 text-center text-sm text-slate-500">{query ? 'No customers match your search.' : 'No customers yet. Add your first customer to get started.'}</div>}</div>
        </section>
        <p className="text-center text-xs text-slate-400">Customer records are private to your business account.</p>
      </div>

      {notice && <div role="status" className="fixed bottom-5 right-5 rounded-xl bg-brand-black px-5 py-3 text-sm font-medium text-white shadow-xl">{notice}</div>}
      {modalOpen && <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) { setModalOpen(false); setEditing(null) } }}><section role="dialog" aria-modal="true" aria-labelledby="customer-form-title" className="my-6 w-full max-w-2xl rounded-2xl bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-brand-line px-6 py-5"><div><h2 id="customer-form-title" className="text-lg font-bold">{editing ? 'Edit customer' : 'Add a customer'}</h2><p className="mt-1 text-sm text-slate-500">Save the customer details you use on bills and invoices.</p></div><button onClick={() => { setModalOpen(false); setEditing(null) }} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close"><X size={18} /></button></div><form onSubmit={saveCustomer} className="grid gap-4 p-6 sm:grid-cols-2"><label className="block text-sm font-medium text-slate-700">Customer name<input name="name" required value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="e.g. Aarav Traders" className="brand-focus mt-2 h-11 w-full rounded-lg border border-brand-line px-3 text-sm outline-none" /></label><Field label="Mobile number" name="phone" type="tel" id="customer-mobile" ref={mobileInputRef} defaultValue={editing?.phone} placeholder="e.g. 98765 43210" /><Field label="Email address" name="email" type="email" defaultValue={editing?.email} placeholder="name@example.com" /><label className="block text-sm font-medium text-slate-700">GSTIN (optional)<input name="gstin" value={customerGstin} onChange={(event) => { const value = event.target.value.toUpperCase().replace(/\s/g, '').slice(0, 15); setCustomerGstin(value); if (/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/.test(value)) setCustomerPan(value.slice(2, 12)); setLookupFor(''); setLookupStatus('') }} maxLength={15} placeholder="15-character GSTIN" className="brand-focus mt-2 h-11 w-full rounded-lg border border-brand-line px-3 text-sm uppercase outline-none" />{lookupStatus && <span role="status" className="mt-1 block text-xs text-slate-500">{lookupStatus}</span>}</label><label className="block text-sm font-medium text-slate-700">Door / House No.<input name="doorNumber" maxLength={80} value={customerDoorNumber} onChange={(event) => setCustomerDoorNumber(event.target.value)} placeholder="e.g. 52/9A" className="brand-focus mt-2 h-11 w-full rounded-lg border border-brand-line px-3 text-sm outline-none" /></label><label className="block text-sm font-medium text-slate-700">PAN (optional)<input name="pan" maxLength={10} value={customerPan} onChange={(event) => setCustomerPan(event.target.value.toUpperCase())} placeholder="ABCDE1234F" className="brand-focus mt-2 h-11 w-full rounded-lg border border-brand-line px-3 text-sm uppercase outline-none" /></label><label className="block text-sm font-medium text-slate-700">PIN code<input name="pincode" maxLength={10} value={customerPincode} onChange={(event) => setCustomerPincode(event.target.value)} placeholder="e.g. 641020" className="brand-focus mt-2 h-11 w-full rounded-lg border border-brand-line px-3 text-sm outline-none" /></label><Field label="Opening balance (₹)" name="openingBalance" type="number" step="0.01" defaultValue={editing?.openingBalance ?? 0} placeholder="0.00" /><label className="block text-sm font-medium text-slate-700 sm:col-span-2">Full billing address<textarea name="billingAddress" rows="3" value={customerAddress} onChange={(event) => setCustomerAddress(event.target.value)} placeholder="Door / street, area, city, district, state" className="brand-focus mt-2 w-full rounded-lg border border-brand-line px-3 py-2.5 text-sm outline-none" /></label><label className="block text-sm font-medium text-slate-700 sm:col-span-2">Notes<textarea name="notes" rows="2" defaultValue={editing?.notes} placeholder="Optional notes" className="brand-focus mt-2 w-full rounded-lg border border-brand-line px-3 py-2.5 text-sm outline-none" /></label><div className="mt-2 flex justify-end gap-3 border-t border-brand-line pt-5 sm:col-span-2"><button type="button" onClick={() => { setModalOpen(false); setEditing(null) }} className="rounded-xl border border-brand-line px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-stone-50">Cancel</button><button type="submit" disabled={saving} className="brand-button rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-60">{saving ? 'Saving…' : editing ? 'Save changes' : 'Save customer'}</button></div></form></section></div>}
    </main>
  )
}

function SummaryCard({ label, value, detail, icon }) {
  return <article className="rounded-2xl border border-brand-line bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-500">{label}</p><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-brand-red">{icon}</span></div><p className="mt-3 text-2xl font-bold tracking-tight">{value}</p><p className="mt-1 text-xs text-slate-400">{detail}</p></article>
}

function Field({ label, name, type = 'text', ...inputProps }) {
  return <label className="block text-sm font-medium text-slate-700">{label}<input name={name} type={type} className="brand-focus mt-2 h-11 w-full rounded-lg border border-brand-line px-3 text-sm outline-none" {...inputProps} /></label>
}
