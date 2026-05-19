import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';
import UserAccountForm, { UserAccountFormValues } from '../components/UserAccountForm';
import AuthPageLayout from '../components/marketing/AuthPageLayout';

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

export default function RegisterPage() {
  const { token, login } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState(emptyValues);
  const [orgSlug, setOrgSlug] = useState('');
  const [orgName, setOrgName] = useState<string | undefined>();
  const [orgSlugValid, setOrgSlugValid] = useState<boolean | null>(null);
  const [orgSlugChecking, setOrgSlugChecking] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (token) navigate('/', { replace: true });
  }, [token, navigate]);

  useEffect(() => {
    if (!orgSlug || orgSlug.length < 2) {
      setOrgSlugValid(null);
      setOrgName(undefined);
      return;
    }
    const timer = setTimeout(async () => {
      setOrgSlugChecking(true);
      try {
        const { data } = await api.get<{ name: string }>(`/auth/register/orgs/${encodeURIComponent(orgSlug)}`);
        setOrgName(data.name);
        setOrgSlugValid(true);
      } catch {
        setOrgName(undefined);
        setOrgSlugValid(false);
      } finally {
        setOrgSlugChecking(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [orgSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (values.password !== values.passwordConfirm) {
      setError('Passwords do not match');
      return;
    }
    if (!orgSlugValid) {
      setError('Enter a valid organization code');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/auth/register', {
        orgSlug,
        name: values.name,
        email: values.email,
        password: values.password,
        department: values.department || undefined,
      });
      setSuccess(true);
      await login(values.email, values.password);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <AuthPageLayout title="Welcome" subtitle="Your account is ready">
        <p className="text-sm text-slate-600 text-center">Signing you in…</p>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout
      title="Create your account"
      subtitle="Join your organization with the code provided by your administrator"
      footer={
        <p className="text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">
            Sign in
          </Link>
        </p>
      }
    >
      <UserAccountForm
        mode="create"
        variant="register"
        values={values}
        onChange={setValues}
        orgSlug={orgSlug}
        orgName={orgName}
        onOrgSlugChange={setOrgSlug}
        orgSlugValid={orgSlugValid}
        orgSlugChecking={orgSlugChecking}
        error={error}
        submitting={submitting}
        onSubmit={handleSubmit}
        submitLabel="Create account"
      />
    </AuthPageLayout>
  );
}
