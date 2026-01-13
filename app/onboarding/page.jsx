"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Eye, EyeOff, Lock, Shield, ArrowRight, SkipForward } from 'lucide-react';

export default function Onboarding() {
    const router = useRouter();
    const { user, loading: authLoading, needsOnboarding, saveJiitCredentials, skipOnboarding, silentSync } = useAuth();

    const [enrollment, setEnrollment] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    // Redirect if not logged in or doesn't need onboarding
    useEffect(() => {
        if (!authLoading) {
            if (!user) {
                router.replace('/signin');
            } else if (!needsOnboarding) {
                router.replace('/timetable');
            }
        }
    }, [user, authLoading, needsOnboarding, router]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!enrollment.trim()) {
            setError('Please enter your enrollment number');
            return;
        }

        if (!password.trim()) {
            setError('Please enter your password');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Save credentials to localStorage only
            await saveJiitCredentials(enrollment.trim(), password, false);

            setSuccess(true);

            // Try to sync in background
            silentSync().catch(() => {
                // Silent failure is fine
            });

            // Short delay to show success state
            setTimeout(() => {
                router.replace('/timetable');
            }, 1000);
        } catch (err) {
            setError(err.message || 'Failed to save credentials');
            setLoading(false);
        }
    };

    const handleSkip = () => {
        skipOnboarding();
        router.replace('/timetable');
    };

    if (authLoading) {
        return (
            <div className="loading-screen">
                <div className="spinner spinner-lg"></div>
            </div>
        );
    }

    // Success state
    if (success) {
        return (
            <div className="page-center">
                <div className="auth-card" style={{ textAlign: 'center' }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        background: 'var(--success)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px'
                    }}>
                        <Shield size={32} color="var(--black)" />
                    </div>
                    <h2>You're all set!</h2>
                    <p className="text-secondary" style={{ marginTop: '8px' }}>
                        Credentials saved securely on your device.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="page-center">
            <div className="auth-card">
                <div className="auth-header">
                    <h1>Welcome{user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}!</h1>
                    <p className="text-secondary">
                        Connect your JIIT WebPortal to sync your timetable and attendance.
                    </p>
                </div>

                {/* Privacy Badge */}
                <div className="privacy-badge">
                    <Lock size={16} />
                    <span>Stored locally only — never sent to our servers</span>
                </div>

                <form className="auth-form" onSubmit={handleSubmit} style={{ marginTop: '16px' }}>
                    {error && <div className="auth-error">{error}</div>}

                    <div className="input-group">
                        <label htmlFor="enrollment">Enrollment Number</label>
                        <input
                            type="text"
                            id="enrollment"
                            className="input"
                            placeholder="e.g. 21103001"
                            value={enrollment}
                            onChange={(e) => setEnrollment(e.target.value)}
                            disabled={loading}
                            autoComplete="username"
                        />
                    </div>

                    <div className="input-group">
                        <label htmlFor="jiitPassword">WebPortal Password</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                id="jiitPassword"
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
                        style={{ padding: '12px', marginTop: '8px' }}
                    >
                        {loading ? (
                            <>
                                <span className="spinner" style={{ width: '16px', height: '16px' }}></span>
                                Saving...
                            </>
                        ) : (
                            <>
                                Continue
                                <ArrowRight size={16} />
                            </>
                        )}
                    </button>
                </form>

                {/* Skip button */}
                <button
                    className="btn btn-ghost w-full"
                    onClick={handleSkip}
                    disabled={loading}
                    style={{ marginTop: '12px' }}
                >
                    <SkipForward size={16} />
                    I'll do this later
                </button>

                <p className="text-muted text-center" style={{ marginTop: '24px', fontSize: '0.7rem' }}>
                    Your credentials are only used to fetch your data from the JIIT WebPortal.
                    They are stored in your browser's local storage and never leave your device.
                </p>
            </div>
        </div>
    );
}
