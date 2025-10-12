"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AppointmentAPI } from "@/lib/appointment-api"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"

// Simple Plan form used in the Plans modal
function PlanForm({ initial, onCancel, onSave }: { initial?: any; onCancel: () => void; onSave: (data: any) => Promise<void> }) {
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [sessionsPerMonth, setSessionsPerMonth] = useState(initial?.sessionsPerMonth ?? initial?.sessionsPerMonth ?? 0)
  const [sessionsPerWeek, setSessionsPerWeek] = useState(initial?.sessionsPerWeek ?? initial?.sessionsPerWeek ?? 0)
  const [price, setPrice] = useState(initial?.price ?? initial?.amount ?? 0)
  const [currency, setCurrency] = useState(initial?.currency || 'USD')
  const [order, setOrder] = useState(initial?.order ?? 0)
  const [badge, setBadge] = useState(initial?.badge || '')
  // duration can be one of presets or a custom number
  const presets = [30, 60, 90, 120]
  const initialDuration = typeof initial?.duration === 'number' ? initial.duration : 30
  const [duration, setDuration] = useState<number>(presets.includes(initialDuration) ? initialDuration : 30)
  const [durationMode, setDurationMode] = useState<'preset' | 'custom'>(presets.includes(initialDuration) ? 'preset' : 'custom')
  const [customDuration, setCustomDuration] = useState<number>(presets.includes(initialDuration) ? 30 : initialDuration)
  const [features, setFeatures] = useState<string[]>((initial?.features && Array.isArray(initial.features)) ? initial.features.slice() : [])
  const [newFeature, setNewFeature] = useState('')

  const submit = async (e?: any) => {
    if (e && e.preventDefault) e.preventDefault()
    const finalDuration = durationMode === 'custom' ? Number(customDuration) || 0 : Number(duration) || 0
    const payload = {
      name: name.trim(),
      description: description.trim(),
      sessionsPerMonth: Number(sessionsPerMonth) || 0,
      sessionsPerWeek: Number(sessionsPerWeek) || 0,
      price: Number(price) || 0,
      currency: currency || 'EGP',
      duration: finalDuration,
      order: Number(order) || 0,
      badge: badge.trim(),
      features: Array.isArray(features) ? features.filter(Boolean) : [],
    }
    await onSave(payload)
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 text-sm">
      <div>
        <label className="text-xs text-gray-500">Name</label>
  <input title="Plan name" placeholder="Premium Plan" className="w-full border rounded px-2 py-1" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="text-xs text-gray-500">Description</label>
  <textarea title="Plan description" placeholder="E.g. 8 sessions per month with weekly reports" className="w-full border rounded px-2 py-1" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500">Sessions / Month</label>
          <input title="Sessions per month" placeholder="8" type="number" className="w-full border rounded px-2 py-1" value={sessionsPerMonth} onChange={(e) => setSessionsPerMonth(Number(e.target.value))} />
        </div>
        <div>
          <label className="text-xs text-gray-500">Sessions / Week</label>
          <input title="Sessions per week" placeholder="2" type="number" className="w-full border rounded px-2 py-1" value={sessionsPerWeek} onChange={(e) => setSessionsPerWeek(Number(e.target.value))} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500">Price</label>
          <input title="Price" placeholder="1000" type="number" className="w-full border rounded px-2 py-1" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
        </div>
        <div>
          <label className="text-xs text-gray-500">Currency</label>
          <select title="Currency" className="w-full border rounded px-2 py-1" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs text-gray-500">Order</label>
          <input title="Display order (lower numbers appear first)" placeholder="0" type="number" className="w-full border rounded px-2 py-1" value={order} onChange={(e) => setOrder(Number(e.target.value))} />
        </div>
        <div>
          <label className="text-xs text-gray-500">Badge</label>
          <select title="Plan badge (optional)" className="w-full border rounded px-2 py-1" value={badge} onChange={(e) => setBadge(e.target.value)}>
            <option value="">None</option>
            <option value="Best Seller">🔥 Best Seller</option>
            <option value="Most Popular">⭐ Most Popular</option>
            <option value="Recommended">✨ Recommended</option>
            <option value="New">🆕 New</option>
            <option value="Limited Offer">⏰ Limited Offer</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">Duration (days)</label>
          <div className="flex flex-col">
            <select title="Duration in days" className="w-full border rounded px-2 py-1" value={durationMode === 'preset' ? String(duration) : 'custom'} onChange={(e) => {
              const v = e.target.value
              if (v === 'custom') {
                setDurationMode('custom')
                // seed custom input with current duration
                setCustomDuration(duration)
              } else {
                setDurationMode('preset')
                setDuration(Number(v))
              }
            }}>
              <option value={String(presets[0])}>{presets[0]}</option>
              <option value={String(presets[1])}>{presets[1]}</option>
              <option value={String(presets[2])}>{presets[2]}</option>
              <option value={String(presets[3])}>{presets[3]}</option>
              <option value="custom">Custom</option>
            </select>
            {durationMode === 'custom' && (
              <input
                title="Custom duration in days"
                type="number"
                min={1}
                className="w-full border rounded px-2 py-1 mt-2"
                value={customDuration}
                onChange={(e) => setCustomDuration(Number(e.target.value))}
              />
            )}
          </div>
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500">Features</label>
        <div className="mt-1">
          <div className="flex flex-wrap gap-2">
            {features.map((f, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-slate-100 px-2 py-1 rounded text-sm">
                <span>{f}</span>
                <button type="button" className="text-xs text-gray-500" onClick={() => setFeatures(prev => prev.filter((_, i) => i !== idx))}>×</button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              title="Add feature"
              placeholder="Add a feature and press Enter"
              className="flex-1 border rounded px-2 py-1"
              value={newFeature}
              onChange={(e) => setNewFeature(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const val = newFeature.trim()
                  if (val) {
                    setFeatures(prev => [...prev, val])
                    setNewFeature('')
                  }
                }
              }}
            />
            <Button type="button" onClick={() => {
              const val = newFeature.trim()
              if (val) {
                setFeatures(prev => [...prev, val])
                setNewFeature('')
              }
            }}>Add</Button>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" type="button" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save</Button>
      </div>
    </form>
  )
}

export default function AdminDashboard() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subscriptions, setSubscriptions] = useState<any[]>([])
  const [view, setView] = useState<'subscriptions' | 'users' | 'plans'>('subscriptions')
  const [users, setUsers] = useState<any[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<{ type: 'user' | 'subscription' | 'confirmPayment' | 'plan'; id: string } | null>(null)
  const [adminProfile, setAdminProfile] = useState<any>(null)
  const [expanded, setExpanded] = useState<Record<string, any>>({})
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'pending'>('all')
  const [plans, setPlans] = useState<any[]>([])
  const [planModalOpen, setPlanModalOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<any | null>(null)
  const [lastPlansResponse, setLastPlansResponse] = useState<any | null>(null)

  const stats = useMemo(() => {
    const totalUsers = users.length
    const totalSubscriptions = subscriptions.length
    const paidSubs = subscriptions.filter(s => (s.paymentStatus || s.payment?.status) === 'paid')
    const paidCount = paidSubs.length
    const totalRevenue = paidSubs.reduce((sum, s) => {
      const price = Number(s.price ?? s.amount ?? s.subscriptionPrice ?? s.planPrice ?? s.subscriptionPlan?.price ?? s.plan?.price)
      if (Number.isFinite(price)) return sum + price
      return sum
    }, 0)
    return { totalUsers, totalSubscriptions, paidCount, totalRevenue }
  }, [subscriptions, users])

  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter(s => {
      const isPaid = (s.paymentStatus || s.payment?.status) === 'paid'
      if (paymentFilter === 'all') return true
      if (paymentFilter === 'paid') return isPaid
      return !isPaid
    })
  }, [subscriptions, paymentFilter])

  const sortedPlans = useMemo(() => {
    return [...plans].sort((a, b) => {
      const orderA = typeof a.order === 'number' ? a.order : 999
      const orderB = typeof b.order === 'number' ? b.order : 999
      return orderA - orderB
    })
  }, [plans])

  useEffect(() => {
    const t = typeof window !== 'undefined'
      ? (localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token'))
      : null
    setToken(t)
    if (!t) {
      router.push('/admin/login')
      return
    }
    // load cached profile first
    try {
      const cached = localStorage.getItem('admin_profile')
      if (cached) setAdminProfile(JSON.parse(cached))
    } catch (e) {}

    fetchSubscriptions(t)
    fetchAdminProfile(t)
    // also prefetch users so the dashboard stats (Users count) is accurate without visiting the Users view
    fetchUsers(t)
    // prefetch plans too for quick switching
    fetchPlans(t)
  }, [])

  // central handler for authentication failures: clear stored tokens/profile and redirect to login
  const handleAuthError = (message?: string) => {
    // clear both storages
    try {
      localStorage.removeItem('admin_token')
      localStorage.removeItem('admin_profile')
      sessionStorage.removeItem('admin_token')
      sessionStorage.removeItem('admin_profile')
    } catch (e) {}
    setToken(null)
    setAdminProfile(null)
    // optional: set error to show a message before redirect
    if (message) setError(message)
    router.push('/admin/login')
  }

  const fetchAdminProfile = async (jwt: string) => {
    // Detect admin's current timezone
    const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Cairo'
    const defaultAdmin = { timezone: detectedTimezone }
    setAdminProfile(defaultAdmin)
    localStorage.setItem('admin_profile', JSON.stringify(defaultAdmin))
  }

  const changeAdminTimezone = (newTimezone: string) => {
    const updated = { ...adminProfile, timezone: newTimezone }
    setAdminProfile(updated)
    localStorage.setItem('admin_profile', JSON.stringify(updated))
  }

  const fetchSubscriptions = async (jwt?: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await AppointmentAPI.adminGetSubscriptions(jwt || token || '', { limit: 200 })
      if (!res.success) {
        // if server signals auth problems, redirect to login
        if (res.error && /token|auth|unauthor/i.test(String(res.error))) {
          handleAuthError(typeof res.error === 'string' ? res.error : undefined)
          return
        }
        setError(res.error)
        setSubscriptions([])
      } else {
        setSubscriptions(res.subscriptions || [])
      }
    } catch (e: any) {
      // network or 401-like errors handling
      const msg = e?.message || ''
      if (/401|unauthor|token|expired/i.test(msg)) {
        handleAuthError(msg)
        return
      }
      setError(msg || 'Failed to fetch')
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async (jwt?: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await AppointmentAPI.adminGetUsers(jwt || token || '', { limit: 200 })
      if (!res.success) {
        if (res.error && /token|auth|unauthor/i.test(String(res.error))) {
          handleAuthError(typeof res.error === 'string' ? res.error : undefined)
          return
        }
        setError(res.error)
        setUsers([])
      } else {
        setUsers(res.users || [])
      }
    } catch (e: any) {
      const msg = e?.message || ''
      if (/401|unauthor|token|expired/i.test(msg)) {
        handleAuthError(msg)
        return
      }
      setError(msg || 'Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }

  const fetchPlans = async (jwt?: string) => {
    setLoading(true)
    setError(null)
    try {
      try { console.debug('fetchPlans jwt (arg):', jwt, 'token(state):', token) } catch (e) {}
      const res = await AppointmentAPI.adminGetPlans(jwt || token || '')
      // DEBUG: surface response for troubleshooting (will appear in browser console)
      try { console.debug('fetchPlans response:', res) } catch (e) {}
  try { setLastPlansResponse(res) } catch (e) {}
      if (!res.success) {
        if (res.error && /token|auth|unauthor/i.test(String(res.error))) {
          handleAuthError(typeof res.error === 'string' ? res.error : undefined)
          return
        }
        setError(res.error)
        setPlans([])
      } else {
        const fetchedPlans = res.plans || []
        
        // Try to load local order overrides (in case backend doesn't support ordering yet)
        try {
          const localOrder = localStorage.getItem('admin_plans_order')
          if (localOrder) {
            const orderMap = JSON.parse(localOrder)
            const plansWithOrder = fetchedPlans.map((p: any) => ({
              ...p,
              order: orderMap[p._id || p.id] ?? p.order ?? 999
            }))
            setPlans(plansWithOrder)
          } else {
            setPlans(fetchedPlans)
          }
        } catch (e) {
          setPlans(fetchedPlans)
        }
      }
    } catch (e: any) {
      const msg = e?.message || ''
      try { console.error('fetchPlans error:', e) } catch (e) {}
      if (/401|unauthor|token|expired/i.test(msg)) {
        handleAuthError(msg)
        return
      }
      setError(msg || 'Failed to fetch plans')
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_profile')
    sessionStorage.removeItem('admin_token')
    sessionStorage.removeItem('admin_profile')
    setToken(null)
    setSubscriptions([])
    router.push('/admin/login')
  }

  const handleDeleteUser = async (userId: string) => {
    if (!token) return
    setLoading(true)
    const res = await AppointmentAPI.adminDeleteUser(token, userId)
    setLoading(false)
    if (!res.success) {
      setError(res.error)
      return
    }
    // remove from UI
    setUsers((prev) => prev.filter(u => (u._id || u.id) !== userId))
  }

  const handleDeleteSubscription = async (subscriptionId: string) => {
    if (!token) return
    setLoading(true)
    const res = await AppointmentAPI.adminDeleteSubscription(token, subscriptionId)
    setLoading(false)
    if (!res.success) {
      setError(res.error)
      return
    }
    // remove from subscriptions list and collapse if expanded
    setSubscriptions((prev) => prev.filter(s => ((s._id || s.id || s.subscriptionId) !== subscriptionId)))
    setExpanded((prev) => {
      const copy = { ...prev }
      delete copy[subscriptionId]
      return copy
    })
  }

  const handleDeletePlan = async (planId: string) => {
    if (!token) return
    setLoading(true)
    const res = await AppointmentAPI.adminDeletePlan(token, planId)
    setLoading(false)
    if (!res.success) {
      setError(res.error)
      return
    }
    setPlans(prev => prev.filter(p => String(p._id || p.id) !== String(planId)))
  }

  const handleCreateOrUpdatePlan = async (form: any) => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      if (editingPlan && editingPlan._id) {
        const res = await AppointmentAPI.adminUpdatePlan(token, editingPlan._id, form)
        if (!res.success) {
          setError(res.error)
        } else {
          setPlans(prev => prev.map(p => (String(p._id || p.id) === String(editingPlan._id) ? res.plan : p)))
          setPlanModalOpen(false)
          setEditingPlan(null)
        }
      } else {
        const res = await AppointmentAPI.adminCreatePlan(token, form)
        if (!res.success) {
          setError(res.error)
        } else {
          // Add new plan with highest order if not specified
          const maxOrder = Math.max(...plans.map(p => typeof p.order === 'number' ? p.order : -1), -1)
          const newPlan = { ...res.plan, order: res.plan.order ?? (maxOrder + 1) }
          setPlans(prev => [...prev, newPlan])
          setPlanModalOpen(false)
          setEditingPlan(null)
        }
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to save plan')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmPayment = async (subscriptionId: string, paymentReference?: string) => {
    if (!token) return
    setLoading(true)
    const res = await AppointmentAPI.adminConfirmPayment(token, subscriptionId, paymentReference)
    setLoading(false)
    if (!res.success) {
      setError(res.error)
      return
    }
    // Update subscription in UI: mark paymentStatus paid and set paymentReference/confirmedAt if returned
    setSubscriptions((prev) => prev.map(s => {
      const id = s._id || s.id || s.subscriptionId
      if (String(id) === String(subscriptionId)) {
        return {
          ...s,
          paymentStatus: 'paid',
          paymentConfirmedAt: res.payment?.paymentConfirmedAt || res.payment?.paymentConfirmedAt || new Date().toISOString(),
          paymentReference: res.payment?.paymentReference || paymentReference || s.paymentReference
        }
      }
      return s
    }))
  }

  const [draggedPlanIndex, setDraggedPlanIndex] = useState<number | null>(null)

  const handleDragStart = (index: number) => {
    setDraggedPlanIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedPlanIndex === null || draggedPlanIndex === index) return

    // Get current sorted plans
    const currentSorted = [...sortedPlans]
    const draggedPlan = currentSorted[draggedPlanIndex]
    
    // Remove from old position and insert at new position
    currentSorted.splice(draggedPlanIndex, 1)
    currentSorted.splice(index, 0, draggedPlan)

    // Update order property for all plans
    const updatedPlans = currentSorted.map((p, i) => ({ ...p, order: i }))
    
    // Update the main plans array with new order
    setPlans(updatedPlans)
    setDraggedPlanIndex(index)
  }

  const handleDragEnd = async () => {
    if (draggedPlanIndex === null) {
      setDraggedPlanIndex(null)
      return
    }

    // Get the final order after all drag operations
    const currentSorted = [...sortedPlans]
    const updatedPlans = currentSorted.map((p, i) => ({ ...p, order: i }))
    
    // Save to localStorage as backup
    try {
      const orderMap: Record<string, number> = {}
      updatedPlans.forEach((p, i) => {
        orderMap[p._id || p.id] = i
      })
      localStorage.setItem('admin_plans_order', JSON.stringify(orderMap))
      console.log('Order saved to localStorage:', orderMap)
    } catch (e) {
      console.error('Failed to save to localStorage:', e)
    }
    
    // Update locally first for immediate UI persistence
    setPlans(updatedPlans)
    setDraggedPlanIndex(null)

    // Try to save to backend (non-blocking)
    if (token) {
      try {
        const planOrders = updatedPlans.map((p, i) => ({ 
          planId: String(p._id || p.id), 
          order: i 
        }))
        
        console.log('Saving plan order to backend:', planOrders)
        const res = await AppointmentAPI.adminReorderPlans(token, planOrders)
        
        if (!res.success) {
          console.error('Failed to save plan order to backend:', res.error)
          // Show error but keep local changes
          setError(`Order saved locally. Backend sync failed: ${res.error}`)
        } else {
          console.log('Plan order saved successfully to backend')
          // Clear any previous errors
          setError(null)
        }
      } catch (e: any) {
        console.error('Error saving plan order to backend:', e)
        // Show error but keep local changes
        setError(`Order saved locally. Backend sync failed: ${e?.message}`)
      }
    }
  }

  const toggleRow = async (sub: any) => {
    const id = sub._id || sub.id || sub.idString || sub.subscriptionId
    if (!id) return
    // If already expanded, collapse
    if (expanded[id]) {
      setExpanded((prev) => {
        const copy = { ...prev }
        delete copy[id]
        return copy
      })
      return
    }

    // Fetch subscription details (sessions) from backend
    if (!token) return
    const res = await AppointmentAPI.adminGetSubscriptionById(token, id)
    if (!res.success) {
      setError(res.error)
      return
    }

    const subscription = res.subscription

    // Prepare sessions display: convert each session's stored UTC (or derive) to both user timezone and admin timezone
    const sessions = (subscription.sessions || []).map((sess: any) => {
      // Prefer canonical UTC instant in fields named startsAtUTC, utcTime, utc
      const utc = sess.startsAtUTC || sess.utcTime || sess.utc || sess.startsAt || null
      // If session has originalUserDate and originalUserTime, combine
      const userDate = sess.date || sess.originalUserDate
      const userTime = sess.time || sess.originalUserTime
      return { ...sess, _utc: utc, _userDate: userDate, _userTime: userTime }
    })

    // propagate fetched user name into the subscriptions list for immediate display
    setSubscriptions(prev => prev.map(s => {
      const sid = s._id || s.id || s.subscriptionId || ''
      if (String(sid) === String(id)) {
        return {
          ...s,
          // prefer subscription-level user fields when available
          user: { ...(s.user || {}), ...(subscription.user || {}) },
          firstName: subscription.user?.firstName || subscription.userFirstName || s.firstName || s.user?.firstName,
          lastName: subscription.user?.lastName || subscription.userLastName || s.lastName || s.user?.lastName
        }
      }
      return s
    }))

    setExpanded((prev) => ({ ...prev, [id]: { subscription, sessions } }))
  }

  // control visibility of sessions table inside expanded panel per-subscription
  const [sessionsVisible, setSessionsVisible] = React.useState<Record<string, boolean>>({})

  const toggleSessionsVisible = (id: string) => {
    setSessionsVisible(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // small copy feedback state: { [subscriptionId]: 'email' | 'phone' | 'firstName' }
  const [copied, setCopied] = React.useState<Record<string, 'email' | 'phone' | 'firstName' | undefined>>({})

  // selected user for details modal
  const [selectedUser, setSelectedUser] = React.useState<any | null>(null)

  // robust copy helper: try navigator.clipboard, fallback to textarea+execCommand
  const copyText = async (text: string) => {
    if (!text) return false
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text)
        return true
      }
    } catch (e) {
      // fallback below
    }
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return !!ok
    } catch (e) {
      return false
    }
  }

  const formatInZone = (isoOrDateLike: string | Date, timezone: string | undefined) => {
    try {
      const date = typeof isoOrDateLike === 'string' ? new Date(isoOrDateLike) : isoOrDateLike
      if (!timezone) return date.toLocaleString()
      return new Intl.DateTimeFormat('en-GB', {
        year: 'numeric', month: 'short', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone
      }).format(date)
    } catch (e) {
      return String(isoOrDateLike)
    }
  }

  const formatUserTZ = (iso: string | Date, tz: string | undefined) => {
    // Prefer human-friendly format used in original UI (e.g., "18 Sept 2025, 08:00")
    try {
      const date = typeof iso === 'string' ? new Date(iso) : iso
      const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }
      if (tz) (opts as any).timeZone = tz
      return new Intl.DateTimeFormat('en-GB', opts).format(date)
    } catch (e) {
      return String(iso)
    }
  }

  const formatAdminTZ = (iso: string | Date, tz: string | undefined) => {
    try {
      const date = typeof iso === 'string' ? new Date(iso) : iso
      const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }
      if (tz) (opts as any).timeZone = tz
      return new Intl.DateTimeFormat('en-GB', opts).format(date)
    } catch (e) {
      return String(iso)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-6">
      <div className="max-w-6xl mx-auto bg-white rounded-3xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-500">Manage subscriptions and users</p>
              {adminProfile?.timezone && (
                <button 
                  onClick={() => {
                    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
                    changeAdminTimezone(detected)
                  }}
                  className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-1 rounded border border-blue-200"
                  title="Click to refresh timezone"
                >
                  🌍 {adminProfile.timezone}
                </button>
              )}
            </div>
          </div>
            <div className="flex items-center gap-3">
            <div className="flex rounded-md bg-slate-100 p-1">
              <button className={`px-3 py-1 rounded ${view === 'subscriptions' ? 'bg-white shadow' : 'text-gray-600'}`} onClick={() => setView('subscriptions')}>Subscriptions</button>
              <button className={`px-3 py-1 rounded ${view === 'users' ? 'bg-white shadow' : 'text-gray-600'}`} onClick={() => { setView('users'); fetchUsers(token || undefined) }}>Users</button>
              <button className={`px-3 py-1 rounded ${view === 'plans' ? 'bg-white shadow' : 'text-gray-600'}`} onClick={() => { setView('plans'); fetchPlans(token || undefined) }}>Plans</button>
            </div>
            <Button onClick={() => { if (view === 'subscriptions') fetchSubscriptions(token || undefined); else if (view === 'users') fetchUsers(token || undefined); else if (view === 'plans') fetchPlans(token || undefined) }}>Refresh</Button>
            <Button variant="outline" onClick={logout}>Logout</Button>
          </div>
        </div>

        {/* Dashboard stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/** compute stats using useMemo to avoid recalculation on every render */}
          <div className="bg-white border rounded-lg p-4">
            <div className="text-sm text-gray-500">Users</div>
            <div className="text-2xl font-semibold">{stats.totalUsers}</div>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <div className="text-sm text-gray-500">Subscriptions</div>
            <div className="text-2xl font-semibold">{stats.totalSubscriptions}</div>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <div className="text-sm text-gray-500">Paid subscriptions</div>
            <div className="text-2xl font-semibold text-green-600">{stats.paidCount}</div>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <div className="text-sm text-gray-500">Revenue</div>
            <div className="text-2xl font-semibold">{stats.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })} USD</div>
          </div>
        </div>

        {error && <div className="text-sm text-red-600 mb-4">{error}</div>}

        {/* Payment filter controls (only for subscriptions view) */}
        {view === 'subscriptions' && (
          <div className="flex items-center gap-3 mb-4">
            <div className="text-sm text-gray-600">Show:</div>
            <div className="flex items-center rounded-md bg-slate-100 p-1">
              <button className={`px-3 py-1 rounded ${paymentFilter === 'all' ? 'bg-white shadow' : 'text-gray-600'}`} onClick={() => setPaymentFilter('all')}>All</button>
              <button className={`px-3 py-1 rounded ${paymentFilter === 'paid' ? 'bg-white shadow' : 'text-gray-600'}`} onClick={() => setPaymentFilter('paid')}>Paid ({stats.paidCount})</button>
              <button className={`px-3 py-1 rounded ${paymentFilter === 'pending' ? 'bg-white shadow' : 'text-gray-600'}`} onClick={() => setPaymentFilter('pending')}>Pending ({stats.totalSubscriptions - stats.paidCount})</button>
            </div>
          </div>
        )}

        {loading ? (
          <div>Loading...</div>
        ) : view === 'subscriptions' ? (
          <Table>
            <TableHeader>
              <tr>
                <TableHead>#</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>Sessions</TableHead>
                <TableHead>Confirm Payment</TableHead>
                <TableHead>Action</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {filteredSubscriptions.map((s: any, idx: number) => {
                    const id = s._id || s.id || s.subscriptionId || String(idx)
                    return (
                      <React.Fragment key={id}>
                        <TableRow key={`row-${id}`}>
                      <TableCell className="font-medium cursor-pointer" role="button" tabIndex={0} onClick={() => toggleRow(s)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleRow(s) }}>{idx + 1}</TableCell>
                      <TableCell className="cursor-pointer" role="button" tabIndex={0} onClick={() => toggleRow(s)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleRow(s) }}>
                        {(() => {
                          const u = s.user || {}
                          const email = s.userEmail || u.email || u.emailAddress || ''
                          const first = u.firstName || u.first_name || u.given_name || s.firstName || s.userFirstName
                          const last = u.lastName || u.last_name || u.family_name || s.lastName || s.userLastName

                          // Try to resolve a name from several places:
                          // 1. subscription-level fields (first/last)
                          // 2. subscription user object (u.name / u.fullName)
                          // 3. prefetched users list (match by id or email)
                          let lookupName = ''
                          try {
                            const uid = s.user?._id || s.user?.id || s.userId || s.userIdString || s.userId
                            let found: any = null
                            if (uid) found = users.find(usr => String(usr._id || usr.id) === String(uid))
                            if (!found && email) found = users.find(usr => (usr.email || usr.emailAddress) === email)
                            if (found) {
                              lookupName = (found.firstName || found.first_name || found.name || found.fullName || `${found.firstName || ''} ${found.lastName || ''}`.trim()) || ''
                            }
                          } catch (e) {
                            // ignore lookup errors
                          }

                          // Build a robust displayName that prefers explicit first+last.
                          let displayName = ''
                          const explicitFirst = first || ''
                          const explicitLast = last || ''
                          if (explicitFirst || explicitLast) {
                            displayName = `${explicitFirst}${explicitLast ? ' ' + explicitLast : ''}`.trim()
                          } else if (u.name || u.fullName || u.displayName) {
                            displayName = u.name || u.fullName || u.displayName || ''
                          } else if (lookupName) {
                            displayName = lookupName
                          } else {
                            displayName = ''
                          }

                          // If we only have a first name and lookup can provide a last name, merge them
                          if (displayName && (!explicitLast || explicitLast === '')) {
                            // try to enrich with lookup's last name if possible
                            try {
                              const uid = s.user?._id || s.user?.id || s.userId || s.userIdString || s.userId
                              let found: any = null
                              if (uid) found = users.find(usr => String(usr._id || usr.id) === String(uid))
                              if (!found && email) found = users.find(usr => (usr.email || usr.emailAddress) === email)
                              if (found) {
                                const ln = found.lastName || found.last_name || ''
                                if (ln && !displayName.includes(ln)) displayName = (displayName + ' ' + ln).trim()
                              }
                            } catch (e) {
                              // ignore
                            }
                          }

                          if (displayName) {
                            return (
                              <>
                                <div className="font-medium">{displayName}</div>
                                <div className="text-xs text-gray-500">{email || '—'}</div>
                              </>
                            )
                          }

                          return (
                            <>
                              <div className="font-medium">{email || '—'}</div>
                              <div className="text-xs text-gray-500">{email || '—'}</div>
                            </>
                          )
                        })()}
                      </TableCell>
                      <TableCell className="cursor-pointer" role="button" tabIndex={0} onClick={() => toggleRow(s)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleRow(s) }}>{s.planName || s.subscriptionPlan?.name || '—'}</TableCell>
                      <TableCell className="cursor-pointer" role="button" tabIndex={0} onClick={() => toggleRow(s)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleRow(s) }}>{(() => {
                        const price = Number(s.price ?? s.amount ?? s.subscriptionPrice ?? s.planPrice ?? s.subscriptionPlan?.price ?? s.plan?.price ?? 0)
                        const currency = s.currency || s.subscriptionPlan?.currency || s.plan?.currency || 'USD'
                        return price ? `${price.toLocaleString()} ${currency}` : '—'
                      })()}</TableCell>
                      <TableCell className="cursor-pointer" role="button" tabIndex={0} onClick={() => toggleRow(s)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleRow(s) }}>{(() => {
                        const d = s.startDate ? new Date(s.startDate) : (s.createdAt ? new Date(s.createdAt) : null)
                        return d ? new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: 'short', day: '2-digit' }).format(d) : '—'
                      })()}</TableCell>
                      <TableCell className="cursor-pointer" role="button" tabIndex={0} onClick={() => toggleRow(s)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleRow(s) }}>{(s.sessions || s.sessionsScheduled || []).length || 0}</TableCell>
                      <TableCell>
                        {/* Only show Paid badge or Confirm button as requested */}
                        {s.paymentStatus === 'paid' ? (
                          <div className="text-sm text-green-600 font-medium">Paid</div>
                        ) : (
                          <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setPendingDelete({ type: 'confirmPayment', id }); setConfirmOpen(true) }}>Confirm payment</Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="destructive" size="sm" onClick={(e) => { e.stopPropagation(); setPendingDelete({ type: 'subscription', id }); setConfirmOpen(true) }} style={{ position: 'relative', zIndex: 50 }}>Delete</Button>
                      </TableCell>
                    </TableRow>

                    {expanded[id] && (
                      <TableRow key={`exp-${id}`}>
                        <TableCell colSpan={8} className="bg-gray-50">
                          <div className="p-4">
                            <h4 className="font-semibold mb-2">Subscription</h4>
                            <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-white border rounded-md p-3">
                                <div className="text-sm text-gray-600">Plan</div>
                                <div className="font-medium">{expanded[id].subscription.planName || expanded[id].subscription.subscriptionPlan?.name}</div>
                                {/* Email row (separate copy action) */}
                                <div className="text-sm text-gray-600 mt-2">Email</div>
                                <div className="flex items-center gap-2">
                                  <div className="text-sm text-gray-700">{s.userEmail || s.user?.email || expanded[id].subscription.user?.email || '—'}</div>
                                  <button className="text-xs text-gray-500 hover:text-gray-700" onClick={async () => {
                                    const text = s.userEmail || s.user?.email || expanded[id].subscription.user?.email || ''
                                    const ok = await copyText(text)
                                    if (ok) {
                                      setCopied(prev => ({ ...prev, [id]: 'email' }))
                                      setTimeout(() => setCopied(prev => ({ ...prev, [id]: undefined })), 1400)
                                    }
                                  }}>
                                    Copy
                                  </button>
                                  {copied[id] === 'email' && <span className="text-xs text-green-600">Copied!</span>}
                                </div>
                                <div className="text-sm text-gray-600 mt-2">Phone</div>
                                <div className="flex items-center gap-2">
                                  <div className="text-sm">{expanded[id].subscription.user?.phone || expanded[id].subscription.userPhone || expanded[id].subscription.phone || (s.user?.phone || s.userPhone || s.phone) || '—'}</div>
                                  <button className="text-xs text-gray-500 hover:text-gray-700" onClick={async () => {
                                    const phone = expanded[id].subscription.user?.phone || expanded[id].subscription.userPhone || expanded[id].subscription.phone || (s.user?.phone || s.userPhone || s.phone) || ''
                                    const ok = await copyText(phone)
                                    if (ok) {
                                      setCopied(prev => ({ ...prev, [id]: 'phone' }))
                                      setTimeout(() => setCopied(prev => ({ ...prev, [id]: undefined })), 1400)
                                    }
                                  }}>
                                    Copy
                                  </button>
                                  {copied[id] === 'phone' && <span className="text-xs text-green-600">Copied!</span>}
                                </div>
                                <div className="text-sm text-gray-600 mt-2">Period</div>
                                <div className="text-sm">{expanded[id].subscription.startDate ? new Date(expanded[id].subscription.startDate).toLocaleDateString() : '—'} — {expanded[id].subscription.endDate ? new Date(expanded[id].subscription.endDate).toLocaleDateString() : '—'}</div>
                                <div className="text-sm text-gray-600 mt-2">Status</div>
                                <div className="text-sm">{expanded[id].subscription.status || '—'} • {expanded[id].subscription.paymentStatus || '—'}</div>
                              </div>
                              <div className="bg-white border rounded-md p-3">
                                <div className="text-sm text-gray-600">Totals</div>
                                <div className="text-sm">Total sessions: <span className="font-medium">{expanded[id].subscription.totalSessions ?? expanded[id].subscription.sessions?.length ?? '—'}</span></div>
                                <div className="text-sm">Completed: <span className="font-medium">{expanded[id].subscription.sessionsCompleted ?? 0}</span></div>
                                <div className="text-sm">Remaining: <span className="font-medium">{expanded[id].subscription.sessionsRemaining ?? '—'}</span></div>
                              </div>
                            </div>

                            
                            <div>
                              <div className="flex items-center justify-between">
                                <h5 className="font-medium mb-2">Sessions</h5>
                                <Button size="sm" variant="ghost" onClick={() => toggleSessionsVisible(id)}>{sessionsVisible[id] ? 'Hide' : 'Show'} sessions</Button>
                              </div>
                              {sessionsVisible[id] && (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm border-collapse">
                                    <thead>
                                      <tr className="text-left">
                                        <th className="p-2 border-b">#</th>
                                        <th className="p-2 border-b">Original</th>
                                        <th className="p-2 border-b">Country</th>
                                        <th className="p-2 border-b">User ({'TZ'})</th>
                                        <th className="p-2 border-b">Admin ({adminProfile?.timezone || 'Detecting...'})</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {expanded[id].sessions.map((ss: any, i: number) => {
                                      const canonical = ss._utc || ss.startsAtUTC || ss.startsAt || null
                                      const userTz = ss.timezone || expanded[id].subscription.timezone || expanded[id].subscription.user?.timezone || undefined
                                      const adminTz = adminProfile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Cairo'
                                      const country = ss.userCountry || expanded[id].subscription.displayCountry || expanded[id].subscription.user?.country || ss.country || ''
                                      
                                      // Session number text
                                      const sessionNumbers = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve']
                                      const sessionLabel = `Session ${sessionNumbers[i] || (i + 1)}`
                                      
                                      return (
                                        <tr key={i} className="align-top">
                                          <td className="p-2 border-b font-medium">{i + 1}</td>
                                          <td className="p-2 border-b">
                                            <div className="font-medium text-base">{sessionLabel}</div>
                                            <div className="text-xs text-gray-500 mt-1">{userTz || ''}</div>
                                          </td>
                                          <td className="p-2 border-b">{country || (userTz || '')}</td>
                                          <td className="p-2 border-b">{canonical ? formatUserTZ(canonical, userTz) : '—'}</td>
                                          <td className="p-2 border-b">{canonical ? formatAdminTZ(canonical, adminTz) : '—'}</td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                )
              })}
            </TableBody>
          </Table>
        ) : view === 'users' ? (
          // Users view
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium">Users</h3>
            </div>
          <Table>
            <TableHeader>
              <tr>
                <TableHead>#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Timezone</TableHead>
                <TableHead>Action</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {users.map((u: any, idx: number) => {
                const uid = u._id || u.id || String(idx)
                return (
                  <React.Fragment key={uid}>
                    <TableRow className="hover:bg-slate-50 cursor-pointer" onClick={() => setExpanded(prev => ({ ...prev, [uid]: prev[uid] ? undefined : { user: u } }))}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>
                        <div className="font-medium">{(u.firstName || u.lastName) ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : (u.name || '—')}</div>
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">{u.email || u.emailAddress || '—'}</TableCell>
                      <TableCell>{u.country || '—'}</TableCell>
                      <TableCell className="text-xs">{u.timezone || u.tz || '—'}</TableCell>
                      <TableCell>
                        <Button variant="destructive" size="sm" onClick={(e) => { e.stopPropagation(); setPendingDelete({ type: 'user', id: (u._id || u.id) }); setConfirmOpen(true) }}>Delete</Button>
                      </TableCell>
                    </TableRow>

                    {expanded[uid] && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-gray-50">
                          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white border rounded-md p-3">
                              <div className="text-sm text-gray-600">Name</div>
                              <div className="font-medium">{(u.firstName || u.lastName) ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : (u.name || '—')}</div>
                              <div className="text-sm text-gray-600 mt-2">Email</div>
                              <div className="flex items-center gap-2">
                                <div className="text-sm text-gray-700">{u.email || u.emailAddress || '—'}</div>
                                <button className="text-xs text-gray-500" onClick={async () => { const ok = await copyText(u.email || u.emailAddress || ''); if (ok) { setCopied(prev => ({ ...prev, [uid]: 'email' })); setTimeout(() => setCopied(prev => ({ ...prev, [uid]: undefined })), 1400) } }}>Copy</button>
                                {copied[uid] === 'email' && <span className="text-xs text-green-600">Copied!</span>}
                              </div>
                              <div className="text-sm text-gray-600 mt-2">Phone</div>
                              <div className="flex items-center gap-2">
                                <div className="text-sm">{u.phone || u.phoneNumber || u.userPhone || '—'}</div>
                                <button className="text-xs text-gray-500" onClick={async () => { const ok = await copyText(u.phone || u.phoneNumber || u.userPhone || ''); if (ok) { setCopied(prev => ({ ...prev, [uid]: 'phone' })); setTimeout(() => setCopied(prev => ({ ...prev, [uid]: undefined })), 1400) } }}>Copy</button>
                                {copied[uid] === 'phone' && <span className="text-xs text-green-600">Copied!</span>}
                              </div>
                              <div className="text-sm text-gray-600 mt-2">Country</div>
                              <div className="text-sm">{u.country || '—'}</div>
                            </div>
                            <div className="bg-white border rounded-md p-3">
                              <div className="text-sm text-gray-600">Timezone</div>
                              <div className="text-sm">{u.timezone || u.tz || '—'}</div>
                              <div className="text-sm text-gray-600 mt-2">Created</div>
                              <div className="text-sm">{u.createdAt ? new Date(u.createdAt).toLocaleString() : '—'}</div>
                              <div className="text-sm text-gray-600 mt-2">ID</div>
                              <div className="text-sm">{u._id || u.id || '—'}</div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                )
              })}
            </TableBody>
          </Table>
          </div>
        ) : null }

        {view === 'plans' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-lg font-medium">Plans</h3>
                <p className="text-xs text-gray-500 mt-1">Drag and drop rows to reorder plans</p>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => { setEditingPlan(null); setPlanModalOpen(true) }}>Create New Plan</Button>
              </div>
            </div>
            {/* debug JSON removed */}
            <Table>
              <TableHeader>
                <tr>
                  <TableHead>#</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Badge</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Sessions / Month</TableHead>
                  <TableHead>Sessions / Week</TableHead>
                  <TableHead>Duration (days)</TableHead>
                  <TableHead>Action</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {sortedPlans.map((p: any, i: number) => {
                  const pid = p._id || p.id || String(i)
                  return (
                    <TableRow 
                      key={pid} 
                      draggable
                      onDragStart={() => handleDragStart(i)}
                      onDragOver={(e) => handleDragOver(e, i)}
                      onDragEnd={handleDragEnd}
                      className={`hover:bg-slate-50 cursor-move transition-all ${draggedPlanIndex === i ? 'opacity-50' : ''}`}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">⋮⋮</span>
                          <span>{i + 1}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">{p.order ?? i}</span>
                      </TableCell>
                      <TableCell className="font-medium">{p.name || '—'}</TableCell>
                      <TableCell>
                        {p.badge ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-orange-400 to-pink-500 text-white shadow-sm">
                            {p.badge === 'Best Seller' && '🔥'}
                            {p.badge === 'Most Popular' && '⭐'}
                            {p.badge === 'Recommended' && '✨'}
                            {p.badge === 'New' && '🆕'}
                            {p.badge === 'Limited Offer' && '⏰'}
                            {' '}{p.badge}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>{(p.price ?? p.amount ?? 0).toLocaleString?.() ?? p.price ?? '—'}</TableCell>
                      <TableCell>{p.currency || 'EGP'}</TableCell>
                      <TableCell>{p.sessionsPerMonth ?? p.sessionsPerMonth ?? '—'}</TableCell>
                      <TableCell>{p.sessionsPerWeek ?? p.sessionsPerWeek ?? '—'}</TableCell>
                      <TableCell>{p.duration ?? '—'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); setEditingPlan(p); setPlanModalOpen(true) }}>Edit</Button>
                          <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); setPendingDelete({ type: 'plan', id: pid }); setConfirmOpen(true) }}>Delete</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* User details modal */}
        {selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-lg shadow-lg max-w-xl w-full p-6">
              <div className="flex items-start justify-between">
                <h3 className="text-lg font-semibold">User details</h3>
                <button className="text-gray-500" onClick={() => setSelectedUser(null)}>Close</button>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <div className="text-xs text-gray-500">Name</div>
                  <div className="font-medium">{(selectedUser.firstName || selectedUser.lastName) ? `${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`.trim() : (selectedUser.name || '—')}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Email</div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm">{selectedUser.email || selectedUser.emailAddress || '—'}</div>
                    <button className="text-xs text-gray-500" onClick={async () => { const ok = await copyText(selectedUser.email || selectedUser.emailAddress || ''); if (ok) { setCopied(prev => ({ ...prev, ['user-email']: 'email' })); setTimeout(() => setCopied(prev => ({ ...prev, ['user-email']: undefined })), 1400) } }}>Copy</button>
                    {copied['user-email'] === 'email' && <span className="text-xs text-green-600">Copied!</span>}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Phone</div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm">{selectedUser.phone || selectedUser.phoneNumber || selectedUser.userPhone || '—'}</div>
                    <button className="text-xs text-gray-500" onClick={async () => { const ok = await copyText(selectedUser.phone || selectedUser.phoneNumber || selectedUser.userPhone || ''); if (ok) { setCopied(prev => ({ ...prev, ['user-phone']: 'phone' })); setTimeout(() => setCopied(prev => ({ ...prev, ['user-phone']: undefined })), 1400) } }}>Copy</button>
                    {copied['user-phone'] === 'phone' && <span className="text-xs text-green-600">Copied!</span>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500">Country</div>
                    <div className="text-sm">{selectedUser.country || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Timezone</div>
                    <div className="text-sm">{selectedUser.timezone || selectedUser.tz || '—'}</div>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Created</div>
                  <div className="text-sm">{selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleString() : '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">ID</div>
                  <div className="text-sm">{selectedUser._id || selectedUser.id || '—'}</div>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button variant="ghost" onClick={() => setSelectedUser(null)}>Close</Button>
              </div>
            </div>
          </div>
        )}
        {/* Plan create / edit modal */}
        {planModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full p-6">
              <div className="flex items-start justify-between">
                <h3 className="text-lg font-semibold">{editingPlan ? 'Edit Plan' : 'Create New Plan'}</h3>
                <button className="text-gray-500" onClick={() => { setPlanModalOpen(false); setEditingPlan(null) }}>Close</button>
              </div>
              <PlanForm initial={editingPlan} onCancel={() => { setPlanModalOpen(false); setEditingPlan(null) }} onSave={handleCreateOrUpdatePlan} />
            </div>
          </div>
        )}
        <AlertDialog open={confirmOpen} onOpenChange={(open) => { if (!open) { setConfirmOpen(false); setPendingDelete(null) } else setConfirmOpen(true) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{pendingDelete?.type === 'confirmPayment' ? 'Confirm payment' : 'Confirm deletion'}</AlertDialogTitle>
              <AlertDialogDescription>
                {pendingDelete?.type === 'confirmPayment'
                  ? 'Are you sure you want to mark this subscription as paid? This will update the payment status.'
                  : 'Are you sure you want to permanently delete the selected item? This action cannot be undone.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setConfirmOpen(false); setPendingDelete(null) }}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={async () => {
                if (!pendingDelete) return
                const { type, id } = pendingDelete
                setConfirmOpen(false)
                setPendingDelete(null)
                if (type === 'user') await handleDeleteUser(id)
                if (type === 'subscription') await handleDeleteSubscription(id)
                if (type === 'confirmPayment') await handleConfirmPayment(id)
                if (type === 'plan') await handleDeletePlan(id)
              }}>
                {pendingDelete?.type === 'confirmPayment' ? 'Confirm' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
