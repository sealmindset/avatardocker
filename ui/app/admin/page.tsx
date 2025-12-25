"use client";

import Link from "next/link";
import { useMemo } from "react";

export default function AdminPage() {
  const enable = (process.env.NEXT_PUBLIC_ENABLE_ADMIN === "true") && (process.env.NEXT_PUBLIC_ENV_NAME !== "prod");
  const banner = useMemo(() => enable ? "Dev Mode – no authentication enabled" : "Admin disabled in this environment", [enable]);
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
      </div>
      <div className={`rounded border p-2 text-sm ${enable ? "border-yellow-200 bg-yellow-50 text-yellow-800" : "border-gray-200 bg-gray-50 text-gray-700"}`}>{banner}</div>
      
      {enable ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* AI Components Overview Card */}
          <Link 
            href="/admin/overview"
            className="group relative bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] cursor-pointer overflow-hidden"
          >
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-4 right-4 w-32 h-32 border-4 border-white rounded-full"></div>
              <div className="absolute bottom-4 left-4 w-20 h-20 border-4 border-white rounded-full"></div>
            </div>
            
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold">AI Components</h2>
                  <p className="text-white/70 text-sm">Configure AI behavior</p>
                </div>
              </div>
              
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-sm text-white/80">
                  <span className="w-2 h-2 rounded-full bg-green-400"></span>
                  <span>4 Customer Personas</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-white/80">
                  <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                  <span>3 Evaluation Agents</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-white/80">
                  <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                  <span>5 System Prompts</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-white/80">
                  <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                  <span>5 PULSE Stages</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-sm font-medium group-hover:gap-3 transition-all">
                <span>Manage Components</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </Link>

          {/* Training Administration Card */}
          <Link 
            href="/admin/training"
            className="group relative bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] cursor-pointer overflow-hidden"
          >
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-4 right-4 w-32 h-32 border-4 border-white rounded-full"></div>
              <div className="absolute bottom-4 left-4 w-20 h-20 border-4 border-white rounded-full"></div>
            </div>
            
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold">Training Program</h2>
                  <p className="text-white/70 text-sm">Customize learning content</p>
                </div>
              </div>
              
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-sm text-white/80">
                  <span className="w-2 h-2 rounded-full bg-green-400"></span>
                  <span>5 PULSE Training Modules</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-white/80">
                  <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                  <span>15 Practice Scenarios</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-white/80">
                  <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                  <span>3 Experience Levels</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-white/80">
                  <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                  <span>Intro Video & Rubrics</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-sm font-medium group-hover:gap-3 transition-all">
                <span>Manage Training</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </Link>

          {/* Avatar & Voice Manager Card */}
          <Link 
            href="/admin/avatars"
            className="group relative bg-gradient-to-br from-pink-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] cursor-pointer overflow-hidden"
          >
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-4 right-4 w-32 h-32 border-4 border-white rounded-full"></div>
              <div className="absolute bottom-4 left-4 w-20 h-20 border-4 border-white rounded-full"></div>
            </div>
            
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold">Avatar & Voice</h2>
                  <p className="text-white/70 text-sm">Manage AI personas</p>
                </div>
              </div>
              
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-sm text-white/80">
                  <span className="w-2 h-2 rounded-full bg-green-400"></span>
                  <span>LiteAvatar Models</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-white/80">
                  <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                  <span>Piper TTS Voices</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-white/80">
                  <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                  <span>ModelScope Gallery</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-white/80">
                  <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                  <span>Voice Sampling & Download</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-sm font-medium group-hover:gap-3 transition-all">
                <span>Manage Avatars</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </Link>

          {/* Authentication & Authorization Card */}
          <Link 
            href="/admin/auth"
            className="group relative bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] cursor-pointer overflow-hidden"
          >
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-4 right-4 w-32 h-32 border-4 border-white rounded-full"></div>
              <div className="absolute bottom-4 left-4 w-20 h-20 border-4 border-white rounded-full"></div>
            </div>
            
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold">Auth & Security</h2>
                  <p className="text-white/70 text-sm">Users, roles, SSO/SAML</p>
                </div>
              </div>
              
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-sm text-white/80">
                  <span className="w-2 h-2 rounded-full bg-green-400"></span>
                  <span>User Management</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-white/80">
                  <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                  <span>5 Role Levels</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-white/80">
                  <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                  <span>SSO / SAML Integration</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-white/80">
                  <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                  <span>Security Policies</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-sm font-medium group-hover:gap-3 transition-all">
                <span>Manage Security</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </Link>
        </div>
      ) : (
        <div className="text-sm text-gray-600">Set NEXT_PUBLIC_ENABLE_ADMIN=true and NEXT_PUBLIC_ENV_NAME!=prod to enable in dev.</div>
      )}
    </div>
  );
}
