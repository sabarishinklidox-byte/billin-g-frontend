import { useEffect, useMemo, useState } from 'react'
import { ArrowDownToLine, ArrowLeft, ChevronDown, CirclePlus, MoreHorizontal, Package, Search, X } from 'lucide-react'
import { createProduct, getGstRates, getProducts, searchHsn, updateProduct } from '../lib/api.js'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })
const productUnits = [
  ['pcs', 'Pieces'], ['nos', 'Numbers'], ['kg', 'Kilograms (kg)'], ['g', 'Grams (g)'], ['mg', 'Milligrams (mg)'],
  ['tonne', 'Tonnes'], ['ltr', 'Litres (L)'], ['ml', 'Millilitres (ml)'], ['mtr', 'Metres (m)'], ['cm', 'Centimetres (cm)'],
  ['box', 'Box'], ['pack', 'Pack'], ['set', 'Set'], ['dozen', 'Dozen'], ['pair', 'Pair'], ['roll', 'Roll'],
  ['bag', 'Bag'], ['bottle', 'Bottle'], ['carton', 'Carton'], ['bundle', 'Bundle'], ['sheet', 'Sheet'],
  ['sq ft', 'Square feet (sq ft)'], ['sq m', 'Square metres (sq m)'], ['hour', 'Hour'], ['day', 'Day'], ['other', 'Other'],
]

