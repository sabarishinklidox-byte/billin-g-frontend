import { ArrowLeft, ArrowUpRight, BookOpen, Clock3, Mail, MessageCircle } from 'lucide-react'

export default function Contact({ onBack }) {
  const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL

  return (
    <main className="min-h-screen bg-brand-paper px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <a href="#home" className="inline-flex items-center gap-3" aria-label="My Bill Book home"><span className="brand-logo-mark flex h-10 w-10 items-center justify-center rounded-xl"><BookOpen size={20} /></span><span className="font-bold tracking-tight text-slate-900">My Bill Book</span></a>
        <button onClick={onBack} className="mt-10 flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-brand-red"><ArrowLeft size={16} />Back to sign in</button>

        <section className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
            <div className="p-7 sm:p-10 lg:p-14">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-red">We’re here to help</p>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Let’s get you back to business.</h1>
              <p className="mt-4 max-w-xl leading-7 text-slate-500">Our support team can help with sign-in issues, account access, and getting started with My Bill Book.</p>

              <div className="mt-9 space-y-4">
                {supportEmail ? <a href={`mailto:${supportEmail}`} className="group flex items-center gap-4 rounded-2xl border border-slate-200 p-4 transition hover:border-red-100 hover:bg-red-50/50">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-brand-red"><Mail size={20} /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-900">Email support</span><span className="mt-1 block truncate text-sm text-slate-500">{supportEmail}</span></span><ArrowUpRight size={17} className="text-slate-400 transition group-hover:text-brand-red" />
                </a> : <div className="flex items-center gap-4 rounded-2xl border border-slate-200 p-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-brand-red"><Mail size={20} /></span>
                  <span><span className="block text-sm font-semibold text-slate-900">Email support</span><span className="mt-1 block text-sm text-slate-500">Support email will be available soon.</span></span>
                </div>}
                <div className="flex items-center gap-4 rounded-2xl border border-slate-200 p-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Clock3 size={20} /></span>
                  <span><span className="block text-sm font-semibold text-slate-900">Account access</span><span className="mt-1 block text-sm text-slate-500">Use the account email configured by your owner.</span></span>
                </div>
              </div>

              <p className="mt-8 text-sm text-slate-500">When you write to us, include the email address on your account. Please don’t send your password.</p>
            </div>
            <aside className="brand-dark-panel flex flex-col justify-between p-7 sm:p-10 lg:p-12">
              <div><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-red-100"><MessageCircle size={22} /></span><h2 className="mt-8 text-2xl font-bold">A little help goes a long way.</h2><p className="mt-3 leading-7 text-slate-300">Tell us what you’re trying to do and where you got stuck. We’ll point you in the right direction.</p></div>
              <button onClick={onBack} className="mt-12 inline-flex w-fit items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-red-50">Return to sign in<ArrowLeft size={16} /></button>
            </aside>
          </div>
        </section>
        <p className="mt-7 text-center text-xs text-slate-400">My Bill Book support · Your business, in one place</p>
      </div>
    </main>
  )
}
