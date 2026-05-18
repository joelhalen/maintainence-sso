import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Smartphone, CheckCircle } from 'lucide-react';
import api from '../api/client';

interface NotificationPref {
  id: string;
  onAssign: boolean;
  onComment: boolean;
  onStatusChange: boolean;
  onDueDateRemind: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  onAssignPush: boolean;
  onStatusPush: boolean;
  onCommentPush: boolean;
}

interface DeviceToken {
  id: string;
  platform: 'IOS' | 'ANDROID' | 'WEB';
  active: boolean;
  lastSeen: string;
  createdAt: string;
}

export default function NotificationSettingsPage() {
  const qc = useQueryClient();

  const { data: prefs, isLoading } = useQuery<NotificationPref>({
    queryKey: ['notification-prefs'],
    queryFn: () => api.get('/auth/me').then((r) => r.data.notificationPref),
  });

  const { data: devices } = useQuery<DeviceToken[]>({
    queryKey: ['my-devices'],
    queryFn: () => api.get('/devices').then((r) => r.data).catch(() => []),
  });

  const prefMutation = useMutation({
    mutationFn: (updates: Partial<NotificationPref>) =>
      api.patch('/users/notification-preferences', updates).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-prefs'] }),
  });

  const toggle = (key: keyof NotificationPref) => {
    if (!prefs) return;
    prefMutation.mutate({ [key]: !prefs[key] });
  };

  const busy = isLoading || prefMutation.isPending;

  const EMAIL_SETTINGS = [
    { key: 'onAssign' as const,       label: 'Ticket assigned to me',    description: 'When a ticket is assigned to you' },
    { key: 'onComment' as const,      label: 'New comment on my tickets', description: 'When someone comments on a ticket you own or are assigned to' },
    { key: 'onStatusChange' as const, label: 'Status changes',            description: 'When a ticket status changes' },
    { key: 'onDueDateRemind' as const,label: 'Due date reminders',        description: 'When tickets are approaching or past their due date' },
  ];

  const PUSH_SETTINGS = [
    { key: 'onAssignPush' as const,  label: 'Ticket assigned to me', description: 'Push alert when a ticket is assigned to you' },
    { key: 'onStatusPush' as const,  label: 'Status changes',        description: 'Push alert when a ticket status changes' },
    { key: 'onCommentPush' as const, label: 'New comments',          description: 'Push alert when someone comments on your tickets' },
  ];

  const activeDevices = devices?.filter((d) => d.active) ?? [];
  const platformLabel: Record<string, string> = { IOS: 'iOS', ANDROID: 'Android', WEB: 'Web' };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Notification Settings</h1>

      {/* Email channel */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">Email Notifications</h2>
            <p className="text-xs text-gray-400 mt-0.5">Receive emails for ticket activity</p>
          </div>
          <Toggle on={!!prefs?.emailEnabled} onClick={() => toggle('emailEnabled')} disabled={busy} />
        </div>
        <div className="divide-y divide-gray-50">
          {EMAIL_SETTINGS.map(({ key, label, description }) => (
            <div key={key} className="flex items-center justify-between px-5 py-4">
              <div>
                <div className="text-sm font-medium text-gray-800">{label}</div>
                <div className="text-xs text-gray-400 mt-0.5">{description}</div>
              </div>
              <Toggle on={!!prefs?.[key]} onClick={() => toggle(key)} disabled={!prefs?.emailEnabled || busy} />
            </div>
          ))}
        </div>
      </div>

      {/* Push notifications */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">Push Notifications</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Instant alerts on your registered mobile devices and browsers
            </p>
          </div>
          <Toggle on={!!prefs?.pushEnabled} onClick={() => toggle('pushEnabled')} disabled={busy} />
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* Registered devices */}
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Registered Devices</div>
            {activeDevices.length === 0 ? (
              <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-lg px-4 py-3">
                <Smartphone size={18} className="text-gray-400 flex-shrink-0" />
                <div>
                  <div className="text-sm text-gray-600">No devices registered</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    Install the MegaMTX mobile app on iOS or Android, or enable web push from your browser. The app
                    automatically registers your device on sign-in.
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {activeDevices.map((device) => (
                  <div key={device.id} className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-lg px-4 py-2.5">
                    <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-green-800 font-medium">{platformLabel[device.platform] ?? device.platform}</span>
                      <span className="text-xs text-green-600 ml-2">
                        Last seen {new Date(device.lastSeen).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Per-event push toggles */}
          {prefs?.pushEnabled && (
            <div className="border-t border-gray-100 pt-4 divide-y divide-gray-50">
              {PUSH_SETTINGS.map(({ key, label, description }) => (
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

      <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4">
        <div className="flex items-center gap-2 mb-1">
          <Bell size={14} className="text-blue-600" />
          <h3 className="text-sm font-semibold text-blue-800">Mobile App</h3>
        </div>
        <p className="text-xs text-blue-600">
          Download the MegaMTX app from the App Store (iOS) or Google Play (Android) to receive instant push
          notifications. Sign in with your existing credentials — your device registers automatically.
        </p>
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