export default function ProductMaster({ user, onBack, onManageGst }) {
  const [products, setProducts] = useState([])
  const [gstRates, setGstRates] = useState([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All stock')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')
  const [saving, setSaving] = useState(false)
  const [productName, setProductName] = useState('')
  const [hsnCode, setHsnCode] = useState('')
  const [hsnMatches, setHsnMatches] = useState([])
  const [hsnLoading, setHsnLoading] = useState(false)
  const [hsnMessage, setHsnMessage] = useState('')

  useEffect(() => {
    Promise.all([getProducts(), getGstRates()])
      .then(([productResponse, gstResponse]) => {
        setProducts(productResponse.data.products)
        setGstRates(gstResponse.data.rates)
      })
      .catch((error) => setPageError(error.response?.data?.message || 'Could not load products. Check that the API and database are running.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const query = productName.trim()
    if (!modalOpen || query.length < 3) {
      setHsnMatches([])
      setHsnMessage('')
      return undefined
    }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setHsnLoading(true)
      try {
        const { data } = await searchHsn(query)
        if (!cancelled) {
          setHsnMatches(data.matches || [])
          setHsnMessage(data.matches?.length ? 'Select the closest HSN result to fill the code.' : 'No HSN matches found. You can enter the code manually.')
        }
      } catch {
        if (!cancelled) {
          setHsnMatches([])
          setHsnMessage('HSN lookup is unavailable. You can enter the code manually.')
        }
      } finally {
        if (!cancelled) setHsnLoading(false)
      }
    }, 450)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [productName, modalOpen])

  const filtered = useMemo(() => products.filter((product) => {
    const matchesQuery = `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(query.toLowerCase())
    const matchesFilter = filter === 'All stock' || (filter === 'In stock' && product.stock > 10) || (filter === 'Low stock' && product.stock > 0 && product.stock <= 10) || (filter === 'Out of stock' && product.stock === 0)
    return matchesQuery && matchesFilter
  }), [products, query, filter])

  async function saveProduct(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const product = {
      id: editing?.id ?? Date.now(),
      name: String(form.get('name')).trim(),
      sku: String(form.get('sku')).trim().toUpperCase(),
      hsnCode: String(form.get('hsnCode')).trim(),
      category: String(form.get('category')).trim() || 'Uncategorized',
      salePrice: Number(form.get('salePrice')),
      purchasePrice: Number(form.get('purchasePrice')),
      stock: Number(form.get('stock')),
      unit: String(form.get('unit')).trim() || 'pcs',
      gstRateId: String(form.get('gstRateId')),
    }
    setSaving(true)
    setPageError('')
    try {
      const { data } = editing ? await updateProduct(editing.id, product) : await createProduct(product)
      setProducts((current) => editing ? current.map((item) => item.id === editing.id ? data.product : item) : [...current, data.product])
      setModalOpen(false)
      setEditing(null)
      setNotice(editing ? 'Product updated.' : 'Product saved to your catalog.')
      window.setTimeout(() => setNotice(''), 3000)
    } catch (error) {
      setPageError(error.response?.data?.message || 'Could not save this product. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function exportCsv() {
    const headers = ['Name', 'SKU', 'HSN code', 'Category', 'Selling price', 'Purchase price', 'Stock', 'Unit', 'GST']
    const rows = filtered.map(({ name, sku, hsnCode, category, salePrice, purchasePrice, stock, unit, gst }) => [name, sku, hsnCode || '', category, salePrice, purchasePrice, stock, unit, `${gst}%`])
    const csv = [headers, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'my-bill-book-products.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const totalValue = products.reduce((sum, product) => sum + product.purchasePrice * product.stock, 0)
  const lowStock = products.filter((product) => product.stock > 0 && product.stock <= 10).length
  const initials = user.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()

  return (
    <main className="min-h-screen bg-brand-paper text-slate-900">
      <header className="sticky top-0 z-10 border-b border-brand-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 md:px-8">
          <div className="flex items-center gap-3"><button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Back to overview"><ArrowLeft size={17} /></button><span className="brand-logo-mark flex h-9 w-9 items-center justify-center rounded-lg"><Package size={18} /></span><div><p className="text-sm font-bold">My Bill Book</p><p className="text-xs text-slate-500">Product master</p></div></div>
          <div className="flex items-center gap-3"><span className="hidden text-sm text-slate-500 sm:block">{user.name}</span><span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-black text-xs font-bold text-white">{initials}</span></div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-7 px-5 py-8 md:px-8">
        <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="brand-eyebrow text-xs font-bold uppercase tracking-[0.16em]">CATALOGUE</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Product master</h1><p className="mt-2 text-sm text-slate-500">Manage products, pricing, tax, and available stock.</p></div><div className="flex flex-wrap gap-3"><button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-xl border border-brand-line bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-stone-50"><ArrowDownToLine size={16} />Export</button><button onClick={() => { setEditing(null); setProductName(''); setHsnCode(''); setHsnMatches([]); setHsnMessage(''); setModalOpen(true) }} className="brand-button inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"><CirclePlus size={17} />Add product</button></div></section>

        <section className="grid gap-4 sm:grid-cols-3">
          <SummaryCard label="Products" value={products.length} detail="In your catalogue" icon="P" />
          <SummaryCard label="Low stock" value={lowStock} detail="Need a restock soon" icon="!" />
          <SummaryCard label="Stock purchase value" value={currency.format(totalValue)} detail="Based on purchase price" icon="₹" />
        </section>

        {pageError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{pageError}</p>}

        <section className="overflow-hidden rounded-2xl border border-brand-line bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-brand-line p-5 sm:flex-row sm:items-center sm:justify-between md:px-6"><div><h2 className="font-bold">All products</h2><p className="mt-1 text-sm text-slate-500">{filtered.length} of {products.length} products</p></div><div className="flex flex-col gap-3 sm:flex-row"><label className="relative"><Search className="absolute left-3 top-2.5 text-slate-400" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products or SKU" className="brand-focus h-10 w-full rounded-lg border border-brand-line bg-white pl-9 pr-3 text-sm outline-none sm:w-60" /></label><label className="relative"><select value={filter} onChange={(event) => setFilter(event.target.value)} className="h-10 w-full appearance-none rounded-lg border border-brand-line bg-white pl-3 pr-9 text-sm text-slate-700 outline-none sm:w-36"><option>All stock</option><option>In stock</option><option>Low stock</option><option>Out of stock</option></select><ChevronDown className="pointer-events-none absolute right-3 top-3 text-slate-400" size={15} /></label></div></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-stone-50 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-6 py-3 font-semibold">Product</th><th className="px-4 py-3 font-semibold">HSN</th><th className="px-4 py-3 font-semibold">Category</th><th className="px-4 py-3 text-right font-semibold">Sale price</th><th className="px-4 py-3 text-right font-semibold">Purchase price</th><th className="px-4 py-3 text-right font-semibold">Stock</th><th className="px-4 py-3 font-semibold">GST</th><th className="px-6 py-3 text-right font-semibold">Action</th></tr></thead><tbody className="divide-y divide-brand-line">{filtered.map((product) => <tr key={product.id} className="transition hover:bg-stone-50/70"><td className="px-6 py-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-paper text-brand-red"><Package size={18} /></span><span><span className="block font-semibold text-slate-800">{product.name}</span><span className="mt-0.5 block text-xs text-slate-400">{product.sku}</span></span></div></td><td className="px-4 py-4 text-slate-600">{product.hsnCode || '—'}</td><td className="px-4 py-4 text-slate-600">{product.category}</td><td className="px-4 py-4 text-right font-semibold">{currency.format(product.salePrice)}</td><td className="px-4 py-4 text-right text-slate-600">{currency.format(product.purchasePrice)}</td><td className="px-4 py-4 text-right"><span className="font-semibold">{product.stock}</span><span className="ml-1 text-xs text-slate-400">{product.unit}</span><span className={`ml-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${product.stock === 0 ? 'bg-rose-50 text-rose-700' : product.stock <= 10 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{product.stock === 0 ? 'Out' : product.stock <= 10 ? 'Low' : 'In stock'}</span></td><td className="px-4 py-4 text-slate-600"><span className="font-medium">{product.gstRate?.name || 'GST rate'}</span><span className="ml-1 text-xs text-slate-500">{product.gst}%</span></td><td className="px-6 py-4 text-right"><button onClick={() => { setEditing(product); setProductName(product.name); setHsnCode(product.hsnCode || ''); setModalOpen(true) }} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-brand-red" aria-label={`Edit ${product.name}`}><MoreHorizontal size={18} /></button></td></tr>)}</tbody></table>{loading ? <div className="p-12 text-center text-sm text-slate-500">Loading products…</div> : filtered.length === 0 && <div className="p-12 text-center text-sm text-slate-500">{query ? 'No products match your search.' : 'No products yet. Add your first product to get started.'}</div>}</div>
        </section>
        <p className="text-center text-xs text-slate-400">Product catalogue · Use these items when creating sales invoices.</p>
      </div>

      {notice && <div role="status" className="fixed bottom-5 right-5 rounded-xl bg-brand-black px-5 py-3 text-sm font-medium text-white shadow-xl">{notice}</div>}
      {modalOpen && <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) { setModalOpen(false); setEditing(null) } }}><section role="dialog" aria-modal="true" aria-labelledby="product-form-title" className="my-6 w-full max-w-xl rounded-2xl bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-brand-line px-6 py-5"><div><h2 id="product-form-title" className="text-lg font-bold">{editing ? 'Edit product' : 'Add a product'}</h2><p className="mt-1 text-sm text-slate-500">Add the details used on your invoices and stock list.</p></div><button onClick={() => { setModalOpen(false); setEditing(null) }} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close"><X size={18} /></button></div><form onSubmit={saveProduct} className="grid gap-4 p-6 sm:grid-cols-2"><label className="block text-sm font-medium text-slate-700">Product name<input name="name" required value={productName} onChange={(event) => setProductName(event.target.value)} placeholder="e.g. Corrugated box" className="brand-focus mt-2 h-11 w-full rounded-lg border border-brand-line px-3 text-sm outline-none" />{(hsnLoading || hsnMessage) && <span className="mt-1 block text-xs text-slate-500">{hsnLoading ? 'Searching free HSN database…' : hsnMessage}</span>}{hsnMatches.length > 0 && <span className="mt-2 block max-h-36 overflow-y-auto rounded-lg border border-brand-line bg-white">{hsnMatches.map((match) => <button key={`${match.hsn_sac}-${match.description}`} type="button" onClick={() => { setHsnCode(match.hsn_sac); setHsnMatches([]); setHsnMessage(`Selected ${match.description}`) }} className="block w-full border-b border-brand-line px-3 py-2 text-left last:border-0 hover:bg-stone-50"><span className="font-semibold">{match.hsn_sac}</span><span className="ml-2 text-xs text-slate-600">{match.description}</span></button>)}</span>}</label><Field label="SKU / code (optional)" name="sku" defaultValue={editing?.sku} placeholder="Leave blank to generate automatically" /><label className="block text-sm font-medium text-slate-700">HSN code<input name="hsnCode" value={hsnCode} onChange={(event) => setHsnCode(event.target.value.replace(/\D/g, '').slice(0, 8))} inputMode="numeric" placeholder="Search product name to find HSN" className="brand-focus mt-2 h-11 w-full rounded-lg border border-brand-line px-3 text-sm outline-none" /><span className="mt-1 block text-xs text-slate-500">Free lookup suggestions use the CBIC GST schedule dataset. Confirm the correct code for your item.</span></label><Field label="Category" name="category" defaultValue={editing?.category} placeholder="e.g. Packaging" /><label className="block text-sm font-medium text-slate-700">Unit<select name="unit" defaultValue={editing?.unit || 'pcs'} className="brand-focus mt-2 h-11 w-full rounded-lg border border-brand-line bg-white px-3 text-sm outline-none">{editing?.unit && !productUnits.some(([value]) => value === editing.unit) && <option value={editing.unit}>{editing.unit} (current unit)</option>}{productUnits.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><Field label="Selling price (₹)" name="salePrice" type="number" min="0" step="0.01" required defaultValue={editing?.salePrice} placeholder="0.00" /><Field label="Purchase price (₹)" name="purchasePrice" type="number" min="0" step="0.01" required defaultValue={editing?.purchasePrice} placeholder="0.00" /><Field label="Opening stock" name="stock" type="number" min="0" step="1" required defaultValue={editing?.stock ?? 0} placeholder="0" /><label className="block text-sm font-medium text-slate-700">GST rate<select name="gstRateId" required defaultValue={editing?.gstRateId || gstRates.find((rate) => Number(rate.percentage) === Number(editing?.gst))?.id || ''} className="brand-focus mt-2 h-11 w-full rounded-lg border border-brand-line bg-white px-3 text-sm outline-none"><option value="" disabled>Select a tax rate</option>{gstRates.filter((rate) => rate.isActive).map((rate) => <option key={rate.id} value={rate.id}>{rate.name} · {rate.percentage}%</option>)}</select></label>{gstRates.filter((rate) => rate.isActive).length === 0 && <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 sm:col-span-2">Create an active rate in GST Master before saving a product. <button type="button" onClick={onManageGst} className="ml-1 font-semibold underline">Open GST Master</button></div>}<div className="mt-2 flex justify-end gap-3 border-t border-brand-line pt-5 sm:col-span-2"><button type="button" onClick={() => { setModalOpen(false); setEditing(null) }} className="rounded-xl border border-brand-line px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-stone-50">Cancel</button><button type="submit" disabled={saving || gstRates.filter((rate) => rate.isActive).length === 0} className="brand-button rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-60">{saving ? 'Saving…' : editing ? 'Save changes' : 'Save product'}</button></div></form></section></div>}
    </main>
  )
}

function SummaryCard({ label, value, detail, icon }) {
  return <article className="rounded-2xl border border-brand-line bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-500">{label}</p><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-sm font-bold text-brand-red">{icon}</span></div><p className="mt-3 text-2xl font-bold tracking-tight">{value}</p><p className="mt-1 text-xs text-slate-400">{detail}</p></article>
}

function Field({ label, name, type = 'text', ...inputProps }) {
  return <label className="block text-sm font-medium text-slate-700">{label}<input name={name} type={type} className="brand-focus mt-2 h-11 w-full rounded-lg border border-brand-line px-3 text-sm outline-none" {...inputProps} /></label>
}
