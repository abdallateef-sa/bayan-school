"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AppointmentAPI } from "@/lib/appointment-api"
import { Button } from "@/components/ui/button"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [step, setStep] = useState<'request' | 'confirm'>('request')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [otp, setOtp] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const request = async (e?: any) => {
    e?.preventDefault()
    setMsg(null)
    if (!email) {
      setMsg('Please enter your admin email')
      return
    }
    setLoading(true)
    try {
      const res = await AppointmentAPI.adminRequestPasswordReset(email)
      if (!res.success) setMsg(res.error)
      else {
        setMsg('If this email is registered an OTP has been sent. Enter it and your new password to reset.')
        setStep('confirm')
      }
    } catch (e: any) {
      setMsg(e?.message || 'Request failed')
    } finally { setLoading(false) }
  }

  const confirm = async (e?: any) => {
    e?.preventDefault()
    setMsg(null)
    if (!email || !otp || !password) { setMsg('Email, OTP and new password required'); return }
    setLoading(true)
    try {
      const res = await AppointmentAPI.adminResetPassword(email, otp, password)
      if (!res.success) setMsg(res.error)
      else {
        setMsg('Password reset successful — redirecting to login...')
        setTimeout(() => router.push('/admin/login'), 1200)
      }
    } catch (e: any) { setMsg(e?.message || 'Reset failed') } finally { setLoading(false) }
  }

  return (
    <div className="w-full max-w-full flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-md w-[640px] max-w-full mx-4 my-8">
        <div className="h-auto min-h-[440px] flex flex-col justify-center overflow-auto p-8">
          <h2 className="text-3xl font-bold mb-6 text-center">Forgot Admin Password</h2>
          {step === 'request' ? (
            <form onSubmit={request} className="space-y-4">
              <div>
                <label htmlFor="admin-email-request" className="block text-sm text-gray-700">Admin email</label>
                <input id="admin-email-request" title="Admin email" placeholder="you@example.com" className="mt-1 block w-full rounded-xl border-gray-200 shadow-sm p-3" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              {msg && <div className="text-sm text-red-600">{msg}</div>}
              <div className="flex justify-end">
                <Button variant="ghost" onClick={() => router.push('/admin/login')}>Back</Button>
                <Button type="submit" className="ml-2" disabled={loading}>{loading ? 'Sending...' : 'Send OTP'}</Button>
              </div>
            </form>
          ) : (
            <form onSubmit={confirm} className="space-y-4">
              <div>
                <label htmlFor="admin-email-confirm" className="block text-sm text-gray-700">Admin email</label>
                <input id="admin-email-confirm" title="Admin email" placeholder="you@example.com" className="mt-1 block w-full rounded-xl border-gray-200 shadow-sm p-3" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label htmlFor="admin-otp" className="block text-sm text-gray-700">OTP</label>
                <input id="admin-otp" title="One time password" placeholder="123456" className="mt-1 block w-full rounded-xl border-gray-200 shadow-sm p-3" value={otp} onChange={(e) => setOtp(e.target.value)} />
              </div>
              <div>
                <label htmlFor="admin-password" className="block text-sm text-gray-700">New password</label>
                <div className="relative">
                  <input id="admin-password" type={showPassword ? 'text' : 'password'} title="New password" placeholder="New secure password" className="mt-1 block w-full rounded-xl border-gray-200 shadow-sm p-3" value={password} onChange={(e) => setPassword(e.target.value)} />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-600" onClick={() => setShowPassword(s => !s)}>{showPassword ? 'Hide' : 'Show'}</button>
                </div>
              </div>
              {msg && <div className="text-sm text-red-600">{msg}</div>}
              <div className="flex justify-end">
                <Button variant="ghost" onClick={() => setStep('request')}>Back</Button>
                <Button type="submit" className="ml-2" disabled={loading}>{loading ? 'Resetting...' : 'Reset password'}</Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
