import type { EnrollmentData } from "../types/enrollment"

// API functions for backend integration
export class EnrollmentAPI {
  private static baseUrl = process.env.NEXT_PUBLIC_API_URL || "/api"

  // Submit enrollment data to backend
  static async submitEnrollment(
    data: EnrollmentData,
  ): Promise<{ success: boolean; enrollmentId?: string; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/enrollment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      return { success: false, error: "Failed to submit enrollment" }
    }
  }

  // Send confirmation email
  static async sendConfirmationEmail(
    email: string,
    enrollmentData: any,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/enrollment/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, enrollmentData }),
      })

      if (!response.ok) {
        if (response.status === 404) {
          return { success: false, error: "Email confirmation service not available" }
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      return { success: false, error: "Failed to send confirmation email" }
    }
  }

  // Check available time slots - using mock data since backend endpoint doesn't exist yet
  static async getAvailableSlots(date: string): Promise<{ success: boolean; slots?: string[]; error?: string }> {
    try {
      const mockSlots = [
        "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
        "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
        "17:00", "17:30", "18:00", "18:30", "19:00", "19:30"
      ]
      
      const availableSlots = mockSlots.filter((_, index) => Math.random() > 0.3)
      
      return { 
        success: true, 
        slots: availableSlots 
      }
    } catch (error) {
      return { success: false, error: "Failed to fetch available slots" }
    }
  }
}
