import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';
import UserAccountForm, { RoleOption, UserAccountFormValues } from '../components/UserAccountForm';

const emptyValues: UserAccountFormValues = {
  name: '',
  email: '',
  roleId: '',
  department: '',
  password: '',
  passwordConfirm: '',
  active: true,
  isPlatformAdmin: false,
};

interface UserDetail {
  id: string;
  name: string;
  email: string;
  department?: string | null;
  active: boolean;
  isPlatformAdmin: boolean;
  role: { id: string; name: string; description?: string | null };
}

function extractError(err: unknown): string {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to save user';
}

export function OrgUserAccountPage() {
  const { userId } = useParams();
  const mode = userId ? 'edit' : 'create';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const [values, setValues] = useState(emptyValues);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canCreate = hasPermission('USER_CREATE');
  const canUpdate = hasPermission('USER_UPDATE');

  if (mode === 'create' && !canCreate) {
    return <div className="text-center py-12 text-gray-400">You don&apos;t have permission to create users.</div>;
  }
  if (mode === 'edit' && !canUpdate) {
    return <div className="text-center py-12 text-gray-400">You don&apos;t have permission to edit users.</div>;
  }

  const { data: roles = [], isLoading: rolesLoading } = useQuery<RoleOption[]>({
    queryKey: ['roles'],
    queryFn: () => api.get('/users/roles').then((r) => r.data),
  });

  const { data: user, isLoading: userLoading } = useQuery<UserDetail>({
    queryKey: ['user', userId],
    queryFn: () => api.get(`/users/${userId}`).then((r) => r.data),
    enabled: mode === 'edit' && !!userId,
  });

  useEffect(() => {
    if (user) {
      setValues({
        name: user.name,
        email: user.email,
        roleId: user.role.id,
        department: user.department ?? '',
        password: '',
        passwordConfirm: '',
        active: user.active,
        isPlatformAdmin: user.isPlatformAdmin,
      });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (values.password && values.password !== values.passwordConfirm) {
      setError('Passwords do not match');
      return;
    }
    if (mode === 'create' && values.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: values.name,
        email: values.email,
        roleId: values.roleId,
        department: values.department || undefined,
        active: values.active,
      };
      if (values.password) payload.password = values.password;
      if (mode === 'create') {
        await api.post('/users', { ...payload, password: values.password });
      } else {
        await api.patch(`/users/${userId}`, payload);
      }
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['organization-me'] });
      navigate('/users');
    } catch (err: unknown) {
      setError(extractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if ((mode === 'edit' && userLoading) || rolesLoading) {
    return <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/users" className="text-gray-400 hover:text-gray-600 p-1">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">
          {mode === 'create' ? 'Add user' : `Edit ${user?.name ?? 'user'}`}
        </h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 sm:p-8">
        <UserAccountForm
          mode={mode}
          variant="org"
          values={values}
          onChange={setValues}
          roles={roles}
          error={error}
          submitting={submitting}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/users')}
          submitLabel={mode === 'create' ? 'Add user' : 'Save changes'}
        />
      </div>
    </div>
  );
}

export function PlatformUserAccountPage() {
  const { organizationId, userId } = useParams();
  const mode = userId ? 'edit' : 'create';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [values, setValues] = useState(emptyValues);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: org } = useQuery<{ name: string; roles: RoleOption[] }>({
    queryKey: ['platform-org', organizationId],
    queryFn: () => api.get(`/platform/organizations/${organizationId}`).then((r) => r.data),
    enabled: !!organizationId,
  });

  const { data: user, isLoading: userLoading } = useQuery<UserDetail>({
    queryKey: ['platform-user', organizationId, userId],
    queryFn: () => api.get(`/platform/organizations/${organizationId}/users/${userId}`).then((r) => r.data),
    enabled: mode === 'edit' && !!organizationId && !!userId,
  });

  useEffect(() => {
    if (user) {
      setValues({
        name: user.name,
        email: user.email,
        roleId: user.role.id,
        department: user.department ?? '',
        password: '',
        passwordConfirm: '',
        active: user.active,
        isPlatformAdmin: user.isPlatformAdmin,
      });
    }
  }, [user]);

  const backTo = `/platform/organizations/${organizationId}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (values.password && values.password !== values.passwordConfirm) {
      setError('Passwords do not match');
      return;
    }
    if (mode === 'create' && values.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: values.name,
        email: values.email,
        roleId: values.roleId,
        department: values.department || undefined,
        active: values.active,
        isPlatformAdmin: values.isPlatformAdmin,
      };
      if (values.password) payload.password = values.password;
      if (mode === 'create') {
        await api.post(`/platform/organizations/${organizationId}/users`, { ...payload, password: values.password });
      } else {
        await api.patch(`/platform/organizations/${organizationId}/users/${userId}`, payload);
      }
      await qc.invalidateQueries({ queryKey: ['platform-org', organizationId] });
      await qc.invalidateQueries({ queryKey: ['platform-organizations'] });
      navigate(backTo);
    } catch (err: unknown) {
      setError(extractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (mode === 'edit' && userLoading) {
    return <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to={backTo} className="text-gray-400 hover:text-gray-600 p-1">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">
          {mode === 'create' ? 'Add user' : `Edit ${user?.name ?? 'user'}`}
        </h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 sm:p-8">
        <UserAccountForm
          mode={mode}
          variant="platform"
          values={values}
          onChange={setValues}
          roles={org?.roles ?? []}
          orgName={org?.name}
          error={error}
          submitting={submitting}
          onSubmit={handleSubmit}
          onCancel={() => navigate(backTo)}
          submitLabel={mode === 'create' ? 'Create user' : 'Save changes'}
        />
      </div>
    </div>
  );
}
