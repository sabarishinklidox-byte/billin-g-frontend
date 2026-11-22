import { useState } from 'react'
import { ArrowRight, BookOpen, ChartNoAxesCombined, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { login } from '../lib/api.js'

export default function Login({ onLogin, onContact }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { data } = await login({ email, password })
      localStorage.removeItem('billbook-token')
      sessionStorage.removeItem('billbook-token')
      const storage = remember ? localStorage : sessionStorage
      storage.setItem('billbook-token', data.token)
      onLogin(data.user)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'We could not connect to your account. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login-page grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <section className="flex items-center justify-center px-6 py-10 sm:px-12 lg:px-16">
        <div className="w-full max-w-md">
          <a href="#home" className="mb-14 inline-flex items-center gap-3" aria-label="My Bill Book home">
            <span className="brand-logo-mark flex h-11 w-11 items-center justify-center rounded-xl shadow-lg shadow-red-100"><BookOpen size={21} /></span>
            <span><span className="block font-bold tracking-tight text-slate-900">My Bill Book</span><span className="block text-xs text-slate-500">Business made simple</span></span>
          </a>

          <div className="mb-8">
            <p className="brand-eyebrow mb-3 text-sm font-semibold">WELCOME BACK</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Sign in to your account</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">Your business overview, invoices, and customer records are waiting.</p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <label className="block text-sm font-semibold text-slate-700">Work email
              <span className="relative mt-2 block"><Mail className="pointer-events-none absolute left-3.5 top-3.5 text-slate-400" size={18} /><input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@business.com" className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-11 pr-4 font-normal outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-red focus:ring-4 focus:ring-red-100" /></span>
            </label>
            <label className="block text-sm font-semibold text-slate-700">Password
              <span className="relative mt-2 block"><LockKeyhole className="pointer-events-none absolute left-3.5 top-3.5 text-slate-400" size={18} /><input required type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-11 pr-12 font-normal outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-red focus:ring-4 focus:ring-red-100" /><button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-700" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span>
            </label>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2.5 font-medium text-slate-600"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-red focus:ring-brand-red" />Remember me</label>
              <button type="button" onClick={onContact} className="font-semibold text-brand-red hover:text-brand-deep">Forgot password?</button>
            </div>

            {error && <p role="alert" className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
            <button type="submit" disabled={busy} className="brand-button group flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-semibold shadow-lg shadow-red-100 disabled:cursor-wait disabled:opacity-70">{busy ? 'Signing in…' : 'Sign in'}{!busy && <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />}</button>
          </form>

          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-500"><ShieldCheck size={15} className="text-emerald-600" />Your account information is securely protected.</div>
          <p className="mt-12 text-center text-sm text-slate-500">Need help signing in? <button onClick={onContact} className="font-semibold text-brand-red hover:text-brand-deep">Contact support</button></p>
          <p className="mt-8 text-center text-xs text-slate-400">© 2026 My Bill Book. All rights reserved.</p>
        </div>
      </section>

      <section className="login-brand-panel relative hidden min-h-screen overflow-hidden p-12 lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="login-red-glow absolute -right-24 -top-28 h-[28rem] w-[28rem] rounded-full blur-3xl" />
        <div className="login-soft-glow absolute -bottom-32 -left-20 h-[30rem] w-[30rem] rounded-full blur-3xl" />
        <div className="relative flex items-center gap-2 text-sm font-medium text-red-100"><span className="h-2 w-2 rounded-full bg-emerald-400" />YOUR BUSINESS, IN GOOD HANDS</div>
        <div className="relative mx-auto w-full max-w-xl">
          <div className="login-icon-card mb-8 flex h-14 w-14 items-center justify-center rounded-2xl"><ChartNoAxesCombined size={27} /></div>
          <h2 className="text-4xl font-bold leading-tight tracking-tight xl:text-5xl">Make every business day count.</h2>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">Create clear invoices, stay on top of payments, and keep your business moving forward.</p>
          <div className="mt-10 grid grid-cols-3 gap-3">
            {[['01', 'Invoice faster'], ['02', 'Track payments'], ['03', 'Know your numbers']].map(([number, label]) => <div key={number} className="login-step-card rounded-2xl p-4"><span className="login-step-number text-xs font-bold">{number}</span><p className="mt-3 text-sm font-medium text-slate-100">{label}</p></div>)}
          </div>
        </div>
        <p className="relative text-xs text-slate-400">A simpler way to take care of business.</p>
      </section>
    </main>
  )
}
