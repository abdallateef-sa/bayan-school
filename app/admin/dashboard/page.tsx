"use client"

import AdminDashboard from "@/components/admin/admin-dashboard"

export default function AdminDashboardPage() {
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-md">
        <AdminDashboard />
      </div>
    </div>
  )
}
