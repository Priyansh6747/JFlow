"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Eye, EyeOff, Mail } from 'lucide-react';

// Simple SVG icons for OAuth providers
const GoogleIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
);

const GithubIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
);

export default function SignIn() {
    const router = useRouter();
    const { user, loading: authLoading, needsOnboarding, signIn, signUp, signInWithGoogle, signInWithGithub } = useAuth();

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

    // Handle OAuth sign-in
    const handleOAuth = async (provider) => {
        setLoading(true);
        setError(null);

        try {
            if (provider === 'google') {
                await signInWithGoogle();
            } else if (provider === 'github') {
                await signInWithGithub();
            }
            // Redirect handled by useEffect
        } catch (err) {
            console.error('OAuth error:', err);
            if (err.code === 'auth/popup-closed-by-user') {
                // User closed popup, no error to show
            } else if (err.code === 'auth/account-exists-with-different-credential') {
                setError('An account already exists with this email. Try a different sign-in method.');
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

                {/* OAuth Buttons */}
                <div className="flex flex-col gap-sm">
                    <button
                        className="btn btn-google w-full"
                        onClick={() => handleOAuth('google')}
                        disabled={loading}
                        style={{ padding: '12px', justifyContent: 'center' }}
                    >
                        <GoogleIcon />
                        Continue with Google
                    </button>

                    <button
                        className="btn btn-github w-full"
                        onClick={() => handleOAuth('github')}
                        disabled={loading}
                        style={{ padding: '12px', justifyContent: 'center' }}
                    >
                        <GithubIcon />
                        Continue with GitHub
                    </button>
                </div>

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