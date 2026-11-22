import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CalendarCheck, Clock3, Pencil, Plus, Save, Trash2, Users, Wallet, X } from 'lucide-react'
import { createEmployee, createEmployeeSalary, deleteAttendance, getAttendance, getEmployeeSalaries, getEmployees, saveAttendance } from '../lib/api.js'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })

const today = () => {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}
const statusOptions = [
  { value: 'PRESENT', label: 'Present', style: 'bg-emerald-50 text-emerald-700' },
  { value: 'ABSENT', label: 'Absent', style: 'bg-rose-50 text-rose-700' },
  { value: 'LATE', label: 'Late', style: 'bg-amber-50 text-amber-700' },
  { value: 'LEAVE', label: 'Leave', style: 'bg-sky-50 text-sky-700' },
]

function workedMinutes(checkIn, checkOut, breakMinutes = 0) {
  if (!checkIn || !checkOut) return 0
  const [inHour, inMinute] = checkIn.split(':').map(Number)
  const [outHour, outMinute] = checkOut.split(':').map(Number)
  const start = inHour * 60 + inMinute
  let end = outHour * 60 + outMinute
  if (end < start) end += 24 * 60
  return Math.max(0, end - start - Number(breakMinutes || 0))
}

function workedTime(checkIn, checkOut, breakMinutes = 0) {
  if (!checkIn || !checkOut) return '—'
  const elapsed = workedMinutes(checkIn, checkOut, breakMinutes)
  if (!elapsed) return '0h 00m'
  return `${Math.floor(elapsed / 60)}h ${String(elapsed % 60).padStart(2, '0')}m`
}

function formatTime12h(value) {
  if (!value) return '—'
  const [hour, minute] = value.split(':').map(Number)
  const date = new Date(Date.UTC(2020, 0, 1, hour, minute))
  return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' }).format(date)
}

