"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AppointmentAPI } from "@/lib/appointment-api"
import { Button } from "@/components/ui/button"

export default function AdminLogin() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()

  const submit = async (e: any) => {
    e?.preventDefault()
    setError(null)
    if (!email || !password) {
      setError('Email and password are required')
      return
    }
    setLoading(true)
    try {
      const res = await AppointmentAPI.adminLogin(email, password)
      if (!res.success) {
        setError(res.error)
        setLoading(false)
        return
      }
      // Store token in chosen storage (localStorage when 'remember' is checked, sessionStorage otherwise)
      try {
        const profile = await AppointmentAPI.adminGetProfile(res.token)
        if (remember) {
          localStorage.setItem('admin_token', res.token)
          if (profile.success) localStorage.setItem('admin_profile', JSON.stringify(profile.admin))
        } else {
          sessionStorage.setItem('admin_token', res.token)
          if (profile.success) sessionStorage.setItem('admin_profile', JSON.stringify(profile.admin))
        }
      } catch (e) {
        // If profile fetch fails, still persist token so admin can proceed
        if (remember) localStorage.setItem('admin_token', res.token)
        else sessionStorage.setItem('admin_token', res.token)
      }
      router.push('/admin/dashboard')
    } catch (e: any) {
      setError(e?.message || 'Unexpected error')
    } finally {
      setLoading(false)
    }
  }

  // Forgot password state & handler
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState("")
  const [resetMsg, setResetMsg] = useState<string | null>(null)
  const [resetLoading, setResetLoading] = useState(false)
  // After requesting reset, allow entering OTP + new password
  const [showOtpForm, setShowOtpForm] = useState(false)
  const [otp, setOtp] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [showNewPassword, setShowNewPassword] = useState(false)

  const requestReset = async (e?: any) => {
    e?.preventDefault()
    setResetMsg(null)
    if (!resetEmail) {
      setResetMsg('Please enter your admin email')
      return
    }
    setResetLoading(true)
    try {
      const res = await AppointmentAPI.adminRequestPasswordReset(resetEmail)
      if (!res.success) {
        setResetMsg(res.error)
      } else {
        // The backend sends an OTP to the admin email. Show OTP form for entering code + new password.
        setResetMsg('If this email is registered, an OTP has been sent. Enter the OTP and your new password below.')
        setShowOtpForm(true)
      }
    } catch (e: any) {
      setResetMsg(e?.message || 'Failed to request reset')
    } finally {
      setResetLoading(false)
    }
  }

  const submitReset = async (e?: any) => {
    e?.preventDefault()
    setResetMsg(null)
    if (!resetEmail || !otp || !newPassword) {
      setResetMsg('Email, OTP and new password are required')
      return
    }
    setResetLoading(true)
    try {
      const res = await AppointmentAPI.adminResetPassword(resetEmail, otp, newPassword)
      if (!res.success) {
        setResetMsg(res.error)
      } else {
        setResetMsg('Password reset successful. You can now sign in with your new password.')
        setShowOtpForm(false)
      }
    } catch (e: any) {
      setResetMsg(e?.message || 'Failed to reset password')
    } finally {
      setResetLoading(false)
    }
  }

  return (
  <div className="w-full max-w-full flex items-center justify-center">
    <div className="bg-white rounded-2xl shadow-md w-[640px] max-w-full mx-4 my-8">
      <div className="h-auto min-h-[480px] flex flex-col justify-center overflow-auto p-8">
        <h2 className="text-3xl font-bold mb-6 text-center">Admin Login</h2>

        <form onSubmit={submit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-xl border-gray-200 shadow-sm focus:ring-2 focus:ring-blue-500 p-4 text-lg"
              placeholder="admin@example.com"
              title="Admin email"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-xl border-gray-200 shadow-sm focus:ring-2 focus:ring-blue-500 p-4 text-lg"
                placeholder="Password"
                title="Admin password"
                required
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-600" onClick={() => setShowPassword(p => !p)}>{showPassword ? 'Hide' : 'Show'}</button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input id="remember" type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-5 h-5 rounded" />
            <label htmlFor="remember" className="text-sm text-gray-700">Remember me</label>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex items-center justify-between">
            <div className="text-sm">
              <button type="button" className="text-blue-600 underline" onClick={() => router.push('/admin/forgot-password')}>Forgot password?</button>
            </div>
            <div>
              <Button type="submit" disabled={loading} className="px-6 py-3 text-lg">{loading ? 'Signing in...' : 'Sign in'}</Button>
            </div>
          </div>
        </form>

        {/* Inline reset removed: use dedicated /admin/forgot-password page */}
      </div>
    </div>
  </div>
  )
}
