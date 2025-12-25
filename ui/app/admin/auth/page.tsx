"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

// ============================================================================
// TYPES
// ============================================================================
interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: "active" | "inactive" | "pending";
  lastLogin: string | null;
  createdAt: string;
  authMethod: "local" | "sso";
  mfaEnabled: boolean;
}

type UserRole = "super_admin" | "admin" | "manager" | "trainer" | "trainee";

interface Role {
  id: UserRole;
  name: string;
  description: string;
  permissions: string[];
  color: string;
}

interface SSOConfig {
  enabled: boolean;
  provider: "saml" | "oidc" | "azure_ad" | "okta" | "google" | null;
  entityId: string;
  ssoUrl: string;
  certificate: string;
  attributeMapping: {
    email: string;
    name: string;
    role: string;
  };
  autoProvision: boolean;
  defaultRole: UserRole;
  allowedDomains: string[];
}

interface AuthSettings {
  mode: "development" | "production";
  localAuthEnabled: boolean;
  ssoEnabled: boolean;
  mfaRequired: boolean;
  sessionTimeout: number;
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    expiryDays: number;
  };
  loginAttempts: {
    maxAttempts: number;
    lockoutDuration: number;
  };
}

// ============================================================================
// DEFAULT DATA
// ============================================================================
const DEFAULT_ROLES: Role[] = [
  {
    id: "super_admin",
    name: "Super Administrator",
    description: "Full system access with all permissions",
    permissions: ["*"],
    color: "red",
  },
  {
    id: "admin",
    name: "Administrator",
    description: "Manage users, settings, and content",
    permissions: ["users:*", "settings:*", "content:*", "reports:view"],
    color: "purple",
  },
  {
    id: "manager",
    name: "Manager",
    description: "Manage trainees and view reports",
    permissions: ["users:view", "trainees:*", "reports:*", "content:view"],
    color: "blue",
  },
  {
    id: "trainer",
    name: "Trainer",
    description: "Conduct training sessions and provide feedback",
    permissions: ["trainees:view", "sessions:*", "feedback:*", "reports:view"],
    color: "green",
  },
  {
    id: "trainee",
    name: "Trainee",
    description: "Access training content and sessions",
    permissions: ["training:access", "sessions:participate", "feedback:view"],
    color: "gray",
  },
];

const DEFAULT_USERS: User[] = [
  {
    id: "demo-user",
    email: "demo@pulse.training",
    name: "Demo User",
    role: "super_admin",
    status: "active",
    lastLogin: new Date().toISOString(),
    createdAt: "2024-01-01T00:00:00Z",
    authMethod: "local",
    mfaEnabled: false,
  },
];

const DEFAULT_SSO_CONFIG: SSOConfig = {
  enabled: false,
  provider: null,
  entityId: "",
  ssoUrl: "",
  certificate: "",
  attributeMapping: {
    email: "email",
    name: "displayName",
    role: "role",
  },
  autoProvision: true,
  defaultRole: "trainee",
  allowedDomains: [],
};

const DEFAULT_AUTH_SETTINGS: AuthSettings = {
  mode: "development",
  localAuthEnabled: true,
  ssoEnabled: false,
  mfaRequired: false,
  sessionTimeout: 480,
  passwordPolicy: {
    minLength: 8,
    requireUppercase: true,
    requireNumbers: true,
    requireSpecialChars: false,
    expiryDays: 90,
  },
  loginAttempts: {
    maxAttempts: 5,
    lockoutDuration: 15,
  },
};

