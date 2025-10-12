"use client"

import { useState, useEffect } from "react"
import type { EnrollmentData, PersonalInfo, SelectedPackage, Session } from "@/types/enrollment"
import { AppointmentAPI } from "@/lib/appointment-api"
import { getTimezoneForUSState } from "@/lib/us-timezones"
import { fetchCountryStates, curateCountries } from "@/lib/geo"
import { getTimezoneForRegion } from "@/lib/region-timezones"

const EnhancedEnrollmentForm = () => {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<EnrollmentData>({
    personal: {} as PersonalInfo,
    package: {} as SelectedPackage,
    sessions: [],
  })
  // Normalize booked slot shapes coming from API to { date: YYYY-MM-DD, time: HH:MM }
  const normalizeBookedSlots = (items: any[]) => {
    const tz = userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone
    return (items || []).map((s: any) => {
      if (!s) return null
      // Prefer canonical UTC instant when available and compute viewer-local date/time from it.
      if (s.utcTime) {
        try {
          const d = new Date(s.utcTime)
          const dateStr = d.toLocaleDateString('en-CA', { timeZone: tz }) // YYYY-MM-DD
          const timeStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz })
          return { date: dateStr, time: timeStr, utcTime: s.utcTime }
        } catch (e) {
          // fallthrough to other shapes below
        }
      }
      // If no utcTime, fall back to originalUserDate/originalUserTime or generic date/time
      if (s.originalUserDate && s.originalUserTime) {
        const parts = String(s.originalUserTime).split(':')
        const hh = parts[0].padStart(2, '0')
        const mm = (parts[1] || '00').slice(0,2)
        return { date: s.originalUserDate, time: `${hh}:${mm}`, utcTime: s.utcTime || undefined }
      }
      if (s.date && s.time) {
        return { date: s.date, time: s.time, utcTime: s.utcTime || undefined }
      }
      return null
    }).filter(Boolean) as Array<{date: string, time: string, utcTime?: string}>
  }

  // Normalize time string (accepts "7:00", "07:00", "7:00 AM") => returns HH:MM (24h)
  const to24 = (t: string) => {
    if (!t || typeof t !== 'string') return ''
    const m = t.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i)
    if (!m) return t
    let hh = parseInt(m[1], 10)
    const mm = m[2]
    const ampm = m[3]
    if (ampm) {
      const up = ampm.toUpperCase()
      if (up === 'PM' && hh < 12) hh += 12
      if (up === 'AM' && hh === 12) hh = 0
    }
    return `${String(hh).padStart(2, '0')}:${mm}`
  }
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [otpSent, setOtpSent] = useState(false)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [isLogin, setIsLogin] = useState(false)
  const [jwtToken, setJwtToken] = useState("")
  const [isLoggedInUser, setIsLoggedInUser] = useState(false) // Track if user successfully logged in

  // Toast notification state
  const [toast, setToast] = useState<{ 
    message: string; 
    type: 'success' | 'error' | 'info'; 
    show: boolean 
  }>({ message: "", type: "info", show: false })

  // Show toast notification
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type, show: true })
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }))
    }, 5000)
  }

  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSessions, setSelectedSessions] = useState<Session[]>([])
  const [maxSessions, setMaxSessions] = useState(0)
  const [userTimezone, setUserTimezone] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [availableSlots, setAvailableSlots] = useState<any[]>([])
  const [plans, setPlans] = useState<any[]>([])
  const [isLoadingPlans, setIsLoadingPlans] = useState(false)
  const [bookedSlots, setBookedSlots] = useState<Array<{ date: string; time: string; utcTime?: string }>>([])
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [countries, setCountries] = useState<Array<{value: string, label: string}>>([])
  const [loadingCountries, setLoadingCountries] = useState(false)
  const [usState, setUsState] = useState<string>("")
  const [stateOptions, setStateOptions] = useState<Array<{ name: string; code?: string }>>([])
  const [region, setRegion] = useState<string>("")
  const [geoPrompted, setGeoPrompted] = useState(false)
  const [countryFlag, setCountryFlag] = useState<string>("🌍")

  useEffect(() => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    setUserTimezone(timezone)
    // Try to set a default flag from locale region
    try {
      const locale = Intl.DateTimeFormat().resolvedOptions().locale || 'en-US'
      const region = (locale.split('-')[1] || '').toUpperCase()
      if (region && region.length === 2) {
        const flag = region.replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
        if (flag) setCountryFlag(flag)
      }
    } catch {}
    
    // Initialize data loading with optimized batch loading
    initializeData()
    
    // If user is logged in, get their country from backend and update timezone
    if (jwtToken && isLoggedInUser) {
      fetchUserProfileAndUpdateTimezone()
    }
  }, [jwtToken, isLoggedInUser])

  // Regenerate available slots when timezone changes
  useEffect(() => {
    if (selectedDate) {
      fetchAvailableSlots(selectedDate)
    }
  }, [userTimezone])

  // Optimized data initialization - load all initial data in parallel
  const initializeData = async () => {
    try {
      setIsLoadingPlans(true)
      // Load all initial data in parallel instead of sequential calls
      const [plansResult, slotsResult, countriesResult] = await Promise.all([
        AppointmentAPI.getPlans().catch(() => ({ success: false })),
        AppointmentAPI.getBookedSlots().catch(() => ({ success: false, bookedSlots: [] })),
        fetchCountriesData().catch(() => null)
      ])

      // Handle plans
      if (plansResult && (plansResult as any).success && 'plans' in (plansResult as any)) {
        setPlans((plansResult as any).plans || [])
      } else {
        // keep fallback to local packages
        setPlans([])
      }
      setIsLoadingPlans(false)

      // Handle booked slots (normalize and keep current/future bookings)
      if (slotsResult.success && 'bookedSlots' in slotsResult) {
        const normalized = normalizeBookedSlots(slotsResult.bookedSlots || [])
        const today = new Date()
        today.setHours(0,0,0,0)
        const futureBooked = normalized.filter((s: any) => {
          try {
            const d = new Date(s.date)
            d.setHours(0,0,0,0)
            return d >= today
          } catch (e) {
            return false
          }
        })
        // dedupe and preserve utcTime when available
        const uniq = Array.from(new Set(futureBooked.map((m: any) => `${m.date}||${m.time}||${m.utcTime || ''}`))).map(k => {
          const [date, time, utc] = k.split('||')
          return { date, time, utcTime: utc || undefined }
        })
        setBookedSlots(uniq)
      } else {
        setBookedSlots([])
      }
      setIsLoadingSlots(false)

      // Handle countries
      if (countriesResult) {
        setCountries(countriesResult)
      } else {
        // Fallback countries if API fails
        setCountries([
          { value: "", label: "Select your country" },
          { value: "United States", label: "United States" },
          { value: "United Kingdom", label: "United Kingdom" },
          { value: "Canada", label: "Canada" },
          { value: "Egypt", label: "Egypt" },
          { value: "Saudi Arabia", label: "Saudi Arabia" },
          { value: "UAE", label: "UAE" },
          { value: "Germany", label: "Germany" },
          { value: "France", label: "France" },
          { value: "India", label: "India" },
          { value: "Pakistan", label: "Pakistan" },
          { value: "Australia", label: "Australia" },
          { value: "other", label: "🌍 Other" },
        ])
      }
      setLoadingCountries(false)
    } catch (error) {
      // Set defaults if everything fails
      setIsLoadingPlans(false)
      setIsLoadingSlots(false)
      setLoadingCountries(false)
    }
  }

  // Separate function for countries API to make it reusable
  const fetchCountriesData = async () => {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'
    
    try {
      // Fetch countries from single endpoint (server provides /countries)
      const response = await fetch(`${apiBaseUrl}/countries`)
      const data = await response.json()

      if (data && (data.status === 'success' && data.data && data.data.countries)) {
        return curateCountries(data.data.countries)
      }
    } catch (error) {
      // Return null to use fallback countries
      return null
    }
    return null
  }

  // Fetch user profile from database and update timezone
  const fetchUserProfileAndUpdateTimezone = async (token?: string) => {
    try {
      const authToken = token || jwtToken
      if (!authToken) {
        return
      }
      
      const result = await AppointmentAPI.getUserProfile(authToken)
      
      if (result.success && result.user) {
        const userCountry = result.user.country
        const userTimezoneFromDB = result.user.timezone
        
        if (userCountry) {
          // Update form data with country from database
          setFormData((prev) => ({
            ...prev,
            personal: {
              ...prev.personal,
              country: userCountry,
              firstName: result.user.firstName || prev.personal.firstName,
              lastName: result.user.lastName || prev.personal.lastName,
              phone: result.user.phone || prev.personal.phone,
              gender: result.user.gender || prev.personal.gender,
            }
          }))
          
          // Use timezone directly from database if available, otherwise fetch from countries API
          if (userTimezoneFromDB) {
            setUserTimezone(userTimezoneFromDB)
          } else {
            await updateTimezoneFromUserCountry(userCountry)
          }
        }
      }
    } catch (error) {
      // Silent error handling
    }
  }

  // Watch for country changes and update timezone
  useEffect(() => {
    const selectedCountry = formData.personal.country
    if (selectedCountry && selectedCountry !== 'other') {
      updateTimezoneFromUserCountry(selectedCountry)
    }
  }, [formData.personal.country])

  // Dynamically load region/state options for selected country
  useEffect(() => {
    const selectedCountry = formData.personal.country || ''
    if (selectedCountry && selectedCountry !== 'other') {
      fetchCountryStates(selectedCountry)
        .then((states) => setStateOptions(states || []))
        .catch(() => setStateOptions([]))
    } else {
      setStateOptions([])
      setUsState("")
      setRegion("")
    }
  }, [formData.personal.country])



  // Update timezone based on user's selected country
  const updateTimezoneFromUserCountry = async (countryName?: string) => {
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'
      
      // Use the provided country or get from form data
      const userCountry = countryName || formData.personal.country
      
      if (userCountry && userCountry !== 'other') {
        // Prefer region-specific timezone when available
        const selectedRegion = (userCountry === 'United States' ? usState : region)
        if (selectedRegion) {
          const tz = userCountry === 'United States' ? getTimezoneForUSState(selectedRegion) : getTimezoneForRegion(userCountry, selectedRegion)
          if (tz) { setUserTimezone(tz); return }
        }
        const response = await fetch(`${apiBaseUrl}/countries/${encodeURIComponent(userCountry)}/timezone`)
        const data = await response.json()
        if (data.status === 'success' && data.data.timezone) setUserTimezone(data.data.timezone)
      }
    } catch (error) {
      // Silent error handling - fallback to browser timezone
    }
  }

  const sendOtp = async () => {
    // Enhanced email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email || !emailRegex.test(email)) {
      showToast("Please enter a valid email address", "error")
      return
    }

    // Prevent excessive requests
    if (isSendingOtp) return

    setIsSendingOtp(true)
    try {
      const result = isLogin 
        ? await AppointmentAPI.sendLoginOtp(email)
        : await AppointmentAPI.sendOtp(email)

      if (result.success) {
        setOtpSent(true)
    showToast(`${isLogin ? 'Login' : 'Registration'} OTP sent to your email address!`, "success")
      } else {
  showToast(`Failed to send OTP: ${result.error}`, "error")
      }
    } catch (error) {
  showToast("Failed to send OTP. Please try again.", "error")
    } finally {
      setIsSendingOtp(false)
    }
  }

  const verifyOtp = async () => {
    // Enhanced OTP validation
    const otpRegex = /^\d{6}$/
    if (!otp || !otpRegex.test(otp)) {
      showToast("Please enter a valid 6-digit OTP", "error")
      return
    }

    // Prevent double submission
    if (isVerifyingOtp) return

    setIsVerifyingOtp(true)
    try {
      const result = await AppointmentAPI.verifyOtp(email, otp)

      if (result.success) {
        // Set email in form data first
        setFormData((prev) => ({
          ...prev,
          personal: { ...prev.personal, email },
        }))

        if (isLogin) {
          // Login flow: always go to package selection
          setJwtToken(result.token)
          setIsLoggedInUser(true)
          showToast("Login successful! Welcome back.", "success")
          
          // For existing users, get their profile from database and update timezone
          setTimeout(() => fetchUserProfileAndUpdateTimezone(result.token), 500)
          
          setCurrentStep(3) // Go to package selection
        } else {
          // Registration flow: check token type
          if (result.tempToken) {
            // New user - needs to complete personal info
            setJwtToken(result.tempToken)
            showToast("OTP verified! Please complete your personal information.", "success")
            setCurrentStep(2) // Go to personal info
          } else if (result.token) {
            // User already exists but tried to register - treat as login
            setJwtToken(result.token)
            setIsLoggedInUser(true)
            showToast("Welcome back! You already have an account.", "info")
            
            // For existing users, get profile from database and update timezone
            setTimeout(() => fetchUserProfileAndUpdateTimezone(result.token), 500)
            
            setCurrentStep(3) // Go to package selection
          } else {
            showToast("Unable to complete verification. Please try again.", "error")
            return
          }
        }
      } else {
        showToast(`OTP verification failed: ${result.error}`, "error")
      }
    } catch (error) {
      showToast("OTP verification failed. Please try again.", "error")
    } finally {
      setIsVerifyingOtp(false)
    }
  }

  const fetchAvailableSlots = async (date: string) => {
    // Use central timezone util to generate slots for Cairo and convert to user's timezone
    try {
      setIsLoadingSlots(true)
      const selectedUserTimezone = userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone
      // Import util dynamically to avoid SSR issues
      const { getWorkingSlotsForUser } = await import('../lib/simple-timezone-utils.js')
      const slots: any = getWorkingSlotsForUser(date, selectedUserTimezone)
      // slots may be array of strings or array of objects { cairoTime, userTime, utcTime }
      const mapped = (slots || []).map((s: any) => {
        if (typeof s === 'string') return { display: s, utcTime: null }
        return { display: s.userTime || s.display || String(s), utcTime: s.utcTime || null }
      })
      // dedupe by utcTime if present else by display
      const seen = new Set<string>()
      const unique = [] as any[]
      for (const it of mapped) {
        const key = it.utcTime || it.display
        if (!seen.has(key)) {
          seen.add(key)
          unique.push(it)
        }
      }
      setAvailableSlots(unique)
      // Also fetch booked slots for this specific date and merge
      try {
        const bk = await AppointmentAPI.getBookedSlots(date)
        if (bk && bk.success && Array.isArray(bk.bookedSlots)) {
          // normalize and include utcTime when available
          const normalized = normalizeBookedSlots(bk.bookedSlots)
          setBookedSlots((prev) => {
            const merged = [...prev, ...normalized]
            const uniq = Array.from(new Set(merged.map((m: any) => `${m.date}||${m.time}||${m.utcTime || ''}`))).map(k => {
              const [d, t, u] = k.split('||')
              return { date: d, time: t, utcTime: u || undefined }
            })
            return uniq
          })
        }
      } catch (e) {
        // ignore
      }
    } catch (e) {
      console.error('Failed to generate slots:', e)
      setAvailableSlots([])
    }
    finally {
      setIsLoadingSlots(false)
    }
  }

  const submitEnrollment = async () => {
    setIsSubmitting(true)

    try {
      if (!jwtToken) {
        showToast("Authentication required. Please verify your email first.", "error")
        return false
      }

      if (!formData.package.planId) {
        showToast("Please select a package first.", "error")
        return false
      }

      // Ensure user country is set for timezone handling
      let userCountry = formData.personal.country
      if (!userCountry) {
        showToast("Country information is required. Please complete your profile.", "error")
        return false
      }

  // Create complete subscription with plan and all sessions in one call
  // Use Cairo's calendar day to avoid UTC off-by-one causing a "past" date
  const startDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date())
      
      const sessionsData = selectedSessions.map(session => {
        const payload: any = {
          date: session.date,
          time: session.time,
          notes: `${formData.package.name} session`
        }
        // Prefer utcTime if captured from slot selection
        if ((session as any).utcTime) {
          payload.startsAtUTC = (session as any).utcTime
        } else {
          // Fallback: compute from local date/time
          try { payload.startsAtUTC = new Date(`${session.date}T${session.time}:00`).toISOString() } catch {}
        }
        return payload
      })

      const result = await AppointmentAPI.createCompleteSubscription(jwtToken, {
        subscriptionPlanId: formData.package.planId,
        startDate: startDate,
        sessions: sessionsData,
        country: userCountry
      })

      if (!result.success) {
        // Check if the error is about existing active subscription
          if (result.error && typeof result.error === 'string') {
          if (result.error.toLowerCase().includes('already have an active subscription')) {
            showToast("You already have an active subscription to this plan. Contact support to modify your subscription or choose a different plan.", "error")
          } else if (result.error.toLowerCase().includes('plan not found')) {
            showToast("Selected plan is not available. Please choose another plan.", "error")
          } else if (result.error.toLowerCase().includes('insufficient')) {
            showToast("Payment issue. Please check your payment details.", "error")
          } else if (result.error.toLowerCase().includes('network') || result.error.toLowerCase().includes('connection')) {
            showToast("Network issue. Please check your connection and try again.", "error")
          } else {
            showToast(`Failed to create subscription: ${result.error}`, "error")
          }
        } else {
          showToast("An unexpected error occurred. Please try again.", "error")
        }
        return false
      }
      showToast("Subscription created successfully! Welcome to Bayan School!", "success")
      // Append newly booked sessions to local bookedSlots so UI updates immediately
      try {
        const newBooked = selectedSessions.map((s: any) => ({ date: s.date, time: s.time, utcTime: s.utcTime }))
        setBookedSlots((prev) => {
          const merged = [...prev, ...newBooked]
          // dedupe
          const uniq = Array.from(new Set(merged.map((m: any) => `${m.date}||${m.time}||${m.utcTime || ''}`))).map(k => {
            const [date, time, u] = k.split('||')
            return { date, time, utcTime: u || undefined }
          })
          return uniq
        })
      } catch (e) {
        // ignore
      }
      return true
    } catch (error) {
      showToast("An error occurred. Please try again.", "error")
      return false
    } finally {
      setIsSubmitting(false)
    }
  }

  const packages = [
    {
      id: "basic",
      name: "Basic",
      description: "Perfect for beginners",
      sessions: 8,
      price: 35,
      popular: false,
      details: ["30min sessions", "2 sessions/week", "8 sessions/month", "Basic curriculum"],
    },
    {
      id: "standard",
      name: "Standard",
      description: "Most popular choice",
      sessions: 12,
      price: 50,
      popular: true,
      details: ["30min sessions", "3 sessions/week", "12 sessions/month", "Comprehensive curriculum"],
    },
    {
      id: "intensive",
      name: "Intensive",
      description: "Accelerated learning",
      sessions: 16,
      price: 65,
      popular: false,
      details: [
        "30min sessions",
        "4 sessions/week",
        "16 sessions/month",
        "Advanced curriculum",
        "Group sessions available",
      ],
    },
    {
      id: "custom1",
      name: "Lite",
      description: "Flexible schedule",
      sessions: 4,
      price: 20,
      popular: false,
      details: ["30min sessions", "1 session/week", "4 sessions/month"],
    },
    {
      id: "custom2",
      name: "Premium",
      description: "Ultimate flexibility",
      sessions: 0,
      price: 8,
      popular: false,
      details: ["Custom duration", "Flexible scheduling", "8+ hours monthly", "Contact for setup"],
    },
  ]

  const nextStep = async (step: number) => {
    if (step === 2) {
      // Validate personal info fields
      const requiredFields: (keyof PersonalInfo)[] = ["firstName", "lastName", "gender", "country", "phone"]
      const isValid = requiredFields.every((field) => formData.personal[field])

      if (!isValid) {
        showToast("Please fill in all required fields", "error")
        return
      }

      // If US is selected, require state selection
      if ((formData.personal.country || '') === 'United States' && !usState) {
        showToast("Please select your state", "error")
        return
      }

      // Only complete registration if user is truly new (has tempToken)
      if (jwtToken && !isLoggedInUser) {
        try {
          const result = await AppointmentAPI.completeRegistration(jwtToken, {
            firstName: formData.personal.firstName,
            lastName: formData.personal.lastName,
            phone: formData.personal.phone,
            gender: formData.personal.gender,
            country: formData.personal.country,
            timezone: userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone
          })

          if (result.success) {
            setJwtToken(result.token) // Update with permanent token
            setIsLoggedInUser(true) // Now user is fully registered
            showToast("Registration completed successfully! 🎉", "success")
            // Fetch user profile to retrieve persisted timezone and update state
            try {
              await fetchUserProfileAndUpdateTimezone(result.token)
            } catch (e) {
              // ignore profile fetch errors here
            }
          } else {
            // Handle registration errors gracefully
            if (result.error && (result.error.includes("already completed") || result.error.includes("No authentication token"))) {
              // If registration completed but no token, or already completed,
              // treat as success and proceed
              showToast("Account setup completed! Please proceed to select your package.", "success")
              setIsLoggedInUser(true)
            } else {
              showToast(`Registration failed: ${result.error}`, "error")
              return
            }
          }
        } catch (error) {
          showToast("Network error during registration. Please check your connection and try again.", "error")
          return
        }
      }
    } else if (step === 3) {
      if (!formData.package.type) {
        showToast("Please select a package", "error")
        return
      }
      // Update timezone when moving to scheduling step
      setTimeout(() => updateTimezoneFromUserCountry(), 100)
    } else if (step === 4) {
      const totalRequired = maxSessions
      if (selectedSessions.length < totalRequired) {
        showToast(`Please select ${totalRequired} sessions`, "error")
        return
      }

      setFormData((prev) => ({ ...prev, sessions: selectedSessions }))

      const success = await submitEnrollment()
      if (!success) return
    }

    setCurrentStep(step + 1)
  }

  const previousStep = (step: number) => {
    const targetStep = step - 1
    
    // If user is trying to go back to step 2 but they are a logged in user, go to step 1 instead
    if (targetStep === 2 && isLoggedInUser) {
      setCurrentStep(1)
    } else {
      setCurrentStep(targetStep)
    }
  }

  const updatePersonalInfo = (field: keyof PersonalInfo, value: string) => {
    // Input sanitization for security
    let sanitizedValue = value

    // Basic input sanitization
    if (typeof value === 'string') {
      // Remove potentially dangerous characters
      sanitizedValue = value.replace(/[<>'"]/g, '').trim()
      
      // Additional validation for phone numbers
      if (field === 'phone') {
        sanitizedValue = sanitizedValue.replace(/[^\d\s\-\+\(\)]/g, '')
      }
      
      // Additional validation for names
      if (field === 'firstName' || field === 'lastName') {
        sanitizedValue = sanitizedValue.replace(/[^\p{L}\s\-']/gu, '')
      }
    }

    setFormData((prev) => ({
      ...prev,
      personal: { ...prev.personal, [field]: sanitizedValue },
    }))
    
    // Update timezone when country is changed
    if (field === 'country' && sanitizedValue && sanitizedValue !== 'other') {
      // Update timezone immediately with the new country value
      setTimeout(() => updateTimezoneFromUserCountry(sanitizedValue), 100)
      // Reset US state when country changes away from US
      if (sanitizedValue !== 'United States') setUsState("")
      // Update flag emoji for selected country when possible
      try {
        const code = countryNameToCode(sanitizedValue)
        if (code) {
          const flag = code.replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
          setCountryFlag(flag)
        }
      } catch {}
    }
  }

  // Minimal country-name to ISO code mapper for common countries
  const countryNameToCode = (name: string): string | null => {
    const map: Record<string, string> = {
      'United States': 'US',
      'United Kingdom': 'GB',
      'Canada': 'CA',
      'Australia': 'AU',
      'Germany': 'DE',
      'France': 'FR',
      'Saudi Arabia': 'SA',
      'UAE': 'AE',
      'Egypt': 'EG',
      'Pakistan': 'PK',
      'India': 'IN',
      'Malaysia': 'MY',
      'Indonesia': 'ID',
      'Turkey': 'TR',
    }
    return map[name] || null
  }

  const selectPackage = (pkg: any) => {
    setFormData((prev) => ({
      ...prev,
      package: {
        name: pkg.name,
        type: pkg.id,
        sessions: pkg.sessions || pkg.sessionsPerMonth || 8,
        sessionsPerWeek: pkg.sessionsPerWeek || 2,
        planId: pkg._id || pkg.id, // Store the backend plan ID
      },
    }))
    setMaxSessions(pkg.sessions || pkg.sessionsPerMonth || 8)
  }

  const generateCalendar = () => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    // Prevent booking for today and any past dates
    const minimumBookingDate = new Date(today)
    minimumBookingDate.setDate(today.getDate() + 1) // Start from tomorrow

    const days = []

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="w-12 h-12"></div>)
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      const isPast = date < minimumBookingDate // Changed to use minimumBookingDate
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  const isSelected = selectedSessions.some((s) => s.date === dateStr)
      const isCurrentlySelected = selectedDate === dateStr

  // bookedCount removed: we no longer show per-day booked-count badge

      // Calculate week boundaries for this date
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay()) // Sunday
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6) // Saturday
      
      // Count sessions in this week
      const sessionsPerWeek = formData.package.sessionsPerWeek || 2
      const sessionsInWeek = selectedSessions.filter(session => {
        const sessionDate = new Date(session.date)
        return sessionDate >= weekStart && sessionDate <= weekEnd
      }).length
      
      // Check if this week is full
      const isWeekFull = sessionsInWeek >= sessionsPerWeek && !isSelected

      days.push(
        <div
          key={day}
          className={`w-9 h-9 md:w-12 md:h-12 flex flex-col items-center justify-center rounded-2xl cursor-pointer transition-all duration-300 text-xs md:text-sm font-semibold relative ${
            isPast
              ? "bg-gray-50 text-gray-300 cursor-not-allowed"
              : isCurrentlySelected
                ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-xl scale-110 shadow-blue-200"
                : isSelected
                  ? "bg-gradient-to-br from-blue-50 to-purple-50 text-blue-600 border-2 border-blue-200"
                  : isWeekFull
                  ? "bg-orange-50 text-orange-600 border-2 border-orange-200 cursor-not-allowed opacity-70"
                  : "bg-white text-gray-700 border-2 border-gray-100 hover:border-blue-200 hover:bg-gradient-to-br hover:from-blue-50 hover:to-purple-50 hover:scale-105 hover:shadow-lg"
          }`}
          onClick={isPast || isWeekFull ? undefined : () => selectDate(dateStr)}
          title={
            isPast 
              ? "Past date - cannot book" 
              : isWeekFull
              ? `Week full (${sessionsInWeek}/${sessionsPerWeek} sessions used)`
              : isSelected
              ? "Has booked sessions"
              : "Available for booking"
          }
        >
          <span className="text-xs">{day}</span>
          {/* booked-count badge removed as per UX request */}
          {isWeekFull && !isSelected && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs leading-none">!</span>
            </div>
          )}
          {isSelected && (
            <span className="text-xs leading-none">✓</span>
          )}
        </div>,
      )
    }

    return days
  }

  const changeMonth = (direction: number) => {
    setCurrentMonth((prev) => {
      const newDate = new Date(prev)
      newDate.setMonth(prev.getMonth() + direction)
      return newDate
    })
  }

  const selectDate = async (date: string) => {
    setSelectedDate(date)
    await fetchAvailableSlots(date)
    // Refresh will happen automatically through state updates
  }

  // Helper function to format week range
  const formatWeekRange = (date: Date) => {
    const weekStart = new Date(date)
    weekStart.setDate(date.getDate() - date.getDay()) // Sunday
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6) // Saturday
    
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    
    if (weekStart.getMonth() === weekEnd.getMonth()) {
      return `${months[weekStart.getMonth()]} ${weekStart.getDate()} - ${weekEnd.getDate()}`
    } else {
      return `${months[weekStart.getMonth()]} ${weekStart.getDate()} - ${months[weekEnd.getMonth()]} ${weekEnd.getDate()}`
    }
  }

  // Helper function to count sessions in a week
  const getWeekSessionCount = (dateStr: string) => {
    const date = new Date(dateStr)
    const weekStart = new Date(date)
    weekStart.setDate(date.getDate() - date.getDay()) // Sunday
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6) // Saturday
    
    return selectedSessions.filter(session => {
      const sessionDate = new Date(session.date)
      return sessionDate >= weekStart && sessionDate <= weekEnd
    }).length
  }

  // Function to print comprehensive summary
  const printSummary = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const printContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Enrollment Summary - ${formData.personal.firstName} ${formData.personal.lastName}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: white;
            padding: 20px;
            direction: ltr;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #3b82f6;
            padding-bottom: 20px;
          }
          .header h1 {
            color: #1e40af;
            font-size: 28px;
            margin-bottom: 10px;
          }
          .header p {
            color: #6b7280;
            font-size: 16px;
          }
          .section {
            margin-bottom: 25px;
            padding: 20px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            background: #f9fafb;
          }
          .section h2 {
            color: #1f2937;
            font-size: 20px;
            margin-bottom: 15px;
            border-bottom: 1px solid #d1d5db;
            padding-bottom: 8px;
          }
          .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
          }
          .info-item {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
          }
          .info-label {
            font-weight: 600;
            color: #374151;
          }
          .info-value {
            color: #6b7280;
          }
          .sessions-list {
            list-style: none;
          }
          .sessions-list li {
            padding: 8px;
            margin: 5px 0;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 4px;
          }
          .date {
            font-weight: 600;
            color: #1e40af;
          }
          .time {
            color: #059669;
            margin-left: 10px;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 14px;
          }
          @media print {
            body { margin: 0; padding: 15px; }
            .section { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Enrollment Summary - Bayan School</h1>
          <p>Print Date: ${new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            weekday: 'long'
          })}</p>
        </div>

        <!-- Student Information -->
        <div class="section">
          <h2>Student Information</h2>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">First Name:</span>
              <span class="info-value">${formData.personal.firstName}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Last Name:</span>
              <span class="info-value">${formData.personal.lastName}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Phone Number:</span>
              <span class="info-value">${formData.personal.phone}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Email:</span>
              <span class="info-value">${formData.personal.email}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Gender:</span>
              <span class="info-value">${formData.personal.gender === 'Male' ? 'Male' : formData.personal.gender === 'Female' ? 'Female' : 'Not Specified'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Country:</span>
              <span class="info-value">${formData.personal.country}</span>
            </div>
          </div>
        </div>

        <!-- Subscription Information -->
        <div class="section">
          <h2>Subscription Information</h2>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Plan Name:</span>
              <span class="info-value">${formData.package.name}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Total Sessions:</span>
              <span class="info-value">${formData.package.sessions} sessions</span>
            </div>
            ${formData.package.sessionsPerWeek ? `
            <div class="info-item">
              <span class="info-label">Sessions per Week:</span>
              <span class="info-value">${formData.package.sessionsPerWeek} sessions</span>
            </div>
            ` : ''}
          </div>
        </div>

        <!-- Scheduled Sessions -->
        <div class="section">
          <h2>Scheduled Sessions (${selectedSessions.length} sessions)</h2>
          ${selectedSessions.length > 0 ? `
          <ul class="sessions-list">
            ${selectedSessions.map(session => `
              <li>
                <span class="date">${new Date(session.date).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric',
                  weekday: 'long'
                })}</span>
                <span class="time">Time: ${session.time}</span>
              </li>
            `).join('')}
          </ul>
          ` : `
          <p style="text-align: center; color: #6b7280; padding: 20px;">No sessions scheduled yet</p>
          `}
        </div>

        <!-- Summary -->
        <div class="section">
          <h2>Subscription Summary</h2>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Registration Date:</span>
              <span class="info-value">${new Date().toLocaleDateString('en-US')}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Subscription Status:</span>
              <span class="info-value">Active</span>
            </div>
            ${selectedSessions.length > 0 ? `
            <div class="info-item">
              <span class="info-label">First Session Date:</span>
              <span class="info-value">${new Date(selectedSessions[0].date).toLocaleDateString('en-US')}</span>
            </div>
            ` : ''}
            <div class="info-item">
              <span class="info-label">Scheduled Sessions:</span>
              <span class="info-value">${selectedSessions.length} of ${formData.package.sessions}</span>
            </div>
          </div>
        </div>

        <div class="footer">
          <p>Bayan School - All Rights Reserved</p>
          <p>For inquiries: support@bayan-school.com | 123-456-7890</p>
        </div>
      </body>
      </html>
    `

    printWindow.document.write(printContent)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 500)
  }

  const generateTimeSlots = () => {
    if (!selectedDate) return []

    const slots = []
    const sessionsPerWeek = formData.package.sessionsPerWeek || 2

    // Calculate week boundaries for selected date
    const selectedDateObj = new Date(selectedDate)
    const weekStart = new Date(selectedDateObj)
    weekStart.setDate(selectedDateObj.getDate() - selectedDateObj.getDay()) // Sunday
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6) // Saturday

    // Count existing sessions in this week
    const sessionsInWeek = selectedSessions.filter(session => {
      const sessionDate = new Date(session.date)
      return sessionDate >= weekStart && sessionDate <= weekEnd
    }).length

    // Check if this week is full
    const isWeekFull = sessionsInWeek >= sessionsPerWeek

    for (const slotItem of availableSlots) {
      // slotItem can be a string like "07:00" or an object { display, utcTime }
      const timeStr = typeof slotItem === 'string' ? slotItem : slotItem.display
      const utcForSlot = typeof slotItem === 'string' ? undefined : slotItem.utcTime

      const [hour, minute] = timeStr.split(":").map(Number)
      const displayTime = formatTime(hour, minute)

      // Selected checks should prefer utcTime when available (for uniqueness across timezones)
      const isSelected = selectedSessions.some((s) => {
        const ss: any = s
        if (utcForSlot && ss.utcTime) return ss.utcTime === utcForSlot
        return s.date === selectedDate && s.time === timeStr
      })

      // Check if this slot is booked by another student
      // If booked slot has utcTime, compare by utcTime; otherwise fall back to date+time
      const isBooked = bookedSlots.some((slot) => {
        const bs: any = slot
        // If booked slot has utcTime, compare canonical UTC instants.
        if (bs.utcTime) {
          const slotUtc = utcForSlot || new Date(`${selectedDate}T${timeStr}:00`).toISOString()
          return slotUtc === bs.utcTime
        }
        // fallback: compare by date + normalized time
        return slot.date === selectedDate && to24(slot.time) === to24(timeStr)
      })

      // Prevent selection if week is full and slot is not already selected
      const isWeekLimitReached = isWeekFull && !isSelected

      slots.push(
        <div
          key={`${selectedDate}-${timeStr}${utcForSlot ? `-${utcForSlot}` : ''}`}
          className={`px-4 py-3 rounded-2xl min-h-[44px] transition-all duration-300 text-center font-medium text-sm border-2 ${
            isBooked
              ? "border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed opacity-70"
              : isWeekLimitReached
              ? "border-orange-200 bg-orange-50 text-orange-400 cursor-not-allowed opacity-60"
              : isSelected
              ? "border-blue-500 bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg transform scale-105 cursor-pointer"
              : "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-gradient-to-br hover:from-blue-50 hover:to-purple-50 hover:scale-105 hover:shadow-md cursor-pointer"
          }`}
          onClick={isWeekLimitReached || isBooked ? undefined : () => toggleTimeSlot(slotItem)}
          title={
            isBooked
              ? "This time slot is already booked"
              : isWeekLimitReached
              ? `Week limit reached (${sessionsPerWeek} sessions max)`
              : ""
          }
        >
          <div className="flex flex-col">
            <span>{displayTime}</span>
          </div>
          {isBooked && <span className="block text-xs mt-1">Booked</span>}
          {isWeekLimitReached && !isBooked && <span className="block text-xs mt-1">Week Full</span>}
        </div>,
      )
    }

    return slots
  }

  const formatTime = (hour: number, minute: number) => {
    const period = hour >= 12 ? "PM" : "AM"
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
    return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`
  }

  const toggleTimeSlot = (slotOrTime: any) => {
    if (!selectedDate) return

    // Normalize incoming slot
    const time = typeof slotOrTime === 'string' ? slotOrTime : slotOrTime.display
    const utc = typeof slotOrTime === 'string' ? undefined : slotOrTime.utcTime

    // Prevent selecting a slot that is already booked by someone else
    const isBookedNow = bookedSlots.some((s) => {
      const bs: any = s
      if (bs.utcTime) {
        const slotUtc = utc || new Date(`${selectedDate}T${time}:00`).toISOString()
        return bs.utcTime === slotUtc
      }
      return s.date === selectedDate && to24(s.time) === to24(time)
    })
    if (isBookedNow) {
      showToast('This time slot is already booked', 'error')
      return
    }

    const existingIndex = selectedSessions.findIndex((s) => {
      const ss: any = s
      if (utc && ss.utcTime) return ss.utcTime === utc
      return s.date === selectedDate && s.time === time
    })
    const totalAllowed = maxSessions

    if (existingIndex > -1) {
      // Remove session
      setSelectedSessions((prev) => prev.filter((_, index) => index !== existingIndex))
    } else {
      // Add session
      if (selectedSessions.length >= totalAllowed) {
        showToast(`You can only select ${totalAllowed} sessions in total`, "info")
        return
      }

      const newEntry: any = { date: selectedDate, time }
      if (utc) newEntry.utcTime = utc
      setSelectedSessions((prev) => [...prev, newEntry])
    }
  }

  const resetForm = () => {
    // Reset all form data
    setFormData({ 
      personal: { firstName: "", lastName: "", gender: "", email: "", country: "", phone: "" }, 
      package: { name: "", type: "", sessions: 0 }, 
      sessions: [] 
    })
    setSelectedSessions([])
    setSelectedDate(null)
    setMaxSessions(0)
    setEmail("")
    setOtp("")
    setOtpSent(false)
    setCurrentStep(1)
    setJwtToken("")
    setIsLoggedInUser(false)
    setIsLogin(false)
    setToast({ message: "", type: "info", show: false })
    setBookedSlots([]) // Reset booked slots
    // Clear any loading states
    setIsSendingOtp(false)
    setIsVerifyingOtp(false)
    setIsSubmitting(false)
    setIsLoadingSlots(false)
    // Reload fresh data
    initializeData()
  }

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ]

  const progressPercentage = (currentStep - 1) * 25

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-100 flex items-center justify-center p-4">
      <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl max-w-5xl w-full p-8 md:p-12 border border-white/20">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl mb-6 shadow-xl">
            <span className="text-3xl text-white">📚</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mb-4 leading-tight">
            Bayan School
          </h1>
          <p className="text-xl text-gray-600 mb-2">Arabic & Quran Studies</p>
          <p className="text-lg text-gray-500">Begin Your Learning Journey</p>
        </div>

        <div className="mb-12">
          <div className="flex justify-between items-center mb-4">
            {[1, 2, 3, 4, 5].map((step) => (
              <div key={step} className="flex flex-col items-center">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-lg transition-all duration-500 border-3 ${
                    step < currentStep
                      ? "bg-gradient-to-br from-green-400 to-green-600 text-white border-green-500 shadow-lg shadow-green-200"
                      : step === currentStep
                        ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white border-blue-500 shadow-xl shadow-blue-200 scale-110"
                        : "bg-gray-50 text-gray-400 border-gray-200"
                  }`}
                >
                  {step < currentStep ? "✓" : step}
                </div>
                <span className="text-xs text-gray-500 mt-2 font-medium">
                  {step === 1
                    ? "Verify"
                    : step === 2
                      ? "Personal"
                      : step === 3
                        ? "Package"
                        : step === 4
                          ? "Schedule"
                          : "Complete"}
                </span>
              </div>
            ))}
          </div>
          {/* Scoped style for progress width */}
          <style>{`:root { --enhanced-progress-width: ${progressPercentage}%; } .enhanced-progress-fill { width: var(--enhanced-progress-width); }`}</style>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-700 ease-out enhanced-progress-fill"></div>
          </div>
        </div>

        {currentStep === 1 && (
          <div className="animate-in fade-in-50 slide-in-from-right-4 duration-700">
            <div className="flex items-center mb-8">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mr-4">
                <span className="text-white text-xl">🔐</span>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-gray-800">
                  {isLogin ? 'Login' : 'Create Account'}
                </h2>
                <p className="text-gray-500">
                  {isLogin ? 'Welcome back! Verify your email to continue' : 'Create a new account to get started'}
                </p>
              </div>
            </div>

            <div className="max-w-md mx-auto">
              {!otpSent ? (
                <div className="space-y-6">
                  {/* Login/Register Toggle */}
                  <div className="flex bg-gray-100 p-1 rounded-2xl">
                    <button
                      onClick={() => setIsLogin(true)}
                      className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all duration-300 ${
                        isLogin
                          ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg"
                          : "text-gray-600 hover:text-gray-800"
                      }`}
                    >
                      Login
                    </button>
                    <button
                      onClick={() => setIsLogin(false)}
                      className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all duration-300 ${
                        !isLogin
                          ? "bg-gradient-to-r from-green-500 to-teal-600 text-white shadow-lg"
                          : "text-gray-600 hover:text-gray-800"
                      }`}
                    >
                      Register
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 flex items-center">
                      Email Address <span className="text-red-500 ml-1">*</span>
                    </label>
                    <input
                      type="email"
                      className="w-full px-4 py-4 bg-gray-50 border-0 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all duration-300 text-gray-800 placeholder-gray-400"
                      placeholder="your.email@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <button
                    onClick={sendOtp}
                    disabled={isSendingOtp}
                    className={`w-full px-8 py-4 text-white rounded-2xl font-semibold hover:scale-105 transform transition-all duration-300 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
                      isLogin
                        ? "bg-gradient-to-r from-blue-500 to-purple-600 shadow-blue-200"
                        : "bg-gradient-to-r from-green-500 to-teal-600 shadow-green-200"
                    }`}
                  >
                    {isSendingOtp ? "Sending OTP..." : `Send ${isLogin ? 'Login' : 'Registration'} Code`}
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl">📧</span>
                    </div>
                    <p className="text-gray-600">We've sent a 6-digit verification code to:</p>
                    <p className="font-semibold text-gray-800">{email}</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 flex items-center">
                      Verification Code <span className="text-red-500 ml-1">*</span>
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      className="w-full px-4 py-4 bg-gray-50 border-0 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all duration-300 text-gray-800 placeholder-gray-400 text-center text-2xl tracking-widest"
                      placeholder="000000"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    />
                  </div>

                  <button
                    onClick={verifyOtp}
                    disabled={isVerifyingOtp || otp.length !== 6}
                    className="w-full px-8 py-4 bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-2xl font-semibold hover:scale-105 transform transition-all duration-300 shadow-xl shadow-green-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {isVerifyingOtp ? "Verifying..." : "Verify Code"}
                  </button>

                  <button
                    onClick={() => {
                      setOtpSent(false)
                      setOtp("")
                    }}
                    className="w-full px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors duration-300"
                  >
                    ← Back to email entry
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {currentStep === 2 && !isLoggedInUser && (
          <div className="animate-in fade-in-50 slide-in-from-right-4 duration-700">
            <div className="flex items-center mb-8">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mr-4">
                <span className="text-white text-xl">👤</span>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-gray-800">Personal Information</h2>
                <p className="text-gray-500">Tell us about yourself</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Detect timezone and location - moved here as requested */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-2xl bg-amber-50 border border-amber-200">
                <div className="flex items-center">
                  <span className="text-2xl mr-3" aria-hidden>{countryFlag}</span>
                  <p className="font-semibold text-amber-800">Your timezone: {userTimezone || '—'}</p>
                </div>
                <div className="flex-1" />
                <button
                  type="button"
                  className="px-4 py-2 text-sm rounded-xl bg-white border border-amber-200 hover:bg-amber-100"
                  onClick={async () => {
                    if (typeof navigator !== 'undefined' && navigator.geolocation) {
                      setGeoPrompted(true)
                      navigator.geolocation.getCurrentPosition(async (pos) => {
                        try {
                          // Set timezone from Intl
                          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
                          if (tz) setUserTimezone(tz)
                          // Reverse geocode to fill country/state when possible
                          const { latitude, longitude } = pos.coords
                          try {
                            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`)
                            const data = await res.json()
                            const addr = data && data.address ? data.address : {}
                            const cc = (addr.country_code || '').toUpperCase()
                            // Map to our country dropdown values
                            const mapCountryCodeToName: Record<string, string> = {
                              US: 'United States',
                              GB: 'United Kingdom',
                              AE: 'UAE',
                              SA: 'Saudi Arabia',
                              EG: 'Egypt',
                              CA: 'Canada',
                              AU: 'Australia',
                              DE: 'Germany',
                              FR: 'France',
                              PK: 'Pakistan',
                              IN: 'India',
                              MY: 'Malaysia',
                              ID: 'Indonesia',
                              TR: 'Turkey',
                            }
                            const detectedCountry = mapCountryCodeToName[cc] || (addr.country || '')
                            if (detectedCountry) {
                              // Update form country
                              setFormData((prev) => ({
                                ...prev,
                                personal: { ...prev.personal, country: detectedCountry }
                              }))
                              // Update flag
                              try {
                                const code = cc || countryNameToCode(detectedCountry) || ''
                                if (code) {
                                  const flag = code.replace(/./g, (c: string) => String.fromCodePoint(127397 + c.charCodeAt(0)))
                                  setCountryFlag(flag)
                                }
                              } catch {}
                              // If US, set state
                              if (detectedCountry === 'United States') {
                                const st = addr.state || addr.region || ''
                                if (st) {
                                  setUsState(st)
                                  const tzz = getTimezoneForUSState(st)
                                  if (tzz) setUserTimezone(tzz)
                                }
                              }
                            }
                          } catch {}
                        } catch {}
                      }, () => {
                        setGeoPrompted(false)
                        showToast('Location detection was blocked. You can select country and state manually.', 'info')
                      })
                    }
                  }}
                >
                  Detect timezone & location
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center">
                    First Name <span className="text-red-500 ml-1">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-4 bg-gray-50 border-0 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all duration-300 text-gray-800 placeholder-gray-400"
                    placeholder="Enter your first name"
                    value={formData.personal.firstName || ""}
                    onChange={(e) => updatePersonalInfo("firstName", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center">
                    Last Name <span className="text-red-500 ml-1">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-4 bg-gray-50 border-0 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all duration-300 text-gray-800 placeholder-gray-400"
                    placeholder="Enter your last name"
                    value={formData.personal.lastName || ""}
                    onChange={(e) => updatePersonalInfo("lastName", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 flex items-center">
                  Gender <span className="text-red-500 ml-1">*</span>
                </label>
                <select
                  className="w-full px-4 py-4 bg-gray-50 border-0 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all duration-300 text-gray-800"
                  value={formData.personal.gender || ""}
                  onChange={(e) => updatePersonalInfo("gender", e.target.value as "Male" | "Female")}
                  aria-label="Select gender"
                  title="Select your gender"
                >
                  <option value="">Select your gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center">
                    Country <span className="text-red-500 ml-1">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <select
                      className="w-full px-4 py-4 bg-gray-50 border-0 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all duration-300 text-gray-800"
                      value={formData.personal.country || ""}
                      onChange={(e) => updatePersonalInfo("country", e.target.value)}
                      aria-label="Select country"
                      title="Select your country"
                      disabled={loadingCountries}
                    >
                      {loadingCountries ? (
                        <option value="">Loading countries...</option>
                      ) : (
                        countries.map((country) => (
                          <option key={country.value} value={country.value}>
                            {country.label}
                          </option>
                        ))
                      )}
                    </select>
                    {stateOptions.length > 0 && (
                      <select
                        className="w-full px-4 py-4 bg-gray-50 border-0 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all duration-300 text-gray-800"
                        value={(formData.personal.country || '') === 'United States' ? usState : region}
                        onChange={(e) => {
                          const v = e.target.value
                          if ((formData.personal.country || '') === 'United States') {
                            setUsState(v)
                            const tz = getTimezoneForUSState(v)
                            if (tz) setUserTimezone(tz)
                          } else {
                            setRegion(v)
                            const tz = getTimezoneForRegion(formData.personal.country || '', v)
                            if (tz) setUserTimezone(tz)
                          }
                        }}
                        aria-label="Select state/region"
                        title="Select state/region"
                      >
                        <option value="">Select state/region</option>
                        {stateOptions.map((s: { name: string; code?: string }) => (
                          <option key={s.code || s.name} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center">
                    Phone Number <span className="text-red-500 ml-1">*</span>
                  </label>
                  <input
                    type="tel"
                    className="w-full px-4 py-4 bg-gray-50 border-0 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all duration-300 text-gray-800 placeholder-gray-400"
                    placeholder="+1 (555) 123-4567"
                    value={formData.personal.phone || ""}
                    onChange={(e) => updatePersonalInfo("phone", e.target.value)}
                  />
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                <div className="flex items-center">
                  <span className="text-green-600 text-xl mr-3">✓</span>
                  <div>
                    <p className="font-semibold text-green-800">Email Verified</p>
                    <p className="text-green-600">{email}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between mt-10">
              <button
                onClick={() => previousStep(2)}
                className="px-8 py-4 bg-gray-100 text-gray-700 rounded-2xl font-semibold hover:bg-gray-200 transition-all duration-300"
              >
                ← Back
              </button>
              <button
                onClick={() => nextStep(2)}
                className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-2xl font-semibold hover:scale-105 transform transition-all duration-300 shadow-xl shadow-blue-200 hover:shadow-2xl hover:shadow-blue-300"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Package Selection */}
        {currentStep === 3 && (
          <div className="animate-in fade-in-50 slide-in-from-right-4 duration-700">
            <div className="flex items-center mb-8">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mr-4">
                <span className="text-white text-xl">📦</span>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-gray-800">Choose Your Package</h2>
                <p className="text-gray-500">Select the plan that fits your needs</p>
              </div>
            </div>

            {isLoadingPlans ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <p className="mt-2 text-gray-500">Loading plans...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {(plans.length > 0 ? plans : packages).map((pkg, index) => {
                  const isApiPlan = plans.length > 0

                  const displayPkg = isApiPlan
                    ? {
                        id: (pkg as any)._id || (pkg as any).id,
                        name: (pkg as any).name,
                        description: (pkg as any).description || "Package plan",
                        sessions: (pkg as any).sessionsPerMonth || 8,
                        sessionsPerWeek: (pkg as any).sessionsPerWeek || 2,
                        duration: (pkg as any).duration || 30,
                        price: (pkg as any).price ?? (pkg as any).pricePerSession ?? 0,
                        currency: (pkg as any).currency ?? 'USD',
                        features: (pkg as any).features ?? (pkg as any).details ?? [],
                        popular: index === 1,
                      }
                    : { ...(pkg as any), currency: (pkg as any).currency || 'USD' }

                  const sessionDuration = ((displayPkg as any).duration || 30) / ((displayPkg as any).sessions || 8) * 30
                  const pricePerSession = ((displayPkg as any).price || 0) / ((displayPkg as any).sessions || 1)

                  return (
                    <div
                      key={(displayPkg as any).id}
                      className={`relative bg-white rounded-xl p-5 cursor-pointer transition-all duration-300 border-2 hover:shadow-lg ${
                        formData.package.type === (displayPkg as any).id
                          ? "border-blue-500 shadow-lg"
                          : "border-gray-200 hover:border-blue-300"
                      }`}
                      onClick={() => selectPackage(displayPkg)}
                    >
                      <div className="mb-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="text-lg md:text-xl font-bold text-gray-800">{(displayPkg as any).name}</h3>
                          <div className="bg-gray-100 rounded px-1.5 py-0.5 text-[9px] leading-tight text-gray-600 shrink-0 self-start">
                            {(displayPkg as any).duration || 30} Days Course Duration
                          </div>
                        </div>
                        <p className="text-xs md:text-sm text-gray-500 line-clamp-2">{(displayPkg as any).description}</p>
                      </div>

                      <div className="mb-4">
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl md:text-4xl font-bold text-gray-800">
                            ${(displayPkg as any).price || 0}
                          </span>
                          <span className="text-sm text-gray-500">/ course</span>
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-start text-sm text-gray-700">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2 mt-1.5 flex-shrink-0"></span>
                          <span>{(displayPkg as any).sessions || 0} sessions per month</span>
                        </div>
                        <div className="flex items-start text-sm text-gray-700">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2 mt-1.5 flex-shrink-0"></span>
                          <span>{(displayPkg as any).sessionsPerWeek || 0} sessions per week</span>
                        </div>
                        <div className="flex items-start text-sm text-gray-700">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2 mt-1.5 flex-shrink-0"></span>
                          <span>{Math.round(sessionDuration)} minutes per session</span>
                        </div>
                        <div className="flex items-start text-sm text-gray-700">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2 mt-1.5 flex-shrink-0"></span>
                          <span>{(displayPkg as any).currency || 'USD'} {(displayPkg as any).price || 0} total</span>
                        </div>
                        {(() => {
                          const features = (displayPkg as any).features || []
                          const featuresArr: string[] = Array.isArray(features) 
                            ? features.map((f: any) => typeof f === 'string' ? f : (f?.title || f?.name || ''))
                            : typeof features === 'string' 
                            ? features.split(',').map((s: string) => s.trim())
                            : []
                          
                          return featuresArr.filter(Boolean).map((feature: string, idx: number) => (
                            <div key={idx} className="flex items-start text-sm text-gray-700">
                              <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2 mt-1.5 flex-shrink-0"></span>
                              <span>{feature}</span>
                            </div>
                          ))
                        })()}
                      </div>

                      <button
                        className={`w-full py-2.5 rounded-lg font-semibold transition-all duration-300 text-sm ${
                          formData.package.type === (displayPkg as any).id
                            ? "bg-blue-500 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        Select Package
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="flex justify-between">
              <button
                onClick={() => previousStep(3)}
                className="px-8 py-4 bg-gray-100 text-gray-700 rounded-2xl font-semibold hover:bg-gray-200 transition-all duration-300"
              >
                ← Back
              </button>
              <button
                onClick={() => nextStep(3)}
                className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-2xl font-semibold hover:scale-105 transform transition-all duration-300 shadow-xl shadow-blue-200"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Schedule Selection */}
        {currentStep === 4 && (
          <div className="animate-in fade-in-50 slide-in-from-right-4 duration-700">
            <div className="flex items-center mb-8">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mr-4">
                <span className="text-white text-xl">📅</span>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-gray-800">Schedule Your Sessions</h2>
                <p className="text-gray-500">Pick your preferred dates and times</p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-4 mb-8 border border-amber-200">
              <div className="flex items-center">
                <span className="text-2xl mr-3" aria-hidden>{countryFlag}</span>
                <p className="font-semibold text-amber-800">Your timezone: {userTimezone}</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-teal-50 rounded-3xl p-8 mb-8 border border-green-200">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-2xl font-semibold text-gray-800 flex items-center">
                  <span className="w-8 h-8 bg-green-500 rounded-xl flex items-center justify-center mr-3">
                    <span className="text-white text-sm">✓</span>
                  </span>
                  Selected Sessions
                </h4>
                <div className="bg-white rounded-2xl px-4 py-2 shadow-sm border">
                  <span className="font-bold text-green-600">{selectedSessions.length}</span>
                  <span className="text-gray-500"> / </span>
                  <span className="font-bold text-gray-700">{maxSessions}</span>
                </div>
              </div>

              <div className="space-y-4">
                {selectedSessions.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl text-gray-400">📅</span>
                    </div>
                    <p className="text-gray-500 font-medium">No sessions selected yet</p>
                    <p className="text-gray-400 text-sm">Choose dates and times from the calendar above</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    {selectedSessions
                      .sort((a, b) => {
                        const dateA = new Date(`${a.date}T${a.time}:00`)
                        const dateB = new Date(`${b.date}T${b.time}:00`)
                        return dateA.getTime() - dateB.getTime()
                      })
                      .map((session, index) => {
                        const date = new Date(`${session.date}T${session.time}:00`)
                        return (
                          <div
                            key={index}
                            className="bg-white rounded-2xl p-3 md:p-4 shadow-sm border border-green-200 flex items-center justify-between hover:shadow-md transition-all duration-300"
                          >
                            <div className="flex items-center">
                              <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                              <div>
                                <p className="font-semibold text-gray-800">
                                  {date.toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    weekday: "short",
                                  })}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedSessions((prev) => prev.filter((_, i) => i !== index))
                              }}
                              className="w-8 h-8 bg-red-100 hover:bg-red-200 text-red-600 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110"
                            >
                              ×
                            </button>
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl p-8 mb-8 border border-gray-200">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-8">
                <h3 className="text-xl md:text-2xl font-semibold text-gray-800">
                  {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </h3>
                <div className="flex gap-2 md:gap-3">
                  <button
                    onClick={() => changeMonth(-1)}
                    className="p-2 md:p-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-2xl hover:scale-105 transition-all duration-300 shadow-lg"
                  >
                    <span className="text-lg">←</span>
                  </button>
                  <button
                    onClick={() => changeMonth(1)}
                    className="p-2 md:p-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-2xl hover:scale-105 transition-all duration-300 shadow-lg"
                  >
                    <span className="text-lg">→</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-2 md:gap-4 mb-4 text-xs md:text-base">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="text-center font-bold text-gray-500 p-2">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2 md:gap-4">{generateCalendar()}</div>
            </div>

            {selectedDate && (
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-3xl p-8 mb-8 border border-blue-200">
                <h3 className="text-2xl font-semibold mb-6 text-gray-800">
                  Select Time Slots for{" "}
                  {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </h3>

                {(() => {
                  const selectedDateObj = new Date(selectedDate)
                  const weekStart = new Date(selectedDateObj)
                  weekStart.setDate(selectedDateObj.getDate() - selectedDateObj.getDay())
                  const weekEnd = new Date(weekStart)
                  weekEnd.setDate(weekStart.getDate() + 6)
                  
                  const sessionsPerWeek = formData.package.sessionsPerWeek || 2
                  const sessionsInWeek = selectedSessions.filter(session => {
                    const sessionDate = new Date(session.date)
                    return sessionDate >= weekStart && sessionDate <= weekEnd
                  }).length
                  
                  return (
                    <div className="bg-white rounded-2xl p-4 mb-6 border border-blue-100">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm text-gray-600">Week Period:</p>
                          <p className="font-semibold text-gray-800">
                            {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Sessions Used:</p>
                          <p className={`font-bold text-lg ${sessionsInWeek >= sessionsPerWeek ? 'text-orange-600' : 'text-green-600'}`}>
                            {sessionsInWeek} / {sessionsPerWeek}
                          </p>
                        </div>
                      </div>
                      {sessionsInWeek >= sessionsPerWeek && (
                        <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-xl">
                          <p className="text-sm text-orange-800 flex items-center">
                            <span className="mr-2">⚠️</span>
                            Weekly limit reached for this week. Select dates from other weeks.
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })()}

                <p className="text-gray-600 mb-6">
                  Choose your preferred 30-minute sessions (combine for 60-minute sessions)
                </p>
                {isLoadingSlots ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-500">Loading available time slots...</p>
                  </div>
                ) : (
                  <div className="max-h-[60vh] overflow-y-auto pr-1">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-3">
                      {generateTimeSlots()}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between mt-10">
              <button
                onClick={() => previousStep(4)}
                className="px-8 py-4 bg-gray-100 text-gray-700 rounded-2xl font-semibold hover:bg-gray-200 transition-all duration-300"
                disabled={isSubmitting}
              >
                ← Back
              </button>
              <button
                onClick={() => nextStep(4)}
                disabled={isSubmitting}
                className="px-8 py-4 bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-2xl font-semibold hover:scale-105 transform transition-all duration-300 shadow-xl shadow-green-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isSubmitting ? "Processing..." : "Complete Registration ✓"}
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Confirmation */}
        {currentStep === 5 && (
          <div className="animate-in fade-in-50 zoom-in-95 duration-700 text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-teal-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-green-200 animate-pulse">
              <span className="text-white text-4xl">✓</span>
            </div>

            <h2 className="text-4xl font-bold text-gray-800 mb-4">Registration Complete!</h2>
            <p className="text-xl text-gray-600 mb-2">Welcome to Bayan School</p>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              Your enrollment has been successfully processed. Check your email for confirmation details and calendar
              invitations.
            </p>

            <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-3xl p-8 mb-10 max-w-lg mx-auto border border-gray-200">
              <h3 className="text-2xl font-semibold mb-6 text-gray-800 flex items-center justify-center">
                <span className="w-8 h-8 bg-blue-500 rounded-xl flex items-center justify-center mr-3">
                  <span className="text-white text-sm">📋</span>
                </span>
                Enrollment Summary
              </h3>

              <div className="space-y-4 text-left">
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-gray-600">Student Name</span>
                  <span className="font-semibold text-gray-800">
                    {formData.personal.firstName} {formData.personal.lastName}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-gray-600">Email</span>
                  <span className="font-semibold text-gray-800">{formData.personal.email}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-gray-600">Package</span>
                  <span className="font-semibold text-blue-600">{formData.package.name}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">Sessions Scheduled</span>
                  <span className="font-semibold text-green-600">{selectedSessions.length} sessions</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={resetForm}
                className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-2xl font-semibold hover:scale-105 transform transition-all duration-300 shadow-xl shadow-blue-200"
              >
                New Registration
              </button>
              <button
                onClick={printSummary}
                className="px-8 py-4 bg-gray-100 text-gray-700 rounded-2xl font-semibold hover:bg-gray-200 transition-all duration-300"
              >
                Print Summary
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-2xl shadow-2xl transform transition-all duration-500 ease-out max-w-md ${
          toast.show ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
        } ${
          toast.type === 'success' 
            ? 'bg-gradient-to-r from-green-500 to-teal-600 text-white' 
            : toast.type === 'error'
            ? 'bg-gradient-to-r from-red-500 to-pink-600 text-white'
            : 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
        }`}>
          <div className="flex items-center">
            <span className="text-xl mr-3">
              {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}
            </span>
            <p className="font-semibold flex-1">{toast.message}</p>
            <button
              onClick={() => setToast(prev => ({ ...prev, show: false }))}
              className="ml-4 text-white hover:text-gray-200 font-bold text-lg"
            >
              ×
            </button>
          </div>
          {toast.type === 'error' && toast.message.includes('failed') && (
            <div className="mt-3 pt-3 border-t border-white/20">
              <button
                onClick={resetForm}
                className="text-sm text-white/90 hover:text-white underline transition-colors duration-200"
              >
                Start Over ↺
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default EnhancedEnrollmentForm
