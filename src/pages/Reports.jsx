import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowLeft, CalendarDays, CheckCircle2, Clock3, Download, FileText, RotateCcw, Scale, Wallet } from 'lucide-react'
import { getSalesReport } from '../lib/api.js'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })
const formatDate = (value) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))

export default function Reports({ user, onBack }) {
  const [filters, setFilters] = useState({ from: '', to: '', customerId: '' })
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let current = true
    setLoading(true)
    getSalesReport(filters)
      .then(({ data }) => {
        if (current) {
          setReport(data)
          setError('')
        }
      })
      .catch((requestError) => {
        if (current) setError(requestError.response?.data?.message || 'Could not load report data. Check that the API and database are running.')
      })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [filters])

  const monthlySales = useMemo(() => {
    const totals = new Map()
    for (const invoice of report?.invoices || []) {
      const month = invoice.invoiceDate.slice(0, 7)
      totals.set(month, (totals.get(month) || 0) + invoice.grandTotal)
    }
    return [...totals.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12)
  }, [report])
  const chartMaximum = Math.max(1, ...monthlySales.map(([, amount]) => amount))
  const paymentGroups = [
    { label: 'Paid', color: '#16a34a', icon: CheckCircle2, invoices: (report?.invoices || []).filter((invoice) => invoice.status === 'PAID') },
    { label: 'Pending', color: '#f59e0b', icon: Clock3, invoices: (report?.invoices || []).filter((invoice) => ['ISSUED', 'PARTIAL'].includes(invoice.status)) },
    { label: 'Overdue', color: '#dc2626', icon: AlertCircle, invoices: (report?.invoices || []).filter((invoice) => invoice.status === 'OVERDUE') },
  ].map((group) => ({ ...group, count: group.invoices.length, amount: group.invoices.reduce((sum, invoice) => sum + invoice.grandTotal, 0) }))
  const paymentCount = paymentGroups.reduce((sum, group) => sum + group.count, 0)
  let paymentAngle = 0
  const paymentSegments = paymentGroups.map((group) => {
    const start = paymentAngle
    paymentAngle += paymentCount ? group.count / paymentCount * 360 : 0
    return `${group.color} ${start}deg ${paymentAngle}deg`
  })
  const paymentGradient = paymentCount ? `conic-gradient(${paymentSegments.join(', ')})` : 'conic-gradient(#e2e8f0 0deg 360deg)'

  function downloadCsv() {
    const rows = report?.invoices || []
    const columns = ['Invoice number', 'Date', 'Customer', 'Subtotal', 'GST', 'Total', 'Weight (kg)', 'Payment status']
    const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
    const content = [columns, ...rows.map((invoice) => [invoice.invoiceNumber, invoice.invoiceDate, invoice.customerName, invoice.subtotal.toFixed(2), invoice.taxTotal.toFixed(2), invoice.grandTotal.toFixed(2), invoice.totalWeight ?? '', invoice.status])]
      .map((row) => row.map(escape).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'my-bill-book-sales-report.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const summary = report?.summary
  const statCards = [
    { label: 'Sales', value: summary ? currency.format(summary.totalSales) : '—', detail: 'Invoice totals', icon: Wallet, tint: 'red' },
    { label: 'Amount received', value: summary ? currency.format(summary.amountReceived) : '—', detail: 'Invoices marked paid', icon: Wallet, tint: 'emerald' },
    { label: 'To collect', value: summary ? currency.format(summary.toCollect) : '—', detail: 'Issued, partial, and overdue', icon: Wallet, tint: 'amber' },
    { label: 'GST on invoices', value: summary ? currency.format(summary.taxTotal) : '—', detail: 'GST on active invoices', icon: FileText, tint: 'violet' },
    { label: 'Invoices', value: summary ? String(summary.invoiceCount) : '—', detail: 'Cancelled bills excluded', icon: FileText, tint: 'blue' },
    { label: 'Total weight', value: summary ? `${summary.totalWeight.toLocaleString('en-IN', { maximumFractionDigits: 3 })} kg` : '—', detail: 'From saved invoice items', icon: Scale, tint: 'rose' },
  ]

  return <main className="min-h-screen bg-brand-paper text-slate-900">
    <header className="sticky top-0 z-10 border-b border-brand-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 md:px-8">
        <div className="flex items-center gap-3"><button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Back to overview"><ArrowLeft size={17} /></button><div><p className="text-sm font-bold">My Bill Book</p><p className="text-xs text-slate-500">Business reports</p></div></div>
        <span className="hidden text-sm text-slate-500 sm:block">{user.name}</span>
      </div>
    </header>
    <div className="mx-auto max-w-7xl space-y-6 px-5 py-8 md:px-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-red-950 p-7 text-white shadow-xl shadow-slate-900/10 md:p-9"><div className="pointer-events-none absolute -right-12 -top-24 h-72 w-72 rounded-full border-[38px] border-white/[0.04]" /><div className="pointer-events-none absolute -bottom-36 right-1/4 h-72 w-72 rounded-full bg-red-500/10 blur-3xl" /><div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-end"><div><div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-red-100"><span className="h-2 w-2 rounded-full bg-emerald-400" />Live business data</div><h1 className="text-3xl font-bold tracking-tight md:text-4xl">Sales reports</h1><p className="mt-2 max-w-xl text-sm text-slate-300">See your sales, GST, collections, and delivered weight from saved invoices.</p></div><button type="button" onClick={downloadCsv} disabled={!report?.invoices?.length || loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-900 shadow-lg transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"><Download size={16} />Export report</button></div></section>

      <section className="rounded-2xl border border-brand-line bg-white p-4 shadow-sm md:p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-bold">Filter your report</h2><p className="mt-1 text-xs text-slate-400">Choose a customer and date range</p></div><button type="button" onClick={() => setFilters({ from: '', to: '', customerId: '' })} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-stone-50 hover:text-brand-red"><RotateCcw size={14} />Reset</button></div><div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-medium text-slate-500">Customer<select value={filters.customerId} onChange={(event) => setFilters((current) => ({ ...current, customerId: event.target.value }))} className="mt-1 block h-11 w-full rounded-lg border border-brand-line bg-white px-3 text-sm text-slate-700"><option value="">All customers</option>{(report?.customers || []).map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
        <label className="text-xs font-medium text-slate-500"><span className="inline-flex items-center gap-1"><CalendarDays size={13} />From date</span><input type="date" max={filters.to || undefined} value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} className="mt-1 block h-11 w-full rounded-lg border border-brand-line px-3 text-sm text-slate-700" /></label>
        <label className="text-xs font-medium text-slate-500"><span className="inline-flex items-center gap-1"><CalendarDays size={13} />To date</span><input type="date" min={filters.from || undefined} value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} className="mt-1 block h-11 w-full rounded-lg border border-brand-line px-3 text-sm text-slate-700" /></label>
      </div></section>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{statCards.map(({ label, value, detail, icon: Icon, tint }) => { const tones = { red: 'bg-red-50 text-brand-red', emerald: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600', violet: 'bg-violet-50 text-violet-600', blue: 'bg-blue-50 text-blue-600', rose: 'bg-rose-50 text-rose-600' }; return <article key={label} className="group rounded-2xl border border-brand-line bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-500">{label}</p><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tint]}`}><Icon size={19} /></span></div><p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{loading ? '…' : value}</p><p className="mt-1 text-xs text-slate-400">{detail}</p>{label === 'Amount received' && <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${summary?.totalSales ? Math.min(100, summary.amountReceived / summary.totalSales * 100) : 0}%` }} /></div>}</article> })}</section>

      <section className="grid gap-5 xl:grid-cols-[1.55fr_1fr]"><article className="rounded-2xl border border-brand-line bg-white p-5 shadow-sm md:p-6"><div className="flex items-start justify-between"><div><h2 className="font-bold">Sales by month</h2><p className="mt-1 text-sm text-slate-500">Invoice totals within the selected filters</p></div><span className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-brand-red">{monthlySales.length ? `${monthlySales.length} months` : 'No data'}</span></div><div className="mt-6 flex h-56 items-end gap-3 overflow-x-auto border-b border-l border-slate-100 px-3 pb-0 pt-4 sm:gap-5">{monthlySales.map(([key, amount]) => <div key={key} className="group flex h-full min-w-12 flex-1 flex-col justify-end gap-2"><span className="text-center text-[10px] font-medium text-slate-400 opacity-0 transition group-hover:opacity-100">{currency.format(amount)}</span><div title={currency.format(amount)} className="w-full rounded-t-lg bg-gradient-to-t from-red-700 to-red-500 shadow-sm shadow-red-200 transition-all group-hover:from-red-800 group-hover:to-red-600" style={{ height: `${Math.max(4, amount / chartMaximum * 82)}%` }} /><span className="-mb-6 text-center text-xs text-slate-400">{new Intl.DateTimeFormat('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(`${key}-01T00:00:00Z`))}</span></div>)}{!monthlySales.length && !loading && <p className="m-auto text-sm text-slate-400">No invoice sales for this selection.</p>}</div></article><article className="rounded-2xl border border-brand-line bg-white p-5 shadow-sm md:p-6"><div><h2 className="font-bold">Payment status</h2><p className="mt-1 text-sm text-slate-500">Breakdown of active invoices</p></div><div className="flex items-center gap-5 py-5 sm:justify-center sm:gap-8"><div className="relative flex h-36 w-36 shrink-0 items-center justify-center rounded-full" style={{ background: paymentGradient }}><div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white"><span className="text-2xl font-bold">{paymentCount}</span><span className="text-xs text-slate-400">Invoices</span></div></div><div className="min-w-0 flex-1 space-y-3">{paymentGroups.map(({ label, color, icon: Icon, count, amount }) => <div key={label} className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-sm text-slate-600"><Icon size={16} style={{ color }} />{label}</span><span className="text-right"><strong className="block text-sm text-slate-800">{count}</strong><small className="text-xs text-slate-400">{currency.format(amount)}</small></span></div>)}</div></div></article></section>

      <section className="overflow-hidden rounded-2xl border border-brand-line bg-white shadow-sm"><div className="border-b border-brand-line p-5 md:px-6"><h2 className="font-bold">Invoice details</h2><p className="mt-1 text-sm text-slate-500">{loading ? 'Loading saved invoices…' : `${report?.invoices?.length || 0} invoices in this report`}</p></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-stone-50 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3 font-semibold">Invoice</th><th className="px-4 py-3 font-semibold">Customer</th><th className="px-4 py-3 font-semibold">Date</th><th className="px-4 py-3 text-right font-semibold">Subtotal</th><th className="px-4 py-3 text-right font-semibold">GST</th><th className="px-4 py-3 text-right font-semibold">Total</th><th className="px-4 py-3 text-right font-semibold">Weight</th><th className="px-5 py-3 font-semibold">Payment</th></tr></thead><tbody className="divide-y divide-brand-line">{(report?.invoices || []).map((invoice) => <tr key={invoice.id}><td className="px-5 py-4 font-semibold">{invoice.invoiceNumber}</td><td className="px-4 py-4">{invoice.customerName}</td><td className="px-4 py-4 text-slate-500">{formatDate(invoice.invoiceDate)}</td><td className="px-4 py-4 text-right">{currency.format(invoice.subtotal)}</td><td className="px-4 py-4 text-right">{currency.format(invoice.taxTotal)}</td><td className="px-4 py-4 text-right font-semibold">{currency.format(invoice.grandTotal)}</td><td className="px-4 py-4 text-right">{invoice.totalWeight === null ? '—' : `${invoice.totalWeight.toLocaleString('en-IN', { maximumFractionDigits: 3 })} kg`}</td><td className="px-5 py-4 text-xs font-semibold text-slate-600">{invoice.status}</td></tr>)}</tbody></table>{!loading && !error && report?.invoices?.length === 0 && <div className="p-10 text-center text-sm text-slate-500">No active invoices match these filters.</div>}</div></section>
    </div>
  </main>
}
