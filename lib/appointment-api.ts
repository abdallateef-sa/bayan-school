// Backend Appointment Booking API client
// Uses NEXT_PUBLIC_API_URL, e.g. http://localhost:4000/api/v1

export type Plan = {
  _id: string
  id?: string
  name: string
  description?: string
  sessionsPerMonth?: number
  sessionsPerWeek?: number
  price?: number
  currency?: string
  duration?: number
  isActive?: boolean
  pricePerSession?: number
  order?: number
  badge?: string // e.g., "Best Seller", "Most Popular", "Recommended"
}

type ApiSuccess<T> = { success: true; data?: T; message?: string }
type ApiFailure = { success: false; error: string }

function getBaseUrl() {
  // Default to relative API path to avoid mixed-content issues when frontend is served over HTTPS
  const base = process.env.NEXT_PUBLIC_API_URL || '/api/v1'
  const trimmed = base.replace(/\/$/, "")
  
  // If it's a relative path (starts with /), return as-is
  if (trimmed.startsWith('/')) {
    return trimmed
  }
  
  // If it's a full URL, return trimmed
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed
  }
  
  // If empty or invalid, return empty (will cause fetch to fail clearly)
  return trimmed
}

async function parseJson<T = any>(res: Response): Promise<T> {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    // Non-JSON
    return text as unknown as T
  }
}

