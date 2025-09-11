export interface PersonalInfo {
  firstName: string
  lastName: string
  gender: "Male" | "Female" | ""
  email: string
  country: string
  phone: string
}

export interface Package {
  id: string
  name: string
  description: string
  sessions: number
  price: number
  popular: boolean
  details: string[]
}

export interface SelectedPackage {
  name: string
  type: string
  sessions: number
  sessionsPerWeek?: number
  planId?: string // Backend plan ID
}

export interface Session {
  date: string
  time: string
}

export interface EnrollmentData {
  personal: PersonalInfo
  package: SelectedPackage
  sessions: Session[]
}

export interface Country {
  value: string
  label: string
}
