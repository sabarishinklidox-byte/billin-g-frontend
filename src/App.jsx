import { useEffect, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Bell, BookOpen, Boxes, Building2, ChartNoAxesCombined, ChevronDown, CircleHelp, FileText, LayoutDashboard, Menu, Percent, Plus, Scale, Search, Settings, ShoppingBag, Users, Wallet, X, Receipt, CalendarCheck, Activity } from 'lucide-react'
import { api } from './lib/api.js'
import Login from './pages/Login.jsx'
import Contact from './pages/Contact.jsx'
import ProductMaster from './pages/ProductMaster.jsx'
import GstMaster from './pages/GstMaster.jsx'
import CustomerMaster from './pages/CustomerMaster.jsx'
import InvoiceMaster from './pages/InvoiceMaster.jsx'
import BankMaster from './pages/BankMaster.jsx'
import CompanyMaster from './pages/CompanyMaster.jsx'
import Reports from './pages/Reports.jsx'
import ExpenseTracker from './pages/ExpenseTracker.jsx'
import Attendance from './pages/Attendance.jsx'
import CalculatorWidget from './components/CalculatorWidget.jsx'
import SalesActivity from './pages/SalesActivity.jsx'

const navigation = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Customer Master', icon: Users },
  { label: 'Product Master', icon: Boxes },
  { label: 'GST Master', icon: Percent },
  { label: 'Bank Master', icon: Building2 },
  { label: 'Company Details', icon: Building2 },
  { label: 'Sales', icon: ArrowUpRight },
  { label: 'Sales Activity', icon: Activity },
  { label: 'Purchases', icon: ShoppingBag },
  { label: 'Expenses', icon: Receipt },
  { label: 'Attendance', icon: CalendarCheck },
  { label: 'Reports', icon: ChartNoAxesCombined },
]

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

