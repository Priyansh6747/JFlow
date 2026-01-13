"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Eye, EyeOff, Mail } from 'lucide-react';

// Google icon SVG
const GoogleIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
);

export default function SignIn() {
    const router = useRouter();
    const { user, loading: authLoading, needsOnboarding, signIn, signUp, signInWithGoogle } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showEmailForm, setShowEmailForm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Redirect if already logged in
    useEffect(() => {
        if (!authLoading && user) {
            if (needsOnboarding) {
                router.replace('/onboarding');
            } else {
                router.replace('/timetable');
            }
        }
    }, [user, authLoading, needsOnboarding, router]);

    // Handle Google OAuth sign-in
    const handleGoogleSignIn = async () => {
        setLoading(true);
        setError(null);

        try {
            await signInWithGoogle();
            // Redirect handled by useEffect
        } catch (err) {
            console.error('Google OAuth error:', err);
            if (err.code === 'auth/popup-closed-by-user') {
                // User closed popup, no error to show
            } else if (err.code === 'auth/account-exists-with-different-credential') {
                setError('An account already exists with this email.');
            } else {
                setError(err.message || 'Failed to sign in. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    // Handle email/password sign-in
    const handleEmailSubmit = async (e) => {
        e.preventDefault();

        if (!email.trim() || !password.trim()) {
            setError('Please enter both email and password');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await signIn(email.trim(), password);
        } catch (err) {
            if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
                try {
                    await signUp(email.trim(), password);
                    return;
                } catch (signUpErr) {
                    if (signUpErr.code === 'auth/email-already-in-use') {
                        setError('Incorrect password');
                    } else {
                        setError(signUpErr.message);
                    }
                }
            } else if (err.code === 'auth/wrong-password') {
                setError('Incorrect password');
            } else if (err.code === 'auth/invalid-email') {
                setError('Invalid email address');
            } else if (err.code === 'auth/too-many-requests') {
                setError('Too many attempts. Please try again later.');
            } else {
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    if (authLoading) {
        return (
            <div className="loading-screen">
                <div className="spinner spinner-lg"></div>
            </div>
        );
    }

    return (
        <div className="page-center">
            <div className="auth-card">
                <div className="auth-header">
                    <h1>JFlow</h1>
                    <p className="text-secondary">Your JIIT timetable, simplified</p>
                </div>

                {error && <div className="auth-error">{error}</div>}

                {/* Google Sign-In Button */}
                <button
                    className="btn btn-google w-full"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    style={{ padding: '12px', justifyContent: 'center' }}
                >
                    <GoogleIcon />
                    Continue with Google
                </button>

                {/* Divider */}
                <div className="divider" style={{ margin: '20px 0' }}>
                    <span style={{ fontSize: '0.75rem' }}>or</span>
                </div>

                {/* Email toggle or form */}
                {!showEmailForm ? (
                    <button
                        className="btn btn-secondary w-full"
                        onClick={() => setShowEmailForm(true)}
                        style={{ padding: '12px', justifyContent: 'center' }}
                    >
                        <Mail size={18} />
                        Continue with Email
                    </button>
                ) : (
                    <form className="auth-form" onSubmit={handleEmailSubmit}>
                        <div className="input-group">
                            <label htmlFor="email">Email</label>
                            <input
                                type="email"
                                id="email"
                                className="input"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={loading}
                                autoComplete="email"
                            />
                        </div>

                        <div className="input-group">
                            <label htmlFor="password">Password</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    id="password"
                                    className="input w-full"
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={loading}
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute',
                                        right: '12px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--text-muted)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary w-full"
                            disabled={loading}
                            style={{ padding: '12px' }}
                        >
                            {loading ? (
                                <>
                                    <span className="spinner" style={{ width: '16px', height: '16px' }}></span>
                                    Signing in...
                                </>
                            ) : (
                                'Sign In'
                            )}
                        </button>

                        <button
                            type="button"
                            className="btn btn-ghost w-full"
                            onClick={() => setShowEmailForm(false)}
                            style={{ marginTop: '-8px' }}
                        >
                            Back to other options
                        </button>
                    </form>
                )}

                <p className="text-muted text-center" style={{ marginTop: '24px', fontSize: '0.75rem' }}>
                    New users will be registered automatically.
                </p>
            </div>
        </div>
    );
}