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
}

type ApiSuccess<T> = { success: true; data?: T; message?: string }
type ApiFailure = { success: false; error: string }

function getBaseUrl() {
  const base = process.env.NEXT_PUBLIC_API_URL || ""
  return base.replace(/\/$/, "")
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
      const url = `${getBaseUrl()}/plans`
      const res = await fetch(url, { cache: "no-store" })
      const body = await parseJson(res)
      
      if (!res.ok) {
        const errorMsg = body?.message || `Failed to fetch plans (${res.status})`
        return { success: false, error: errorMsg }
      }

      // Backend returns: { status: 'success', results: number, data: { plans: Plan[] } }
      let plans: Plan[] = []
      
      if (body?.data?.plans && Array.isArray(body.data.plans)) {
        plans = body.data.plans
      } else if (body?.plans && Array.isArray(body.plans)) {
        plans = body.plans
      } else if (Array.isArray(body)) {
        plans = body
      } else {
        return { success: false, error: "Invalid plans data structure" }
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
      sessions: { date: string; time: string; notes?: string }[]
      country?: string // User's country for timezone handling
    },
  ): Promise<{ success: true; subscription: any } | ApiFailure> {
    try {
      const url = `${getBaseUrl()}/user/complete-subscription`
      
      const requestBody: any = { 
        subscriptionPlanId, 
        startDate, 
        sessions 
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
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ subscriptionId, date, time, notes }),
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
      
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ subscriptionId, sessions }),
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
}