function App() {
  const [user, setUser] = useState(null)
  const [authPage, setAuthPage] = useState('login')
  const [active, setActive] = useState('Overview')
  const [menuOpen, setMenuOpen] = useState(false)
  const [dashboard, setDashboard] = useState(null)
  const [allInvoices, setAllInvoices] = useState([])
  const [invoiceDateFrom, setInvoiceDateFrom] = useState('')
  const [invoiceDateTo, setInvoiceDateTo] = useState('')
  const [invoiceCustomerId, setInvoiceCustomerId] = useState('')
  const [dashboardError, setDashboardError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('billbook-token') || sessionStorage.getItem('billbook-token')
    if (!token) return
    api.get('/auth/me')
      .then(({ data }) => setUser(data.user))
      .catch(() => {
        localStorage.removeItem('billbook-token')
        sessionStorage.removeItem('billbook-token')
      })
  }, [])

  useEffect(() => {
    if (!user || active !== 'Overview') return undefined
    let cancelled = false
    api.get('/dashboard')
      .then(({ data }) => {
        if (!cancelled) {
          setDashboard(data)
          setDashboardError('')
        }
      })
      .catch((error) => {
        if (!cancelled) setDashboardError(error.response?.data?.message || 'Could not load your business summary.')
      })
    api.get('/invoices')
      .then(({ data }) => { if (!cancelled) setAllInvoices(data.invoices || []) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user, active])

  if (!user) {
    return authPage === 'contact'
      ? <Contact onBack={() => setAuthPage('login')} />
      : <Login onLogin={setUser} onContact={() => setAuthPage('contact')} />
  }

  if (active === 'Product Master') {
    return <><ProductMaster user={user} onBack={() => setActive('Overview')} onManageGst={() => setActive('GST Master')} /><CalculatorWidget /></>
  }

  if (active === 'GST Master') {
    return <><GstMaster user={user} onBack={() => setActive('Overview')} /><CalculatorWidget /></>
  }

  if (active === 'Bank Master') {
    return <><BankMaster user={user} onBack={() => setActive('Overview')} /><CalculatorWidget /></>
  }

  if (active === 'Company Details') {
    return <><CompanyMaster user={user} onBack={() => setActive('Overview')} onSave={setUser} /><CalculatorWidget /></>
  }

  if (active === 'Customer Master') {
    return <><CustomerMaster user={user} onBack={() => setActive('Overview')} /><CalculatorWidget /></>
  }

  if (active === 'Sales') {
    return <><InvoiceMaster user={user} onBack={() => setActive('Overview')} onManageCustomers={() => setActive('Customer Master')} onManageProducts={() => setActive('Product Master')} onManageBanks={() => setActive('Bank Master')} /><CalculatorWidget /></>
  }

  if (active === 'Sales Activity') {
    return <><SalesActivity user={user} onBack={() => setActive('Overview')} /><CalculatorWidget /></>
  }

  if (active === 'Reports') {
    return <><Reports user={user} onBack={() => setActive('Overview')} /><CalculatorWidget /></>
  }

  if (active === 'Expenses') {
    return <><ExpenseTracker user={user} onBack={() => setActive('Overview')} /><CalculatorWidget /></>
  }
  if (active === 'Attendance') {
    return <><Attendance user={user} onBack={() => setActive('Overview')} /><CalculatorWidget /></>
  }

  const summary = dashboard?.summary
  const recentInvoices = dashboard?.recentInvoices || []
  const invoiceCustomers = [...new Map(allInvoices.map((invoice) => [invoice.customerId, invoice.customer.name])).entries()]
  const hasInvoiceFilters = Boolean(invoiceDateFrom || invoiceDateTo || invoiceCustomerId)
  const matchesInvoiceFilters = (invoice) => {
    const invoiceDay = invoice.invoiceDate.slice(0, 10)
    return (!invoiceDateFrom || invoiceDay >= invoiceDateFrom)
      && (!invoiceDateTo || invoiceDay <= invoiceDateTo)
      && (!invoiceCustomerId || invoice.customerId === invoiceCustomerId)
  }
  const filteredAllInvoices = allInvoices.filter(matchesInvoiceFilters)
  const displayedInvoices = hasInvoiceFilters ? filteredAllInvoices : recentInvoices
  const filteredValidInvoices = filteredAllInvoices.filter((invoice) => invoice.status !== 'VOID' && invoice.workflowStatus !== 'CANCELLED')
  const totalForStatus = (statusList) => filteredValidInvoices.filter((invoice) => statusList.includes(invoice.status)).reduce((sum, invoice) => sum + Number(invoice.grandTotal), 0)
  const currentMonthKey = new Date().toISOString().slice(0, 7)
  const previousMonthDate = new Date()
  previousMonthDate.setMonth(previousMonthDate.getMonth() - 1)
  const previousMonthKey = previousMonthDate.toISOString().slice(0, 7)
  const currentFilteredSales = filteredValidInvoices.filter((invoice) => invoice.invoiceDate.startsWith(currentMonthKey)).reduce((sum, invoice) => sum + Number(invoice.grandTotal), 0)
  const previousFilteredSales = filteredValidInvoices.filter((invoice) => invoice.invoiceDate.startsWith(previousMonthKey)).reduce((sum, invoice) => sum + Number(invoice.grandTotal), 0)
  const filteredSummary = hasInvoiceFilters ? {
    totalSales: totalForStatus(['ISSUED', 'PARTIAL', 'PAID', 'OVERDUE']),
    amountReceived: totalForStatus(['PAID']),
    toCollect: totalForStatus(['ISSUED', 'PARTIAL', 'OVERDUE']),
    totalInvoices: filteredValidInvoices.length,
    createdThisMonth: filteredValidInvoices.filter((invoice) => invoice.invoiceDate.startsWith(currentMonthKey)).length,
    salesChangePercent: previousFilteredSales ? Math.round(((currentFilteredSales - previousFilteredSales) / previousFilteredSales) * 1000) / 10 : currentFilteredSales ? 100 : 0,
    paidCount: filteredValidInvoices.filter((invoice) => invoice.status === 'PAID').length,
    pendingCount: filteredValidInvoices.filter((invoice) => ['ISSUED', 'PARTIAL'].includes(invoice.status)).length,
    overdueCount: filteredValidInvoices.filter((invoice) => invoice.status === 'OVERDUE').length,
    totalWeight: filteredValidInvoices.some((invoice) => invoice.totalWeight !== null) ? filteredValidInvoices.reduce((sum, invoice) => sum + Number(invoice.totalWeight || 0), 0) : null,
  } : summary
  const summaryForDisplay = filteredSummary || summary
  const monthlySales = hasInvoiceFilters
    ? Array.from({ length: 7 }, (_, index) => {
      const month = new Date()
      month.setDate(1)
      month.setMonth(month.getMonth() + index - 6)
      const key = month.toISOString().slice(0, 7)
      return { key, label: new Intl.DateTimeFormat('en-IN', { month: 'short', timeZone: 'UTC' }).format(month), amount: filteredValidInvoices.filter((invoice) => invoice.invoiceDate.startsWith(key)).reduce((sum, invoice) => sum + Number(invoice.grandTotal), 0) }
    })
    : dashboard?.monthlySales || []
  const chartMaximum = Math.max(1, ...monthlySales.map((month) => month.amount))
  const paidCount = summaryForDisplay?.paidCount || 0
  const pendingCount = summaryForDisplay?.pendingCount || 0
  const overdueCount = summaryForDisplay?.overdueCount || 0
  const paymentCount = paidCount + pendingCount + overdueCount
  const paidAngle = paymentCount ? paidCount / paymentCount * 360 : 0
  const pendingAngle = paymentCount ? paidAngle + pendingCount / paymentCount * 360 : 0
  const paymentGradient = paymentCount
    ? `conic-gradient(var(--brand-red) 0deg ${paidAngle}deg, #f59e0b ${paidAngle}deg ${pendingAngle}deg, #cbd5e1 ${pendingAngle}deg 360deg)`
    : 'conic-gradient(#e2e8f0 0deg 360deg)'

  return (
    <div className="min-h-screen bg-brand-paper text-slate-900">
      <aside className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col overflow-y-auto border-r border-slate-200 bg-white transition-transform lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-20 items-center gap-3 border-b border-slate-100 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-red text-white"><BookOpen size={21} /></div>
          <div><p className="font-bold tracking-tight">My Bill Book</p><p className="text-xs text-slate-500">Business made simple</p></div>
          <button className="ml-auto lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Close navigation"><X size={19} /></button>
        </div>
        <div className="px-4 pt-7">
          <p className="px-3 pb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Workspace</p>
          <nav className="space-y-1">{navigation.map(({ label, icon: Icon }) => <button key={label} onClick={() => { setActive(label); setMenuOpen(false) }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active === label ? 'bg-red-50 text-brand-deep' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}><Icon size={18} strokeWidth={1.8} />{label}{label === 'Sales' && <span className="ml-auto rounded-md bg-white px-2 py-0.5 text-xs text-slate-500">24</span>}</button>)}</nav>
        </div>
        <div className="mt-auto space-y-1 border-t border-slate-100 p-4">
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 hover:bg-slate-50"><CircleHelp size={18} />Help & support</button>
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 hover:bg-slate-50"><Settings size={18} />Settings</button>
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-slate-50 p-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">{user.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{user.name}</p><p className="text-xs text-slate-500">Owner</p></div><ChevronDown size={16} className="text-slate-400" /></div>
        </div>
      </aside>
      {menuOpen && <button className="fixed inset-0 z-20 bg-slate-900/30 lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Close navigation overlay" />}

      <main className="lg:pl-64">
        <header className="sticky top-0 z-10 flex h-20 items-center justify-between border-b border-slate-200 bg-white/90 px-5 backdrop-blur md:px-8">
          <div className="flex items-center gap-3"><button className="lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Menu size={21} /></button><div><p className="text-sm text-slate-500">My Bill Book</p><h1 className="text-lg font-bold">Good morning, {user.name}</h1></div></div>
          <div className="flex items-center gap-2"><button className="hidden h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm text-slate-500 sm:flex"><Search size={16} />Search anything <kbd className="ml-5 rounded border border-slate-200 px-1.5 py-0.5 text-[10px]">⌘ K</kbd></button><button className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Notifications"><Bell size={18} /><span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" /></button></div>
        </header>

        <div className="mx-auto max-w-7xl space-y-7 p-5 md:p-8">
          <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h2 className="text-2xl font-bold tracking-tight">Business overview</h2><p className="mt-1 text-sm text-slate-500">Here’s what’s happening with your business today.</p></div><button onClick={() => setActive('Sales')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-red px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-red-100 hover:bg-brand-deep"><Plus size={17} />Create invoice</button></section>

          <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-3"><label className="text-xs font-medium text-slate-500">Customer<select aria-label="Filter dashboard by customer" value={invoiceCustomerId} onChange={(event) => setInvoiceCustomerId(event.target.value)} className="mt-1 block h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"><option value="">All customers</option>{invoiceCustomers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><label className="text-xs font-medium text-slate-500">From date<input aria-label="From date" type="date" max={invoiceDateTo || undefined} value={invoiceDateFrom} onChange={(event) => setInvoiceDateFrom(event.target.value)} className="mt-1 block h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700" /></label><label className="text-xs font-medium text-slate-500">To date<input aria-label="To date" type="date" min={invoiceDateFrom || undefined} value={invoiceDateTo} onChange={(event) => setInvoiceDateTo(event.target.value)} className="mt-1 block h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700" /></label></section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard title="Total sales" value={summaryForDisplay ? currency.format(summaryForDisplay.totalSales) : '—'} note={summaryForDisplay ? `Monthly sales ${summaryForDisplay.salesChangePercent > 0 ? '+' : ''}${summaryForDisplay.salesChangePercent}% vs last month` : dashboardError || 'Loading your sales'} icon={Wallet} positive={summaryForDisplay?.salesChangePercent >= 0} />
            <StatCard title="Amount received" value={summaryForDisplay ? currency.format(summaryForDisplay.amountReceived) : '—'} note={summaryForDisplay ? 'From invoices marked paid' : 'Loading payments'} icon={ArrowDownLeft} positive />
            <StatCard title="To collect" value={summaryForDisplay ? currency.format(summaryForDisplay.toCollect) : '—'} note={summaryForDisplay ? 'On open invoices' : 'Loading open invoices'} icon={ArrowUpRight} />
            <StatCard title="Total invoices" value={summaryForDisplay ? String(summaryForDisplay.totalInvoices) : '—'} note={summaryForDisplay ? `${summaryForDisplay.createdThisMonth} created this month` : 'Loading invoices'} icon={FileText} positive />
            <StatCard title="Total weight" value={summaryForDisplay?.totalWeight == null ? '—' : `${Number(summaryForDisplay.totalWeight).toLocaleString('en-IN', { maximumFractionDigits: 3 })} kg`} note={summaryForDisplay?.totalWeight == null ? 'No invoice weights recorded' : 'Across saved invoices'} icon={Scale} />
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.65fr_1fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6"><div className="mb-6 flex items-start justify-between"><div><h3 className="font-bold">Sales overview</h3><p className="mt-1 text-sm text-slate-500">Invoice totals over the last 7 months</p></div><span className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600">Last 7 months</span></div><div className="flex h-52 items-end gap-3 border-b border-l border-slate-100 px-3 pb-0 pt-4 sm:gap-5">{monthlySales.map((month) => <div key={month.key} className="flex h-full flex-1 flex-col justify-end gap-2"><div title={currency.format(month.amount)} className="w-full rounded-t-md bg-brand-red transition hover:bg-brand-deep" style={{height:`${month.amount ? Math.max(4, month.amount / chartMaximum * 100) : 0}%`}} /><span className="-mb-6 text-center text-xs text-slate-400">{month.label}</span></div>)}</div><div className="mt-10 flex items-center justify-between text-xs text-slate-500"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-brand-red" />Sales invoiced</span>{dashboardError && <span role="status" className="text-rose-600">{dashboardError}</span>}</div></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6"><div className="mb-5"><h3 className="font-bold">Payment summary</h3><p className="mt-1 text-sm text-slate-500">Invoice payment status</p></div><div className="flex items-center justify-center py-2"><div className="relative flex h-40 w-40 items-center justify-center rounded-full" style={{background:paymentGradient}}><div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-white"><span className="text-2xl font-bold">{summaryForDisplay?.totalInvoices ?? '—'}</span><span className="text-xs text-slate-400">Invoices</span></div></div></div><div className="mt-4 space-y-3">{[['Paid',paidCount,'bg-brand-red'],['Pending',pendingCount,'bg-amber-500'],['Overdue',overdueCount,'bg-slate-300']].map(([name,count,color])=><div key={name} className="flex items-center justify-between text-sm"><span className="flex items-center gap-2 text-slate-600"><i className={`h-2.5 w-2.5 rounded-full ${color}`} />{name}</span><span className="font-medium text-slate-800">{count} invoices</span></div>)}</div></div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="flex flex-col gap-4 p-5 md:px-6"><div className="flex flex-col justify-between gap-3 md:flex-row md:items-center"><div><h3 className="font-bold">{hasInvoiceFilters ? 'Invoices' : 'Recent invoices'}</h3><p className="mt-1 text-sm text-slate-500">{hasInvoiceFilters ? `Showing ${displayedInvoices.length} matching invoices` : 'Your latest saved transactions'}</p></div><button onClick={() => setActive('Sales')} className="self-start text-sm font-semibold text-brand-red hover:text-brand-deep md:self-auto">View all invoices →</button></div></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-y border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-400"><tr><th className="px-6 py-3 font-semibold">Invoice</th><th className="px-4 py-3 font-semibold">Customer</th><th className="px-4 py-3 font-semibold">Date</th><th className="px-4 py-3 font-semibold">Weight</th><th className="px-4 py-3 font-semibold">Amount</th><th className="px-6 py-3 font-semibold">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{displayedInvoices.map((invoice) => { const workflowStatus = invoice.workflowStatus || "ISSUED"; const completed = workflowStatus === "COMPLETED"; const cancelled = workflowStatus === "CANCELLED"; const paid = completed; const overdue = cancelled; const customerName = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer.name; const initials = customerName.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase(); return <tr key={invoice.id} className="hover:bg-slate-50/70"><td className="px-6 py-4 font-semibold text-slate-700">{invoice.invoiceNumber}</td><td className="px-4 py-4"><span className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-[10px] font-bold text-brand-red">{initials}</span><span className="font-medium">{customerName}</span></span></td><td className="px-4 py-4 text-slate-500">{new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${invoice.invoiceDate}T00:00:00Z`))}</td><td className="px-4 py-4 text-slate-500">{invoice.totalWeight === null || invoice.totalWeight === undefined ? '—' : `${Number(invoice.totalWeight).toLocaleString('en-IN', { maximumFractionDigits: 3 })} kg`}</td><td className="px-4 py-4 font-semibold">{currency.format(invoice.grandTotal)}</td><td className="px-6 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${paid ? 'bg-emerald-50 text-emerald-700' : overdue ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{completed ? "Completed" : cancelled ? "Cancelled" : "Issued"}</span></td></tr> })}</tbody></table>{displayedInvoices.length === 0 && <div className="p-10 text-center text-sm text-slate-500">{hasInvoiceFilters ? 'No invoices match these filters.' : 'Your saved invoices will appear here.'}</div>}</div></section>
          <footer className="pb-2 text-center text-xs text-slate-400">My Bill Book · Your business, in one place</footer>
        </div>
      </main>
      <CalculatorWidget />
    </div>
  )
}

function StatCard({ title, value, note, icon: Icon, positive = false }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-500">{title}</p><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-brand-red"><Icon size={18} /></span></div><p className="mt-4 text-2xl font-bold tracking-tight">{value}</p><p className="mt-2 text-xs"><span className={positive ? 'font-semibold text-emerald-600' : 'font-semibold text-slate-700'}>{note.split(' ').slice(0, 3).join(' ')}</span><span className="text-slate-400"> {note.split(' ').slice(3).join(' ')}</span></p></div>
}

export default App