const STORAGE_KEYS = {
  users: "pulse_auth_users",
  ssoConfig: "pulse_auth_sso_config",
  settings: "pulse_auth_settings",
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function AuthManagementPage() {
  const [activeTab, setActiveTab] = useState<"users" | "roles" | "sso" | "settings">("users");
  const [users, setUsers] = useState<User[]>(DEFAULT_USERS);
  const [ssoConfig, setSsoConfig] = useState<SSOConfig>(DEFAULT_SSO_CONFIG);
  const [authSettings, setAuthSettings] = useState<AuthSettings>(DEFAULT_AUTH_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showSSOTest, setShowSSOTest] = useState(false);

  const isDev = process.env.NEXT_PUBLIC_USE_DEV_SESSION === "true";

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedUsers = localStorage.getItem(STORAGE_KEYS.users);
      if (savedUsers) {
        try { setUsers(JSON.parse(savedUsers)); } catch {}
      }
      const savedSSO = localStorage.getItem(STORAGE_KEYS.ssoConfig);
      if (savedSSO) {
        try { setSsoConfig(JSON.parse(savedSSO)); } catch {}
      }
      const savedSettings = localStorage.getItem(STORAGE_KEYS.settings);
      if (savedSettings) {
        try { setAuthSettings(JSON.parse(savedSettings)); } catch {}
      }
    }
  }, []);

  const handleSaveAll = () => {
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
    localStorage.setItem(STORAGE_KEYS.ssoConfig, JSON.stringify(ssoConfig));
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(authSettings));
    setHasChanges(false);
  };

  const getRoleInfo = (roleId: UserRole): Role => {
    return DEFAULT_ROLES.find(r => r.id === roleId) || DEFAULT_ROLES[4];
  };

  const getRoleColor = (roleId: UserRole): string => {
    const colors: Record<string, string> = {
      red: "bg-red-100 text-red-700 border-red-200",
      purple: "bg-purple-100 text-purple-700 border-purple-200",
      blue: "bg-blue-100 text-blue-700 border-blue-200",
      green: "bg-green-100 text-green-700 border-green-200",
      gray: "bg-gray-100 text-gray-700 border-gray-200",
    };
    return colors[getRoleInfo(roleId).color] || colors.gray;
  };

  const handleAddUser = (user: Omit<User, "id" | "createdAt" | "lastLogin">) => {
    const newUser: User = {
      ...user,
      id: `user-${Date.now()}`,
      createdAt: new Date().toISOString(),
      lastLogin: null,
    };
    setUsers(prev => [...prev, newUser]);
    setHasChanges(true);
    setShowAddUser(false);
  };

  const handleUpdateUser = (userId: string, updates: Partial<User>) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updates } : u));
    setHasChanges(true);
  };

  const handleDeleteUser = (userId: string) => {
    if (userId === "demo-user" && isDev) {
      alert("Cannot delete demo user in development mode");
      return;
    }
    setUsers(prev => prev.filter(u => u.id !== userId));
    setHasChanges(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-gray-500 hover:text-gray-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">Authentication & Authorization</h1>
            <p className="text-sm text-gray-500">Manage users, roles, SSO, and security settings</p>
          </div>
        </div>
        {hasChanges && (
          <button
            onClick={handleSaveAll}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Save Changes
          </button>
        )}
      </div>

      {/* Dev Mode Banner */}
      {isDev && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-amber-900">Development Mode Active</h3>
              <p className="text-sm text-amber-700 mt-1">
                Demo credentials (demo/demo) have full Super Admin access. All authentication checks are bypassed.
                Switch to production mode before deploying to a live environment.
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs px-2 py-1 bg-amber-200 text-amber-800 rounded-full">NEXT_PUBLIC_USE_DEV_SESSION=true</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Environment Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`rounded-xl p-4 border ${authSettings.mode === "development" ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"}`}>
          <div className="text-xs font-medium text-gray-500 uppercase">Environment</div>
          <div className={`text-lg font-bold ${authSettings.mode === "development" ? "text-amber-700" : "text-green-700"}`}>
            {authSettings.mode === "development" ? "Development" : "Production"}
          </div>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <div className="text-xs font-medium text-gray-500 uppercase">Active Users</div>
          <div className="text-lg font-bold text-blue-700">{users.filter(u => u.status === "active").length}</div>
        </div>
        <div className={`rounded-xl p-4 border ${ssoConfig.enabled ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
          <div className="text-xs font-medium text-gray-500 uppercase">SSO Status</div>
          <div className={`text-lg font-bold ${ssoConfig.enabled ? "text-green-700" : "text-gray-500"}`}>
            {ssoConfig.enabled ? "Enabled" : "Disabled"}
          </div>
        </div>
        <div className={`rounded-xl p-4 border ${authSettings.mfaRequired ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
          <div className="text-xs font-medium text-gray-500 uppercase">MFA</div>
          <div className={`text-lg font-bold ${authSettings.mfaRequired ? "text-green-700" : "text-gray-500"}`}>
            {authSettings.mfaRequired ? "Required" : "Optional"}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-lg w-fit">
        {[
          { id: "users" as const, label: "Users", icon: "👥" },
          { id: "roles" as const, label: "Roles & Permissions", icon: "🔐" },
          { id: "sso" as const, label: "SSO / SAML", icon: "🔗" },
          { id: "settings" as const, label: "Security Settings", icon: "⚙️" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === tab.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {/* Users Tab */}
        {activeTab === "users" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">User Management</h2>
                <p className="text-sm text-gray-500">Manage user accounts and access levels</p>
              </div>
              <button
                onClick={() => setShowAddUser(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add User
              </button>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Role</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Auth Method</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Last Login</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{user.name}</div>
                            <div className="text-xs text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2 py-1 rounded-full border ${getRoleColor(user.role)}`}>
                          {getRoleInfo(user.role).name}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          user.status === "active" ? "bg-green-100 text-green-700" :
                          user.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                          "bg-gray-100 text-gray-700"
                        }`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs text-gray-600 flex items-center gap-1">
                          {user.authMethod === "sso" ? "🔗 SSO" : "🔑 Local"}
                          {user.mfaEnabled && <span className="text-green-600">+MFA</span>}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500">
                        {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : "Never"}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditingUser(user)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                            disabled={user.id === "demo-user" && isDev}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Roles Tab */}
        {activeTab === "roles" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Roles & Permissions</h2>
              <p className="text-sm text-gray-500">Define access levels and permissions for each role</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {DEFAULT_ROLES.map((role) => (
                <div key={role.id} className={`rounded-xl border-2 p-4 ${getRoleColor(role.id)}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">{role.name}</h3>
                    <span className="text-xs px-2 py-1 bg-white/50 rounded-full">
                      {users.filter(u => u.role === role.id).length} users
                    </span>
                  </div>
                  <p className="text-sm opacity-80 mb-3">{role.description}</p>
                  <div className="space-y-1">
                    <div className="text-xs font-medium opacity-70">Permissions:</div>
                    <div className="flex flex-wrap gap-1">
                      {role.permissions.slice(0, 4).map((perm, idx) => (
                        <span key={idx} className="text-xs px-2 py-0.5 bg-white/50 rounded">
                          {perm}
                        </span>
                      ))}
                      {role.permissions.length > 4 && (
                        <span className="text-xs px-2 py-0.5 bg-white/50 rounded">
                          +{role.permissions.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SSO Tab */}
        {activeTab === "sso" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Single Sign-On (SSO) Configuration</h2>
                <p className="text-sm text-gray-500">Configure SAML, OIDC, or enterprise identity providers</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={ssoConfig.enabled}
                  onChange={(e) => {
                    setSsoConfig(prev => ({ ...prev, enabled: e.target.checked }));
                    setHasChanges(true);
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                <span className="ml-2 text-sm font-medium">Enable SSO</span>
              </label>
            </div>

            {/* SSO Provider Selection */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { id: "saml", name: "SAML 2.0", icon: "🔐", desc: "Enterprise standard" },
                { id: "azure_ad", name: "Azure AD", icon: "☁️", desc: "Microsoft Entra" },
                { id: "okta", name: "Okta", icon: "🔵", desc: "Identity platform" },
                { id: "google", name: "Google", icon: "🔴", desc: "Google Workspace" },
              ].map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => {
                    setSsoConfig(prev => ({ ...prev, provider: provider.id as SSOConfig["provider"] }));
                    setHasChanges(true);
                  }}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    ssoConfig.provider === provider.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="text-2xl mb-2">{provider.icon}</div>
                  <div className="font-medium">{provider.name}</div>
                  <div className="text-xs text-gray-500">{provider.desc}</div>
                </button>
              ))}
            </div>

            {ssoConfig.enabled && ssoConfig.provider && (
              <div className="space-y-4 border-t pt-6">
                <h3 className="font-medium">SAML Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Entity ID / Issuer</label>
                    <input
                      type="text"
                      value={ssoConfig.entityId}
                      onChange={(e) => {
                        setSsoConfig(prev => ({ ...prev, entityId: e.target.value }));
                        setHasChanges(true);
                      }}
                      placeholder="https://your-idp.com/entity-id"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">SSO URL</label>
                    <input
                      type="text"
                      value={ssoConfig.ssoUrl}
                      onChange={(e) => {
                        setSsoConfig(prev => ({ ...prev, ssoUrl: e.target.value }));
                        setHasChanges(true);
                      }}
                      placeholder="https://your-idp.com/sso"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">X.509 Certificate</label>
                  <textarea
                    value={ssoConfig.certificate}
                    onChange={(e) => {
                      setSsoConfig(prev => ({ ...prev, certificate: e.target.value }));
                      setHasChanges(true);
                    }}
                    placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  />
                </div>

                <div className="flex items-center gap-4 pt-4">
                  <button
                    onClick={() => setShowSSOTest(true)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Test Connection
                  </button>
                  <button className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors">
                    Download SP Metadata
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Security Settings</h2>
              <p className="text-sm text-gray-500">Configure authentication and security policies</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Environment Mode */}
              <div className="border border-gray-200 rounded-xl p-4">
                <h3 className="font-medium mb-4">Environment Mode</h3>
                <div className="space-y-3">
                  <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer ${
                    authSettings.mode === "development" ? "border-amber-500 bg-amber-50" : "border-gray-200"
                  }`}>
                    <input
                      type="radio"
                      name="mode"
                      checked={authSettings.mode === "development"}
                      onChange={() => {
                        setAuthSettings(prev => ({ ...prev, mode: "development" }));
                        setHasChanges(true);
                      }}
                      className="w-4 h-4"
                    />
                    <div>
                      <div className="font-medium">Development</div>
                      <div className="text-xs text-gray-500">Demo credentials enabled, auth bypassed</div>
                    </div>
                  </label>
                  <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer ${
                    authSettings.mode === "production" ? "border-green-500 bg-green-50" : "border-gray-200"
                  }`}>
                    <input
                      type="radio"
                      name="mode"
                      checked={authSettings.mode === "production"}
                      onChange={() => {
                        setAuthSettings(prev => ({ ...prev, mode: "production" }));
                        setHasChanges(true);
                      }}
                      className="w-4 h-4"
                    />
                    <div>
                      <div className="font-medium">Production</div>
                      <div className="text-xs text-gray-500">Full authentication required</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Authentication Methods */}
              <div className="border border-gray-200 rounded-xl p-4">
                <h3 className="font-medium mb-4">Authentication Methods</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">Local Authentication</div>
                      <div className="text-xs text-gray-500">Username/password login</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={authSettings.localAuthEnabled}
                        onChange={(e) => {
                          setAuthSettings(prev => ({ ...prev, localAuthEnabled: e.target.checked }));
                          setHasChanges(true);
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">Require MFA</div>
                      <div className="text-xs text-gray-500">Two-factor authentication</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={authSettings.mfaRequired}
                        onChange={(e) => {
                          setAuthSettings(prev => ({ ...prev, mfaRequired: e.target.checked }));
                          setHasChanges(true);
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Session Settings */}
              <div className="border border-gray-200 rounded-xl p-4">
                <h3 className="font-medium mb-4">Session Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Session Timeout (minutes)</label>
                    <input
                      type="number"
                      value={authSettings.sessionTimeout}
                      onChange={(e) => {
                        setAuthSettings(prev => ({ ...prev, sessionTimeout: parseInt(e.target.value) || 60 }));
                        setHasChanges(true);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Max Login Attempts</label>
                    <input
                      type="number"
                      value={authSettings.loginAttempts.maxAttempts}
                      onChange={(e) => {
                        setAuthSettings(prev => ({
                          ...prev,
                          loginAttempts: { ...prev.loginAttempts, maxAttempts: parseInt(e.target.value) || 5 }
                        }));
                        setHasChanges(true);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Password Policy */}
              <div className="border border-gray-200 rounded-xl p-4">
                <h3 className="font-medium mb-4">Password Policy</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Minimum Length</label>
                    <input
                      type="number"
                      value={authSettings.passwordPolicy.minLength}
                      onChange={(e) => {
                        setAuthSettings(prev => ({
                          ...prev,
                          passwordPolicy: { ...prev.passwordPolicy, minLength: parseInt(e.target.value) || 8 }
                        }));
                        setHasChanges(true);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={authSettings.passwordPolicy.requireUppercase}
                      onChange={(e) => {
                        setAuthSettings(prev => ({
                          ...prev,
                          passwordPolicy: { ...prev.passwordPolicy, requireUppercase: e.target.checked }
                        }));
                        setHasChanges(true);
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Require uppercase letters</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={authSettings.passwordPolicy.requireNumbers}
                      onChange={(e) => {
                        setAuthSettings(prev => ({
                          ...prev,
                          passwordPolicy: { ...prev.passwordPolicy, requireNumbers: e.target.checked }
                        }));
                        setHasChanges(true);
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Require numbers</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={authSettings.passwordPolicy.requireSpecialChars}
                      onChange={(e) => {
                        setAuthSettings(prev => ({
                          ...prev,
                          passwordPolicy: { ...prev.passwordPolicy, requireSpecialChars: e.target.checked }
                        }));
                        setHasChanges(true);
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Require special characters</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddUser && (
        <AddUserModal
          onClose={() => setShowAddUser(false)}
          onSave={handleAddUser}
          roles={DEFAULT_ROLES}
        />
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSave={(updates) => {
            handleUpdateUser(editingUser.id, updates);
            setEditingUser(null);
          }}
          roles={DEFAULT_ROLES}
        />
      )}

      {/* SSO Test Modal */}
      {showSSOTest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Test SSO Connection</h3>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2 text-blue-700">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>Testing connection to {ssoConfig.provider}...</span>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                This will attempt to validate your SSO configuration by checking the IdP metadata and certificate.
              </p>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowSSOTest(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ADD USER MODAL
// ============================================================================
function AddUserModal({ 
  onClose, 
  onSave, 
  roles 
}: { 
  onClose: () => void; 
  onSave: (user: Omit<User, "id" | "createdAt" | "lastLogin">) => void;
  roles: Role[];
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("trainee");
  const [authMethod, setAuthMethod] = useState<"local" | "sso">("local");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      email,
      name,
      role,
      status: "active",
      authMethod,
      mfaEnabled: false,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">Add New User</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Auth Method</label>
            <select
              value={authMethod}
              onChange={(e) => setAuthMethod(e.target.value as "local" | "sso")}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="local">Local (Password)</option>
              <option value="sso">SSO</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Add User
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// EDIT USER MODAL
// ============================================================================
function EditUserModal({ 
  user,
  onClose, 
  onSave, 
  roles 
}: { 
  user: User;
  onClose: () => void; 
  onSave: (updates: Partial<User>) => void;
  roles: Role[];
}) {
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<UserRole>(user.role);
  const [status, setStatus] = useState(user.status);
  const [mfaEnabled, setMfaEnabled] = useState(user.mfaEnabled);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ name, role, status, mfaEnabled });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">Edit User: {user.email}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as User["status"])}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={mfaEnabled}
              onChange={(e) => setMfaEnabled(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm">MFA Enabled</span>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
