"use client"

import EnhancedEnrollmentForm from "@/components/enhanced-enrollment-form"
import { useEffect } from "react"

export default function LoginPage() {
  // The EnhancedEnrollmentForm now supports login mode via hash flag
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (!window.location.hash.includes("login")) {
        window.location.hash = "#login"
      }
    }
  }, [])

  return <EnhancedEnrollmentForm />
}
