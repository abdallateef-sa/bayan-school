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
  console.log("🌐 API Base URL:", base)
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
      console.log("📧 Sending Registration OTP to:", url, "for email:", email)
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      console.log("📧 Registration OTP Response status:", res.status)
      if (!res.ok) {
        const body = await parseJson(res)
        console.log("❌ Registration OTP Error:", body)
        return { success: false, error: (body as any)?.message || `Failed to send registration OTP (${res.status})` }
      }
      const responseData = await parseJson(res)
      console.log("✅ Registration OTP Success:", responseData)
      return { success: true, data: responseData }
    } catch (e: any) {
      console.error("🚨 Registration OTP Network Error:", e)
      return { success: false, error: e?.message || "Network error sending registration OTP" }
    }
  },

  // Verify OTP (for both login and registration)
  async verifyOtp(email: string, otp: string): Promise<{ success: true; token: string; tempToken?: string } | ApiFailure> {
    try {
      const url = `${getBaseUrl()}/auth/verify-otp`
      console.log("🔐 Verifying OTP at:", url, "for email:", email, "OTP:", otp)
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      })
      console.log("🔐 Verify Response status:", res.status)
      const body = await parseJson(res)
      console.log("🔐 Verify Response body:", body)
      
      if (!res.ok) {
        const errorMessage = body?.message || body?.error || `Failed to verify OTP (${res.status})`
        console.log("❌ Verify Error:", errorMessage)
        return { success: false, error: errorMessage }
      }

      // Extract tokens from the response based on backend structure
      const token = body?.data?.token || body?.token
      const tempToken = body?.data?.tempToken || body?.tempToken
      
      if (token) {
        console.log("✅ Verify Success, permanent token found:", token)
        return { success: true, token: token as string }
      } else if (tempToken) {
        console.log("✅ Verify Success, temp token found (needs registration completion):", tempToken)
        return { success: true, token: tempToken as string, tempToken: tempToken as string }
      } else {
        console.log("❌ No token found in response")
        return { success: false, error: "No authentication token received" }
      }
    } catch (e: any) {
      console.error("🚨 Verify Network Error:", e)
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
      console.log("📝 Completing registration at:", url)
      const res = await fetch(url, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${tempToken}`
        },
        body: JSON.stringify(userData),
      })
      console.log("📝 Complete Registration Response status:", res.status)
      const body = await parseJson(res)
      console.log("📝 Complete Registration Response body:", body)
      
      if (!res.ok) {
        const errorMessage = body?.message || body?.error || `Failed to complete registration (${res.status})`
        console.log("❌ Complete Registration Error:", errorMessage)
        return { success: false, error: errorMessage }
      }

      const token = body?.data?.token || body?.token
      const user = body?.data?.user || body?.user
      
      // If registration is successful but no new token is provided,
      // it means the temp token should be used as the permanent token
      if (res.status === 201 || res.status === 200) {
        console.log("✅ Registration completed successfully")
        // Use the temp token we already have if no new token is provided
        const finalToken = token || tempToken
        return { success: true, token: finalToken as string, user }
      } else {
        return { success: false, error: "Registration completion failed" }
      }
    } catch (e: any) {
      console.error("🚨 Complete Registration Network Error:", e)
      return { success: false, error: e?.message || "Network error completing registration" }
    }
  },

  async getPlans(): Promise<{ success: true; plans: Plan[] } | ApiFailure> {
    try {
      const url = `${getBaseUrl()}/plans`
      console.log("📦 Fetching plans from:", url)
      const res = await fetch(url, { cache: "no-store" })
      console.log("📦 Plans response status:", res.status)
      const body = await parseJson(res)
      console.log("📦 Plans response body:", body)
      
      if (!res.ok) {
        const errorMsg = body?.message || `Failed to fetch plans (${res.status})`
        console.error("❌ Plans fetch error:", errorMsg)
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
        console.warn("⚠️ Unexpected plans response structure:", body)
        return { success: false, error: "Invalid plans data structure" }
      }
      
      console.log("✅ Plans parsed successfully:", plans.length, "plans:", plans)
      return { success: true, plans }
    } catch (e: any) {
      console.error("🚨 Plans network error:", e)
      return { success: false, error: e?.message || "Network error fetching plans" }
    }
  },

  // Create Complete Subscription (Plan + Sessions in one call)
  async createCompleteSubscription(
    jwt: string,
    {
      subscriptionPlanId,
      startDate,
      sessions,
    }: {
      subscriptionPlanId: string
      startDate: string // YYYY-MM-DD
      sessions: { date: string; time: string; notes?: string }[]
    },
  ): Promise<{ success: true; subscription: any } | ApiFailure> {
    try {
      const url = `${getBaseUrl()}/user/complete-subscription`
      console.log("📝 Creating complete subscription at:", url, "Plan ID:", subscriptionPlanId)
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ subscriptionPlanId, startDate, sessions }),
      })
      console.log("📝 Complete subscription response status:", res.status)
      const body = await parseJson(res)
      console.log("📝 Complete subscription response body:", body)
      
      if (!res.ok) {
        // Handle specific case of existing subscription (409 Conflict)
        if (res.status === 409 && body?.message?.includes('already have an active subscription')) {
          console.log("ℹ️ User already has an active subscription to this plan")
          return { success: false, error: "You already have an active subscription to this plan" }
        }
        
        console.error("❌ Complete subscription creation failed:", body)
        let errorMsg = body?.message || "Failed to create complete subscription"
        return { success: false, error: errorMsg }
      }
      
      console.log("✅ Complete subscription created successfully!")
      return { success: true, subscription: body?.data?.subscription || body }
    } catch (e: any) {
      console.error("🚨 Complete subscription network error:", e)
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
      console.log("📝 Creating subscription at:", url, "Plan ID:", subscriptionPlanId, "Start:", startDate)
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ subscriptionPlanId, startDate }),
      })
      console.log("📝 Subscription response status:", res.status)
      const body = await parseJson(res)
      console.log("📝 Subscription response body:", body)
      
      if (!res.ok) {
        console.error("❌ Subscription creation failed:", body)
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
        console.error("❌ Subscription ID missing in response:", body)
        return { success: false, error: "Subscription ID missing in response" }
      }
      
      console.log("✅ Subscription created successfully, ID:", subId)
      return { success: true, subscriptionId: String(subId) }
    } catch (e: any) {
      console.error("🚨 Subscription creation network error:", e)
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
      console.log("📅 Creating session at:", url, "Subscription:", subscriptionId, "Date:", date, "Time:", time)
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ subscriptionId, date, time, notes }),
      })
      console.log("📅 Session response status:", res.status)
      
      // Get raw response text first
      const rawText = await res.text()
      console.log("📅 Session raw response:", rawText)
      
      // Try to parse as JSON
      let body
      try {
        body = rawText ? JSON.parse(rawText) : {}
      } catch (e) {
        console.warn("📅 Failed to parse response as JSON:", e)
        body = { message: rawText || "Empty response" }
      }
      
      console.log("📅 Session parsed body:", body)
      
      if (!res.ok) {
        console.warn("⚠️ Session creation failed:")
        console.warn("Status:", res.status, res.statusText)
        console.warn("Headers:", Object.fromEntries(res.headers.entries()))
        console.warn("Body:", body)
        
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
      
      console.log("✅ Session created successfully")
      return { success: true, data: body }
    } catch (e: any) {
      console.error("🚨 Session creation network error:", e)
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
      console.log("📅 Creating bulk sessions at:", url, "Subscription:", subscriptionId, "Sessions count:", sessions.length)
      console.log("📅 Sessions data:", sessions)
      
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ subscriptionId, sessions }),
      })
      console.log("📅 Bulk sessions response status:", res.status)
      
      // Get raw response text first
      const rawText = await res.text()
      console.log("📅 Bulk sessions raw response:", rawText)
      
      // Try to parse as JSON
      let body
      try {
        body = rawText ? JSON.parse(rawText) : {}
      } catch (e) {
        console.warn("📅 Failed to parse response as JSON:", e)
        body = { message: rawText || "Empty response" }
      }
      
      console.log("📅 Bulk sessions parsed body:", body)
      
      if (!res.ok) {
        console.warn("⚠️ Bulk sessions creation failed:")
        console.warn("Status:", res.status, res.statusText)
        console.warn("Headers:", Object.fromEntries(res.headers.entries()))
        console.warn("Body:", body)
        
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
      
      console.log("✅ Bulk sessions created successfully")
      return { success: true, data: body }
    } catch (e: any) {
      console.warn("⚠️ Bulk sessions creation network error:", e)
      return { success: false, error: e?.message || "Network error creating bulk sessions" }
    }
  },

  // Get booked slots to prevent conflicts (Optional endpoint)
  async getBookedSlots(date?: string): Promise<{ success: true; bookedSlots: { date: string; time: string }[] } | ApiFailure> {
    try {
      const url = date 
        ? `${getBaseUrl()}/sessions/booked?date=${date}`
        : `${getBaseUrl()}/sessions/booked`
      
      console.log("📅 Fetching booked slots from:", url)
      const res = await fetch(url, { cache: "no-store" })
      console.log("📅 Booked slots response status:", res.status)
      
      // If endpoint doesn't exist (404), return empty array
      if (res.status === 404) {
        console.log("📅 Booked slots endpoint not implemented yet - returning empty array")
        return { success: true, bookedSlots: [] }
      }
      
      const body = await parseJson(res)
      console.log("📅 Booked slots response body:", body)
      
      if (!res.ok) {
        const errorMessage = body?.message || body?.error || `Failed to fetch booked slots (${res.status})`
        console.log("❌ Booked slots fetch error:", errorMessage)
        // Return empty array instead of error for non-critical feature
        return { success: true, bookedSlots: [] }
      }

      const bookedSlots = body?.data?.bookedSlots || body?.bookedSlots || []
      console.log("✅ Booked slots fetched successfully:", bookedSlots)
      return { success: true, bookedSlots }
    } catch (e: any) {
      console.warn("� Booked slots fetch network error (endpoint might not exist):", e)
      // Return empty array instead of error - this is not critical functionality
      return { success: true, bookedSlots: [] }
    }
  },
}
