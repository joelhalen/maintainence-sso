import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';
import UserAccountForm, { UserAccountFormValues } from '../components/UserAccountForm';

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
      <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
        <p className="text-white text-sm">Account created. Signing you in…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 px-4 py-10">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-blue-600 mb-4">
            <span className="text-white text-xl font-bold">M</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Create your account</h1>
          <p className="text-gray-400 text-sm mt-1">Join your organization on MegaMTX</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8">
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
        </div>

        <p className="text-center text-sm text-gray-400 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
