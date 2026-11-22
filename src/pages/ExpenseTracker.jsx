import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CalendarDays, Download, Plus, Receipt, Search, Trash2, Wallet, X } from 'lucide-react'
import { createExpense, deleteExpense, getExpenses, updateExpense } from '../lib/api.js'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })
const categories = ['Office supplies', 'Travel', 'Utilities', 'Rent', 'Food', 'Marketing', 'Salaries', 'Repairs', 'Other']
const paymentModes = ['Cash', 'UPI', 'Card', 'Bank transfer', 'Other']
const today = () => new Date().toISOString().slice(0, 10)
const blankForm = () => ({ title: '', category: 'Other', amount: '', expenseDate: today(), paymentMode: 'Cash', notes: '' })
const dateLabel = (value) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${String(value).slice(0, 10)}T00:00:00Z`))

export default function ExpenseTracker({ user, onBack }) {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(blankForm)
  const [categoryInput, setCategoryInput] = useState('Other')
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  async function loadExpenses() {
    setLoading(true)
    try {
      const { data } = await getExpenses()
      setExpenses(data.expenses || [])
      setError('')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not load expenses. Check that the API and database are running.')
    } finally { setLoading(false) }
  }
  useEffect(() => { loadExpenses() }, [])

  const filtered = useMemo(() => expenses.filter((expense) => {
    const day = String(expense.expenseDate).slice(0, 10)
    const matchesQuery = `${expense.title} ${expense.category} ${expense.notes || ''}`.toLowerCase().includes(query.trim().toLowerCase())
    return matchesQuery && (!categoryFilter || expense.category === categoryFilter) && (!from || day >= from) && (!to || day <= to)
  }), [expenses, query, categoryFilter, from, to])
  const total = filtered.reduce((sum, expense) => sum + Number(expense.amount), 0)
  const monthKey = today().slice(0, 7)
  const monthTotal = expenses.filter((expense) => String(expense.expenseDate).slice(0, 7) === monthKey).reduce((sum, expense) => sum + Number(expense.amount), 0)
  const categoryTotals = useMemo(() => {
    const totals = new Map()
    filtered.forEach((expense) => totals.set(expense.category, (totals.get(expense.category) || 0) + Number(expense.amount)))
    return [...totals.entries()].sort((a, b) => b[1] - a[1])
  }, [filtered])
  const chartMaximum = Math.max(1, ...categoryTotals.map(([, amount]) => amount))
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageExpenses = filtered.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => { setPage(1) }, [query, categoryFilter, from, to])
  useEffect(() => { if (page > pageCount) setPage(pageCount) }, [page, pageCount])

  function openNew() { setEditingId(null); setForm(blankForm()); setCategoryInput('Other'); setCategoryOpen(false); setError(''); setFormOpen(true) }
  function openEdit(expense) {
    setEditingId(expense.id)
    setForm({ title: expense.title, category: expense.category, amount: String(expense.amount), expenseDate: String(expense.expenseDate).slice(0, 10), paymentMode: expense.paymentMode, notes: expense.notes || '' })
    setCategoryInput(expense.category)
    setCategoryOpen(false)
    setError(''); setFormOpen(true)
  }
  async function submit(event) {
    event.preventDefault(); setSaving(true); setError('')
    try {
      const expenseData = { ...form, category: categoryInput.trim() }
      if (editingId) await updateExpense(editingId, expenseData)
      else await createExpense(expenseData)
      setFormOpen(false); setForm(blankForm()); setEditingId(null)
      await loadExpenses()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not save this expense.')
    } finally { setSaving(false) }
  }
  const categoryOptions = [...new Set([...categories, ...expenses.map((item) => item.category)])]
  const matchingCategories = categoryOptions.filter((name) => name.toLowerCase().includes(categoryInput.trim().toLowerCase()))
  const canAddCategory = Boolean(categoryInput.trim()) && !categoryOptions.some((name) => name.toLowerCase() === categoryInput.trim().toLowerCase())
  async function removeExpense(expense) {
    if (!window.confirm(`Delete “${expense.title}”? This cannot be undone.`)) return
    try { await deleteExpense(expense.id); setExpenses((current) => current.filter((item) => item.id !== expense.id)); setError('') }
    catch (requestError) { setError(requestError.response?.data?.message || 'Could not delete this expense.') }
  }
  function exportCsv() {
    const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
    const rows = [['Date', 'Title', 'Category', 'Payment method', 'Amount', 'Notes'], ...filtered.map((item) => [String(item.expenseDate).slice(0, 10), item.title, item.category, item.paymentMode, Number(item.amount).toFixed(2), item.notes])]
    const content = rows.map((row) => row.map(escape).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = 'my-bill-book-expenses.csv'; link.click(); URL.revokeObjectURL(url)
  }

  return <main className="min-h-screen bg-brand-paper text-slate-900">
    <header className="sticky top-0 z-10 border-b border-brand-line bg-white/95 backdrop-blur"><div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 md:px-8"><div className="flex items-center gap-3"><button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Back to overview"><ArrowLeft size={17} /></button><div><p className="text-sm font-bold">My Bill Book</p><p className="text-xs text-slate-500">Expense tracker</p></div></div><span className="hidden text-sm text-slate-500 sm:block">{user.name}</span></div></header>
    <div className="mx-auto max-w-7xl space-y-6 px-5 py-8 md:px-8">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold text-brand-red">Business spending</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Expense tracker</h1><p className="mt-2 text-sm text-slate-500">Record and review the money going out of your business.</p></div><div className="flex gap-2"><button onClick={exportCsv} disabled={!filtered.length} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Download size={16} />Export CSV</button><button onClick={openNew} className="inline-flex items-center gap-2 rounded-xl bg-brand-red px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-deep"><Plus size={17} />Add expense</button></div></section>
      <section className="grid gap-4 sm:grid-cols-2"><article className="rounded-2xl border border-brand-line bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-500">Expenses this month</p><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-brand-red"><Wallet size={19} /></span></div><p className="mt-3 text-2xl font-bold">{currency.format(monthTotal)}</p><p className="mt-1 text-xs text-slate-400">{expenses.filter((item) => String(item.expenseDate).slice(0, 7) === monthKey).length} recorded this month</p></article><article className="rounded-2xl border border-brand-line bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-500">Filtered total</p><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><Receipt size={19} /></span></div><p className="mt-3 text-2xl font-bold">{currency.format(total)}</p><p className="mt-1 text-xs text-slate-400">Across {filtered.length} {filtered.length === 1 ? 'expense' : 'expenses'}</p></article></section>
      <section className="rounded-2xl border border-brand-line bg-white p-5 shadow-sm md:p-6"><div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><h2 className="font-bold">Spending by category</h2><p className="mt-1 text-sm text-slate-500">Category totals for the selected filters</p></div><span className="text-sm font-semibold text-slate-700">{currency.format(total)}</span></div>{categoryTotals.length ? <div className="mt-5 space-y-4">{categoryTotals.map(([name, amount]) => <div key={name} className="grid grid-cols-[minmax(90px,140px)_1fr_auto] items-center gap-3 text-sm"><span className="truncate font-medium text-slate-600" title={name}>{name}</span><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full min-w-1 rounded-full bg-brand-red transition-all" style={{ width: `${Math.max(1, amount / chartMaximum * 100)}%` }} /></div><span className="text-right text-xs font-semibold text-slate-700 sm:text-sm">{currency.format(amount)}</span></div>)}</div> : <p className="mt-5 rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-400">Add expenses to see your category chart.</p>}</section>
      <section className="rounded-2xl border border-brand-line bg-white p-4 shadow-sm md:p-5"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><label className="text-xs font-medium text-slate-500 xl:col-span-1">Search expenses<span className="relative mt-1 block"><Search size={15} className="absolute left-3 top-3 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title, category, notes" className="h-10 w-full rounded-lg border border-brand-line pl-9 pr-3 text-sm text-slate-700" /></span></label><label className="text-xs font-medium text-slate-500">Category<select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="mt-1 block h-10 w-full rounded-lg border border-brand-line bg-white px-3 text-sm text-slate-700"><option value="">All categories</option>{[...new Set([...categories, ...expenses.map((item) => item.category)])].map((name) => <option key={name} value={name}>{name}</option>)}</select></label><label className="text-xs font-medium text-slate-500"><span className="inline-flex items-center gap-1"><CalendarDays size={13} />From date</span><input type="date" max={to || undefined} value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 block h-10 w-full rounded-lg border border-brand-line px-3 text-sm text-slate-700" /></label><label className="text-xs font-medium text-slate-500"><span className="inline-flex items-center gap-1"><CalendarDays size={13} />To date</span><input type="date" min={from || undefined} value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 block h-10 w-full rounded-lg border border-brand-line px-3 text-sm text-slate-700" /></label></div></section>
      {error && !formOpen && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      <section className="overflow-hidden rounded-2xl border border-brand-line bg-white shadow-sm"><div className="border-b border-brand-line p-5 md:px-6"><h2 className="font-bold">Expense history</h2><p className="mt-1 text-sm text-slate-500">{loading ? 'Loading saved expenses…' : `${filtered.length} expenses shown`}</p></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-stone-50 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-6 py-3 font-semibold">Expense</th><th className="px-4 py-3 font-semibold">Category</th><th className="px-4 py-3 font-semibold">Date</th><th className="px-4 py-3 font-semibold">Payment</th><th className="px-4 py-3 text-right font-semibold">Amount</th><th className="px-6 py-3 text-right font-semibold">Actions</th></tr></thead><tbody className="divide-y divide-brand-line">{pageExpenses.map((expense) => <tr key={expense.id} className="hover:bg-stone-50/70"><td className="px-6 py-4"><p className="font-semibold text-slate-800">{expense.title}</p>{expense.notes && <p className="mt-0.5 max-w-xs truncate text-xs text-slate-400">{expense.notes}</p>}</td><td className="px-4 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{expense.category}</span></td><td className="px-4 py-4 text-slate-500">{dateLabel(expense.expenseDate)}</td><td className="px-4 py-4 text-slate-500">{expense.paymentMode}</td><td className="px-4 py-4 text-right font-semibold">{currency.format(expense.amount)}</td><td className="px-6 py-4"><div className="flex justify-end gap-2"><button onClick={() => openEdit(expense)} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-red hover:bg-red-50">Edit</button><button onClick={() => removeExpense(expense)} aria-label={`Delete ${expense.title}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button></div></td></tr>)}</tbody></table>{!loading && !filtered.length && <div className="p-12 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-brand-red"><Receipt size={22} /></span><p className="mt-4 font-semibold text-slate-700">{expenses.length ? 'No expenses match these filters' : 'No expenses recorded yet'}</p><p className="mt-1 text-sm text-slate-400">{expenses.length ? 'Try adjusting your search or date range.' : 'Add your first business expense to start tracking spending.'}</p>{!expenses.length && <button onClick={openNew} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-red px-3 py-2 text-sm font-semibold text-white"><Plus size={15} />Add expense</button>}</div>}{filtered.length > 0 && <div className="flex flex-col gap-3 border-t border-brand-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-slate-500">Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length} expenses</p><div className="flex items-center justify-end gap-1"><button disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>{Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => <button key={pageNumber} onClick={() => setPage(pageNumber)} aria-current={page === pageNumber ? 'page' : undefined} className={`h-9 min-w-9 rounded-lg px-2 text-xs font-semibold ${page === pageNumber ? 'bg-brand-red text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{pageNumber}</button>)}<button disabled={page === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Next</button></div></div>}</div></section>
    </div>
    {formOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false) }}><section role="dialog" aria-modal="true" aria-labelledby="expense-form-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl md:p-7"><div className="flex items-start justify-between"><div><h2 id="expense-form-title" className="text-xl font-bold">{editingId ? 'Edit expense' : 'Add an expense'}</h2><p className="mt-1 text-sm text-slate-500">Enter the details for this business expense.</p></div><button onClick={() => setFormOpen(false)} aria-label="Close form" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button></div><form onSubmit={submit} className="mt-6 space-y-4">{error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}<label className="block text-xs font-semibold text-slate-600">Expense title<input required maxLength={160} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Monthly internet bill" className="mt-1.5 h-11 w-full rounded-lg border border-brand-line px-3 text-sm font-normal text-slate-800" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block text-xs font-semibold text-slate-600">Amount (₹)<input required min="0.01" step="0.01" type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="0.00" className="mt-1.5 h-11 w-full rounded-lg border border-brand-line px-3 text-sm font-normal text-slate-800" /></label><label className="block text-xs font-semibold text-slate-600">Date<input required type="date" value={form.expenseDate} onChange={(event) => setForm({ ...form, expenseDate: event.target.value })} className="mt-1.5 h-11 w-full rounded-lg border border-brand-line px-3 text-sm font-normal text-slate-800" /></label><div className="relative"><label htmlFor="expense-category" className="block text-xs font-semibold text-slate-600">Category</label><input id="expense-category" role="combobox" aria-expanded={categoryOpen} aria-controls="expense-category-options" aria-autocomplete="list" autoComplete="off" maxLength={80} value={categoryInput} onFocus={() => setCategoryOpen(true)} onBlur={() => window.setTimeout(() => setCategoryOpen(false), 120)} onChange={(event) => { setCategoryInput(event.target.value); setForm((current) => ({ ...current, category: event.target.value })); setCategoryOpen(true) }} onKeyDown={(event) => { if (event.key === 'Enter' && categoryInput.trim()) { event.preventDefault(); setCategoryOpen(false) } if (event.key === 'Escape') setCategoryOpen(false) }} placeholder="Choose or type a category" className="mt-1.5 h-11 w-full rounded-lg border border-brand-line bg-white px-3 text-sm font-normal text-slate-800" />{categoryOpen && <div id="expense-category-options" role="listbox" className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">{matchingCategories.map((name) => <button key={name} type="button" role="option" aria-selected={categoryInput === name} onMouseDown={(event) => event.preventDefault()} onClick={() => { setCategoryInput(name); setForm((current) => ({ ...current, category: name })); setCategoryOpen(false) }} className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-red-50 hover:text-brand-red">{name}</button>)}{canAddCategory && <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setCategoryInput(categoryInput.trim()); setForm((current) => ({ ...current, category: categoryInput.trim() })); setCategoryOpen(false) }} className="mt-1 flex w-full items-center gap-2 rounded-md border-t border-slate-100 px-3 py-2.5 text-left text-sm font-semibold text-brand-red hover:bg-red-50"><Plus size={15} />Add “{categoryInput.trim()}”</button>}{!matchingCategories.length && !canAddCategory && <p className="px-3 py-2 text-sm text-slate-400">Type a category name to add it.</p>}</div>}<p className="mt-1 text-[11px] font-normal text-slate-400">Choose a suggestion or type your own.</p></div><label className="block text-xs font-semibold text-slate-600">Payment method<select value={form.paymentMode} onChange={(event) => setForm({ ...form, paymentMode: event.target.value })} className="mt-1.5 h-11 w-full rounded-lg border border-brand-line bg-white px-3 text-sm font-normal text-slate-800">{paymentModes.map((name) => <option key={name}>{name}</option>)}</select></label></div><label className="block text-xs font-semibold text-slate-600">Notes <span className="font-normal text-slate-400">(optional)</span><textarea maxLength={1000} rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Add a note or reference" className="mt-1.5 w-full rounded-lg border border-brand-line px-3 py-2 text-sm font-normal text-slate-800" /></label><div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setFormOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button><button disabled={saving || !categoryInput.trim()} className="rounded-lg bg-brand-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60">{saving ? 'Saving…' : editingId ? 'Save changes' : 'Save expense'}</button></div></form></section></div>}
  </main>
}
