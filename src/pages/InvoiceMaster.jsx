import { Fragment, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, ChevronDown, FilePlus2, FileText, Printer, Search, Trash2, X } from 'lucide-react'
import { createInvoice, getBankAccounts, getCustomers, getInvoice, getInvoices, getProducts, updateInvoice, updateInvoicePaymentStatus, updateInvoiceWorkflowStatus } from '../lib/api.js'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })
const today = () => {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}
const displayDate = (date) => date ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${date.slice(0, 10)}T00:00:00Z`)) : 'â€”'
const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100
function formatCustomerAddress(customer) {
  if (!customer) return ''
  const billingAddress = String(customer.billingAddress || customer.billing_address || customer.address || '').replace(/\bPIN(?:\s*CODE)?\s*[:#-]?\s*(?=\d)/gi, '').replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ').trim()
  const doorNumber = String(customer.doorNumber || customer.door_number || '').trim()
  const pincode = String(customer.pincode || customer.pinCode || customer.postalCode || '').trim()
  const parts = []
  if (doorNumber && !billingAddress.toLowerCase().includes(doorNumber.toLowerCase())) parts.push(doorNumber)
  if (billingAddress) parts.push(billingAddress)
  if (pincode && !parts.join(' ').includes(pincode)) parts.push(pincode)
  return parts.join(', ')
}

export default function InvoiceMaster({ user, onBack, onManageCustomers, onManageProducts, onManageBanks }) {
  const [invoices, setInvoices] = useState([])
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [bankAccounts, setBankAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list')
  const [currentInvoice, setCurrentInvoice] = useState(null)
  const [editingInvoice, setEditingInvoice] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [updatingStatusId, setUpdatingStatusId] = useState('')
  const [updatingPaymentId, setUpdatingPaymentId] = useState('')
  const [query, setQuery] = useState('')
  const [filterCustomerId, setFilterCustomerId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState(user.nextInvoiceNumber || 1)
  const [bankAccountId, setBankAccountId] = useState('')
  const [billingAddress, setBillingAddress] = useState('')
  const [shippingAddress, setShippingAddress] = useState('')
  const [shippingSameAsBilling, setShippingSameAsBilling] = useState(true)
  const [invoiceDate, setInvoiceDate] = useState(today())
  const [dueDate, setDueDate] = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([])

  useEffect(() => {
    Promise.all([getInvoices(), getCustomers(), getProducts(), getBankAccounts()])
      .then(([invoiceResponse, customerResponse, productResponse, bankResponse]) => {
        setInvoices(invoiceResponse.data.invoices)
        setCustomers(customerResponse.data.customers)
        setProducts(productResponse.data.products)
        setBankAccounts(bankResponse.data.accounts)
        setBankAccountId(bankResponse.data.accounts.find((account) => account.isDefault)?.id || '')
      })
      .catch((requestError) => setError(requestError.response?.data?.message || 'Could not load invoices. Check that the API and database are running.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!customerId || editingInvoice?.customerId === customerId) return
    const customer = customers.find((candidate) => candidate.id === customerId)
    if (!customer) return
    const address = formatCustomerAddress(customer)
    setBillingAddress(address)
    setShippingAddress(address)
    setShippingSameAsBilling(true)
  }, [customerId, customers, editingInvoice])

  const visibleInvoices = useMemo(() => {
    const search = query.trim().toLowerCase()
    return invoices.filter((invoice) => {
      const matchesSearch = !search || `${invoice.invoiceNumber} ${invoice.customer.name}`.toLowerCase().includes(search)
      const invoiceDay = invoice.invoiceDate.slice(0, 10)
      const matchesCustomer = !filterCustomerId || invoice.customerId === filterCustomerId
      const matchesFrom = !dateFrom || invoiceDay >= dateFrom
      const matchesTo = !dateTo || invoiceDay <= dateTo
      return matchesSearch && matchesCustomer && matchesFrom && matchesTo
    })
  }, [invoices, query, filterCustomerId, dateFrom, dateTo])

  const itemRows = items.map((item) => {
    const product = products.find((candidate) => candidate.id === item.productId)
    const quantity = Number(item.quantity) || 0
    const unitPrice = item.unitPriceOverride ?? (product ? Number(product.salePrice) : 0)
    const gstRate = item.gstRateOverride ?? (product ? Number(product.gstRate?.percentage ?? product.gst) : 0)
    const taxableAmount = roundMoney(unitPrice * quantity)
    const taxAmount = roundMoney(taxableAmount * gstRate / 100)
    return { ...item, product, quantity, unitPrice, gstRate, taxableAmount, taxAmount, lineTotal: roundMoney(taxableAmount + taxAmount) }
  })
  const subtotal = roundMoney(itemRows.reduce((sum, item) => sum + item.taxableAmount, 0))
  const taxTotal = roundMoney(itemRows.reduce((sum, item) => sum + item.taxAmount, 0))
  const grandTotal = roundMoney(subtotal + taxTotal)
  const activeInvoices = invoices.filter((invoice) => invoice.workflowStatus !== 'CANCELLED' && invoice.status !== 'VOID')
  const issuedInvoiceCount = invoices.filter((invoice) => invoice.workflowStatus === 'ISSUED' && invoice.status !== 'VOID').length
  const completedInvoiceCount = invoices.filter((invoice) => invoice.workflowStatus === 'COMPLETED').length
  const cancelledInvoiceCount = invoices.filter((invoice) => invoice.workflowStatus === 'CANCELLED' || invoice.status === 'VOID').length
  const issuedAmount = activeInvoices.filter((invoice) => ['ISSUED', 'PARTIAL', 'OVERDUE'].includes(invoice.status)).reduce((sum, invoice) => sum + Number(invoice.grandTotal), 0)
  const taxAmountTotal = activeInvoices.reduce((sum, invoice) => sum + Number(invoice.taxTotal), 0)
  const totalWeight = activeInvoices.reduce((sum, invoice) => sum + (Number(invoice.totalWeight) || 0), 0)
  const initials = user.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()

  function startCreate() {
    setError('')
    setCurrentInvoice(null)
    setEditingInvoice(null)
    setCustomerId('')
    setInvoiceNumber('')
    setBankAccountId(bankAccounts.find((account) => account.isDefault)?.id || '')
    setBillingAddress('')
    setShippingAddress('')
    setShippingSameAsBilling(true)
    setInvoiceDate(today())
    setDueDate('')
    setVehicleNumber('')
    setNotes('')
    setItems([{ key: `${Date.now()}-1`, productId: '', quantity: 1, weight: '' }])
    setView('create')
  }

  function updateItem(key, field, value) {
    setItems((current) => current.map((item) => item.key === key ? { ...item, [field]: value, ...(field === 'productId' ? { existingItemId: '', unitPriceOverride: null, gstRateOverride: null } : {}) } : item))
  }

  function selectCustomer(id) {
    setCustomerId(id)
    const customer = customers.find((candidate) => candidate.id === id)
    const address = formatCustomerAddress(customer)
    setBillingAddress(address)
    setShippingAddress(address)
    setShippingSameAsBilling(true)
  }

  function previewInvoice() {
    const customer = customers.find((item) => item.id === customerId)
    const selectedBank = bankAccounts.find((account) => account.id === bankAccountId)
    if (!customer) {
      setError('Choose a customer before previewing the invoice.')
      return
    }
    if (!itemRows.some((item) => item.product)) {
      setError('Add at least one product before previewing the invoice.')
      return
    }

    setError('')
    setCurrentInvoice({
      id: 'preview',
      invoiceNumber: invoiceNumber.trim() || String(nextInvoiceNumber).padStart(3, '0'),
      invoiceDate,
      dueDate: dueDate || null,
      vehicleNumber: vehicleNumber.trim().toUpperCase(),
      customer,
      billingAddress: billingAddress.trim(),
      shippingAddress: (shippingSameAsBilling ? billingAddress : shippingAddress).trim(),
      subtotal,
      taxTotal,
      grandTotal,
      notes: notes.trim(),
      bankName: selectedBank?.bankName || '',
      accountName: selectedBank?.accountName || '',
      accountNumber: selectedBank?.accountNumber || '',
      ifscCode: selectedBank?.ifscCode || '',
      branch: selectedBank?.branch || '',
      items: itemRows.filter((item) => item.product).map((item) => ({
        id: item.key,
        productName: item.product.name,
        sku: item.product.sku,
        hsnCode: item.product.hsnCode,
        unit: item.product.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        gstRate: item.gstRate,
        taxableAmount: item.taxableAmount,
        taxAmount: item.taxAmount,
        lineTotal: item.lineTotal,
      })),
    })
    setView('preview')
  }

  async function saveInvoice(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        customerId,
        invoiceNumber: invoiceNumber.trim() || null,
        bankAccountId: bankAccountId || null,
        invoiceDate,
        dueDate: dueDate || null,
        vehicleNumber: vehicleNumber.trim().toUpperCase(),
        billingAddress: billingAddress.trim(),
        shippingAddress: (shippingSameAsBilling ? billingAddress : shippingAddress).trim(),
        notes: notes.trim(),
        items: itemRows.map(({ key, productId, quantity, weight }) => ({ existingItemId: items.find((row) => row.key === key)?.existingItemId || '', productId, quantity, weight: weight === '' ? null : Number(weight) })),
      }
      const { data } = editingInvoice ? await updateInvoice(editingInvoice.id, payload) : await createInvoice(payload)
      if (!editingInvoice && !invoiceNumber.trim()) setNextInvoiceNumber((current) => current + 1)
      setCurrentInvoice(data.invoice)
      const weightedItems = data.invoice.items.filter((item) => item.weight !== null)
      const totalWeight = weightedItems.length ? weightedItems.reduce((sum, item) => sum + Number(item.weight), 0) : null
      setInvoices((current) => editingInvoice
        ? current.map((item) => item.id === data.invoice.id ? { ...item, ...data.invoice, totalWeight } : item)
        : [{ ...data.invoice, totalWeight }, ...current])
      setEditingInvoice(null)
      setView('detail')
    } catch (requestError) {
      setError(requestError.response?.data?.message || `Could not ${editingInvoice ? 'update' : 'create'} this invoice. Please try again.`)
    } finally {
      setSaving(false)
    }
  }

  async function openInvoice(invoice) {
    setError('')
    if (invoice.items) {
      setCurrentInvoice(invoice)
      setView('detail')
      return
    }
    try {
      const { data } = await getInvoice(invoice.id)
      setCurrentInvoice(data.invoice)
      setView('detail')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not open this invoice.')
    }
  }

  async function changeWorkflowStatus(invoice, workflowStatus) {
    const statusLabel = workflowStatus === 'COMPLETED' ? 'Completed' : 'Cancelled'
    if (!window.confirm(`Mark invoice ${invoice.invoiceNumber} as ${statusLabel}? This status cannot be changed later.`)) return
    setUpdatingStatusId(invoice.id)
    setError('')
    try {
      const { data } = await updateInvoiceWorkflowStatus(invoice.id, workflowStatus)
      setInvoices((current) => current.map((item) => item.id === invoice.id ? { ...item, workflowStatus: data.invoice.workflowStatus } : item))
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not update this invoice status.')
    } finally {
      setUpdatingStatusId('')
    }
  }

  async function markInvoicePaid(invoice) {
    if (invoice.status === 'PAID') return
    if (!window.confirm(`Mark invoice ${invoice.invoiceNumber} as paid? This records the full amount ${currency.format(invoice.grandTotal)} as received.`)) return
    setUpdatingPaymentId(invoice.id)
    setError('')
    try {
      const { data } = await updateInvoicePaymentStatus(invoice.id, 'PAID')
      setInvoices((current) => current.map((item) => item.id === invoice.id ? { ...item, status: data.invoice.status } : item))
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not mark this invoice as paid.')
    } finally {
      setUpdatingPaymentId('')
    }
  }

  async function startEditInvoice(invoice) {
    if (invoice.workflowStatus !== 'ISSUED') return
    setError('')
    try {
      const fullInvoice = invoice.items ? invoice : (await getInvoice(invoice.id)).data.invoice
      if (fullInvoice.workflowStatus !== 'ISSUED') {
        setError('Only issued invoices can be edited.')
        return
      }
      setEditingInvoice(fullInvoice)
      setCurrentInvoice(fullInvoice)
      setCustomerId(fullInvoice.customerId)
      setInvoiceNumber(fullInvoice.invoiceNumber)
      setBankAccountId(fullInvoice.bankAccountId || '')
      setBillingAddress(fullInvoice.billingAddress || '')
      setShippingAddress(fullInvoice.shippingAddress || '')
      setShippingSameAsBilling((fullInvoice.billingAddress || '') === (fullInvoice.shippingAddress || ''))
      setInvoiceDate(fullInvoice.invoiceDate)
      setDueDate(fullInvoice.dueDate || '')
      setVehicleNumber(fullInvoice.vehicleNumber || '')
      setNotes(fullInvoice.notes || '')
      setItems(fullInvoice.items.map((item) => ({
        key: item.id,
        existingItemId: item.id,
        productId: item.productId || '',
        quantity: String(item.quantity),
        weight: item.weight ?? '',
        unitPriceOverride: Number(item.unitPrice),
        gstRateOverride: Number(item.gstRate),
      })))
      setView('edit')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not load this invoice for editing.')
    }
  }

  return (
    <main className="min-h-screen bg-brand-paper text-slate-900">
      <style>{'@page { size: A4; margin: 12mm; } @media print { body { background: white !important; } .no-print { display: none !important; } .invoice-paper { box-shadow: none !important; border: 0 !important; border-radius: 0 !important; max-width: none !important; margin: 0 !important; padding: 0 !important; font-size: 10pt !important; } }'}</style>
      <header className="no-print sticky top-0 z-10 border-b border-brand-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 md:px-8"><div className="flex items-center gap-3"><button onClick={view === 'list' ? onBack : () => setView('list')} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label={view === 'list' ? 'Back to overview' : 'Back to invoices'}><ArrowLeft size={17} /></button><span className="brand-logo-mark flex h-9 w-9 items-center justify-center rounded-lg"><FileText size={18} /></span><div><p className="text-sm font-bold">My Bill Book</p><p className="text-xs text-slate-500">Sales invoices</p></div></div><div className="flex items-center gap-3"><span className="hidden text-sm text-slate-500 sm:block">{user.name}</span><span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-black text-xs font-bold text-white">{initials}</span></div></div>
      </header>

      {(view === 'detail' || view === 'preview') && currentInvoice && <InvoicePreview invoice={currentInvoice} company={user} onBack={() => setView(view === 'preview' ? (editingInvoice ? 'edit' : 'create') : 'list')} backLabel={view === 'preview' ? 'Back to edit' : 'Invoices'} />}

      {(view === 'create' || view === 'edit') && <div className="mx-auto max-w-5xl space-y-6 px-5 py-8 md:px-8"><section><p className="brand-eyebrow text-xs font-bold uppercase tracking-[0.16em]">SALES</p><h1 className="mt-2 text-3xl font-bold tracking-tight">{editingInvoice ? 'Edit invoice' : 'Create invoice'}</h1><p className="mt-2 text-sm text-slate-500">Choose a customer and add products. GST is calculated from each productâ€™s assigned GST rate.</p></section>{error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
        <form onSubmit={saveInvoice} className="space-y-6">
          <section className="grid gap-5 rounded-2xl border border-brand-line bg-white p-5 shadow-sm md:grid-cols-5 md:p-6"><label className="block text-sm font-medium text-slate-700 md:col-span-1">Customer<select required value={customerId} onChange={(event) => selectCustomer(event.target.value)} className="brand-focus mt-2 h-11 w-full rounded-lg border border-brand-line bg-white px-3 text-sm outline-none"><option value="">Select a customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.gstin ? ` Â· ${customer.gstin}` : ''}</option>)}</select>{customers.length === 0 && <button type="button" onClick={onManageCustomers} className="mt-2 text-left text-xs font-semibold text-brand-red underline">Add a customer first</button>}</label><Field label="Invoice date" name="invoiceDate" type="date" required value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} /><Field label="Due date" name="dueDate" type="date" min={invoiceDate} value={dueDate} onChange={(event) => setDueDate(event.target.value)} /><Field label="Invoice number" name="invoiceNumber" required={Boolean(editingInvoice)} maxLength="40" value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} placeholder={`Auto: ${String(nextInvoiceNumber).padStart(3, '0')}`} /><Field label="Vehicle number" name="vehicleNumber" maxLength="40" value={vehicleNumber} onChange={(event) => setVehicleNumber(event.target.value.toUpperCase())} placeholder="e.g. TN-37-BB-6978" /><p className="text-xs text-slate-500 md:col-span-5">{editingInvoice ? 'Invoice number must be unique among active invoices.' : 'Leave the invoice number blank to use the next number automatically. Enter a custom number if needed; duplicate numbers are rejected.'}</p></section>

          <section className="rounded-2xl border border-brand-line bg-white p-5 shadow-sm md:p-6"><label className="block text-sm font-medium text-slate-700">Bank account for payment<select value={bankAccountId} onChange={(event) => setBankAccountId(event.target.value)} className="brand-focus mt-2 h-11 w-full rounded-lg border border-brand-line bg-white px-3 text-sm outline-none"><option value="">No bank details on invoice</option>{bankAccounts.map((account) => <option key={account.id} value={account.id}>{account.bankName} · {account.accountName} · •••• {account.accountNumber.slice(-4)}{account.isDefault ? ' (default)' : ''}</option>)}</select>{bankAccounts.length === 0 && <span className="mt-2 block text-xs text-slate-500">No bank accounts saved. <button type="button" onClick={onManageBanks} className="font-semibold text-brand-red underline">Open Bank Master</button></span>}</label></section>

          <section className="grid gap-5 rounded-2xl border border-brand-line bg-white p-5 shadow-sm md:grid-cols-2 md:p-6"><label className="block text-sm font-medium text-slate-700">Billing address<textarea value={billingAddress} onChange={(event) => setBillingAddress(event.target.value)} maxLength={1000} rows="3" placeholder="Billing street, city, state, PIN code" className="brand-focus mt-2 w-full rounded-lg border border-brand-line px-3 py-2.5 text-sm outline-none" /></label><div><label className="flex min-h-6 items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={shippingSameAsBilling} onChange={(event) => { setShippingSameAsBilling(event.target.checked); if (event.target.checked) setShippingAddress(billingAddress) }} className="rounded border-slate-300 text-brand-red focus:ring-brand-red" />Shipping address is same as billing</label><label className="mt-2 block text-sm font-medium text-slate-700">Shipping address<textarea value={shippingSameAsBilling ? billingAddress : shippingAddress} onChange={(event) => setShippingAddress(event.target.value)} disabled={shippingSameAsBilling} maxLength={1000} rows="3" placeholder="Shipping street, city, state, PIN code" className="brand-focus mt-2 w-full rounded-lg border border-brand-line px-3 py-2.5 text-sm outline-none disabled:bg-stone-50 disabled:text-slate-400" /></label></div></section>

          <section className="overflow-hidden rounded-2xl border border-brand-line bg-white shadow-sm"><div className="flex items-center justify-between border-b border-brand-line px-5 py-4 md:px-6"><div><h2 className="font-bold">Items</h2><p className="mt-1 text-xs text-slate-500">Product sale price is treated as pre-GST.</p></div><button type="button" onClick={() => setItems((current) => [...current, { key: `${Date.now()}-${Math.random()}`, productId: '', quantity: 1, weight: '' }])} className="rounded-lg border border-brand-line px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-stone-50">Add item</button></div>
            {products.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">Add a product before creating an invoice. <button type="button" onClick={onManageProducts} className="font-semibold text-brand-red underline">Open Product Master</button></div> : <div className="divide-y divide-brand-line">{itemRows.map((item, index) => <div key={item.key} className="grid gap-3 p-5 md:grid-cols-[minmax(0,2fr)_100px_110px_125px_125px_36px] md:items-end md:px-6"><label className="block text-sm font-medium text-slate-700">Product<select required value={item.productId} onChange={(event) => updateItem(item.key, 'productId', event.target.value)} className="brand-focus mt-2 h-11 w-full rounded-lg border border-brand-line bg-white px-3 text-sm outline-none"><option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} Â· {currency.format(product.salePrice)} Â· GST {product.gstRate?.percentage ?? product.gst}%</option>)}</select></label><Field label={`Qty (${item.product?.unit || 'unit'})`} name={`quantity-${index}`} type="number" min="0.001" step="0.001" required value={item.quantity} onChange={(event) => updateItem(item.key, 'quantity', event.target.value)} /><Field label="Weight (kg)" name={`weight-${index}`} type="number" min="0" step="0.001" value={item.weight ?? ''} onChange={(event) => updateItem(item.key, 'weight', event.target.value)} placeholder="Optional" /><div><span className="text-xs font-medium text-slate-500">Unit price</span><p className="mt-2 h-11 content-center text-sm font-semibold">{currency.format(item.unitPrice)}</p></div><div><span className="text-xs font-medium text-slate-500">Line total</span><p className="mt-2 h-11 content-center text-sm font-bold">{item.product ? currency.format(item.lineTotal) : 'â€”'}</p><span className="text-[11px] text-slate-400">GST {item.gstRate}% Â· {currency.format(item.taxAmount)}</span></div><button type="button" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((row) => row.key !== item.key))} className="flex h-10 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-30" aria-label="Remove item"><Trash2 size={16} /></button></div>)}</div>}
          </section>

          <section className="grid gap-5 md:grid-cols-[1fr_320px]"><label className="block text-sm font-medium text-slate-700">Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} rows="4" placeholder="Optional note for this invoice" className="brand-focus mt-2 w-full rounded-xl border border-brand-line bg-white px-3 py-2.5 text-sm outline-none" /></label><div className="space-y-3 rounded-2xl border border-brand-line bg-white p-5"><TotalRow label="Subtotal" amount={subtotal} /><TotalRow label="GST" amount={taxTotal} /><div className="border-t border-brand-line pt-3"><TotalRow label="Grand total" amount={grandTotal} strong /></div><button type="button" onClick={previewInvoice} disabled={!customerId || !items.some((item) => item.productId)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-brand-line px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-stone-50 disabled:opacity-50"><FileText size={16} />Preview invoice</button><button type="submit" disabled={saving || !customers.length || !products.length || !items.some((item) => item.productId)} className="brand-button mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50">{saving ? 'Saving invoiceâ€¦' : editingInvoice ? 'Save changes' : 'Save invoice'}<ArrowRight size={16} /></button></div></section>
        </form></div>}

      {view === 'list' && <div className="mx-auto max-w-7xl space-y-7 px-5 py-8 md:px-8"><section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="brand-eyebrow text-xs font-bold uppercase tracking-[0.16em]">SALES</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Invoices</h1><p className="mt-2 text-sm text-slate-500">Create and review your customer invoices.</p></div><button onClick={startCreate} className="brand-button inline-flex items-center justify-center gap-2 self-start rounded-xl px-4 py-2.5 text-sm font-semibold"><FilePlus2 size={17} />Create invoice</button></section>
        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><SummaryCard label="Total invoices issued" value={issuedInvoiceCount} detail="Awaiting completion or cancellation" /><SummaryCard label="Total invoices completed" value={completedInvoiceCount} detail="Marked completed" /><SummaryCard label="Total invoices cancelled" value={cancelledInvoiceCount} detail="Cancelled or voided" /><SummaryCard label="Open amount" value={currency.format(issuedAmount)} detail="Issued, partial, and overdue" /><SummaryCard label="GST billed" value={currency.format(taxAmountTotal)} detail="Across active invoices" /><SummaryCard label="Total weight" value={`${totalWeight.toLocaleString('en-IN', { maximumFractionDigits: 3 })} kg`} detail="Across active invoices" /></section>
        <section className="overflow-hidden rounded-2xl border border-brand-line bg-white shadow-sm"><div className="flex flex-col gap-4 border-b border-brand-line p-5 md:px-6"><div><h2 className="font-bold">Recent invoices</h2><p className="mt-1 text-sm text-slate-500">Showing {visibleInvoices.length} of {invoices.length}</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><label className="relative"><Search className="absolute left-3 top-2.5 text-slate-400" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search invoice or customer" className="brand-focus h-10 w-full rounded-lg border border-brand-line pl-9 pr-3 text-sm outline-none" /></label><select aria-label="Filter by customer" value={filterCustomerId} onChange={(event) => setFilterCustomerId(event.target.value)} className="brand-focus h-10 rounded-lg border border-brand-line bg-white px-3 text-sm outline-none"><option value="">All customers</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select><label className="flex items-center gap-2 text-xs text-slate-500">From<input aria-label="From date" type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} className="brand-focus h-10 min-w-0 flex-1 rounded-lg border border-brand-line px-2 text-sm text-slate-700 outline-none" /></label><label className="flex items-center gap-2 text-xs text-slate-500">To<input aria-label="To date" type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} className="brand-focus h-10 min-w-0 flex-1 rounded-lg border border-brand-line px-2 text-sm text-slate-700 outline-none" /></label></div></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-stone-50 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-6 py-3 font-semibold">Invoice</th><th className="px-4 py-3 font-semibold">Customer</th><th className="px-4 py-3 font-semibold">Date</th><th className="px-4 py-3 font-semibold">Weight</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold">Payment</th><th className="px-4 py-3 text-right font-semibold">Total</th><th className="px-5 py-3 text-right font-semibold">Action</th></tr></thead><tbody className="divide-y divide-brand-line">{visibleInvoices.map((invoice) => <tr key={invoice.id} onClick={() => openInvoice(invoice)} className="cursor-pointer transition hover:bg-stone-50/70"><td className="px-6 py-4 font-semibold text-slate-800">{invoice.invoiceNumber}</td><td className="px-4 py-4">{invoice.customer.name}</td><td className="px-4 py-4 text-slate-500">{displayDate(invoice.invoiceDate)}</td><td className="px-4 py-4 text-slate-600">{invoice.totalWeight === null || invoice.totalWeight === undefined ? '—' : `${Number(invoice.totalWeight).toLocaleString('en-IN', { maximumFractionDigits: 3 })} kg`}</td><td className="px-4 py-4" onClick={(event) => event.stopPropagation()}><select aria-label={`Status for invoice ${invoice.invoiceNumber}`} value={invoice.workflowStatus || "ISSUED"} disabled={invoice.workflowStatus !== "ISSUED" || updatingStatusId === invoice.id} onChange={(event) => changeWorkflowStatus(invoice, event.target.value)} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 disabled:cursor-not-allowed disabled:opacity-100"><option value="ISSUED">Issued</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option></select></td><td className="px-4 py-4" onClick={(event) => event.stopPropagation()}>{invoice.status === "PAID" ? <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">Paid</span> : invoice.workflowStatus === "CANCELLED" || invoice.status === "VOID" ? <span className="text-xs text-slate-400">—</span> : <button type="button" onClick={() => markInvoicePaid(invoice)} disabled={updatingPaymentId === invoice.id} className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60">{updatingPaymentId === invoice.id ? "Saving…" : "Mark paid"}</button>}</td><td className="px-6 py-4 text-right font-bold">{currency.format(invoice.grandTotal)}</td><td className="px-5 py-4 text-right" onClick={(event) => event.stopPropagation()}>{invoice.workflowStatus === "ISSUED" ? <button type="button" onClick={() => startEditInvoice(invoice)} className="rounded-lg border border-brand-line px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-brand-red hover:text-brand-red">Edit</button> : <span className="text-xs text-slate-400">Locked</span>}</td></tr>)}</tbody></table>{loading ? <div className="p-12 text-center text-sm text-slate-500">Loading invoicesâ€¦</div> : visibleInvoices.length === 0 && <div className="p-12 text-center text-sm text-slate-500">{invoices.length ? 'No invoices match these filters.' : 'No invoices yet. Create your first invoice to get started.'}</div>}</div></section>
      </div>}
    </main>
  )
}

function InvoicePreview({ invoice, company, onBack, backLabel }) {
  const [printMenuOpen, setPrintMenuOpen] = useState(false)
  const [printCopyCount, setPrintCopyCount] = useState(1)
  const [printFormat, setPrintFormat] = useState('a4')
  const [printPending, setPrintPending] = useState(false)
  const taxSummary = buildTaxSummary(invoice.items)
  const totalQuantity = invoice.items.reduce((sum, item) => sum + Number(item.quantity), 0)
  const billingAddress = invoice.billingAddress || invoice.customer.billingAddress
  const shippingAddress = invoice.shippingAddress || billingAddress
  useEffect(() => {
    if (!printPending) return undefined
    const timer = window.setTimeout(() => {
      window.print()
      setPrintPending(false)
    }, 50)
    return () => window.clearTimeout(timer)
  }, [printPending, printFormat, printCopyCount])
  function printInvoice(copyCount, format = 'a4') {
    setPrintCopyCount(copyCount)
    setPrintFormat(format)
    setPrintMenuOpen(false)
    setPrintPending(true)
  }
return <div className="mx-auto max-w-4xl px-5 py-8 md:px-8"><style>{`@page { size: ${printFormat === 'thermal' ? '80mm 297mm' : 'A4'}; margin: 0; } @media print { .invoice-paper { padding: 10mm !important; } .invoice-thermal { width: 74mm !important; max-width: 74mm !important; padding: 2mm !important; font-size: 7pt !important; } .invoice-thermal .grid { display: block !important; } .invoice-thermal table { min-width: 0 !important; font-size: 6pt !important; } .invoice-thermal th, .invoice-thermal td { padding: 1mm !important; } .invoice-thermal .overflow-x-auto { overflow: visible !important; } .invoice-copy-label { display: block !important; } }`}</style><div className="no-print mb-5 flex items-center justify-between"><button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-brand-red"><ArrowLeft size={16} />{backLabel}</button><div className="relative"><div className="flex overflow-hidden rounded-xl shadow-sm"><button type="button" onClick={() => printInvoice(1, 'thermal')} className="brand-button inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold"><Printer size={16} />Print Thermal</button><button type="button" onClick={() => setPrintMenuOpen((open) => !open)} aria-label="Choose print option" aria-expanded={printMenuOpen} className="brand-button border-l border-white/30 px-3 text-white"><ChevronDown size={17} /></button></div>{printMenuOpen && <div role="menu" className="absolute right-0 top-full z-20 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-xl"><button role="menuitem" onClick={() => printInvoice(1, 'a4')} className="block w-full px-4 py-3 text-left text-slate-700 hover:bg-stone-50">Print PDF</button><button role="menuitem" onClick={() => printInvoice(2, 'a4')} className="block w-full px-4 py-3 text-left text-slate-700 hover:bg-stone-50">Print Duplicate</button><button role="menuitem" onClick={() => printInvoice(3, 'a4')} className="block w-full px-4 py-3 text-left text-slate-700 hover:bg-stone-50">Print Triplicate</button><button role="menuitem" onClick={() => printInvoice(3, 'a4')} className="block w-full border-t border-slate-100 px-4 py-3 text-left text-slate-700 hover:bg-stone-50">Print All Copies</button></div>}</div></div>{Array.from({ length: printCopyCount }, (_, copyIndex) => <article key={`invoice-copy-${copyIndex}`} style={{ breakAfter: copyIndex < printCopyCount - 1 ? 'page' : 'auto' }} className={`invoice-paper ${printFormat === 'thermal' ? 'invoice-thermal' : ''} rounded-2xl border border-brand-line bg-white p-6 shadow-sm md:p-10`}>{printCopyCount > 1 && <p className="invoice-copy-label mb-3 text-right text-xs font-bold uppercase tracking-widest">{['Original', 'Duplicate', 'Triplicate'][copyIndex]}</p>}<div className="grid border border-slate-800 text-sm leading-snug sm:grid-cols-2"><div className="border-b border-slate-800 p-3 sm:border-b-0 sm:border-r"><h1 className="font-bold">{company.companyName || company.name}</h1>{company.address && <p className="mt-1"><strong>Address</strong> &nbsp;{company.address}</p>}<div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">{company.gstin && <p><strong>GSTIN</strong> &nbsp;{company.gstin}</p>}{company.phone && <p><strong>Mobile</strong> &nbsp;{company.phone}</p>}</div>{(company.companyEmail || company.email) && <p className="mt-2"><strong>Email</strong> &nbsp;{company.companyEmail || company.email}</p>}</div><div className="grid grid-rows-[1fr_auto]"><div className="grid grid-cols-2 text-center"><div className="border-r border-slate-800 p-3"><p className="font-bold">Invoice No.</p><p>{invoice.invoiceNumber}</p></div><div className="p-3"><p className="font-bold">Invoice Date</p><p>{displayDate(invoice.invoiceDate)}</p></div></div><div className="border-t border-slate-800 p-3 text-center"><p className="font-bold">Vehicle No.</p><p className="mt-1">{invoice.vehicleNumber || '—'}</p></div></div><div className="grid border-t border-slate-800 sm:col-span-2 sm:grid-cols-2"><div className="border-b border-slate-800 p-3 sm:border-b-0 sm:border-r"><p className="font-bold uppercase">Bill To</p><h2 className="mt-3 font-bold uppercase">{invoice.customer.name}</h2>{billingAddress && <p className="mt-1"><strong>Address:</strong> &nbsp;{billingAddress}</p>}{invoice.customer.gstin && <p className="mt-2"><strong>GSTIN:</strong> &nbsp;{invoice.customer.gstin}</p>}{invoice.customer.phone && <p className="mt-1"><strong>Mobile:</strong> &nbsp;{invoice.customer.phone}</p>}{invoice.customer.email && <p className="mt-1"><strong>Email:</strong> &nbsp;{invoice.customer.email}</p>}</div><div className="p-3"><p className="font-bold uppercase">Ship To</p><h2 className="mt-3 font-bold uppercase">{invoice.customer.name}</h2>{shippingAddress && <p className="mt-1"><strong>Address:</strong> &nbsp;{shippingAddress}</p>}{invoice.customer.gstin && <p className="mt-2"><strong>GSTIN:</strong> &nbsp;{invoice.customer.gstin}</p>}{invoice.customer.phone && <p className="mt-1"><strong>Mobile:</strong> &nbsp;{invoice.customer.phone}</p>}</div></div></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[680px] border-collapse text-sm"><thead className="bg-stone-100 text-center text-slate-900"><tr><th className="border border-slate-800 px-2 py-2">No.</th><th className="border border-slate-800 px-3 py-2">Particulars</th><th className="border border-slate-800 px-2 py-2">HSN</th><th className="border border-slate-800 px-2 py-2">Quantity</th><th className="border border-slate-800 px-3 py-2">PRICE/ITEM (₹)</th><th className="border border-slate-800 px-3 py-2">Total</th></tr></thead><tbody>{invoice.items.map((item, index) => <tr key={item.id} className="align-top"><td className="border-x border-slate-800 px-2 py-2 text-center">{index + 1}</td><td className="border-x border-slate-800 px-3 py-2 font-medium">{item.productName}<span className="mt-1 block text-xs text-slate-500">{item.sku}</span></td><td className="border-x border-slate-800 px-2 py-2 text-right">{item.hsnCode || '-'}</td><td className="border-x border-slate-800 px-2 py-2 text-right">{Number(item.quantity).toLocaleString('en-IN')} {item.unit}</td><td className="border-x border-slate-800 px-3 py-2 text-right">{currency.format(item.unitPrice)}</td><td className="border-x border-slate-800 px-3 py-2 text-right">{currency.format(item.taxableAmount)}</td></tr>)}{taxSummary.map((row) => <Fragment key={`tax-${row.hsnCode}`}><tr className="h-8"><td className="border-x border-slate-800"></td><td className="border-x border-slate-800 px-3 text-right text-xs italic">CGST @ {row.cgstRate}%</td><td className="border-x border-slate-800 px-2 text-right">-</td><td className="border-x border-slate-800 px-2 text-right">-</td><td className="border-x border-slate-800 px-3 text-right">-</td><td className="border-x border-slate-800 px-3 py-1 text-right">{currency.format(row.cgstAmount)}</td></tr><tr className="h-8"><td className="border-x border-slate-800"></td><td className="border-x border-slate-800 px-3 text-right text-xs italic">SGST @ {row.sgstRate}%</td><td className="border-x border-slate-800 px-2 text-right">-</td><td className="border-x border-slate-800 px-2 text-right">-</td><td className="border-x border-slate-800 px-3 text-right">-</td><td className="border-x border-slate-800 px-3 py-1 text-right">{currency.format(row.sgstAmount)}</td></tr></Fragment>)}</tbody><tfoot><tr className="bg-stone-200 font-bold"><td className="border border-slate-800 px-2 py-2"></td><td className="border border-slate-800 px-3 py-2 text-right">TOTAL</td><td className="border border-slate-800 px-2 py-2"></td><td className="border border-slate-800 px-2 py-2 text-right">{totalQuantity.toLocaleString('en-IN')}</td><td className="border border-slate-800 px-3 py-2"></td><td className="border border-slate-800 px-3 py-2 text-right">{currency.format(invoice.grandTotal)}</td></tr></tfoot></table></div><TaxSummaryTable rows={taxSummary} /><div className="mt-3 border border-slate-800 px-3 py-2 text-xs"><strong>Total Amount (in words):</strong> {amountInWords(invoice.grandTotal)}</div>{invoice.notes && <div className="mt-2 border border-slate-800 px-3 py-2 text-xs"><strong>Notes:</strong> {invoice.notes}</div>}{invoice.bankName && <div className="mt-3 grid border border-slate-800 text-xs sm:grid-cols-2"><div className="border-b border-slate-800 p-3 sm:border-b-0 sm:border-r"><h2 className="font-bold">Bank Details</h2><div className="mt-2 grid grid-cols-[90px_1fr] gap-x-2 gap-y-1"><span>Name:</span><span>{invoice.accountName}</span><span>IFSC Code:</span><span>{invoice.ifscCode}</span><span>Account No:</span><span>{invoice.accountNumber}</span><span>Bank:</span><span>{invoice.bankName}{invoice.branch ? ', ' + invoice.branch : ''}</span></div></div><div className="flex min-h-24 flex-col items-center justify-end p-3 text-center"><p>Authorised Signatory For</p><p className="mt-2 font-bold">{company.companyName || company.name}</p></div></div>}</article>)}</div>
}

function numberWordsUnderThousand(value) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  const words = []
  if (value >= 100) {
    words.push(`${ones[Math.floor(value / 100)]} Hundred`)
    value %= 100
  }
  if (value >= 10 && value < 20) words.push(teens[value - 10])
  else {
    if (value >= 20) words.push(tens[Math.floor(value / 10)])
    if (value % 10) words.push(ones[value % 10])
  }
  return words.join(' ')
}

function amountInWords(amount) {
  const value = Math.round(Number(amount) * 100) / 100
  const rupees = Math.floor(value)
  const paise = Math.round((value - rupees) * 100)
  const groups = [[10000000, 'Crore'], [100000, 'Lakh'], [1000, 'Thousand']]
  let remaining = rupees
  const words = []
  for (const [size, label] of groups) {
    const group = Math.floor(remaining / size)
    if (group) words.push(`${numberWordsUnderThousand(group)} ${label}`)
    remaining %= size
  }
  if (remaining) words.push(numberWordsUnderThousand(remaining))
  return `Rupees ${words.join(' ') || 'Zero'}${paise ? ` and ${numberWordsUnderThousand(paise)} Paise` : ''} Only`
}

function buildTaxSummary(items) {
  const groups = new Map()
  for (const item of items) {
    const key = item.hsnCode || '—'
    const current = groups.get(key) || { hsnCode: key, taxableValue: 0, totalTax: 0, gstRate: Number(item.gstRate) }
    current.taxableValue = roundMoney(current.taxableValue + Number(item.taxableAmount))
    current.totalTax = roundMoney(current.totalTax + Number(item.taxAmount))
    groups.set(key, current)
  }
  return [...groups.values()].map((row) => ({ ...row, cgstRate: row.gstRate / 2, sgstRate: row.gstRate / 2, cgstAmount: roundMoney(row.totalTax / 2), sgstAmount: roundMoney(row.totalTax / 2) }))
}

function TaxSummaryTable({ rows }) {
  const totals = rows.reduce((sum, row) => ({ taxableValue: roundMoney(sum.taxableValue + row.taxableValue), cgstAmount: roundMoney(sum.cgstAmount + row.cgstAmount), sgstAmount: roundMoney(sum.sgstAmount + row.sgstAmount), totalTax: roundMoney(sum.totalTax + row.totalTax) }), { taxableValue: 0, cgstAmount: 0, sgstAmount: 0, totalTax: 0 })
  return <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[680px] border-collapse text-right text-sm"><thead className="bg-stone-100 text-center text-slate-900"><tr><th rowSpan="2" className="border border-slate-800 px-3 py-2">HSN/SAC</th><th rowSpan="2" className="border border-slate-800 px-3 py-2 text-right">Taxable Value</th><th colSpan="2" className="border border-slate-800 px-3 py-2">CGST</th><th colSpan="2" className="border border-slate-800 px-3 py-2">SGST</th><th rowSpan="2" className="border border-slate-800 px-3 py-2 text-right">Total Tax Amount</th></tr><tr><th className="border border-slate-800 px-2 py-1">Rate</th><th className="border border-slate-800 px-2 py-1">Amount</th><th className="border border-slate-800 px-2 py-1">Rate</th><th className="border border-slate-800 px-2 py-1">Amount</th></tr></thead><tbody>{rows.map((row) => <tr key={row.hsnCode}><td className="border-x border-slate-800 px-3 py-2">{row.hsnCode}</td><td className="border-x border-slate-800 px-3 py-2">{currency.format(row.taxableValue)}</td><td className="border-x border-slate-800 px-2 py-2">{row.cgstRate}%</td><td className="border-x border-slate-800 px-3 py-2">{currency.format(row.cgstAmount)}</td><td className="border-x border-slate-800 px-2 py-2">{row.sgstRate}%</td><td className="border-x border-slate-800 px-3 py-2">{currency.format(row.sgstAmount)}</td><td className="border-x border-slate-800 px-3 py-2">{currency.format(row.totalTax)}</td></tr>)}</tbody><tfoot><tr className="font-bold"><td className="border border-slate-800 px-3 py-2">Total</td><td className="border border-slate-800 px-3 py-2">{currency.format(totals.taxableValue)}</td><td className="border border-slate-800 px-2 py-2"></td><td className="border border-slate-800 px-3 py-2">{currency.format(totals.cgstAmount)}</td><td className="border border-slate-800 px-2 py-2"></td><td className="border border-slate-800 px-3 py-2">{currency.format(totals.sgstAmount)}</td><td className="border border-slate-800 px-3 py-2">{currency.format(totals.totalTax)}</td></tr></tfoot></table></div>
}
function AddressBlock({ label, address }) {
  return <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 whitespace-pre-line text-sm text-slate-600">{address || '—'}</p></div>
}

function Field({ label, name, type = 'text', ...inputProps }) {
  return <label className="block text-sm font-medium text-slate-700">{label}<input name={name} type={type} className="brand-focus mt-2 h-11 w-full rounded-lg border border-brand-line bg-white px-3 text-sm outline-none" {...inputProps} /></label>
}

function TotalRow({ label, amount, strong = false }) {
  return <div className={`flex items-center justify-between ${strong ? 'text-base font-bold text-slate-900' : 'text-sm text-slate-600'}`}><span>{label}</span><span>{currency.format(amount)}</span></div>
}

function SummaryCard({ label, value, detail }) {
  return <article className="rounded-2xl border border-brand-line bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-3 text-2xl font-bold tracking-tight">{value}</p><p className="mt-1 text-xs text-slate-400">{detail}</p></article>
}

