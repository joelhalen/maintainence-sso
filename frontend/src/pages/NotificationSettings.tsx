import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';

interface NotificationPref {
  id: string;
  onAssign: boolean;
  onComment: boolean;
  onStatusChange: boolean;
  onDueDateRemind: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
}

export default function NotificationSettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: prefs, isLoading } = useQuery<NotificationPref>({
    queryKey: ['notification-prefs'],
    queryFn: () => api.get('/auth/me').then((r) => r.data.notificationPref),
  });

  const mutation = useMutation({
    mutationFn: (updates: Partial<NotificationPref>) =>
      api.patch('/users/notification-preferences', updates).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-prefs'] }),
  });

  const toggle = (key: keyof NotificationPref) => {
    if (!prefs) return;
    mutation.mutate({ [key]: !prefs[key] });
  };

  const SETTINGS = [
    { key: 'onAssign' as const, label: 'Ticket assigned to me', description: 'Notify me when a ticket is assigned to me' },
    { key: 'onComment' as const, label: 'New comment on my tickets', description: 'Notify me when someone comments on a ticket I created or am assigned to' },
    { key: 'onStatusChange' as const, label: 'Status changes', description: 'Notify me when a ticket status changes' },
    { key: 'onDueDateRemind' as const, label: 'Due date reminders', description: 'Notify me when tickets are approaching or past their due date' },
  ];

  const eventTogglesDisabled = (!prefs?.emailEnabled && !prefs?.smsEnabled) || isLoading || mutation.isPending;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Notification Settings</h1>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">Delivery Channels</h2>
            <p className="text-xs text-gray-400 mt-0.5">Choose where enabled notification events are sent</p>
          </div>
        </div>

        <div className="divide-y divide-gray-50">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <div className="text-sm font-medium text-gray-800">Email notifications</div>
              <div className="text-xs text-gray-400 mt-0.5">Send notifications to {user?.email}</div>
            </div>
            <button
              onClick={() => toggle('emailEnabled')}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${prefs?.emailEnabled ? 'bg-blue-600' : 'bg-gray-200'}`}
              disabled={isLoading || mutation.isPending}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${prefs?.emailEnabled ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <div className="text-sm font-medium text-gray-800">SMS notifications</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {user?.phone ? `Send text messages to ${user.phone}` : 'Add a phone number in your user profile before enabling SMS'}
              </div>
            </div>
            <button
              onClick={() => toggle('smsEnabled')}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${prefs?.smsEnabled ? 'bg-blue-600' : 'bg-gray-200'}`}
              disabled={!user?.phone || isLoading || mutation.isPending}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${prefs?.smsEnabled ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">Notification Events</h2>
            <p className="text-xs text-gray-400 mt-0.5">These event settings apply to every enabled delivery channel</p>
          </div>
        </div>

        <div className="divide-y divide-gray-50">
          {SETTINGS.map(({ key, label, description }) => (
            <div key={key} className="flex items-center justify-between px-5 py-4">
              <div>
                <div className="text-sm font-medium text-gray-800">{label}</div>
                <div className="text-xs text-gray-400 mt-0.5">{description}</div>
              </div>
              <button
                onClick={() => toggle(key)}
                disabled={eventTogglesDisabled}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-40 ${prefs?.[key] ? 'bg-blue-600' : 'bg-gray-200'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${prefs?.[key] ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4">
        <h3 className="text-sm font-semibold text-blue-800 mb-1">SMS Delivery</h3>
        <p className="text-xs text-blue-600">SMS uses Twilio and requires phone numbers in E.164 format, such as +15558675310. Verification codes and 2FA can build on the same SMS service.</p>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4">
        <h3 className="text-sm font-semibold text-blue-800 mb-1">Mobile Push Notifications</h3>
        <p className="text-xs text-blue-600">Push notifications will be available when the MegaMTX mobile app is installed on your iOS or Android device. The app will automatically register your device for push alerts.</p>
      </div>
    </div>
  );
}
