import { useState, FormEvent, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldAlert, Eye, EyeOff, Activity, CheckCircle, Mail, ArrowLeft, RefreshCw } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

export default function Register() {
  const [step, setStep] = useState<'form' | 'otp' | 'success'>('form');

  // Form fields
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  // OTP fields
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpEmail, setOtpEmail] = useState('');
  const [otpTimer, setOtpTimer] = useState(600); // 10 minutes
  const [canResend, setCanResend] = useState(false);

  // State
  const [submitting, setSubmitting] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const navigate = useNavigate();
  const { login } = useAuth();

  // OTP countdown timer
  useEffect(() => {
    if (step !== 'otp') return;
    const interval = setInterval(() => {
      setOtpTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  // Focus first OTP input when step changes to otp
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    }
  }, [step]);

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste (6-digit code pasted into first field)
      const digits = value.replace(/\D/g, '').slice(0, 6);
      const newOtp = [...otp];
      for (let i = 0; i < 6; i++) {
        newOtp[i] = digits[i] || '';
      }
      setOtp(newOtp);
      // Focus the last filled field or next empty
      const lastIdx = Math.min(digits.length, 5);
      otpRefs.current[lastIdx]?.focus();
      return;
    }

    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-advance to next field
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Step 1: Submit registration form → sends OTP
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !email.trim() || !password.trim()) {
      setError('Username, email, and password are required');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.register(username.trim(), email.trim(), password, fullName.trim() || undefined);
      setOtpEmail(result.email);
      setOtpTimer(600);
      setCanResend(false);
      setOtp(['', '', '', '', '', '']);
      setStep('otp');
    } catch (err: any) {
      setError(
        err?.message?.includes('400')
          ? 'Username or email already exists'
          : err?.message || 'Registration failed. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2: Verify OTP → creates account + auto-login
  const handleVerifyOtp = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const user = await api.verifyOtp(otpEmail, otpCode);
      setStep('success');

      // Auto-login after brief delay
      setTimeout(async () => {
        try {
          await login(username.trim(), password);
          navigate('/', { replace: true });
        } catch {
          navigate('/login', { replace: true });
        }
      }, 1500);
    } catch (err: any) {
      setError(err?.message || 'Invalid or expired OTP code');
    } finally {
      setSubmitting(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    setSubmitting(true);
    try {
      await api.resendOtp(otpEmail);
      setOtpTimer(600);
      setCanResend(false);
      setOtp(['', '', '', '', '', '']);
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Failed to resend OTP');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success Screen ─────────────────────────────────────────────

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/20 mb-4">
            <CheckCircle size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Account Verified!</h2>
          <p className="text-slate-400 mb-6">Redirecting you to the dashboard...</p>
          <div className="flex justify-center">
            <Activity size={24} className="animate-spin text-indigo-400" />
          </div>
        </div>
      </div>
    );
  }

  // ── OTP Screen ─────────────────────────────────────────────────

  if (step === 'otp') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMxZTI5M2IiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-20" />

        <div className="relative w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20 mb-4">
              <Mail size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Check Your Email</h1>
            <p className="text-sm text-slate-400 mt-1">
              We sent a verification code to <span className="text-indigo-400 font-medium">{otpEmail}</span>
            </p>
          </div>

          {/* OTP Card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl p-8 shadow-2xl">
            <div className="mb-6 text-center">
              <h2 className="text-lg font-semibold text-white">Enter Verification Code</h2>
              <p className="text-sm text-slate-400 mt-1">
                Code expires in{' '}
                <span className={`font-mono font-medium ${otpTimer < 60 ? 'text-red-400' : 'text-slate-300'}`}>
                  {formatTimer(otpTimer)}
                </span>
              </p>
            </div>

            {/* OTP Input Boxes */}
            <div className="flex justify-center gap-3 mb-6">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={i === 0 ? 6 : 1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className="w-12 h-14 text-center text-xl font-bold text-white bg-slate-800/80 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                />
              ))}
            </div>

            {error && (
              <div className="rounded-lg bg-red-900/30 border border-red-800/50 px-4 py-3 text-sm text-red-300 mb-4 text-center">
                {error}
              </div>
            )}

            <button
              onClick={handleVerifyOtp}
              disabled={submitting || otp.join('').length !== 6}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-semibold text-sm hover:from-indigo-500 hover:to-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/20 mb-3"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Activity size={16} className="animate-spin" />
                  Verifying...
                </span>
              ) : (
                'Verify & Create Account'
              )}
            </button>

            {/* Resend */}
            <div className="text-center">
              {canResend ? (
                <button
                  onClick={handleResendOtp}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                >
                  <RefreshCw size={14} />
                  Resend code
                </button>
              ) : (
                <p className="text-sm text-slate-500">
                  Didn't receive it? Resend available in {formatTimer(otpTimer)}
                </p>
              )}
            </div>

            {/* Back to form */}
            <div className="mt-4 text-center">
              <button
                onClick={() => setStep('form')}
                className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-300 transition-colors"
              >
                <ArrowLeft size={14} />
                Back to registration
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Registration Form ─────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMxZTI5M2IiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-20" />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20 mb-4">
            <ShieldAlert size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">ThreatWatch</h1>
          <p className="text-sm text-slate-400 mt-1">Create Your SOC Account</p>
        </div>

        {/* Register card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl p-8 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white">Register</h2>
            <p className="text-sm text-slate-400 mt-1">
              Fill in your details — a verification code will be sent to your email
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="reg-username" className="block text-sm font-medium text-slate-300 mb-1.5">
                  Username *
                </label>
                <input
                  id="reg-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Choose a username"
                  autoComplete="username"
                  autoFocus
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                />
              </div>
              <div>
                <label htmlFor="reg-name" className="block text-sm font-medium text-slate-300 mb-1.5">
                  Full Name
                </label>
                <input
                  id="reg-name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  autoComplete="name"
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reg-email" className="block text-sm font-medium text-slate-300 mb-1.5">
                Company Email *
              </label>
              <input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                className="w-full px-4 py-2.5 rounded-lg bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
              />
            </div>

            <div>
              <label htmlFor="reg-password" className="block text-sm font-medium text-slate-300 mb-1.5">
                Password *
              </label>
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  autoComplete="new-password"
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="reg-confirm" className="block text-sm font-medium text-slate-300 mb-1.5">
                Confirm Password *
              </label>
              <input
                id="reg-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password"
                autoComplete="new-password"
                className="w-full px-4 py-2.5 rounded-lg bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-900/30 border border-red-800/50 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-semibold text-sm hover:from-indigo-500 hover:to-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/20"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Activity size={16} className="animate-spin" />
                  Sending verification...
                </span>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500">
              Already have an account?{' '}
              <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