export const AppointmentAPI = {
  // Send OTP for Login (existing users)
  async sendLoginOtp(email: string): Promise<{ success: true; token?: string; data?: unknown } | ApiFailure> {
    try {
      const res = await fetch(`${getBaseUrl()}/auth/login/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const body = await parseJson(res)
      if (!res.ok) return { success: false, error: body?.message || `Failed to send login OTP (${res.status})` }
      return { success: true, data: body }
    } catch (e: any) {
      return { success: false, error: e?.message || "Network error sending login OTP" }
    }
  },
  // Send OTP for Registration (new users)
  async sendOtp(email: string): Promise<ApiSuccess<unknown> | ApiFailure> {
    try {
      const url = `${getBaseUrl()}/auth/send-otp`
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const body = await parseJson(res)
        return { success: false, error: (body as any)?.message || `Failed to send registration OTP (${res.status})` }
      }
      const responseData = await parseJson(res)
      return { success: true, data: responseData }
    } catch (e: any) {
      return { success: false, error: e?.message || "Network error sending registration OTP" }
    }
  },

  // Verify OTP (for both login and registration)
  async verifyOtp(email: string, otp: string): Promise<{ success: true; token: string; tempToken?: string } | ApiFailure> {
    try {
      const url = `${getBaseUrl()}/auth/verify-otp`
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      })
      const body = await parseJson(res)
      
      if (!res.ok) {
        const errorMessage = body?.message || body?.error || `Failed to verify OTP (${res.status})`
        return { success: false, error: errorMessage }
      }

      // Extract tokens from the response based on backend structure
      const token = body?.data?.token || body?.token
      const tempToken = body?.data?.tempToken || body?.tempToken
      
      if (token) {
        return { success: true, token: token as string }
      } else if (tempToken) {
        return { success: true, token: tempToken as string, tempToken: tempToken as string }
      } else {
        return { success: false, error: "No authentication token received" }
      }
    } catch (e: any) {
      return { success: false, error: e?.message || "Network error verifying OTP" }
    }
  },

  // Complete Registration (for new users after OTP verification)
  async completeRegistration(
    tempToken: string,
    userData: {
      firstName: string
      lastName: string
      phone: string
      gender: string
      country: string
      timezone?: string
    }
  ): Promise<{ success: true; token: string; user: any } | ApiFailure> {
    try {
      const url = `${getBaseUrl()}/auth/complete-registration`
      const res = await fetch(url, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${tempToken}`
        },
        body: JSON.stringify(userData),
      })
      const body = await parseJson(res)
      
      if (!res.ok) {
        const errorMessage = body?.message || body?.error || `Failed to complete registration (${res.status})`
        return { success: false, error: errorMessage }
      }

      const token = body?.data?.token || body?.token
      const user = body?.data?.user || body?.user
      
      // If registration is successful but no new token is provided,
      // it means the temp token should be used as the permanent token
      if (res.status === 201 || res.status === 200) {
        // Use the temp token we already have if no new token is provided
        const finalToken = token || tempToken
        return { success: true, token: finalToken as string, user }
      } else {
        return { success: false, error: "Registration completion failed" }
      }
    } catch (e: any) {
      return { success: false, error: e?.message || "Network error completing registration" }
    }
  },

  async getPlans(): Promise<{ success: true; plans: Plan[] } | ApiFailure> {
    try {
      // Request all plans without pagination limit (sorted by order)
      const url = `${getBaseUrl()}/plans?limit=1000&sort=order`
      const res = await fetch(url, { cache: "no-store" })
      const body = await parseJson(res)
      
      if (!res.ok) {
        const errorMsg = body?.message || `Failed to fetch plans (${res.status})`
        return { success: false, error: errorMsg }
      }

      // Backend may return plans in several shapes. Normalize common variants.
      let plans: Plan[] = []

      // Common: { data: { subscriptionPlans: [...] } } (observed)
      if (body?.data?.subscriptionPlans && Array.isArray(body.data.subscriptionPlans)) {
        plans = body.data.subscriptionPlans
      }
      // Some backends use data.plans
      else if (body?.data?.plans && Array.isArray(body.data.plans)) {
        plans = body.data.plans
      }
      // top-level plans
      else if (body?.plans && Array.isArray(body.plans)) {
        plans = body.plans
      }
      // sometimes the API returns the array directly
      else if (Array.isArray(body)) {
        plans = body
      }
      // fallback: try to find any array inside data
      else if (body?.data) {
        const values = Object.values(body.data)
        const firstArray = values.find(v => Array.isArray(v))
        if (firstArray) plans = firstArray as Plan[]
      }

      if (!plans || !Array.isArray(plans)) {
        return { success: false, error: 'Invalid plans data structure' }
      }
      
      return { success: true, plans }
    } catch (e: any) {
      return { success: false, error: e?.message || "Network error fetching plans" }
    }
  },

  // Get user profile
  async getUserProfile(
    jwt: string
  ): Promise<{ success: true; user: any } | ApiFailure> {
    try {
      const url = `${getBaseUrl()}/user/profile`
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
      })
      const body = await parseJson(res)

      if (!res.ok) {
        return { success: false, error: body?.message || "Failed to get profile" }
      }

      return { success: true, user: body.data?.user || body.data || body }
    } catch (e: any) {
      return { success: false, error: e?.message || "Network error getting profile" }
    }
  },

  // Get timezone for a country via backend
  async getCountryTimezone(countryName: string): Promise<{ success: true; timezone: string } | ApiFailure> {
    try {
      const url = `${getBaseUrl()}/countries/${encodeURIComponent(countryName)}/timezone`
      const res = await fetch(url)
      if (!res.ok) return { success: false, error: `Failed to get country timezone (${res.status})` }
      const body = await parseJson(res)
      const timezone = body?.data?.timezone || body?.timezone
      if (!timezone) return { success: false, error: 'Timezone not found in response' }
      return { success: true, timezone }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error fetching country timezone' }
    }
  },

  // Optional: Directly query TimeZoneDB (requires NEXT_PUBLIC_TIMEZONEDB_API_KEY in env)
  async getTimezoneFromTimeZoneDB(zoneName: string): Promise<{ success: true; data: any } | ApiFailure> {
    try {
      const apiKey = process.env.NEXT_PUBLIC_TIMEZONEDB_API_KEY
      if (!apiKey) return { success: false, error: 'TimeZoneDB API key not configured' }
      const url = `http://api.timezonedb.com/v2.1/get-time-zone?key=${apiKey}&format=json&by=zone&zone=${encodeURIComponent(zoneName)}`
      const res = await fetch(url)
      if (!res.ok) return { success: false, error: `TimeZoneDB request failed (${res.status})` }
      const body = await parseJson(res)
      return { success: true, data: body }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error calling TimeZoneDB' }
    }
  },

  // Update user profile
  async updateUserProfile(
    jwt: string,
    profileData: { country?: string; [key: string]: any }
  ): Promise<{ success: true; user: any } | ApiFailure> {
    try {
      const url = `${getBaseUrl()}/user/profile`
      const res = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify(profileData),
      })
      const body = await parseJson(res)
      
      if (!res.ok) {
        return { success: false, error: body?.message || "Failed to update profile" }
      }
      
      return { success: true, user: body?.data?.user || body }
    } catch (e: any) {
      return { success: false, error: e?.message || "Network error updating profile" }
    }
  },

  // Create Complete Subscription (Plan + Sessions in one call)
  async createCompleteSubscription(
    jwt: string,
    {
      subscriptionPlanId,
      startDate,
      sessions,
      country,
    }: {
      subscriptionPlanId: string
      startDate: string // YYYY-MM-DD
      sessions: { date: string; time: string; notes?: string; startsAtUTC?: string }[]
      country?: string // User's country for timezone handling
    },
  ): Promise<{ success: true; subscription: any } | ApiFailure> {
    try {
      const url = `${getBaseUrl()}/user/complete-subscription`
      
      // Ensure each session includes startsAtUTC (ISO in UTC)
      const sessionsWithUTC = (sessions || []).map((s) => {
        const hasUTC = s && (s as any).startsAtUTC
        let startsAtUTC = (s as any).startsAtUTC
        if (!hasUTC && s?.date && s?.time) {
          try {
            startsAtUTC = new Date(`${s.date}T${s.time}:00`).toISOString()
          } catch {
            startsAtUTC = undefined
          }
        }
        return { ...s, startsAtUTC }
      })

      const requestBody: any = { 
        subscriptionPlanId, 
        startDate, 
        sessions: sessionsWithUTC 
      }
      
      // Include country if provided for timezone handling
      if (country) {
        requestBody.userCountry = country // Backend expects 'userCountry' not 'country'
      }
      
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify(requestBody),
      })
      const body = await parseJson(res)
      
      if (!res.ok) {
        // Handle specific case of existing subscription (409 Conflict)
        if (res.status === 409 && body?.message?.includes('already have an active subscription')) {
          return { success: false, error: "You already have an active subscription to this plan" }
        }
        
        let errorMsg = body?.message || "Failed to create complete subscription"
        return { success: false, error: errorMsg }
      }
      
      return { success: true, subscription: body?.data?.subscription || body }
    } catch (e: any) {
      return { success: false, error: e?.message || "Network error creating complete subscription" }
    }
  },

  async createSubscription(
    jwt: string,
    {
      subscriptionPlanId,
      startDate,
    }: {
      subscriptionPlanId: string
      startDate: string // YYYY-MM-DD
    },
  ): Promise<{ success: true; subscriptionId: string } | ApiFailure> {
    try {
      const url = `${getBaseUrl()}/user/subscriptions`
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ subscriptionPlanId, startDate }),
      })
      const body = await parseJson(res)
      
      if (!res.ok) {
        let errorMsg = "Failed to create subscription"
        
        if (body?.message) {
          errorMsg = body.message
        } else if (body?.error) {
          errorMsg = body.error
        } else if (typeof body === 'string') {
          errorMsg = body
        } else if (res.status === 400) {
          errorMsg = "Invalid subscription data"
        } else if (res.status === 409) {
          errorMsg = "You already have an active subscription to this plan"
        } else if (res.status === 401) {
          errorMsg = "Authentication required"
        } else {
          errorMsg = `HTTP ${res.status}: ${res.statusText || 'Unknown error'}`
        }
        
        return { success: false, error: errorMsg }
      }

      // Expecting different possible response structures
      const subId = body?.data?.subscription?.id || 
                   body?.data?.subscription?._id || 
                   body?.subscription?.id || 
                   body?.subscription?._id || 
                   body?.subscriptionId || 
                   body?.id || 
                   body?._id
      
      if (!subId) {
        return { success: false, error: "Subscription ID missing in response" }
      }
      
      return { success: true, subscriptionId: String(subId) }
    } catch (e: any) {
      return { success: false, error: e?.message || "Network error creating subscription" }
    }
  },

  async createSession(
    jwt: string,
    {
      subscriptionId,
      date,
      time,
      notes,
    }: {
      subscriptionId: string
      date: string // YYYY-MM-DD
      time: string // HH:mm
      notes?: string
    },
  ): Promise<ApiSuccess<unknown> | ApiFailure> {
    try {
      const url = `${getBaseUrl()}/user/sessions`
      // Compute startsAtUTC to satisfy backend requirement
      let startsAtUTC: string | undefined
      try { startsAtUTC = new Date(`${date}T${time}:00`).toISOString() } catch { startsAtUTC = undefined }
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ subscriptionId, date, time, notes, startsAtUTC }),
      })
      
      // Get raw response text first
      const rawText = await res.text()
      
      // Try to parse as JSON
      let body
      try {
        body = rawText ? JSON.parse(rawText) : {}
      } catch (e) {
        body = { message: rawText || "Empty response" }
      }
      
      if (!res.ok) {
        let errorMsg = "Failed to create session"
        
        if (body?.message) {
          errorMsg = body.message
        } else if (body?.error) {
          errorMsg = body.error
        } else if (typeof body === 'string' && body.trim()) {
          errorMsg = body
        } else if (res.status === 400) {
          errorMsg = "Invalid session data - check date, time, and subscription ID"
        } else if (res.status === 409) {
          errorMsg = "Session conflict - you may already have a session at this time"
        } else if (res.status === 401) {
          errorMsg = "Authentication required - please login again"
        } else if (res.status === 404) {
          errorMsg = "Subscription not found - please try selecting a package again"
        } else if (res.status === 500) {
          errorMsg = "Server error - please try again later"
        } else {
          errorMsg = `Server returned ${res.status}: ${res.statusText || 'Unknown error'}`
        }
        
        return { success: false, error: errorMsg }
      }
      
      return { success: true, data: body }
    } catch (e: any) {
      return { success: false, error: e?.message || "Network error creating session" }
    }
  },

  async createBulkSessions(
    jwt: string,
    {
      subscriptionId,
      sessions,
    }: {
      subscriptionId: string
      sessions: Array<{
        date: string // YYYY-MM-DD
        time: string // HH:mm
        notes?: string
      }>
    },
  ): Promise<ApiSuccess<unknown> | ApiFailure> {
    try {
      const url = `${getBaseUrl()}/user/sessions/bulk`
      // Add startsAtUTC per session
      const sessionsWithUTC = (sessions || []).map((s) => {
        let startsAtUTC: string | undefined
        try { startsAtUTC = new Date(`${s.date}T${s.time}:00`).toISOString() } catch { startsAtUTC = undefined }
        return { ...s, startsAtUTC }
      })
      
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ subscriptionId, sessions: sessionsWithUTC }),
      })
      
      // Get raw response text first
      const rawText = await res.text()
      
      // Try to parse as JSON
      let body
      try {
        body = rawText ? JSON.parse(rawText) : {}
      } catch (e) {
        body = { message: rawText || "Empty response" }
      }
      
      if (!res.ok) {
        let errorMsg = "Failed to create sessions"
        
        if (body?.message) {
          errorMsg = body.message
        } else if (body?.error) {
          errorMsg = body.error
        } else if (typeof body === 'string' && body.trim()) {
          errorMsg = body
        } else if (res.status === 400) {
          errorMsg = "Invalid sessions data - check dates, times, and subscription ID"
        } else if (res.status === 409) {
          errorMsg = "Session conflicts - some time slots might be already taken"
        } else if (res.status === 401) {
          errorMsg = "Authentication required - please login again"
        } else if (res.status === 404) {
          errorMsg = "Subscription not found - please try selecting a package again"
        } else if (res.status === 500) {
          errorMsg = "Server error - please try again later"
        } else {
          errorMsg = `Server returned ${res.status}: ${res.statusText || 'Unknown error'}`
        }
        
        return { success: false, error: errorMsg }
      }
      
      return { success: true, data: body }
    } catch (e: any) {
      return { success: false, error: e?.message || "Network error creating bulk sessions" }
    }
  },

  // Get booked slots to prevent conflicts (Optional endpoint)
  async getBookedSlots(date?: string): Promise<{ success: true; bookedSlots: { date: string; time: string }[] } | ApiFailure> {
    try {
      const url = date 
        ? `${getBaseUrl()}/sessions/booked?date=${date}`
        : `${getBaseUrl()}/sessions/booked`
      
      const res = await fetch(url, { cache: "no-store" })
      
      // If endpoint doesn't exist (404), return empty array
      if (res.status === 404) {
        return { success: true, bookedSlots: [] }
      }
      
      const body = await parseJson(res)
      
      if (!res.ok) {
        // Return empty array instead of error for non-critical feature
        return { success: true, bookedSlots: [] }
      }

      const bookedSlots = body?.data?.bookedSlots || body?.bookedSlots || []
      return { success: true, bookedSlots }
    } catch (e: any) {
      // Return empty array instead of error - this is not critical functionality
      return { success: true, bookedSlots: [] }
    }
  },

  // Admin: login (returns token)
  async adminLogin(
    email: string,
    password: string
  ): Promise<{ success: true; token: string } | ApiFailure> {
    try {
      const url = `${getBaseUrl()}/admin/login`
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const body = await parseJson(res)
      if (!res.ok) {
        return { success: false, error: body?.message || `Admin login failed (${res.status})` }
      }
      const token = body?.data?.token || body?.token
      if (!token) return { success: false, error: 'No token returned from admin login' }
      return { success: true, token }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error during admin login' }
    }
  },

  // Admin: request password reset (sends email with reset token)
  async adminRequestPasswordReset(email: string): Promise<ApiSuccess<unknown> | ApiFailure> {
    try {
      // Backend route observed: /admin/forgot-password
      const url = `${getBaseUrl()}/admin/forgot-password`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      const body = await parseJson(res)
      if (!res.ok) return { success: false, error: body?.message || `Failed to request password reset (${res.status})` }
      return { success: true, data: body }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error requesting password reset' }
    }
  },

  // Admin: confirm password reset using token from email
  async adminConfirmPasswordReset(token: string, newPassword: string): Promise<ApiSuccess<unknown> | ApiFailure> {
    try {
      const url = `${getBaseUrl()}/admin/password-reset/confirm`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: newPassword })
      })
      const body = await parseJson(res)
      if (!res.ok) return { success: false, error: body?.message || `Failed to confirm password reset (${res.status})` }
      return { success: true, data: body }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error confirming password reset' }
    }
  },

  // Admin: reset password using OTP (email + otp + new password)
  async adminResetPassword(email: string, otp: string, newPassword: string): Promise<ApiSuccess<unknown> | ApiFailure> {
    try {
      const url = `${getBaseUrl()}/admin/reset-password`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, password: newPassword })
      })
      const body = await parseJson(res)
      if (!res.ok) return { success: false, error: body?.message || `Failed to reset password (${res.status})` }
      return { success: true, data: body }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error resetting password' }
    }
  },

  // Admin: fetch complete subscriptions with optional filters and displayCountry
  async adminGetSubscriptions(
    jwt: string,
    params?: { status?: string; userEmail?: string; page?: number; limit?: number; displayCountry?: string }
  ): Promise<{ success: true; subscriptions: any[] } | ApiFailure> {
    try {
      const q = new URLSearchParams()
      if (params) {
        if (params.status) q.set('status', params.status)
        if (params.userEmail) q.set('userEmail', params.userEmail)
        if (params.page) q.set('page', String(params.page))
        if (params.limit) q.set('limit', String(params.limit))
        if (params.displayCountry) q.set('displayCountry', params.displayCountry)
      }
      const url = `${getBaseUrl()}/admin/complete-subscriptions${q.toString() ? `?${q.toString()}` : ''}`
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        cache: 'no-store',
      })
      const body = await parseJson(res)
      if (!res.ok) {
        return { success: false, error: body?.message || `Failed to fetch subscriptions (${res.status})` }
      }
      const subs = body?.data?.subscriptions || body?.subscriptions || []
      return { success: true, subscriptions: subs }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error fetching subscriptions' }
    }
  },

  // Admin: get admin profile (to obtain admin country/timezone)
  async adminGetProfile(jwt: string): Promise<{ success: true; admin: any } | ApiFailure> {
    try {
      const url = `${getBaseUrl()}/admin/profile`
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        cache: 'no-store',
      })
      const body = await parseJson(res)
      if (!res.ok) return { success: false, error: body?.message || `Failed to fetch admin profile (${res.status})` }
      const admin = body?.data?.admin || body?.admin || body?.data || body
      return { success: true, admin }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error fetching admin profile' }
    }
  },

  // Admin: fetch single subscription by id
  async adminGetSubscriptionById(jwt: string, subscriptionId: string): Promise<{ success: true; subscription: any } | ApiFailure> {
    try {
      const url = `${getBaseUrl()}/admin/complete-subscriptions/${encodeURIComponent(subscriptionId)}`
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      })
      const body = await parseJson(res)
      if (!res.ok) return { success: false, error: body?.message || `Failed to fetch subscription (${res.status})` }
      const subscription = body?.data?.subscription || body?.subscription || body
      return { success: true, subscription }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error fetching subscription' }
    }
  },

  // Admin: fetch users list (optional pagination/search)
  async adminGetUsers(
    jwt: string,
    params?: { search?: string; page?: number; limit?: number }
  ): Promise<{ success: true; users: any[] } | ApiFailure> {
    try {
      const q = new URLSearchParams()
      if (params) {
        if (params.search) q.set('search', params.search)
        if (params.page) q.set('page', String(params.page))
        if (params.limit) q.set('limit', String(params.limit))
      }
      const url = `${getBaseUrl()}/admin/users${q.toString() ? `?${q.toString()}` : ''}`
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        cache: 'no-store',
      })
      const body = await parseJson(res)
      if (!res.ok) return { success: false, error: body?.message || `Failed to fetch users (${res.status})` }
      const users = body?.data?.users || body?.users || []
      return { success: true, users }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error fetching users' }
    }
  },

  // Admin: delete a user (and backend should cascade-delete or server handles deleting related subscriptions)
  async adminDeleteUser(jwt: string, userId: string): Promise<{ success: true; message?: string } | ApiFailure> {
    try {
      const url = `${getBaseUrl()}/admin/users/${encodeURIComponent(userId)}`
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      })
      const body = await parseJson(res)
      if (!res.ok) return { success: false, error: body?.message || `Failed to delete user (${res.status})` }
      return { success: true, message: body?.message || 'User deleted' }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error deleting user' }
    }
  },

  // Admin: delete a complete subscription by id
  async adminDeleteSubscription(jwt: string, subscriptionId: string): Promise<{ success: true; message?: string } | ApiFailure> {
    try {
      const url = `${getBaseUrl()}/admin/complete-subscriptions/${encodeURIComponent(subscriptionId)}`
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      })
      const body = await parseJson(res)
      if (!res.ok) return { success: false, error: body?.message || `Failed to delete subscription (${res.status})` }
      return { success: true, message: body?.message || 'Subscription deleted' }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error deleting subscription' }
    }
  },
  // Admin: confirm payment for a complete subscription
  async adminConfirmPayment(jwt: string, subscriptionId: string, paymentReference?: string): Promise<{ success: true; payment?: any } | ApiFailure> {
    try {
      const url = `${getBaseUrl()}/admin/complete-subscriptions/${encodeURIComponent(subscriptionId)}/confirm-payment`
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify(paymentReference ? { paymentReference } : {}),
      })
      const body = await parseJson(res)
      if (!res.ok) return { success: false, error: body?.message || `Failed to confirm payment (${res.status})` }
      // backend returns short payment state or updated subscription
      const payment = body?.data || body
      return { success: true, payment }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error confirming payment' }
    }
  },

  // Admin: Plans CRUD
  async adminGetPlans(jwt: string): Promise<{ success: true; plans: Plan[] } | ApiFailure> {
    try {
      const url = `${getBaseUrl()}/admin/subscription-plans`
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        cache: 'no-store',
      })
      const body = await parseJson(res)
      if (!res.ok) return { success: false, error: body?.message || `Failed to fetch plans (${res.status})` }
      // Normalize possible response shapes (data.subscriptionPlans observed)
      let plans: Plan[] = []
      if (body?.data?.subscriptionPlans && Array.isArray(body.data.subscriptionPlans)) {
        plans = body.data.subscriptionPlans
      } else if (body?.data?.plans && Array.isArray(body.data.plans)) {
        plans = body.data.plans
      } else if (body?.plans && Array.isArray(body.plans)) {
        plans = body.plans
      } else if (Array.isArray(body)) {
        plans = body
      } else if (body?.data) {
        const values = Object.values(body.data)
        const firstArray = values.find(v => Array.isArray(v))
        if (firstArray) plans = firstArray as Plan[]
      }

      return { success: true, plans }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error fetching plans' }
    }
  },

  async adminCreatePlan(jwt: string, plan: Partial<Plan>): Promise<{ success: true; plan: Plan } | ApiFailure> {
    try {
      const url = `${getBaseUrl()}/admin/subscription-plans`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify(plan),
      })
      const body = await parseJson(res)
      if (!res.ok) return { success: false, error: body?.message || `Failed to create plan (${res.status})` }
      const created = body?.data?.plan || body?.plan || body
      return { success: true, plan: created }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error creating plan' }
    }
  },

  async adminUpdatePlan(jwt: string, planId: string, updates: Partial<Plan>): Promise<{ success: true; plan: Plan } | ApiFailure> {
    try {
      const url = `${getBaseUrl()}/admin/subscription-plans/${encodeURIComponent(planId)}`
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify(updates),
      })
      const body = await parseJson(res)
      if (!res.ok) return { success: false, error: body?.message || `Failed to update plan (${res.status})` }
      const updated = body?.data?.plan || body?.plan || body
      return { success: true, plan: updated }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error updating plan' }
    }
  },

  async adminDeletePlan(jwt: string, planId: string): Promise<{ success: true; message?: string } | ApiFailure> {
    try {
      const url = `${getBaseUrl()}/admin/subscription-plans/${encodeURIComponent(planId)}`
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      })
      const body = await parseJson(res)
      if (!res.ok) return { success: false, error: body?.message || `Failed to delete plan (${res.status})` }
      return { success: true, message: body?.message || 'Plan deleted' }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error deleting plan' }
    }
  },

  async adminReorderPlans(jwt: string, planOrders: { planId: string; order: number }[]): Promise<{ success: true; message?: string } | ApiFailure> {
    try {
      const url = `${getBaseUrl()}/admin/subscription-plans/reorder`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        // Backend expects { plans: [...] } not { planOrders: [...] }
        body: JSON.stringify({ plans: planOrders }),
      })
      const body = await parseJson(res)
      if (!res.ok) return { success: false, error: body?.message || `Failed to reorder plans (${res.status})` }
      return { success: true, message: body?.message || 'Plans reordered' }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error reordering plans' }
    }
  },
}
