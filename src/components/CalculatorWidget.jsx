import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Calculator, Delete, X } from 'lucide-react'

export default function CalculatorWidget() {
  const [open, setOpen] = useState(false)
  const [display, setDisplay] = useState('0')
  const [stored, setStored] = useState(null)
  const [operator, setOperator] = useState(null)
  const [replaceDisplay, setReplaceDisplay] = useState(false)

  function inputDigit(digit) {
    setDisplay((current) => replaceDisplay || current === '0' ? digit : current.length < 14 ? current + digit : current)
    setReplaceDisplay(false)
  }
  function inputDecimal() {
    if (replaceDisplay) { setDisplay('0.'); setReplaceDisplay(false) }
    else if (!display.includes('.')) setDisplay((current) => `${current}.`)
  }
  function calculate(left, right, op) {
    if (op === '+') return left + right
    if (op === '−') return left - right
    if (op === '×') return left * right
    if (op === '÷') return right === 0 ? NaN : left / right
    return right
  }
  function chooseOperation(nextOperator) {
    const current = Number(display)
    if (!Number.isFinite(current)) return
    if (stored !== null && operator && !replaceDisplay) {
      const result = calculate(stored, current, operator)
      setDisplay(Number.isFinite(result) ? String(Number(result.toPrecision(12))) : 'Error')
      setStored(Number.isFinite(result) ? result : null)
    } else setStored(current)
    setOperator(nextOperator)
    setReplaceDisplay(true)
  }
  function equals() {
    if (stored === null || !operator) return
    const result = calculate(stored, Number(display), operator)
    setDisplay(Number.isFinite(result) ? String(Number(result.toPrecision(12))) : 'Error')
    setStored(null); setOperator(null); setReplaceDisplay(true)
  }
  function clear() { setDisplay('0'); setStored(null); setOperator(null); setReplaceDisplay(false) }
  function backspace() { setDisplay((current) => current.length <= 1 || current === 'Error' ? '0' : current.slice(0, -1)) }

  const keys = [
    { label: '⌫', action: backspace, icon: true }, { label: 'C', action: clear, style: 'text-rose-600' }, { label: '%', action: () => setDisplay(String(Number(display) / 100)) }, { label: '÷', action: () => chooseOperation('÷'), op: true },
    ...['7', '8', '9'].map((label) => ({ label, action: () => inputDigit(label) })), { label: '×', action: () => chooseOperation('×'), op: true },
    ...['4', '5', '6'].map((label) => ({ label, action: () => inputDigit(label) })), { label: '−', action: () => chooseOperation('−'), op: true },
    ...['1', '2', '3'].map((label) => ({ label, action: () => inputDigit(label) })), { label: '+', action: () => chooseOperation('+'), op: true },
    { label: '±', action: () => setDisplay((current) => String(Number(current) * -1)) }, { label: '0', action: () => inputDigit('0') }, { label: '.', action: inputDecimal }, { label: '=', action: equals, equals: true },
  ]

  return createPortal(<>
    <button type="button" onClick={() => setOpen(true)} aria-label="Open calculator" title="Calculator" style={{ position: 'fixed', right: 28, bottom: 28, zIndex: 99999, width: 60, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '9999px', border: '2px solid white', background: '#2563eb', color: 'white', boxShadow: '0 8px 24px rgba(15, 23, 42, 0.28)', cursor: 'pointer' }}><Calculator size={25} strokeWidth={2.2} /></button>
    {open && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}><section role="dialog" aria-modal="true" aria-labelledby="calculator-title" className="w-full max-w-xs overflow-hidden rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><h2 id="calculator-title" className="flex items-center gap-2 text-sm font-bold"><Calculator size={17} className="text-brand-red" />Calculator</h2><button type="button" onClick={() => setOpen(false)} aria-label="Close calculator" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button></div><div aria-live="polite" className="overflow-hidden px-4 py-5 text-right text-3xl font-semibold tracking-tight text-slate-900">{display}</div><div className="grid grid-cols-4 gap-2 p-3 pt-0">{keys.map(({ label, action, op, equals: isEquals, style, icon }) => <button key={label} type="button" onClick={action} aria-label={icon ? 'Backspace' : label} className={`flex h-12 items-center justify-center rounded-xl text-base font-semibold transition ${isEquals ? 'bg-brand-red text-white hover:bg-brand-deep' : op ? 'bg-red-50 text-brand-red hover:bg-red-100' : `${style || 'bg-slate-100 text-slate-700'} hover:bg-slate-200`}`}>{icon ? <Delete size={18} /> : label}</button>)}</div></section></div>}
  </>, document.body)
}
