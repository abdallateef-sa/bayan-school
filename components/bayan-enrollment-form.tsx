"use client"

import React, { useState, useEffect } from "react"
import type { PersonalInfo, SelectedPackage, Session } from "@/types/enrollment"
import { AppointmentAPI, type Plan as ApiPlan } from "@/lib/appointment-api"
import { getTimezoneForUSState } from "@/lib/us-timezones"
import { fetchCountryStates } from "@/lib/geo"
import { getTimezoneForRegion } from "@/lib/region-timezones"

interface FormData {
  personal: PersonalInfo
  package: SelectedPackage  
  sessions: Session[]
}

const BayanEnrollmentForm = () => {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<FormData>({
    personal: {} as PersonalInfo,
    package: {} as SelectedPackage,
    sessions: [],
  })
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSessions, setSelectedSessions] = useState<Session[]>([])
  const [maxSessions, setMaxSessions] = useState(0)
  const [userTimezone, setUserTimezone] = useState("")
  const [countries, setCountries] = useState<Array<{value: string, label: string}>>([])
  const [loadingCountries, setLoadingCountries] = useState(false)
  const [usState, setUsState] = useState("")
  const [stateOptions, setStateOptions] = useState<Array<{ name: string; code?: string }>>([])

  // Persist timezone to profile if JWT available
  const persistTimezone = async (country?: string, timezone?: string) => {
    try {
      const jwt =
        (typeof window !== 'undefined' && (localStorage.getItem('token') || localStorage.getItem('jwt') || localStorage.getItem('authToken'))) ||
        ''
      if (!jwt) return
      const payload: any = {}
      if (country) payload.country = country
      if (timezone) payload.timezone = timezone
      if (Object.keys(payload).length === 0) return
      await AppointmentAPI.updateUserProfile(jwt, payload)
    } catch {}
  }

  // Format price using plan currency without converting values
  const formatPrice = (price: number | undefined | null, currency?: string) => {
    if (price == null) return "N/A"
    // Return TBD if price is 0
    if (price === 0) return "TBD"
    
    const curr = currency || 'USD'
    try {
      const nf = new Intl.NumberFormat(undefined, { style: 'currency', currency: curr, minimumFractionDigits: 0 })
      const parts = nf.formatToParts(price)
      // Find currency symbol (e.g., $)
      const symbolPart = parts.find(p => p.type === 'currency')
      const symbol = symbolPart ? symbolPart.value : ''
      // Use numeric portion (integer/decimal)
      const number = parts.filter(p => p.type === 'integer' || p.type === 'group' || p.type === 'decimal' || p.type === 'fraction').map(p => p.value).join('')
      return `${number}${symbol} ${curr}`
    } catch (e) {
      return `${Number(price).toLocaleString()} ${curr}`
    }
  }

  useEffect(() => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    setUserTimezone(timezone)
    // Load countries from API
    fetchCountries()
  }, [])

  // When country changes, load regions/states if available; clear otherwise
  useEffect(() => {
    const selected = formData.personal.country || ''
    if (selected && selected !== 'other') {
      fetchCountryStates(selected)
        .then((states) => setStateOptions(states || []))
        .catch(() => setStateOptions([]))
    } else {
      setStateOptions([])
      setUsState("")
    }
  }, [formData.personal.country])

  // Country code to flag builder (more robust than relying on backend emoji)
  const flagFor = (code: string) => code.replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)))

  // Fallback curated countries list used when backend is unavailable
  const normalizeCountryName = (raw: string) => {
    const s = (raw || '').trim()
    const lower = s.toLowerCase()
    if (lower === 'united states of america' || lower === 'usa' || lower === 'us') return 'United States'
    if (lower === 'uk' || lower === 'great britain' || lower === 'gb') return 'United Kingdom'
    if (lower === 'united arab emirates' || lower === 'uae') return 'UAE'
    return s
  }

  const getDefaultCountries = () => ([
    { value: "", label: "Select your country" },
    { value: "United States", label: `${flagFor('US')} United States` },
    { value: "United Kingdom", label: `${flagFor('GB')} United Kingdom` },
    { value: "Canada", label: `${flagFor('CA')} Canada` },
    { value: "Egypt", label: `${flagFor('EG')} Egypt` },
    { value: "Saudi Arabia", label: `${flagFor('SA')} Saudi Arabia` },
    { value: "UAE", label: `${flagFor('AE')} UAE` },
    { value: "Germany", label: `${flagFor('DE')} Germany` },
    { value: "France", label: `${flagFor('FR')} France` },
    { value: "India", label: `${flagFor('IN')} India` },
    { value: "Pakistan", label: `${flagFor('PK')} Pakistan` },
    { value: "Australia", label: `${flagFor('AU')} Australia` },
    { value: "other", label: `🌍 Other` },
  ])

  const fetchCountries = async () => {
    setLoadingCountries(true)
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'
      // Fetch all supported countries from backend - backend should provide IANA timezones per country
      const response = await fetch(`${apiBaseUrl}/countries`)
      const data = await response.json()

      if (data?.status === 'success' && data?.data?.countries && Array.isArray(data.data.countries)) {
        // Curate important countries only
        const preferred = new Set(['United States','United Kingdom','Canada','Egypt','Saudi Arabia','UAE','Germany','France','India','Pakistan','Australia'])
        const ordered = ['United States','United Kingdom','Canada','Egypt','Saudi Arabia','UAE','Germany','France','India','Pakistan','Australia']
        const codeFor: Record<string,string> = { 'United States':'US', 'United Kingdom':'GB', 'Canada':'CA', 'Egypt':'EG', 'Saudi Arabia':'SA', 'UAE':'AE', 'Germany':'DE', 'France':'FR', 'India':'IN', 'Pakistan':'PK', 'Australia':'AU' }
        const curated = data.data.countries
          .map((c: any) => ({ ...c, normName: normalizeCountryName(c.name) }))
          .filter((c: any) => preferred.has(c.normName))
          .sort((a: any, b: any) => ordered.indexOf(a.normName) - ordered.indexOf(b.normName))
          .map((c: any) => {
            const code = (c.code || c.iso2 || codeFor[c.normName] || '').toUpperCase()
            const emoji = code && code.length === 2 ? flagFor(code) : '🌍'
            return { value: c.normName, label: `${emoji} ${c.normName}` }
          })
        setCountries([{ value: "", label: "Select your country" }, ...curated, { value: "other", label: "🌍 Other" }])
        // Successfully loaded curated countries
      } else {
        // Invalid response, using defaults
        setCountries(getDefaultCountries())
      }
    } catch (error) {
      console.error('Failed to fetch countries:', error)
      setCountries(getDefaultCountries())
    } finally {
      setLoadingCountries(false)
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

  // Backend plans override local fallback packages when available
  const [plans, setPlans] = useState<ApiPlan[] | null>(null)
  const [loadingPlans, setLoadingPlans] = useState(false)

  useEffect(() => {
    let mounted = true
    const loadPlans = async () => {
      setLoadingPlans(true)
      try {
        const res = await AppointmentAPI.getPlans()
        if ((res as any)?.success && Array.isArray((res as any).plans)) {
          const apiPlans = (res as any).plans as ApiPlan[]
          if (mounted) setPlans(apiPlans)
        }
      } catch (e) {
        console.error('Failed to load plans from API', e)
      } finally {
        if (mounted) setLoadingPlans(false)
      }
    }

    loadPlans()
    return () => { mounted = false }
  }, [])

  const mapApiPlanToUi = (p: ApiPlan) => ({
    id: p._id || p.id || String(p.name),
    name: p.name,
    description: p.description || "",
    sessions: p.sessionsPerMonth ?? p.sessionsPerMonth ?? 0,
    price: p.price ?? p.pricePerSession ?? 0,
    currency: p.currency || 'USD',
    popular: false,
    details: Array.isArray((p as any).features) ? (p as any).features : [],
  })

  type UiPackage = {
    id: string
    name: string
    description?: string
    sessions: number
    price: number
    currency?: string
    popular?: boolean
    details: string[]
  }

  const effectivePackages: UiPackage[] = plans && plans.length > 0 ? plans.map(mapApiPlanToUi) as UiPackage[] : packages as UiPackage[]

  const nextStep = (step: number) => {
    if (step === 1) {
      const requiredFields: (keyof PersonalInfo)[] = ["firstName", "lastName", "gender", "email", "country", "phone"]
      const isValid = requiredFields.every((field) => formData.personal[field])

      if (!isValid) {
        alert("Please fill in all required fields")
        return
      }
    } else if (step === 2) {
      if (!formData.package.type) {
        alert("Please select a package")
        return
      }
    } else if (step === 3) {
      const totalRequired = maxSessions
      if (selectedSessions.length < totalRequired) {
        alert(`Please select ${totalRequired} sessions`)
        return
      }

      // Include UTC instants for backend
      const sessionsWithUTC = selectedSessions.map((s) => {
        // We scheduled in user's timezone view, but source schedule is Cairo.
        // Use the central util to compute UTC based on Cairo date/time derived from user's slot.
        // For simplicity here, we compute UTC from Cairo local time by mapping back using the displayed Cairo slot stored in key.
        // If not available, fall back to date+time as local to UTC.
        try {
          const [h, m] = s.time.split(':').map((n) => parseInt(n, 10))
          const iso = new Date(`${s.date}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00Z`).toISOString()
          return { ...s, startsAtUTC: iso }
        } catch {
          return { ...s }
        }
      })

      setFormData((prev) => ({ ...prev, sessions: sessionsWithUTC as any }))
    }

    setCurrentStep(step + 1)
  }

  const previousStep = (step: number) => {
    setCurrentStep(step - 1)
  }

  const updatePersonalInfo = (field: keyof PersonalInfo, value: string) => {
    setFormData((prev) => ({
      ...prev,
      personal: { ...prev.personal, [field]: value },
    }))

    if (field === 'country') {
      // Reset region when country changes
      setUsState("")
      // Prefer our region mapping first (returns defaults for single-zone countries)
      if (value && value !== 'other') {
        const guessTz = getTimezoneForRegion(value)
        if (guessTz) {
          setUserTimezone(guessTz)
          persistTimezone(value, guessTz)
        } else {
          // Fallback to backend representative timezone
          AppointmentAPI.getCountryTimezone(value).then((res) => {
            if ((res as any)?.success && (res as any).timezone) {
              const tz = (res as any).timezone as string
              setUserTimezone(tz)
              persistTimezone(value, tz)
            }
          }).catch(() => {})
        }
      }
    }
  }

  const selectPackage = (pkg: any) => {
    setFormData((prev) => ({
      ...prev,
      package: {
        name: pkg.name,
        type: pkg.id,
        sessions: pkg.sessions,
      },
    }))
    setMaxSessions(pkg.sessions)
  }

  const generateCalendar = () => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const days = []

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="w-12 h-12"></div>)
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      const isPast = date < today
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      const isSelected = selectedSessions.some((s) => s.date === dateStr)
      const isCurrentlySelected = selectedDate === dateStr

      days.push(
        <div
          key={day}
          className={`w-12 h-12 flex items-center justify-center rounded-2xl cursor-pointer transition-all duration-300 text-sm font-semibold ${
            isPast
              ? "bg-gray-50 text-gray-300 cursor-not-allowed"
              : isCurrentlySelected
                ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-xl scale-110 shadow-blue-200"
                : isSelected
                  ? "bg-gradient-to-br from-blue-50 to-purple-50 text-blue-600 border-2 border-blue-200"
                  : "bg-white text-gray-700 border-2 border-gray-100 hover:border-blue-200 hover:bg-gradient-to-br hover:from-blue-50 hover:to-purple-50 hover:scale-105 hover:shadow-lg"
          }`}
          onClick={isPast ? undefined : () => selectDate(dateStr)}
        >
          {day}
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

  const selectDate = (date: string) => {
    setSelectedDate(date)
  }

  const generateTimeSlots = () => {
    if (!selectedDate) return []

    const slots: JSX.Element[] = []
    
    // Define working hours in Egypt timezone (Cairo)
    const egyptStartHour = 0   // 8:00 AM Egypt time
    const egyptEndHour = 23   // 7:00 PM Egypt time (last slot at 7:30 PM)
    const egyptEndMinute = 30 // 7:30 PM Egypt time
    
  // Use the selected/detected user timezone
  const tz = userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone
    
    // Generate slots for the Egypt working hours and convert to user's timezone
    for (let egyptHour = egyptStartHour; egyptHour <= egyptEndHour; egyptHour++) {
      const maxMinute = egyptHour === egyptEndHour ? egyptEndMinute : 30
      
      for (let minute = 0; minute <= maxMinute; minute += 30) {
        // Create a date object representing the Egypt time
        const egyptDateTimeString = `${selectedDate}T${String(egyptHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+02:00`
        const egyptDateTime = new Date(egyptDateTimeString)
        
        // Convert to user's local timezone
  const userLocalDateTime = new Date(egyptDateTime.toLocaleString("en-US", { timeZone: tz }))
        
        // Extract hour and minute in user's timezone
        const userDateTimeFormatted = egyptDateTime.toLocaleString("en-US", { 
          timeZone: tz,
          hour12: false,
          hour: '2-digit',
          minute: '2-digit'
        })
        
        const [userHourStr, userMinuteStr] = userDateTimeFormatted.split(':')
        const userHour = parseInt(userHourStr)
        const userMinute = parseInt(userMinuteStr)
        
        const time = `${String(userHour).padStart(2, '0')}:${String(userMinute).padStart(2, '0')}`
        const displayTime = formatTime(userHour, userMinute)
        const isSelected = selectedSessions.some((s) => s.date === selectedDate && s.time === time)

        slots.push(
          <div
            key={`${selectedDate}-${time}`}
            className={`px-4 py-3 rounded-2xl cursor-pointer transition-all duration-300 text-center font-medium text-sm border-2 ${
              isSelected
                ? "border-blue-500 bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg transform scale-105"
                : "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-gradient-to-br hover:from-blue-50 hover:to-purple-50 hover:scale-105 hover:shadow-md"
            }`}
            onClick={() => toggleTimeSlot(time)}
          >
            <div className="flex flex-col">
              <span>{displayTime}</span>
              <span className="text-xs opacity-75">
                ({formatEgyptTime(egyptHour, minute)} Cairo)
              </span>
            </div>
          </div>,
        )
      }
    }

    return slots
  }

  // Helper function to format Egypt time display
  const formatEgyptTime = (hour: number, minute: number) => {
    const period = hour >= 12 ? "PM" : "AM"
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
    return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`
  }

  // Enhanced formatTime function
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
      setSelectedSessions((prev) => prev.filter((_, index) => index !== existingIndex))
    } else {
      if (selectedSessions.length < totalAllowed) {
        setSelectedSessions((prev) => [...prev, { date: selectedDate, time }])
      } else {
        alert(`You can only select ${totalAllowed} sessions`)
      }
    }
  }

  const resetForm = () => {
    setFormData({ 
      personal: {} as PersonalInfo, 
      package: {} as SelectedPackage, 
      sessions: [] 
    })
    setSelectedSessions([])
    setSelectedDate(null)
    setMaxSessions(0)
    setCurrentStep(1)
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

  const progressPercentage = (currentStep - 1) * 33.33
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-100 flex items-center justify-center p-4">
      {/* Scoped style for progress width to avoid inline style lint */}
      <style>{`:root { --progress-width: ${progressPercentage}%; } .bayan-progress-fill { width: var(--progress-width); }`}</style>

    return (
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

        {/* Enhanced Progress Bar */}
        <div className="mb-12">
          <div className="flex justify-between items-center mb-4">
            {[1, 2, 3, 4].map((step) => (
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
                  {step === 1 ? "Personal" : step === 2 ? "Package" : step === 3 ? "Schedule" : "Complete"}
                </span>
              </div>
            ))}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-700 ease-out bayan-progress-fill"
            ></div>
          </div>
        </div>

        {/* Step 1: Personal Information */}
        {currentStep === 1 && (
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
                  onChange={(e) => updatePersonalInfo("gender", e.target.value)}
                  aria-label="Select gender"
                  title="Select your gender"
                >
                  <option value="">Select your gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 flex items-center">
                  Email Address <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="email"
                  className="w-full px-4 py-4 bg-gray-50 border-0 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all duration-300 text-gray-800 placeholder-gray-400"
                  placeholder="your.email@example.com"
                  value={formData.personal.email || ""}
                  onChange={(e) => updatePersonalInfo("email", e.target.value)}
                />
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
                    {formData.personal.country && formData.personal.country !== 'other' && stateOptions.length > 0 && (
                      <select
                        className="w-full px-4 py-4 bg-gray-50 border-0 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all duration-300 text-gray-800"
                        value={usState}
                        onChange={(e) => {
                          const stateName = e.target.value
                          setUsState(stateName)
                          const country = formData.personal.country || ''
                          let tz: string | undefined
                          if (country === 'United States') {
                            tz = getTimezoneForUSState(stateName)
                          } else {
                            tz = getTimezoneForRegion(country, stateName)
                          }
                          if (tz) {
                            setUserTimezone(tz)
                            persistTimezone(country, tz)
                          } else if (country) {
                            AppointmentAPI.getCountryTimezone(country).then((res) => {
                              if ((res as any)?.success && (res as any).timezone) {
                                const tz2 = (res as any).timezone as string
                                setUserTimezone(tz2)
                                persistTimezone(country, tz2)
                              }
                            }).catch(() => {})
                          }
                        }}
                        aria-label="Select region/state"
                        title="Select region/state"
                      >
                        <option value="">Select region/state</option>
                        {stateOptions.map((s) => (
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
            </div>

            <div className="flex justify-between mt-10">
              <button
                onClick={async () => {
                  if (!('geolocation' in navigator)) return alert('Geolocation not supported')
                  navigator.geolocation.getCurrentPosition(async (pos) => {
                    try {
                      const { latitude, longitude } = pos.coords
                      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`)
                      const data = await res.json()
                      const addr = data?.address || {}
                      const countryName = normalizeCountryName(addr.country || '')
                      if (countryName) updatePersonalInfo('country', countryName)
                      const regionName = addr.state || addr.region || addr.county || ''
                      if (countryName && regionName) {
                        setUsState(regionName)
                        const tz = countryName === 'United States' 
                          ? getTimezoneForUSState(regionName) 
                          : getTimezoneForRegion(countryName, regionName)
                        if (tz) {
                          setUserTimezone(tz)
                          persistTimezone(countryName, tz)
                        }
                      }
                    } catch {}
                  }, () => alert('Location permission denied'))
                }}
                className="px-4 py-3 bg-gray-100 text-gray-700 rounded-2xl font-semibold hover:bg-gray-200 transition-all duration-300"
              >
                Detect timezone & location
              </button>
              <button
                onClick={() => nextStep(1)}
                className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-2xl font-semibold hover:scale-105 transform transition-all duration-300 shadow-xl shadow-blue-200 hover:shadow-2xl hover:shadow-blue-300"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Package Selection */}
        {currentStep === 2 && (
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {effectivePackages.slice(0, 3).map((pkg) => (
                <div
                  key={pkg.id}
                  className={`relative p-6 rounded-3xl cursor-pointer transition-all duration-300 border-2 hover:scale-105 hover:shadow-2xl ${
                    formData.package.type === pkg.id
                      ? "border-blue-500 bg-gradient-to-br from-blue-50 to-purple-50 shadow-xl shadow-blue-200"
                      : "border-gray-200 bg-white hover:border-blue-300 hover:shadow-xl"
                  }`}
                  onClick={() => selectPackage(pkg)}
                >
                  {pkg.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-gradient-to-r from-orange-400 to-pink-500 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
                        Most Popular
                      </span>
                    </div>
                  )}

                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">{pkg.name}</h3>
                    <p className="text-gray-500 mb-6">{pkg.description}</p>

                    <div className="mb-6">
                      <span className="text-4xl font-bold text-blue-600">{formatPrice(pkg.price, (pkg as any).currency)}</span>
                      <span className="text-gray-500">/month</span>
                    </div>

                    <div className="space-y-3">
                      {pkg.details.map((detail: string, index: number) => (
                        <div key={index} className="flex items-center text-sm text-gray-600">
                          <span className="w-2 h-2 bg-green-400 rounded-full mr-3 flex-shrink-0"></span>
                          {detail}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-3xl p-6 mb-8">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Alternative Packages</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {effectivePackages.slice(3).map((pkg) => (
                  <div
                    key={pkg.id}
                    className={`p-6 rounded-2xl cursor-pointer transition-all duration-300 border-2 hover:scale-105 ${
                      formData.package.type === pkg.id
                        ? "border-blue-500 bg-white shadow-lg"
                        : "border-gray-200 bg-white hover:border-blue-300 hover:shadow-lg"
                    }`}
                    onClick={() => selectPackage(pkg)}
                  >
                    <h4 className="text-xl font-bold text-gray-800 mb-2">{pkg.name}</h4>
                    <p className="text-gray-500 mb-4">{pkg.description}</p>
                    <div className="mb-4">
                      <span className="text-2xl font-bold text-blue-600">
                        {formatPrice(pkg.price, (pkg as any).currency)}
                        {pkg.id === "custom2" ? "/hour" : "/month"}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {pkg.details.map((detail: string, index: number) => (
                        <div key={index} className="flex items-center text-sm text-gray-600">
                          <span className="w-2 h-2 bg-green-400 rounded-full mr-3 flex-shrink-0"></span>
                          {detail}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => previousStep(2)}
                className="px-8 py-4 bg-gray-100 text-gray-700 rounded-2xl font-semibold hover:bg-gray-200 transition-all duration-300"
              >
                ← Back
              </button>
              <button
                onClick={() => nextStep(2)}
                className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-2xl font-semibold hover:scale-105 transform transition-all duration-300 shadow-xl shadow-blue-200"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Schedule Selection */}
        {currentStep === 3 && (
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
                  <p className="text-sm text-amber-600">
                    Available hours: 8:00 AM - 7:30 PM (Cairo time) • Times shown in your local timezone
                  </p>
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
                <p className="text-gray-600 mb-6">
                  Available hours: 8:00 AM - 7:30 PM Cairo time. Choose your preferred 30-minute sessions (times shown in your timezone)
                </p>
                <div className="max-h-[60vh] overflow-y-auto pr-1">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                    {generateTimeSlots()}
                  </div>
                </div>
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
                        return new Date(dateA).getTime() - new Date(dateB).getTime()
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
                onClick={() => previousStep(3)}
                className="px-8 py-4 bg-gray-100 text-gray-700 rounded-2xl font-semibold hover:bg-gray-200 transition-all duration-300"
              >
                ← Back
              </button>
              <button
                onClick={() => nextStep(3)}
                className="px-8 py-4 bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-2xl font-semibold hover:scale-105 transform transition-all duration-300 shadow-xl shadow-green-200"
              >
                Complete Registration ✓
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Confirmation */}
        {currentStep === 4 && (
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

            {/* Action Buttons */}
            <div className="space-y-6 max-w-2xl mx-auto mb-8">
              {/* WhatsApp & PayPal Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <a
                  href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}?text=Hi, I just completed my registration at Bayan School. My name is ${formData.personal.firstName} ${formData.personal.lastName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-2xl font-semibold hover:scale-105 transform transition-all duration-300 shadow-xl shadow-green-200"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  <span>Contact on WhatsApp</span>
                </a>
                
                <a
                  href={`https://www.paypal.com/paypalme/${process.env.NEXT_PUBLIC_PAYPAL_USERNAME}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl font-semibold hover:scale-105 transform transition-all duration-300 shadow-xl shadow-blue-200"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 0 1 .923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.777-4.471z"/>
                  </svg>
                  <span>Pay Now with PayPal</span>
                </a>
              </div>

              {/* Other Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={resetForm}
                  className="px-8 py-4 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-2xl font-semibold hover:scale-105 transform transition-all duration-300 shadow-xl shadow-purple-200"
                >
                  New Registration
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-8 py-4 bg-gray-100 text-gray-700 rounded-2xl font-semibold hover:bg-gray-200 transition-all duration-300"
                >
                  Print Summary
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default BayanEnrollmentForm