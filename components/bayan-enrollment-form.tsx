"use client"

import React, { useState, useEffect } from "react"
import type { PersonalInfo, SelectedPackage, Session } from "@/types/enrollment"

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

  useEffect(() => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    setUserTimezone(timezone)
    // Load countries from API
    fetchCountries()
  }, [])

  // Fallback countries list used when backend is unavailable
  const getDefaultCountries = () => ([
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

  const fetchCountries = async () => {
    setLoadingCountries(true)
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'
      // Fetch all supported countries from backend - backend should provide IANA timezones per country
      const response = await fetch(`${apiBaseUrl}/countries`)
      const data = await response.json()

      if (data?.status === 'success' && data?.data?.countries && Array.isArray(data.data.countries)) {
        const formattedCountries = [
          { value: "", label: "Select your country" },
          ...data.data.countries.map((country: any) => ({
            value: country.name,
            label: `🌍 ${country.name}`
          }))
        ]
        setCountries(formattedCountries)
        console.log('Loaded countries from backend:', formattedCountries.length)
      } else {
        console.warn('Invalid countries response, falling back to defaults')
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

  const sendEmail = () => {
    console.log("Sending email to:", formData.personal.email)
  }

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

      setFormData((prev) => ({ ...prev, sessions: selectedSessions }))
      sendEmail()
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
    const egyptStartHour = 8   // 8:00 AM Egypt time
    const egyptEndHour = 19   // 7:00 PM Egypt time (last slot at 7:30 PM)
    const egyptEndMinute = 30 // 7:30 PM Egypt time
    
    // Get user's timezone
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    
    // Generate slots for the Egypt working hours and convert to user's timezone
    for (let egyptHour = egyptStartHour; egyptHour <= egyptEndHour; egyptHour++) {
      const maxMinute = egyptHour === egyptEndHour ? egyptEndMinute : 30
      
      for (let minute = 0; minute <= maxMinute; minute += 30) {
        // Create a date object representing the Egypt time
        const egyptDateTimeString = `${selectedDate}T${String(egyptHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+02:00`
        const egyptDateTime = new Date(egyptDateTimeString)
        
        // Convert to user's local timezone
        const userLocalDateTime = new Date(egyptDateTime.toLocaleString("en-US", { timeZone: userTimezone }))
        
        // Extract hour and minute in user's timezone
        const userDateTimeFormatted = egyptDateTime.toLocaleString("en-US", { 
          timeZone: userTimezone,
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
              className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progressPercentage}%` }}
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
            </div>

            <div className="flex justify-end mt-10">
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
              {packages.slice(0, 3).map((pkg) => (
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
                      <span className="text-4xl font-bold text-blue-600">${pkg.price}</span>
                      <span className="text-gray-500">/month</span>
                    </div>

                    <div className="space-y-3">
                      {pkg.details.map((detail, index) => (
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
                {packages.slice(3).map((pkg) => (
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
                        ${pkg.price}
                        {pkg.id === "custom2" ? "/hour" : "/month"}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {pkg.details.map((detail, index) => (
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
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                  {generateTimeSlots()}
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

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={resetForm}
                className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-2xl font-semibold hover:scale-105 transform transition-all duration-300 shadow-xl shadow-blue-200"
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
        )}
      </div>
    </div>
  )
}

export default BayanEnrollmentForm