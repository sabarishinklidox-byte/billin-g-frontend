import { useEffect, useMemo, useState } from 'react'
import { Activity, ArrowLeft, ArrowUpRight, CalendarDays, CircleDollarSign, Clock3, FileText, Percent, RotateCcw, Wallet } from 'lucide-react'
import { getSalesReport } from '../lib/api.js'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })
const dateLabel = (value) => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`)) : '—'
const today = () => new Date().toISOString().slice(0, 10)

export default function SalesActivity({ user, onBack }) {
  const [filters, setFilters] = useState({ from: '', to: '', customerId: '' })
  const [invoices, setInvoices] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let current = true
    setLoading(true)
    getSalesReport(filters).then(({ data }) => {
      if (!current) return
      setInvoices(data.invoices || [])
      setCustomers(data.customers || [])
      setError('')
    }).catch((requestError) => {
      if (current) setError(requestError.response?.data?.message || 'Could not load sales activity.')
    }).finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [filters])

  const activeInvoices = invoices.filter((invoice) => invoice.workflowStatus !== 'CANCELLED' && invoice.status !== 'VOID')
  const totals = activeInvoices.reduce((sum, invoice) => {
    const amount = Number(invoice.grandTotal)
    const paid = invoice.status === 'PAID'
    const isOverdue = !paid && (invoice.status === 'OVERDUE' || (invoice.dueDate && invoice.dueDate < today()))
    sum.issued += amount
    sum.gst += Number(invoice.taxTotal)
    if (paid) sum.received += amount
    else sum.outstanding += amount
    if (isOverdue) { sum.overdue += amount; sum.overdueCount += 1 }
    return sum
  }, { issued: 0, gst: 0, received: 0, outstanding: 0, overdue: 0, overdueCount: 0 })
  const collectionRate = totals.issued ? Math.round(totals.received / totals.issued * 100) : 0

  const monthlySales = useMemo(() => {
    const buckets = new Map()
    for (const invoice of activeInvoices) {
      const month = invoice.invoiceDate.slice(0, 7)
      buckets.set(month, (buckets.get(month) || 0) + Number(invoice.grandTotal))
    }
    return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-6)
  }, [invoices])
  const chartMaximum = Math.max(1, ...monthlySales.map(([, amount]) => amount))

  const cards = [
    { label: 'Sales issued', value: totals.issued, detail: `${activeInvoices.length} active invoices`, icon: FileText, tone: 'red' },
    { label: 'GST billed', value: totals.gst, detail: 'Across active invoices', icon: Percent, tone: 'amber' },
    { label: 'Amount received', value: totals.received, detail: `${collectionRate}% of issued sales`, icon: CircleDollarSign, tone: 'green' },
    { label: 'Outstanding', value: totals.outstanding, detail: 'Unpaid invoice balance', icon: Wallet, tone: 'amber' },
    { label: 'Overdue', value: totals.overdue, detail: `${totals.overdueCount} past-due invoices`, icon: Clock3, tone: 'rose' },
  ]

  return <main className="min-h-screen bg-brand-paper text-slate-900">
    <header className="sticky top-0 z-10 border-b border-brand-line bg-white/95 backdrop-blur"><div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 md:px-8"><div className="flex items-center gap-3"><button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Back to overview"><ArrowLeft size={17} /></button><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-brand-red"><Activity size={18} /></span><div><p className="text-sm font-bold">My Bill Book</p><p className="text-xs text-slate-500">Sales activity</p></div></div><span className="hidden text-sm text-slate-500 sm:block">{user.name}</span></div></header>
    <div className="mx-auto max-w-7xl space-y-6 px-5 py-8 md:px-8">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold text-brand-red">Sales tracker</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Sales activity</h1><p className="mt-2 text-sm text-slate-500">Track sales issued, collections, unpaid balances, and overdue invoices.</p></div><div className="rounded-xl border border-brand-line bg-white px-4 py-3"><p className="text-xs text-slate-500">Collection rate</p><p className="mt-1 text-xl font-bold text-emerald-700">{collectionRate}%</p></div></section>
      <section className="rounded-2xl border border-brand-line bg-white p-4 shadow-sm md:p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-bold">Filter sales activity</h2><p className="mt-1 text-xs text-slate-400">Select a customer and invoice date range</p></div><button type="button" onClick={() => setFilters({ from: '', to: '', customerId: '' })} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-stone-50 hover:text-brand-red"><RotateCcw size={14} />Reset</button></div><div className="grid gap-3 sm:grid-cols-3"><label className="text-xs font-medium text-slate-500">Customer<select value={filters.customerId} onChange={(event) => setFilters((current) => ({ ...current, customerId: event.target.value }))} className="mt-1 block h-11 w-full rounded-lg border border-brand-line bg-white px-3 text-sm text-slate-700"><option value="">All customers</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label><label className="text-xs font-medium text-slate-500"><span className="inline-flex items-center gap-1"><CalendarDays size={13} />From date</span><input type="date" max={filters.to || undefined} value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} className="mt-1 block h-11 w-full rounded-lg border border-brand-line px-3 text-sm text-slate-700" /></label><label className="text-xs font-medium text-slate-500"><span className="inline-flex items-center gap-1"><CalendarDays size={13} />To date</span><input type="date" min={filters.from || undefined} value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} className="mt-1 block h-11 w-full rounded-lg border border-brand-line px-3 text-sm text-slate-700" /></label></div></section>
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{cards.map(({ label, value, detail, icon: Icon, tone }) => { const colors = { red: 'bg-red-50 text-brand-red', green: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700', rose: 'bg-rose-50 text-rose-700' }; return <article key={label} className="rounded-2xl border border-brand-line bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-500">{label}</p><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors[tone]}`}><Icon size={19} /></span></div><p className="mt-3 text-2xl font-bold">{loading ? '—' : currency.format(value)}</p><p className="mt-1 text-xs text-slate-400">{detail}</p></article> })}</section>
      <section className="grid gap-5 xl:grid-cols-[1.4fr_1fr]"><article className="rounded-2xl border border-brand-line bg-white p-5 shadow-sm md:p-6"><div className="flex items-center justify-between"><div><h2 className="font-bold">Issued sales by month</h2><p className="mt-1 text-sm text-slate-500">Invoice totals in the selected date range</p></div><ArrowUpRight size={18} className="text-brand-red" /></div><div className="mt-6 flex h-52 items-end gap-4 overflow-x-auto border-b border-l border-slate-100 px-3 pt-4">{monthlySales.map(([month, amount]) => <div key={month} className="group flex h-full min-w-12 flex-1 flex-col justify-end gap-2"><span className="text-center text-[10px] text-slate-400 opacity-0 group-hover:opacity-100">{currency.format(amount)}</span><div title={currency.format(amount)} className="w-full rounded-t-md bg-brand-red" style={{ height: `${Math.max(4, amount / chartMaximum * 82)}%` }} /><span className="-mb-6 text-center text-xs text-slate-400">{new Intl.DateTimeFormat('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`))}</span></div>)}{!monthlySales.length && !loading && <p className="m-auto text-sm text-slate-400">No issued sales for these filters.</p>}</div><div className="mt-10 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500"><span>Paid invoices collected</span><strong className="text-emerald-700">{currency.format(totals.received)}</strong></div></article><article className="rounded-2xl border border-brand-line bg-white p-5 shadow-sm md:p-6"><h2 className="font-bold">Collection progress</h2><p className="mt-1 text-sm text-slate-500">Amount received from issued invoices</p><div className="mt-8 flex items-end justify-between"><span className="text-3xl font-bold">{collectionRate}%</span><span className="text-sm text-slate-500">{currency.format(totals.received)} received</span></div><div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${collectionRate}%` }} /></div><div className="mt-4 flex justify-between text-xs text-slate-500"><span>Outstanding</span><strong className="text-slate-700">{currency.format(totals.outstanding)}</strong></div><div className="mt-5 rounded-xl bg-amber-50 p-4"><p className="text-xs font-semibold text-amber-800">Past due</p><p className="mt-1 text-lg font-bold text-amber-900">{currency.format(totals.overdue)}</p><p className="mt-1 text-xs text-amber-700">Based on invoice due dates and payment status</p></div></article></section>
      <section className="overflow-hidden rounded-2xl border border-brand-line bg-white shadow-sm"><div className="border-b border-brand-line p-5 md:px-6"><h2 className="font-bold">Invoice collection activity</h2><p className="mt-1 text-sm text-slate-500">{loading ? 'Loading invoices…' : `${activeInvoices.length} active invoices`}</p></div><div className="overflow-x-auto"><table className="w-full min-w-[1020px] text-left text-sm"><thead className="bg-stone-50 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3 font-semibold">Invoice</th><th className="px-4 py-3 font-semibold">Customer</th><th className="px-4 py-3 font-semibold">Issued</th><th className="px-4 py-3 font-semibold">Due date</th><th className="px-4 py-3 text-right font-semibold">Amount</th><th className="px-4 py-3 text-right font-semibold">GST</th><th className="px-4 py-3 text-right font-semibold">Received</th><th className="px-4 py-3 text-right font-semibold">Outstanding</th><th className="px-5 py-3 font-semibold">Status</th></tr></thead><tbody className="divide-y divide-brand-line">{activeInvoices.map((invoice) => { const paid = invoice.status === 'PAID'; const overdue = !paid && (invoice.status === 'OVERDUE' || (invoice.dueDate && invoice.dueDate < today())); const statusLabel = paid ? 'Paid' : overdue ? 'Overdue' : invoice.status === 'PARTIAL' ? 'Partial' : 'Issued'; const statusTone = paid ? 'bg-emerald-50 text-emerald-700' : overdue ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'; return <tr key={invoice.id}><td className="px-5 py-4 font-semibold">{invoice.invoiceNumber}</td><td className="px-4 py-4">{invoice.customerName}</td><td className="px-4 py-4 text-slate-500">{dateLabel(invoice.invoiceDate)}</td><td className="px-4 py-4 text-slate-500">{dateLabel(invoice.dueDate)}</td><td className="px-4 py-4 text-right font-semibold">{currency.format(invoice.grandTotal)}</td><td className="px-4 py-4 text-right text-slate-600">{currency.format(invoice.taxTotal)}</td><td className="px-4 py-4 text-right text-emerald-700">{currency.format(paid ? invoice.grandTotal : 0)}</td><td className="px-4 py-4 text-right text-slate-700">{currency.format(paid ? 0 : invoice.grandTotal)}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone}`}>{statusLabel}</span></td></tr> })}</tbody></table>{!loading && activeInvoices.length === 0 && <p className="p-10 text-center text-sm text-slate-500">No invoices in this date range.</p>}</div></section>
      <p className="pb-2 text-center text-xs text-slate-400">Received amounts use invoices marked Paid. Partial payment amounts are not currently recorded separately.</p>
    </div>
  </main>
}
