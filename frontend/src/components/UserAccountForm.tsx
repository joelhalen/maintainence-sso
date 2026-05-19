import { Eye, EyeOff, Info } from 'lucide-react';
import { useState } from 'react';

export interface RoleOption {
  id: string;
  name: string;
  description?: string | null;
}

export interface UserAccountFormValues {
  name: string;
  email: string;
  roleId: string;
  department: string;
  password: string;
  passwordConfirm: string;
  active: boolean;
  isPlatformAdmin: boolean;
}

interface UserAccountFormProps {
  mode: 'create' | 'edit';
  variant: 'org' | 'platform' | 'register';
  values: UserAccountFormValues;
  onChange: (values: UserAccountFormValues) => void;
  roles?: RoleOption[];
  orgName?: string;
  orgSlug?: string;
  onOrgSlugChange?: (slug: string) => void;
  orgSlugValid?: boolean | null;
  orgSlugChecking?: boolean;
  error?: string;
  submitting?: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel?: () => void;
  submitLabel?: string;
}

function passwordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: 'bg-gray-200' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 2) return { score, label: 'Weak', color: 'bg-red-500' };
  if (score <= 3) return { score, label: 'Fair', color: 'bg-amber-500' };
  return { score, label: 'Strong', color: 'bg-green-500' };
}

export default function UserAccountForm({
  mode,
  variant,
  values,
  onChange,
  roles = [],
  orgName,
  orgSlug = '',
  onOrgSlugChange,
  orgSlugValid,
  orgSlugChecking,
  error,
  submitting,
  onSubmit,
  onCancel,
  submitLabel,
}: UserAccountFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const strength = passwordStrength(values.password);
  const selectedRole = roles.find((r) => r.id === values.roleId);
  const showRolePicker = variant !== 'register';
  const passwordRequired = mode === 'create';

  const set = (patch: Partial<UserAccountFormValues>) => onChange({ ...values, ...patch });

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {variant === 'register' && onOrgSlugChange && (
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Organization</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Enter your company&apos;s organization code (slug) from your administrator.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Organization code *</label>
            <input
              required
              value={orgSlug}
              onChange={(e) => onOrgSlugChange(e.target.value.trim().toLowerCase())}
              placeholder="acme-maintenance"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {orgSlugChecking && <p className="text-xs text-gray-400 mt-1">Checking organization…</p>}
            {orgSlugValid === true && orgName && (
              <p className="text-xs text-green-700 mt-1 flex items-center gap-1">
                <Info size={12} /> Joining <span className="font-medium">{orgName}</span>
              </p>
            )}
            {orgSlugValid === false && orgSlug.length > 0 && (
              <p className="text-xs text-red-600 mt-1">No active organization found with this code.</p>
            )}
          </div>
        </section>
      )}

      {(variant === 'org' || variant === 'platform') && orgName && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-800">
          {mode === 'create' ? 'Creating user in' : 'Editing user in'}{' '}
          <span className="font-semibold">{orgName}</span>
        </div>
      )}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Account details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Full name *</label>
            <input
              required
              value={values.name}
              onChange={(e) => set({ name: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Jane Smith"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input
              type="email"
              required
              value={values.email}
              onChange={(e) => set({ email: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="jane@company.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <input
              value={values.department}
              onChange={(e) => set({ department: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Facilities"
            />
          </div>
          {showRolePicker && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
              <select
                required
                value={values.roleId}
                onChange={(e) => set({ roleId: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a role</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        {showRolePicker && selectedRole?.description && (
          <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">{selectedRole.description}</p>
        )}
        {variant === 'register' && (
          <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
            New accounts are assigned the <span className="font-medium">Viewer</span> role. Contact your administrator to request a different role.
          </p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">
          {passwordRequired ? 'Set password' : 'Change password'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {passwordRequired ? 'Password *' : 'New password'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required={passwordRequired}
                minLength={8}
                value={values.password}
                onChange={(e) => set({ password: e.target.value })}
                placeholder={passwordRequired ? 'Min. 8 characters' : 'Leave blank to keep current'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {values.password && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${strength.color}`}
                    style={{ width: `${Math.min(100, (strength.score / 5) * 100)}%` }}
                  />
                </div>
                {strength.label && <span className="text-xs text-gray-500">{strength.label}</span>}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm password{passwordRequired ? ' *' : ''}
            </label>
            <input
              type="password"
              required={passwordRequired}
              value={values.passwordConfirm}
              onChange={(e) => set({ passwordConfirm: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {values.passwordConfirm && values.password !== values.passwordConfirm && (
              <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
            )}
          </div>
        </div>
      </section>

      {mode === 'edit' && variant !== 'register' && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Account status</h2>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={values.active}
              onChange={(e) => set({ active: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Account is active</span>
          </label>
          {variant === 'platform' && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={values.isPlatformAdmin}
                onChange={(e) => set({ isPlatformAdmin: e.target.checked })}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700">Platform super administrator</span>
            </label>
          )}
        </section>
      )}

      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2 border-t border-gray-100">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {submitting ? 'Saving…' : submitLabel ?? (mode === 'create' ? 'Create account' : 'Save changes')}
        </button>
      </div>
    </form>
  );
}
