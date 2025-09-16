"use client"

import { useState, useEffect } from "react"
import type { EnrollmentData, PersonalInfo, SelectedPackage, Session } from "@/types/enrollment"
import { AppointmentAPI } from "@/lib/appointment-api"

const EnhancedEnrollmentForm = () => {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<EnrollmentData>({
    personal: {} as PersonalInfo,
    package: {} as SelectedPackage,
    sessions: [],
  })
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [otpSent, setOtpSent] = useState(false)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [isLogin, setIsLogin] = useState(true)
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
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [plans, setPlans] = useState<any[]>([])
  const [isLoadingPlans, setIsLoadingPlans] = useState(false)
  const [bookedSlots, setBookedSlots] = useState<{ date: string; time: string }[]>([])
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [countries, setCountries] = useState<Array<{value: string, label: string}>>([])
  const [loadingCountries, setLoadingCountries] = useState(false)

  useEffect(() => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    setUserTimezone(timezone)
    
    // Initialize data loading with optimized batch loading
    initializeData()
    
    // If user is logged in, get their country from backend and update timezone
    if (jwtToken && isLoggedInUser) {
      fetchUserProfileAndUpdateTimezone()
    }
  }, [jwtToken, isLoggedInUser])

  // Optimized data initialization - load all initial data in parallel
  const initializeData = async () => {
    try {
      // Load all initial data in parallel instead of sequential calls
      const [plansResult, slotsResult, countriesResult] = await Promise.all([
        AppointmentAPI.getPlans().catch(() => ({ success: false })),
        AppointmentAPI.getBookedSlots().catch(() => ({ success: false, bookedSlots: [] })),
        fetchCountriesData().catch(() => null)
      ])

      // Handle plans
      if (plansResult.success && 'plans' in plansResult) {
        setPlans(plansResult.plans)
      }
      setIsLoadingPlans(false)

      // Handle booked slots
      if (slotsResult.success && 'bookedSlots' in slotsResult) {
        setBookedSlots(slotsResult.bookedSlots)
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
          { value: "United States", label: "🇺🇸 United States" },
          { value: "United Kingdom", label: "🇬🇧 United Kingdom" },
          { value: "Canada", label: "🇨🇦 Canada" },
          { value: "Australia", label: "🇦🇺 Australia" },
          { value: "Germany", label: "🇩🇪 Germany" },
          { value: "France", label: "🇫🇷 France" },
          { value: "Saudi Arabia", label: "🇸🇦 Saudi Arabia" },
          { value: "UAE", label: "🇦🇪 UAE" },
          { value: "Egypt", label: "🇪🇬 Egypt" },
          { value: "Pakistan", label: "🇵🇰 Pakistan" },
          { value: "India", label: "🇮🇳 India" },
          { value: "Malaysia", label: "🇲🇾 Malaysia" },
          { value: "Indonesia", label: "🇮🇩 Indonesia" },
          { value: "Turkey", label: "🇹🇷 Turkey" },
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
      // Try popular countries first
      let response = await fetch(`${apiBaseUrl}/countries/popular`)
      let data = await response.json()
      
      if (data.status === 'success' && data.data && data.data.popularCountries) {
        return [
          { value: "", label: "Select your country" },
          ...data.data.popularCountries.map((country: any) => ({
            value: country.name,
            label: `🌍 ${country.name}`
          }))
        ]
      } else {
        // Try all countries if popular fails
        response = await fetch(`${apiBaseUrl}/countries`)
        data = await response.json()
        
        if (data.status === 'success' && data.data && data.data.countries) {
          return [
            { value: "", label: "Select your country" },
            ...data.data.countries.map((country: any) => ({
              value: country.name,
              label: `🌍 ${country.name}`
            }))
          ]
        }
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



  // Update timezone based on user's selected country
  const updateTimezoneFromUserCountry = async (countryName?: string) => {
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'
      
      // Use the provided country or get from form data
      const userCountry = countryName || formData.personal.country
      
      if (userCountry && userCountry !== 'other') {
        const response = await fetch(`${apiBaseUrl}/countries/${encodeURIComponent(userCountry)}/timezone`)
        const data = await response.json()
        
        if (data.status === 'success' && data.data.timezone) {
          setUserTimezone(data.data.timezone)
        }
      }
    } catch (error) {
      // Silent error handling - fallback to browser timezone
    }
  }

  const sendOtp = async () => {
    // Enhanced email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email || !emailRegex.test(email)) {
      showToast("يرجى إدخال عنوان بريد إلكتروني صحيح / Please enter a valid email address", "error")
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
        showToast(`${isLogin ? 'تم إرسال رمز تسجيل الدخول / Login' : 'تم إرسال رمز التسجيل / Registration'} OTP sent to your email address!`, "success")
      } else {
        showToast(`فشل في إرسال الرمز / Failed to send OTP: ${result.error}`, "error")
      }
    } catch (error) {
      showToast("فشل في إرسال الرمز. يرجى المحاولة مرة أخرى / Failed to send OTP. Please try again.", "error")
    } finally {
      setIsSendingOtp(false)
    }
  }

  const verifyOtp = async () => {
    // Enhanced OTP validation
    const otpRegex = /^\d{6}$/
    if (!otp || !otpRegex.test(otp)) {
      showToast("يرجى إدخال رمز صحيح مكون من 6 أرقام / Please enter a valid 6-digit OTP", "error")
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
          showToast("تم تسجيل الدخول بنجاح! مرحباً بك مرة أخرى / Login successful! Welcome back.", "success")
          
          // For existing users, get their profile from database and update timezone
          setTimeout(() => fetchUserProfileAndUpdateTimezone(result.token), 500)
          
          setCurrentStep(3) // Go to package selection
        } else {
          // Registration flow: check token type
          if (result.tempToken) {
            // New user - needs to complete personal info
            setJwtToken(result.tempToken)
            showToast("تم التحقق من الرمز! يرجى إكمال معلوماتك الشخصية / OTP verified! Please complete your personal information.", "success")
            setCurrentStep(2) // Go to personal info
          } else if (result.token) {
            // User already exists but tried to register - treat as login
            setJwtToken(result.token)
            setIsLoggedInUser(true)
            showToast("مرحباً بك مرة أخرى! لديك حساب بالفعل / Welcome back! You already have an account.", "info")
            
            // For existing users, get profile from database and update timezone
            setTimeout(() => fetchUserProfileAndUpdateTimezone(result.token), 500)
            
            setCurrentStep(3) // Go to package selection
          } else {
            showToast("غير قادر على إكمال التحقق. يرجى المحاولة مرة أخرى / Unable to complete verification. Please try again.", "error")
            return
          }
        }
      } else {
        showToast(`فشل في التحقق من الرمز / OTP verification failed: ${result.error}`, "error")
      }
    } catch (error) {
      showToast("فشل في التحقق من الرمز. يرجى المحاولة مرة أخرى / OTP verification failed. Please try again.", "error")
    } finally {
      setIsVerifyingOtp(false)
    }
  }

  const fetchAvailableSlots = async (date: string) => {
    // Generate available slots with timezone conversion from Egypt time to user's local time
    const allSlots: string[] = []
    
    // Define working hours in Egypt timezone (Cairo)
    const egyptStartHour = 8   // 8:00 AM Egypt time
    const egyptEndHour = 19   // 7:00 PM Egypt time (last slot at 7:30 PM)
    const egyptEndMinute = 30 // 7:30 PM Egypt time
    
    // Get user's selected timezone from state (not browser timezone)
    const selectedUserTimezone = userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone
    
    // Better approach: Use proper timezone conversion with Intl.DateTimeFormat
    for (let egyptHour = egyptStartHour; egyptHour <= egyptEndHour; egyptHour++) {
      const maxMinute = egyptHour === egyptEndHour ? egyptEndMinute : 30
      
      for (let minute = 0; minute <= maxMinute; minute += 30) {
        // Create a date object for the Cairo time we want
        const cairoTimeString = `${String(egyptHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
        
        // More direct approach: create the exact time in Cairo and show what it is in user timezone
        const cairoDateString = `2024-01-01T${cairoTimeString}:00`
        const cairoTime = new Date(cairoDateString + '+02:00') // Cairo is UTC+2
        
        const userTime = cairoTime.toLocaleString('en-US', {
          timeZone: selectedUserTimezone,
          hour12: false,
          hour: '2-digit',
          minute: '2-digit'
        })
        
        allSlots.push(userTime)
      }
    }
    
    // Sort slots by time and remove duplicates
    const uniqueSlots = [...new Set(allSlots)].sort()
    setAvailableSlots(uniqueSlots)
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
      const today = new Date()
      const startDate = today.toISOString().split('T')[0] // YYYY-MM-DD format
      
      const sessionsData = selectedSessions.map(session => ({
        date: session.date,
        time: session.time,
        notes: `${formData.package.name} session`
      }))

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
            showToast("⚠️ لديك اشتراك فعال بالفعل في هذه الخطة! / You already have an active subscription to this plan! تواصل مع الدعم لتعديل اشتراكك أو اختر خطة مختلفة / Contact support to modify your subscription or choose a different plan.", "error")
          } else if (result.error.toLowerCase().includes('plan not found')) {
            showToast("❌ الخطة المحددة غير متوفرة / Selected plan is not available. يرجى اختيار خطة أخرى / Please choose another plan.", "error")
          } else if (result.error.toLowerCase().includes('insufficient')) {
            showToast("💳 مشكلة في الدفع / Payment issue. يرجى التحقق من بيانات الدفع / Please check your payment details.", "error")
          } else if (result.error.toLowerCase().includes('network') || result.error.toLowerCase().includes('connection')) {
            showToast("🌐 مشكلة في الاتصال / Network issue. يرجى التحقق من الاتصال والمحاولة مرة أخرى / Please check your connection and try again.", "error")
          } else {
            showToast(`❌ فشل في إنشاء الاشتراك / Failed to create subscription: ${result.error}`, "error")
          }
        } else {
          showToast("❌ حدث خطأ غير متوقع / An unexpected error occurred. يرجى المحاولة مرة أخرى / Please try again.", "error")
        }
        return false
      }

      showToast("🎉 تم إنشاء الاشتراك بنجاح! أهلاً بك في مدرسة بيان / Subscription created successfully! Welcome to Bayan School!", "success")
      return true
    } catch (error) {
      showToast("⚠️ حدث خطأ / An error occurred. يرجى المحاولة مرة أخرى / Please try again.", "error")
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

      // Only complete registration if user is truly new (has tempToken)
      if (jwtToken && !isLoggedInUser) {
        try {
          const result = await AppointmentAPI.completeRegistration(jwtToken, {
            firstName: formData.personal.firstName,
            lastName: formData.personal.lastName,
            phone: formData.personal.phone,
            gender: formData.personal.gender,
            country: formData.personal.country
          })

          if (result.success) {
            setJwtToken(result.token) // Update with permanent token
            setIsLoggedInUser(true) // Now user is fully registered
            showToast("Registration completed successfully! 🎉", "success")
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
    }
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
          className={`w-12 h-12 flex flex-col items-center justify-center rounded-2xl cursor-pointer transition-all duration-300 text-sm font-semibold relative ${
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
          })} - ${new Date().toLocaleDateString('ar-SA-u-ca-islamic', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric'
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
                })} - ${new Date(session.date).toLocaleDateString('ar-SA-u-ca-islamic', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric'
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
              <span class="info-value">${new Date().toLocaleDateString('en-US')} - ${new Date().toLocaleDateString('ar-SA-u-ca-islamic')}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Subscription Status:</span>
              <span class="info-value">Active</span>
            </div>
            ${selectedSessions.length > 0 ? `
            <div class="info-item">
              <span class="info-label">First Session Date:</span>
              <span class="info-value">${new Date(selectedSessions[0].date).toLocaleDateString('en-US')} - ${new Date(selectedSessions[0].date).toLocaleDateString('ar-SA-u-ca-islamic')}</span>
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

    for (const time of availableSlots) {
      const [hour, minute] = time.split(":").map(Number)
      const displayTime = formatTime(hour, minute)
      const isSelected = selectedSessions.some((s) => s.date === selectedDate && s.time === time)
      
      // Check if this slot is booked by another student
      const isBooked = bookedSlots.some((slot) => slot.date === selectedDate && slot.time === time)
      
      // Prevent selection if week is full and slot is not already selected
      const isWeekLimitReached = isWeekFull && !isSelected

      slots.push(
        <div
          key={`${selectedDate}-${time}`}
          className={`px-4 py-3 rounded-2xl transition-all duration-300 text-center font-medium text-sm border-2 ${
            isBooked
              ? "border-red-200 bg-red-50 text-red-400 cursor-not-allowed opacity-60"
              : isWeekLimitReached
              ? "border-orange-200 bg-orange-50 text-orange-400 cursor-not-allowed opacity-60"
              : isSelected
              ? "border-blue-500 bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg transform scale-105 cursor-pointer"
              : "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-gradient-to-br hover:from-blue-50 hover:to-purple-50 hover:scale-105 hover:shadow-md cursor-pointer"
          }`}
          onClick={isBooked || isWeekLimitReached ? undefined : () => toggleTimeSlot(time)}
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

  const toggleTimeSlot = (time: string) => {
    if (!selectedDate) return

    const existingIndex = selectedSessions.findIndex((s) => s.date === selectedDate && s.time === time)
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

      setSelectedSessions((prev) => [...prev, { date: selectedDate, time }])
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
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progressPercentage}%` }}
            ></div>
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
              <div className="flex flex-wrap gap-6 justify-center">
                {(plans.length > 0 ? plans : packages).map((pkg, index) => {
                  // Convert backend plan to frontend format
                  const displayPkg = plans.length > 0 ? {
                    id: pkg._id || pkg.id,
                    name: pkg.name,
                    description: pkg.description || "Package plan",
                    sessions: pkg.sessionsPerMonth || 8,
                    sessionsPerWeek: pkg.sessionsPerWeek || 2,
                    price: Math.round((pkg.price || 1000) / 100), // Convert from cents to dollars
                    popular: index === 1, // Make second plan popular
                    details: [
                      `${pkg.duration || 30}min sessions`,
                      `${pkg.sessionsPerWeek || 2} sessions/week`,
                      `${pkg.sessionsPerMonth || 8} sessions/month`,
                      "Live online sessions"
                    ]
                  } : pkg

                  return (
                    <div
                      key={displayPkg.id}
                      className={`relative p-6 rounded-3xl cursor-pointer transition-all duration-300 border-2 hover:scale-105 hover:shadow-2xl flex-1 min-w-[280px] max-w-[350px] ${
                        formData.package.type === displayPkg.id
                          ? "border-blue-500 bg-gradient-to-br from-blue-50 to-purple-50 shadow-xl shadow-blue-200"
                          : "border-gray-200 bg-white hover:border-blue-300 hover:shadow-xl"
                      }`}
                      onClick={() => selectPackage(displayPkg)}
                    >
                      {displayPkg.popular && (
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                          <span className="bg-gradient-to-r from-orange-400 to-pink-500 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
                            Most Popular
                          </span>
                        </div>
                      )}

                      <div className="text-center">
                        <h3 className="text-2xl font-bold text-gray-800 mb-2">{displayPkg.name}</h3>
                        <p className="text-gray-500 mb-6">{displayPkg.description}</p>

                        <div className="mb-6">
                          <span className="text-4xl font-bold text-blue-600">${displayPkg.price}</span>
                          <span className="text-gray-500">/month</span>
                        </div>

                        <div className="space-y-3">
                          {displayPkg.details.map((detail: string, idx: number) => (
                            <div key={idx} className="flex items-center text-sm text-gray-600">
                              <span className="w-2 h-2 bg-green-400 rounded-full mr-3 flex-shrink-0"></span>
                              {detail}
                            </div>
                          ))}
                        </div>
                      </div>
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
                <span className="text-2xl mr-3">🌍</span>
                <div>
                  <p className="font-semibold text-amber-800">Your timezone: {userTimezone}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl p-8 mb-8 border border-gray-200">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-semibold text-gray-800">
                  {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </h3>
                <div className="flex gap-3">
                  <button
                    onClick={() => changeMonth(-1)}
                    className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-2xl hover:scale-105 transition-all duration-300 shadow-lg"
                  >
                    <span className="text-lg">←</span>
                  </button>
                  <button
                    onClick={() => changeMonth(1)}
                    className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-2xl hover:scale-105 transition-all duration-300 shadow-lg"
                  >
                    <span className="text-lg">→</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-4 mb-4">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="text-center font-bold text-gray-500 p-2">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-4">{generateCalendar()}</div>
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
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                    {generateTimeSlots()}
                  </div>
                )}
              </div>
            )}

            <div className="bg-gradient-to-br from-green-50 to-teal-50 rounded-3xl p-8 border border-green-200">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            className="bg-white rounded-2xl p-4 shadow-sm border border-green-200 flex items-center justify-between hover:shadow-md transition-all duration-300"
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
