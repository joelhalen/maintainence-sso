import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Phone, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import api from '../api/client';

interface NotificationPref {
  id: string;
  onAssign: boolean;
  onComment: boolean;
  onStatusChange: boolean;
  onDueDateRemind: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  onAssignSms: boolean;
  onStatusSms: boolean;
  onCommentSms: boolean;
}

interface PhoneStatus {
  phone: string | null;
  phoneVerified: boolean;
}

export default function NotificationSettingsPage() {
  const qc = useQueryClient();
  const [phoneInput, setPhoneInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [verifyStep, setVerifyStep] = useState<'idle' | 'sent' | 'confirmed'>('idle');
  const [verifyError, setVerifyError] = useState('');

  const { data: prefs, isLoading } = useQuery<NotificationPref>({
    queryKey: ['notification-prefs'],
    queryFn: () => api.get('/auth/me').then((r) => r.data.notificationPref),
  });

  const { data: phoneStatus, isLoading: phoneLoading } = useQuery<PhoneStatus>({
    queryKey: ['phone-status'],
    queryFn: () => api.get('/phone/status').then((r) => r.data),
  });

  const prefMutation = useMutation({
    mutationFn: (updates: Partial<NotificationPref>) =>
      api.patch('/users/notification-preferences', updates).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-prefs'] }),
  });

  const sendCodeMutation = useMutation({
    mutationFn: (phone: string) => api.post('/phone/verify', { phone }).then((r) => r.data),
    onSuccess: () => {
      setVerifyStep('sent');
      setVerifyError('');
    },
    onError: () => setVerifyError('Failed to send verification code. Check the number and try again.'),
  });

  const confirmCodeMutation = useMutation({
    mutationFn: (code: string) => api.post('/phone/confirm', { code }).then((r) => r.data),
    onSuccess: (data: { result: string }) => {
      if (data.result === 'ok') {
        setVerifyStep('confirmed');
        setVerifyError('');
        qc.invalidateQueries({ queryKey: ['phone-status'] });
        qc.invalidateQueries({ queryKey: ['notification-prefs'] });
      } else {
        const msgs: Record<string, string> = {
          invalid: 'Incorrect code. Please try again.',
          expired: 'Code expired. Request a new one.',
          too_many_attempts: 'Too many attempts. Please request a new code.',
        };
        setVerifyError(msgs[data.result] || 'Verification failed.');
      }
    },
    onError: () => setVerifyError('Something went wrong. Please try again.'),
  });

  const toggle = (key: keyof NotificationPref) => {
    if (!prefs) return;
    prefMutation.mutate({ [key]: !prefs[key] });
  };

  const EMAIL_SETTINGS = [
    { key: 'onAssign' as const,       label: 'Ticket assigned to me',        description: 'When a ticket is assigned to you' },
    { key: 'onComment' as const,      label: 'New comment on my tickets',     description: 'When someone comments on a ticket you own or are assigned to' },
    { key: 'onStatusChange' as const, label: 'Status changes',                description: 'When a ticket status changes' },
    { key: 'onDueDateRemind' as const,label: 'Due date reminders',            description: 'When tickets are approaching or past their due date' },
  ];

  const SMS_SETTINGS = [
    { key: 'onAssignSms' as const,  label: 'Ticket assigned to me',  description: 'SMS when a ticket is assigned to you' },
    { key: 'onStatusSms' as const,  label: 'Status changes',         description: 'SMS when a ticket status changes' },
    { key: 'onCommentSms' as const, label: 'New comments',           description: 'SMS when someone comments on your tickets' },
  ];

  const isVerified = phoneStatus?.phoneVerified && !!phoneStatus?.phone;
  const busy = isLoading || phoneLoading || prefMutation.isPending;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Notification Settings</h1>

      {/* Email */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">Email Notifications</h2>
            <p className="text-xs text-gray-400 mt-0.5">Manage which events send you email notifications</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">All email</span>
            <Toggle on={!!prefs?.emailEnabled} onClick={() => toggle('emailEnabled')} disabled={busy} />
          </div>
        </div>
        <div className="divide-y divide-gray-50">
          {EMAIL_SETTINGS.map(({ key, label, description }) => (
            <div key={key} className="flex items-center justify-between px-5 py-4">
              <div>
                <div className="text-sm font-medium text-gray-800">{label}</div>
                <div className="text-xs text-gray-400 mt-0.5">{description}</div>
              </div>
              <Toggle
                on={!!prefs?.[key]}
                onClick={() => toggle(key)}
                disabled={!prefs?.emailEnabled || busy}
              />
            </div>
          ))}
        </div>
      </div>

      {/* SMS — phone verification */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">SMS Notifications</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Receive text messages for critical updates — requires a verified phone number
            </p>
          </div>
          {isVerified && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">All SMS</span>
              <Toggle on={!!prefs?.smsEnabled} onClick={() => toggle('smsEnabled')} disabled={busy} />
            </div>
          )}
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* Verification status banner */}
          {isVerified ? (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-4 py-3">
              <CheckCircle size={16} className="flex-shrink-0" />
              <span>Verified: <strong>{phoneStatus!.phone}</strong></span>
              <button
                className="ml-auto text-xs text-gray-500 hover:text-gray-700 underline"
                onClick={() => { setVerifyStep('idle'); setPhoneInput(''); setCodeInput(''); setVerifyError(''); }}
              >
                Change number
              </button>
            </div>
          ) : verifyStep === 'confirmed' ? (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-4 py-3">
              <CheckCircle size={16} />
              Phone number verified successfully.
            </div>
          ) : (
            <div className="space-y-3">
              {verifyStep === 'idle' && (
                <>
                  <p className="text-xs text-gray-500">
                    Enter your mobile number to enable SMS notifications. A verification code will be sent to confirm ownership.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      placeholder="+1 555 000 0000"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => sendCodeMutation.mutate(phoneInput)}
                      disabled={!phoneInput.trim() || sendCodeMutation.isPending}
                      className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {sendCodeMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                      Send code
                    </button>
                  </div>
                </>
              )}

              {verifyStep === 'sent' && (
                <>
                  <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
                    <Phone size={16} className="flex-shrink-0" />
                    Code sent to <strong>{phoneInput}</strong>. Check your messages.
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="6-digit code"
                      maxLength={6}
                      value={codeInput}
                      onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, ''))}
                      className="w-40 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 tracking-widest text-center"
                    />
                    <button
                      onClick={() => confirmCodeMutation.mutate(codeInput)}
                      disabled={codeInput.length !== 6 || confirmCodeMutation.isPending}
                      className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {confirmCodeMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                      Verify
                    </button>
                    <button
                      onClick={() => { setVerifyStep('idle'); setCodeInput(''); setVerifyError(''); }}
                      className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
                    >
                      Back
                    </button>
                  </div>
                </>
              )}

              {verifyError && (
                <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
                  <AlertCircle size={16} className="flex-shrink-0" />
                  {verifyError}
                </div>
              )}
            </div>
          )}

          {/* Per-event SMS toggles (only shown when verified + smsEnabled) */}
          {isVerified && prefs?.smsEnabled && (
            <div className="border-t border-gray-100 pt-4 space-y-0 divide-y divide-gray-50">
              {SMS_SETTINGS.map(({ key, label, description }) => (
                <div key={key} className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm font-medium text-gray-800">{label}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{description}</div>
                  </div>
                  <Toggle on={!!prefs?.[key]} onClick={() => toggle(key)} disabled={busy} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Toggle({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-40 ${on ? 'bg-blue-600' : 'bg-gray-200'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${on ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
    </button>
  );
}
