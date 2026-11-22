import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
})

export async function login(credentials) {
  return api.post('/auth/login', credentials)
}

export function saveCompanyDetails(details) {
  return api.put('/auth/company', details)
}

export function getProducts() {
  return api.get('/products')
}

export function getCustomers() {
  return api.get('/customers')
}

export function getBankAccounts() {
  return api.get('/banks')
}

export function createBankAccount(account) {
  return api.post('/banks', account)
}

export function updateBankAccount(id, account) {
  return api.put(`/banks/${encodeURIComponent(id)}`, account)
}

export function deleteBankAccount(id) {
  return api.delete(`/banks/${encodeURIComponent(id)}`)
}

export function getInvoices() {
  return api.get('/invoices')
}

export function getSalesReport(filters = {}) {
  return api.get('/reports/sales', { params: filters })
}

export function getExpenses() { return api.get('/expenses') }
export function createExpense(expense) { return api.post('/expenses', expense) }
export function updateExpense(id, expense) { return api.put(`/expenses/${encodeURIComponent(id)}`, expense) }
export function deleteExpense(id) { return api.delete(`/expenses/${encodeURIComponent(id)}`) }
export function getAttendance() { return api.get('/attendance') }
export function saveAttendance(record) { return api.post('/attendance', record) }
export function deleteAttendance(id) { return api.delete(`/attendance/${encodeURIComponent(id)}`) }
export function getEmployees() { return api.get('/attendance/employees') }
export function createEmployee(employee) { return api.post('/attendance/employees', employee) }
export function getEmployeeSalaries(employeeId, filters = {}) { return api.get(`/attendance/employees/${encodeURIComponent(employeeId)}/salaries`, { params: filters }) }
export function createEmployeeSalary(employeeId, salary) { return api.post(`/attendance/employees/${encodeURIComponent(employeeId)}/salaries`, salary) }

export function getInvoice(id) {
  return api.get(`/invoices/${encodeURIComponent(id)}`)
}

export function createInvoice(invoice) {
  return api.post('/invoices', invoice)
}

export function updateInvoice(id, invoice) {
  return api.put(`/invoices/${encodeURIComponent(id)}`, invoice)
}

export function updateInvoiceWorkflowStatus(id, workflowStatus) {
  return api.patch(`/invoices/${encodeURIComponent(id)}/workflow-status`, { workflowStatus })
}

export function updateInvoicePaymentStatus(id, status) {
  return api.patch(`/invoices/${encodeURIComponent(id)}/payment-status`, { status })
}

export function updateInvoiceQuantities(id, items) {
  return api.put(`/invoices/${encodeURIComponent(id)}/quantities`, { items })
}

export function lookupCustomerGstin(gstin) {
  return api.get(`/customers/gstin/${encodeURIComponent(gstin)}`)
}

export function createCustomer(customer) {
  return api.post('/customers', customer)
}

export function updateCustomer(id, customer) {
  return api.put(`/customers/${encodeURIComponent(id)}`, customer)
}

export function deleteCustomer(id) {
  return api.delete(`/customers/${encodeURIComponent(id)}`)
}

export function searchHsn(query) {
  return api.get('/products/hsn-lookup', { params: { q: query } })
}

export function getGstRates() {
  return api.get('/gst-rates')
}

export function createGstRate(rate) {
  return api.post('/gst-rates', rate)
}

export function updateGstRate(id, rate) {
  return api.put(`/gst-rates/${encodeURIComponent(id)}`, rate)
}

export function deleteGstRate(id) {
  return api.delete(`/gst-rates/${encodeURIComponent(id)}`)
}

export function createProduct(product) {
  return api.post('/products', product)
}

export function updateProduct(id, product) {
  return api.put(`/products/${encodeURIComponent(id)}`, product)
}

export function deleteProduct(id) {
  return api.delete(`/products/${encodeURIComponent(id)}`)
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('billbook-token') || sessionStorage.getItem('billbook-token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