export default function Attendance({ user, onBack }) {
  const [records, setRecords] = useState([])
  const [selectedDate, setSelectedDate] = useState(today())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [employees, setEmployees] = useState([])
  const [formError, setFormError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [employeeSalaries, setEmployeeSalaries] = useState([])
  const [salariesLoading, setSalariesLoading] = useState(false)
  const [salaryModalOpen, setSalaryModalOpen] = useState(false)
  const [salarySaving, setSalarySaving] = useState(false)
  const [salaryFormError, setSalaryFormError] = useState('')
  const [salaryNotice, setSalaryNotice] = useState('')
  const [reportFrom, setReportFrom] = useState('')
  const [reportTo, setReportTo] = useState('')
  const [reportPage, setReportPage] = useState(1)

  useEffect(() => { setReportFrom(''); setReportTo(''); setReportPage(1); setSalaryNotice('') }, [selectedEmployee])

  useEffect(() => {
    if (!selectedEmployee) { setEmployeeSalaries([]); return undefined }
    let current = true
    setSalariesLoading(true)
    getEmployeeSalaries(selectedEmployee.id, { from: reportFrom, to: reportTo })
      .then(({ data }) => { if (current) setEmployeeSalaries(data.salaries || []) })
      .catch((requestError) => { if (current) setSalaryFormError(requestError.response?.data?.message || 'Could not load employee salaries.') })
      .finally(() => { if (current) setSalariesLoading(false) })
    return () => { current = false }
  }, [selectedEmployee, reportFrom, reportTo])
  const [editingRecordId, setEditingRecordId] = useState(null)
  const [recordDraft, setRecordDraft] = useState(null)
  const [sharedBreakMinutes, setSharedBreakMinutes] = useState(() => {
    const saved = Number(localStorage.getItem(`billbook-attendance-break-minutes-${user.id}`))
    return Number.isFinite(saved) && saved >= 0 && saved <= 1440 ? saved : 60
  })
  const [breakMinutesDraft, setBreakMinutesDraft] = useState(String(sharedBreakMinutes))

  useEffect(() => {
    localStorage.setItem(`billbook-attendance-break-minutes-${user.id}`, String(sharedBreakMinutes))
  }, [sharedBreakMinutes, user.id])

  useEffect(() => { setBreakMinutesDraft(String(sharedBreakMinutes)) }, [sharedBreakMinutes])

  function saveBreakTime() {
    const parsed = Number(breakMinutesDraft)
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 1440) {
      setError('Break time must be a whole number between 0 and 1440 minutes.')
      return
    }
    setSharedBreakMinutes(parsed)
    setError('')
  }

  useEffect(() => {
    Promise.all([getAttendance(), getEmployees()])
      .then(([attendanceResponse, employeesResponse]) => {
        setRecords(attendanceResponse.data.records || [])
        setEmployees(employeesResponse.data.employees || [])
      })
      .catch((requestError) => setError(requestError.response?.data?.message || 'Could not load attendance records.'))
      .finally(() => setLoading(false))
  }, [])

  const dayRecords = useMemo(() => {
    const savedForDay = records.filter((record) => String(record.date).slice(0, 10) === selectedDate)
    const savedByName = new Map(savedForDay.map((record) => [record.employee.toLowerCase(), record]))
    const activeEmployees = employees.filter((employee) => String(employee.joinDate).slice(0, 10) <= selectedDate)
    const roster = activeEmployees.map((employee) => savedByName.get(employee.name.toLowerCase()) || {
      id: `pending-${employee.id}`,
      employee: employee.name,
      date: selectedDate,
      status: '',
      checkIn: '',
      checkOut: '',
      notes: '',
      isUnrecorded: true,
    })
    const rosterNames = new Set(activeEmployees.map((employee) => employee.name.toLowerCase()))
    return [...roster, ...savedForDay.filter((record) => !rosterNames.has(record.employee.toLowerCase()))]
      .sort((a, b) => a.employee.localeCompare(b.employee))
  }, [records, employees, selectedDate])
  const counts = statusOptions.reduce((result, status) => ({ ...result, [status.value]: dayRecords.filter((record) => record.status === status.value).length }), {})
  async function save(record) {
    setSaving(true); setError('')
    try {
      const { data } = await saveAttendance(record)
      setRecords((current) => [...current.filter((item) => item.id !== data.record.id && !(item.employee.toLowerCase() === data.record.employee.toLowerCase() && String(item.date).slice(0, 10) === selectedDate)), data.record])
      return true
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not save attendance.')
      return false
    } finally { setSaving(false) }
  }

  async function addEmployee(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const employee = Object.fromEntries(['name', 'phone', 'email', 'address', 'bloodGroup', 'joinDate', 'designation'].map((key) => [key, String(form.get(key) || '').trim()]))
    setSaving(true); setFormError('')
    try {
      const existingEmployee = employees.find((item) => item.name.toLowerCase() === employee.name.toLowerCase())
      let savedEmployee = existingEmployee
      if (!savedEmployee) {
        const { data } = await createEmployee(employee)
        savedEmployee = data.employee
        setEmployees((current) => [...current, savedEmployee].sort((a, b) => a.name.localeCompare(b.name)))
      }
      await save({ employee: savedEmployee.name, date: selectedDate, status: 'PRESENT', checkIn: '', checkOut: '', notes: '' })
      setModalOpen(false)
    } catch (requestError) {
      setFormError(requestError.response?.data?.message || 'Could not save this employee.')
    } finally { setSaving(false) }
  }

  async function updateRecord(record, changes) {
    const saved = await save({ employee: record.employee, date: selectedDate, status: record.status, checkIn: record.checkIn || '', checkOut: record.checkOut || '', notes: record.notes || '', ...changes })
    if (saved) { setEditingRecordId(null); setRecordDraft(null) }
  }

  function startEdit(record) {
    setEditingRecordId(record.id)
    setRecordDraft({ status: record.status, checkIn: record.checkIn || '', checkOut: record.checkOut || '' })
  }

  async function addEmployeeSalary(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const salary = {
      fromDate: String(form.get('fromDate') || ''),
      toDate: String(form.get('toDate') || ''),
      amount: Number(form.get('amount')),
      notes: String(form.get('notes') || '').trim(),
    }
    setSalarySaving(true)
    setSalaryFormError('')
    try {
      const { data } = await createEmployeeSalary(selectedEmployee.id, salary)
      const inSelectedRange = (!reportFrom || data.salary.fromDate >= reportFrom) && (!reportTo || data.salary.toDate <= reportTo)
      if (inSelectedRange) setEmployeeSalaries((current) => [data.salary, ...current].sort((a, b) => b.fromDate.localeCompare(a.fromDate)))
      setSalaryNotice(inSelectedRange ? 'Salary added to this employee report.' : 'Salary saved. It is outside the selected report dates.')
      setSalaryModalOpen(false)
    } catch (requestError) {
      setSalaryFormError(requestError.response?.data?.message || 'Could not save this salary entry.')
    } finally { setSalarySaving(false) }
  }

  async function removeRecord(record) {
    if (!window.confirm(`Remove ${record.employee}'s attendance for this date?`)) return
    try { await deleteAttendance(record.id); setRecords((current) => current.filter((item) => item.id !== record.id)); setError('') }
    catch (requestError) { setError(requestError.response?.data?.message || 'Could not remove this record.') }
  }

  const selectedEmployeeRecords = selectedEmployee
    ? records.filter((record) => record.employee.toLowerCase() === selectedEmployee.name.toLowerCase()).sort((a, b) => String(b.date).localeCompare(String(a.date)))
    : []
  const filteredEmployeeRecords = selectedEmployeeRecords.filter((record) => {
    const date = String(record.date).slice(0, 10)
    return (!reportFrom || date >= reportFrom) && (!reportTo || date <= reportTo)
  })
  const reportPageSize = 10
  const reportPageCount = Math.max(1, Math.ceil(filteredEmployeeRecords.length / reportPageSize))
  const reportPageRecords = filteredEmployeeRecords.slice((reportPage - 1) * reportPageSize, reportPage * reportPageSize)
  const totalWorkedMinutes = filteredEmployeeRecords.reduce((sum, record) => sum + workedMinutes(record.checkIn, record.checkOut, sharedBreakMinutes), 0)
  const totalWorkedLabel = `${Math.floor(totalWorkedMinutes / 60)}h ${String(totalWorkedMinutes % 60).padStart(2, '0')}m`
  const presentDays = filteredEmployeeRecords.filter((record) => record.status === 'PRESENT' || record.status === 'LATE').length
  const absentDays = filteredEmployeeRecords.filter((record) => record.status === 'ABSENT').length
  const leaveDays = filteredEmployeeRecords.filter((record) => record.status === 'LEAVE').length
  const employeeSalaryTotal = employeeSalaries.reduce((sum, salary) => sum + Number(salary.amount), 0)
  const initials = user.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()

  return <main className="min-h-screen bg-brand-paper text-slate-900">
    <header className="sticky top-0 z-10 border-b border-brand-line bg-white/95 backdrop-blur"><div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 md:px-8"><div className="flex items-center gap-3"><button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Back to overview"><ArrowLeft size={17} /></button><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-brand-red"><CalendarCheck size={18} /></span><div><p className="text-sm font-bold">My Bill Book</p><p className="text-xs text-slate-500">Attendance</p></div></div><div className="flex items-center gap-3"><span className="hidden text-sm text-slate-500 sm:block">{user.name}</span><span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-black text-xs font-bold text-white">{initials}</span></div></div></header>
    <div className="mx-auto max-w-7xl space-y-6 px-5 py-8 md:px-8">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold text-brand-red">Team management</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Attendance</h1><p className="mt-2 text-sm text-slate-500">Record who is present, absent, late, or on leave each day.</p></div><button onClick={() => { setFormError(''); setModalOpen(true) }} className="inline-flex items-center gap-2 self-start rounded-xl bg-brand-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep"><Plus size={17} />Add employee</button></section>
      <section className="grid gap-4 rounded-2xl border border-brand-line bg-white p-4 shadow-sm md:grid-cols-2 md:p-5"><label className="block max-w-xs text-xs font-semibold text-slate-600">Attendance date<input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="mt-1.5 block h-11 w-full rounded-lg border border-brand-line px-3 text-sm font-normal text-slate-800" /></label><label className="block max-w-xs text-xs font-semibold text-slate-600">Break time (shared across all employees and dates)<div className="mt-1.5 flex h-11 items-center overflow-hidden rounded-lg border border-brand-line"><input aria-label="Shared break time in minutes" type="number" min="0" max="1440" value={breakMinutesDraft} onChange={(event) => setBreakMinutesDraft(event.target.value)} className="h-full min-w-0 flex-1 px-3 text-sm font-normal text-slate-800 outline-none" /><span className="border-l border-brand-line bg-stone-50 px-3 py-3 text-xs text-slate-500">minutes</span></div><button type="button" onClick={saveBreakTime} className="mt-2 rounded-lg bg-brand-red px-3 py-2 text-xs font-semibold text-white hover:bg-brand-deep">Save break time</button><span className="mt-1 block text-[11px] font-normal text-slate-400">This setting applies to every employee on every date and is subtracted from worked time.</span></label></section>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Summary icon={Users} label="Team" value={dayRecords.length} detail="Employees listed for this date" tone="slate" />{statusOptions.map((status) => <Summary key={status.value} icon={status.value === 'LATE' ? Clock3 : CalendarCheck} label={status.label} value={counts[status.value] || 0} detail="Team members" tone={status.value} />)}</section>
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      {employees.length > 0 && <section className="rounded-2xl border border-brand-line bg-white p-5 shadow-sm"><div className="mb-4"><h2 className="font-bold">Employee details</h2><p className="mt-1 text-sm text-slate-500">Saved team profiles, including joining date and contact details.</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{employees.map((employee) => <article key={employee.id} role="button" tabIndex={0} onClick={() => setSelectedEmployee(employee)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedEmployee(employee) }} className="cursor-pointer rounded-xl border border-slate-100 bg-stone-50/60 p-4 text-left transition hover:border-red-200 hover:bg-red-50/30 focus:outline-none focus:ring-2 focus:ring-brand-red/30"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-800">{employee.name}</p><p className="mt-0.5 text-xs text-slate-500">{employee.designation || 'Employee'}{employee.bloodGroup ? ` · ${employee.bloodGroup}` : ''}</p></div>{employee.bloodGroup && <span className="rounded-full bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700">{employee.bloodGroup}</span>}</div><div className="mt-3 space-y-1 text-xs text-slate-500">{employee.phone && <p>{employee.phone}</p>}{employee.email && <p className="truncate">{employee.email}</p>}<p>Joined {new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${String(employee.joinDate).slice(0, 10)}T00:00:00Z`))}</p>{employee.address && <p className="line-clamp-2">{employee.address}</p>}</div></article>)}</div></section>}
      <section className="overflow-hidden rounded-2xl border border-brand-line bg-white shadow-sm"><div className="border-b border-brand-line p-5 md:px-6"><h2 className="font-bold">Daily attendance</h2><p className="mt-1 text-sm text-slate-500">{loading ? 'Loading attendance…' : `${dayRecords.length} team members · ${new Intl.DateTimeFormat('en-IN', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${selectedDate}T00:00:00Z`))}`}</p></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-stone-50 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-6 py-3 font-semibold">Employee</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold">Check in</th><th className="px-4 py-3 font-semibold">Check out</th><th className="px-4 py-3 font-semibold">Worked</th><th className="px-4 py-3 text-right font-semibold">Action</th></tr></thead><tbody className="divide-y divide-brand-line">{dayRecords.map((record) => { const isEditing = editingRecordId === record.id; const shownStatus = isEditing ? recordDraft?.status : record.status; const status = statusOptions.find((item) => item.value === shownStatus) || { label: 'Not marked', style: 'bg-slate-100 text-slate-500' }; return <tr key={record.id} className="hover:bg-stone-50/70"><td className="px-6 py-4"><span className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-xs font-bold text-brand-red">{record.employee.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><span className="font-semibold text-slate-800">{record.employee}</span></span></td><td className="px-4 py-4"><select aria-label={`${record.employee} attendance status`} value={isEditing ? recordDraft.status : record.status} disabled={!isEditing || saving} onChange={(event) => setRecordDraft((current) => ({ ...current, status: event.target.value }))} className={`rounded-full border-0 px-3 py-1.5 text-xs font-semibold ${status.style}`}><option value="">Not marked</option>{statusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></td><td className="px-4 py-4"><input aria-label={`${record.employee} check-in time`} type="time" value={isEditing ? recordDraft.checkIn : record.checkIn || ''} disabled={!isEditing || saving} onChange={(event) => setRecordDraft((current) => ({ ...current, checkIn: event.target.value }))} className="h-9 rounded-lg border border-brand-line px-2 text-sm text-slate-600" /></td><td className="px-4 py-4"><input aria-label={`${record.employee} check-out time`} type="time" value={isEditing ? recordDraft.checkOut : record.checkOut || ''} disabled={!isEditing || saving} onChange={(event) => setRecordDraft((current) => ({ ...current, checkOut: event.target.value }))} className="h-9 rounded-lg border border-brand-line px-2 text-sm text-slate-600" /></td><td className="px-4 py-4 font-semibold text-slate-700">{workedTime(isEditing ? recordDraft.checkIn : record.checkIn, isEditing ? recordDraft.checkOut : record.checkOut, sharedBreakMinutes)}</td><td className="px-6 py-4"><div className="flex justify-end gap-1">{!isEditing && <button type="button" onClick={() => startEdit(record)} aria-label={`Edit ${record.employee} attendance`} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-brand-red hover:bg-red-50"><Pencil size={15} />{record.isUnrecorded ? "Mark attendance" : "Edit"}</button>}<button type="button" onClick={() => isEditing && updateRecord(record, recordDraft)} disabled={saving || !isEditing || !recordDraft?.status} aria-label={`Save ${record.employee} attendance`} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"><Save size={15} />Save</button>{isEditing && <button type="button" onClick={() => { setEditingRecordId(null); setRecordDraft(null) }} disabled={saving} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100">Cancel</button>}{!record.isUnrecorded && <button type="button" onClick={() => removeRecord(record)} aria-label={`Remove ${record.employee}`} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>}</div></td></tr> })}</tbody></table>{!loading && dayRecords.length === 0 && <div className="p-12 text-center"><CalendarCheck className="mx-auto text-slate-300" size={30} /><p className="mt-4 font-semibold text-slate-700">No attendance records for this day</p><p className="mt-1 text-sm text-slate-400">Add employees to start recording daily attendance.</p><button onClick={() => setModalOpen(true)} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-red px-3 py-2 text-sm font-semibold text-white"><Plus size={15} />Add employee</button></div>}</div></section>
    </div>
    {modalOpen && <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false) }}><section role="dialog" aria-modal="true" aria-labelledby="attendance-employee-title" className="my-5 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 id="attendance-employee-title" className="text-lg font-bold">Add employee</h2><p className="mt-1 text-sm text-slate-500">Save employee details and add them to attendance for the selected date.</p></div><button onClick={() => setModalOpen(false)} aria-label="Close" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button></div><form onSubmit={addEmployee} className="mt-5 grid gap-4 sm:grid-cols-2">{formError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:col-span-2">{formError}</p>}<Field label="Employee name" name="name" required maxLength="160" autoFocus placeholder="Full name" /><Field label="Phone number" name="phone" type="tel" maxLength="24" placeholder="Phone number" /><Field label="Email address" name="email" type="email" maxLength="254" placeholder="name@example.com" /><Field label="Designation" name="designation" maxLength="120" placeholder="e.g. Sales assistant" /><label className="block text-sm font-medium text-slate-700">Blood group<select name="bloodGroup" defaultValue="" className="mt-2 h-11 w-full rounded-lg border border-brand-line bg-white px-3 text-sm"><option value="">Select blood group</option>{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((group) => <option key={group}>{group}</option>)}</select></label><label className="block text-sm font-medium text-slate-700">Joining date<input name="joinDate" required type="date" defaultValue={selectedDate} className="mt-2 h-11 w-full rounded-lg border border-brand-line px-3 text-sm" /></label><label className="block text-sm font-medium text-slate-700 sm:col-span-2">Address<textarea name="address" maxLength="1000" rows="2" placeholder="Employee address" className="mt-2 w-full rounded-lg border border-brand-line px-3 py-2 text-sm" /></label><p className="text-xs text-slate-400 sm:col-span-2">The employee will be added as present for {new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${selectedDate}T00:00:00Z`))}. You can change their attendance status afterward.</p><div className="flex justify-end gap-2 border-t border-brand-line pt-4 sm:col-span-2"><button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button><button disabled={saving} className="rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Saving…' : 'Save employee'}</button></div></form></section></div>}
    {selectedEmployee && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedEmployee(null) }}><section role="dialog" aria-modal="true" aria-labelledby="employee-history-title" className="my-5 max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl md:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-brand-red">Employee attendance report</p><h2 id="employee-history-title" className="mt-1 text-2xl font-bold">{selectedEmployee.name}</h2><p className="mt-1 text-sm text-slate-500">{selectedEmployee.designation || 'Employee'}{selectedEmployee.phone ? ` · ${selectedEmployee.phone}` : ''}</p></div><button onClick={() => setSelectedEmployee(null)} aria-label="Close employee report" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button></div><div className="mt-4 flex justify-end"><button type="button" onClick={() => { setSalaryFormError(""); setSalaryModalOpen(true) }} className="inline-flex items-center gap-2 rounded-lg bg-brand-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep"><Plus size={16} />Add salary</button></div>{salaryNotice && <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{salaryNotice}</p>}<div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Summary icon={Wallet} label="Salary total" value={currency.format(employeeSalaryTotal)} detail={salariesLoading ? "Loading salary" : `${employeeSalaries.length} entries in selected dates`} tone="PRESENT" /><Summary icon={CalendarCheck} label="Attendance entries" value={filteredEmployeeRecords.length} detail="All recorded dates" tone="slate" /><Summary icon={Users} label="Present / late" value={presentDays} detail="Days attended" tone="PRESENT" /><Summary icon={CalendarCheck} label="Absent / leave" value={`${absentDays} / ${leaveDays}`} detail="Absent days / leave days" tone="LEAVE" /><Summary icon={Clock3} label="Total worked" value={totalWorkedLabel} detail={`After ${sharedBreakMinutes} min shared break per day`} tone="LATE" /></div><div className="grid gap-3 border-b border-brand-line bg-white p-4 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-600">From date<input type="date" max={reportTo || undefined} value={reportFrom} onChange={(event) => { setReportFrom(event.target.value); setReportPage(1) }} className="mt-1.5 block h-10 w-full rounded-lg border border-brand-line px-3 text-sm font-normal" /></label><label className="text-xs font-semibold text-slate-600">To date<input type="date" min={reportFrom || undefined} value={reportTo} onChange={(event) => { setReportTo(event.target.value); setReportPage(1) }} className="mt-1.5 block h-10 w-full rounded-lg border border-brand-line px-3 text-sm font-normal" /></label><button type="button" onClick={() => { setReportFrom(''); setReportTo(''); setReportPage(1) }} className="text-left text-xs font-semibold text-brand-red sm:col-span-2">Clear date filters</button></div><div className="mt-6 overflow-x-auto rounded-xl border border-brand-line"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-stone-50 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3 font-semibold">Date</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold">Check in</th><th className="px-4 py-3 font-semibold">Check out</th><th className="px-4 py-3 text-right font-semibold">Worked</th></tr></thead><tbody className="divide-y divide-brand-line">{reportPageRecords.map((record) => { const status = statusOptions.find((item) => item.value === record.status) || statusOptions[0]; return <tr key={record.id}><td className="px-4 py-3 text-slate-600">{new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${String(record.date).slice(0, 10)}T00:00:00Z`))}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.style}`}>{status.label}</span></td><td className="px-4 py-3 text-slate-600">{formatTime12h(record.checkIn)}</td><td className="px-4 py-3 text-slate-600">{formatTime12h(record.checkOut)}</td><td className="px-4 py-3 text-right font-semibold">{workedTime(record.checkIn, record.checkOut, sharedBreakMinutes)}</td></tr> })}</tbody></table>{filteredEmployeeRecords.length === 0 && <p className="p-10 text-center text-sm text-slate-500">No attendance records for this employee yet.</p>}<div className="flex flex-col gap-3 border-t border-brand-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-slate-500">Showing {filteredEmployeeRecords.length ? (reportPage - 1) * reportPageSize + 1 : 0}�{Math.min(reportPage * reportPageSize, filteredEmployeeRecords.length)} of {filteredEmployeeRecords.length} attendance records</p><div className="flex items-center gap-2"><button type="button" disabled={reportPage <= 1} onClick={() => setReportPage((page) => Math.max(1, page - 1))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold disabled:opacity-40">Previous</button><span className="text-xs text-slate-500">Page {reportPage} of {reportPageCount}</span><button type="button" disabled={reportPage >= reportPageCount} onClick={() => setReportPage((page) => Math.min(reportPageCount, page + 1))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold disabled:opacity-40">Next</button></div></div></div><div className="mt-6 overflow-hidden rounded-xl border border-brand-line"><div className="border-b border-brand-line bg-stone-50 px-4 py-3"><h3 className="text-sm font-bold">Salary entries</h3><p className="mt-1 text-xs text-slate-500">Salary entries for this employee in the selected date range</p></div>{salariesLoading ? <p className="p-5 text-sm text-slate-500">Loading salary entries.</p> : employeeSalaries.length ? <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">From - to</th><th className="px-4 py-3">Notes</th><th className="px-4 py-3 text-right">Amount</th></tr></thead><tbody className="divide-y divide-brand-line">{employeeSalaries.map((salary) => <tr key={salary.id}><td className="px-4 py-3 text-slate-600">{`${new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${salary.fromDate}T00:00:00Z`))} - ${new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${salary.toDate}T00:00:00Z`))}`}</td><td className="px-4 py-3 text-slate-500">{salary.notes || '-'}</td><td className="px-4 py-3 text-right font-semibold">{currency.format(salary.amount)}</td></tr>)}</tbody></table></div> : <p className="p-5 text-sm text-slate-500">No salary entries for this date range.</p>}</div><div className="mt-5 flex justify-end"><button onClick={() => setSelectedEmployee(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Close report</button></div></section></div>}
    {salaryModalOpen && selectedEmployee && <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSalaryModalOpen(false) }}><section role="dialog" aria-modal="true" aria-labelledby="employee-salary-title" className="my-5 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-brand-red">Employee salary</p><h2 id="employee-salary-title" className="mt-1 text-xl font-bold">Add salary for {selectedEmployee.name}</h2><p className="mt-1 text-sm text-slate-500">The amount is for the date range you enter and counts in matching report filters.</p></div><button type="button" onClick={() => setSalaryModalOpen(false)} aria-label="Close add salary form" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button></div><form onSubmit={addEmployeeSalary} className="mt-5 space-y-4">{salaryFormError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{salaryFormError}</p>}<div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium text-slate-700">From date<input required name="fromDate" type="date" defaultValue={reportFrom || reportTo || selectedDate} className="mt-2 h-11 w-full rounded-lg border border-brand-line px-3 text-sm" /></label><label className="block text-sm font-medium text-slate-700">To date<input required name="toDate" type="date" defaultValue={reportTo || reportFrom || selectedDate} className="mt-2 h-11 w-full rounded-lg border border-brand-line px-3 text-sm" /></label></div><label className="block text-sm font-medium text-slate-700">Salary amount (INR)<input required name="amount" type="number" min="0.01" max="9999999999.99" step="0.01" placeholder="0.00" className="mt-2 h-11 w-full rounded-lg border border-brand-line px-3 text-sm" /></label><label className="block text-sm font-medium text-slate-700">Notes (optional)<textarea name="notes" maxLength="1000" rows="3" placeholder="Optional salary note" className="mt-2 w-full rounded-lg border border-brand-line px-3 py-2 text-sm" /></label><div className="flex justify-end gap-2 border-t border-brand-line pt-4"><button type="button" onClick={() => setSalaryModalOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button><button disabled={salarySaving} className="rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{salarySaving ? 'Saving.' : 'Save salary'}</button></div></form></section></div>}
  </main>
}

function Summary({ icon: Icon, label, value, detail, tone }) {
  const tones = { slate: 'bg-slate-100 text-slate-600', PRESENT: 'bg-emerald-50 text-emerald-700', ABSENT: 'bg-rose-50 text-rose-700', LATE: 'bg-amber-50 text-amber-700', LEAVE: 'bg-sky-50 text-sky-700' }
  return <article className="rounded-2xl border border-brand-line bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-500">{label}</p><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tones[tone]}`}><Icon size={17} /></span></div><p className="mt-3 text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-slate-400">{detail}</p></article>
}

function Field({ label, name, ...props }) {
  return <label className="block text-sm font-medium text-slate-700">{label}<input name={name} className="mt-2 h-11 w-full rounded-lg border border-brand-line px-3 text-sm outline-none focus:border-brand-red" {...props} /></label>
}
