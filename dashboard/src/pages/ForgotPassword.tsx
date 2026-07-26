import { useState, FormEvent, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldAlert, Activity, CheckCircle, Mail, ArrowLeft, RefreshCw, Key } from 'lucide-react';
import { api } from '../api/client';

export default function ForgotPassword() {
  const [step, setStep] = useState<'email' | 'otp' | 'success'>('email');

  // Email step
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  // OTP + new password step
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpTimer, setOtpTimer] = useState(600);
  const [canResend, setCanResend] = useState(false);

  // State
  const [submitting, setSubmitting] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const navigate = useNavigate();

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

  // Focus first OTP input
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    }
  }, [step]);

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').slice(0, 6);
      const newOtp = [...otp];
      for (let i = 0; i < 6; i++) {
        newOtp[i] = digits[i] || '';
      }
      setOtp(newOtp);
      const lastIdx = Math.min(digits.length, 5);
      otpRefs.current[lastIdx]?.focus();
      return;
    }
    if (value && !/^\d$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
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

  // Step 1: Send OTP to email
  const handleSendOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.forgotPassword(email.trim());
      setOtpEmail(result.email);
      setOtpTimer(600);
      setCanResend(false);
      setOtp(['', '', '', '', '', '']);
      setStep('otp');
    } catch (err: any) {
      setError(
        err?.message?.includes('404')
          ? 'No account found with this email'
          : err?.message || 'Failed to send code. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2: Verify OTP + set new password
  const handleResetPassword = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await api.resetPassword(otpEmail, otpCode, newPassword);
      setStep('success');
      setTimeout(() => navigate('/login', { replace: true }), 2000);
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
      const result = await api.forgotPassword(otpEmail);
      setOtpTimer(600);
      setCanResend(false);
      setOtp(['', '', '', '', '', '']);
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Failed to resend code');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success Screen ─────────────────────────────────────────────

  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4"
        style={{ background: 'linear-gradient(135deg, var(--bg-base), var(--bg-surface), var(--bg-base))' }}
      >
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/20 mb-4">
            <CheckCircle size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Password Reset!</h2>
          <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>Redirecting you to sign in...</p>
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
      <div className="min-h-screen flex items-center justify-center p-4"
        style={{ background: 'linear-gradient(135deg, var(--bg-base), var(--bg-surface), var(--bg-base))' }}
      >
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMxZTI5M2IiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiLz48L2c+PC9nPjwvc3ZnPg==')`,
          }}
        />

        <div className="relative w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20 mb-4">
              <Mail size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Reset Your Password</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Code sent to <span className="text-indigo-400 font-medium">{otpEmail}</span>
            </p>
          </div>

          <div className="rounded-2xl backdrop-blur-xl p-8 shadow-2xl"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
          >
            {/* OTP Input */}
            <div className="mb-6 text-center">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Enter Verification Code</h2>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                Code expires in{' '}
                <span className={`font-mono font-medium ${otpTimer < 60 ? 'text-red-400' : ''}`} style={otpTimer >= 60 ? { color: 'var(--text-primary)' } : {}}>
                  {formatTimer(otpTimer)}
                </span>
              </p>
            </div>

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
                  className="w-12 h-14 text-center text-xl font-bold rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all input-field"
                />
              ))}
            </div>

            {/* New Password */}
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  New Password *
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="input-field w-full px-4 py-2.5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="input-field w-full px-4 py-2.5"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg px-4 py-3 text-sm text-red-300 mb-4 text-center" style={{ backgroundColor: 'rgba(220, 38, 38, 0.15)', border: '1px solid rgba(220, 38, 38, 0.3)' }}>
                {error}
              </div>
            )}

            <button
              onClick={handleResetPassword}
              disabled={submitting || otp.join('').length !== 6 || !newPassword}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-semibold text-sm hover:from-indigo-500 hover:to-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/20 mb-3 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Activity size={16} className="animate-spin" />
                  Resetting...
                </span>
              ) : (
                <>
                  <Key size={16} />
                  Reset Password
                </>
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
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Resend available in {formatTimer(otpTimer)}
                </p>
              )}
            </div>

            {/* Back to email */}
            <div className="mt-4 text-center">
              <button
                onClick={() => setStep('email')}
                className="inline-flex items-center gap-1 text-sm transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                <ArrowLeft size={14} />
                Back to email
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Email Form ─────────────────────────────────────────────

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, var(--bg-base), var(--bg-surface), var(--bg-base))' }}
    >
      <div className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMxZTI5M2IiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiLz48L2c+PC9nPjwvc3ZnPg==')`,
        }}
      />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20 mb-4">
            <ShieldAlert size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>ThreatWatch</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Reset Your Password</p>
        </div>

        <div className="rounded-2xl backdrop-blur-xl p-8 shadow-2xl"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
        >
          <div className="mb-6">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Forgot Password</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Enter your email address and we'll send you a verification code to reset your password.
            </p>
          </div>

          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label htmlFor="reset-email" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                Company Email *
              </label>
              <input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                autoFocus
                className="input-field w-full px-4 py-2.5"
              />
            </div>

            {error && (
              <div className="rounded-lg px-4 py-3 text-sm text-red-300" style={{ backgroundColor: 'rgba(220, 38, 38, 0.15)', border: '1px solid rgba(220, 38, 38, 0.3)' }}>
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
                  Sending code...
                </span>
              ) : (
                'Send Verification Code'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/login" className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors" style={{ color: '#818cf8' }}>
              <ArrowLeft size={14} />
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
