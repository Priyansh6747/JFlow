"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme, themes } from '@/context/ThemeContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import {
    ArrowLeft,
    Eye,
    EyeOff,
    Trash2,
    Plus,
    Wifi,
    WifiOff,
    RefreshCw,
    Circle,
    Check
} from 'lucide-react';

export default function Settings() {
    const router = useRouter();
    const { user, loading: authLoading, jiitStatus, jiitCredentials, saveJiitCredentials, silentSync, signOut } = useAuth();
    const { theme, setTheme } = useTheme();

    // JIIT credentials
    const [enrollment, setEnrollment] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [savingCreds, setSavingCreds] = useState(false);
    const [credsError, setCredsError] = useState(null);
    const [credsSuccess, setCredsSuccess] = useState(false);

    // Subjects
    const [subjects, setSubjects] = useState([]);
    const [loadingSubjects, setLoadingSubjects] = useState(true);

    // Add subject modal
    const [showAddModal, setShowAddModal] = useState(false);
    const [newSubjectCode, setNewSubjectCode] = useState('');
    const [newSubjectName, setNewSubjectName] = useState('');
    const [addingSubject, setAddingSubject] = useState(false);

    // Auth check
    useEffect(() => {
        if (!authLoading && !user) {
            router.replace('/signin');
        }
    }, [user, authLoading, router]);

    // Load JIIT credentials
    useEffect(() => {
        if (jiitCredentials) {
            setEnrollment(jiitCredentials.enrollment || '');
            // Don't show the actual password for security
        }
    }, [jiitCredentials]);

    // Load subjects from Firestore
    useEffect(() => {
        if (user) {
            loadSubjects();
        }
    }, [user]);

    const loadSubjects = async () => {
        if (!user) return;

        setLoadingSubjects(true);
        try {
            const subjectsRef = collection(db, 'users', user.uid, 'subjects');
            const snapshot = await getDocs(subjectsRef);

            const subjectList = [];
            snapshot.forEach(doc => {
                subjectList.push({ id: doc.id, ...doc.data() });
            });

            // Sort: visible first, then by name
            subjectList.sort((a, b) => {
                if (a.isHidden !== b.isHidden) return a.isHidden ? 1 : -1;
                return a.name.localeCompare(b.name);
            });

            setSubjects(subjectList);
        } catch (err) {
            console.error('Failed to load subjects:', err);
        } finally {
            setLoadingSubjects(false);
        }
    };

    // Save JIIT credentials
    const handleSaveCredentials = async (e) => {
        e.preventDefault();

        if (!enrollment.trim()) {
            setCredsError('Please enter enrollment number');
            return;
        }

        if (!password.trim()) {
            setCredsError('Please enter password');
            return;
        }

        setSavingCreds(true);
        setCredsError(null);
        setCredsSuccess(false);

        try {
            await saveJiitCredentials(enrollment.trim(), password);
            setCredsSuccess(true);
            setPassword(''); // Clear password field

            // Trigger sync
            const result = await silentSync();
            if (result.status === 'success') {
                await loadSubjects(); // Reload subjects
            } else if (result.status === 'offline') {
                setCredsError('Credentials saved but JIIT portal is offline. Will sync when available.');
            }
        } catch (err) {
            setCredsError(err.message);
        } finally {
            setSavingCreds(false);
        }
    };

    // Toggle subject visibility (soft delete)
    const toggleSubjectVisibility = async (subject) => {
        try {
            const docRef = doc(db, 'users', user.uid, 'subjects', subject.id);
            await updateDoc(docRef, { isHidden: !subject.isHidden });

            setSubjects(prev => prev.map(s =>
                s.id === subject.id ? { ...s, isHidden: !s.isHidden } : s
            ));
        } catch (err) {
            console.error('Failed to toggle subject:', err);
        }
    };

    // Delete custom subject
    const deleteSubject = async (subject) => {
        if (!subject.isCustom) return;

        if (!confirm(`Delete "${subject.name}"?`)) return;

        try {
            const docRef = doc(db, 'users', user.uid, 'subjects', subject.id);
            await deleteDoc(docRef);

            setSubjects(prev => prev.filter(s => s.id !== subject.id));
        } catch (err) {
            console.error('Failed to delete subject:', err);
        }
    };

    // Add custom subject
    const handleAddSubject = async (e) => {
        e.preventDefault();

        if (!newSubjectCode.trim() || !newSubjectName.trim()) return;

        setAddingSubject(true);
        try {
            const docRef = doc(db, 'users', user.uid, 'subjects', newSubjectCode.trim().toUpperCase());
            await setDoc(docRef, {
                code: newSubjectCode.trim().toUpperCase(),
                name: newSubjectName.trim(),
                components: [],
                isHidden: false,
                isCustom: true,
                attendance: null,
                lastSynced: null
            });

            await loadSubjects();
            setShowAddModal(false);
            setNewSubjectCode('');
            setNewSubjectName('');
        } catch (err) {
            console.error('Failed to add subject:', err);
        } finally {
            setAddingSubject(false);
        }
    };

    // Logout
    const handleLogout = async () => {
        await signOut();
        router.replace('/signin');
    };

    if (authLoading) {
        return (
            <div className="loading-screen">
                <div className="spinner spinner-lg"></div>
            </div>
        );
    }

    return (
        <div className="page">
            {/* Header */}
            <div className="header">
                <button className="btn btn-ghost" onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ArrowLeft size={16} /> Back
                </button>
                <h2>Settings</h2>
                <div style={{ width: '60px' }}></div>
            </div>

            <div className="page-content">
                {/* JIIT Credentials Section */}
                <div className="card">
                    <h3 style={{ marginBottom: '16px' }}>JIIT Portal Credentials</h3>
                    <p className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '16px' }}>
                        Link your JIIT WebPortal account to sync subjects and attendance.
                    </p>

                    <form onSubmit={handleSaveCredentials} className="flex flex-col gap-md">
                        {credsError && <div className="auth-error">{credsError}</div>}
                        {credsSuccess && (
                            <div style={{
                                backgroundColor: 'rgba(129, 199, 132, 0.1)',
                                border: '1px solid var(--success)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '8px 16px',
                                color: 'var(--success)',
                                fontSize: '0.875rem'
                            }}>
                                Credentials saved successfully!
                            </div>
                        )}

                        <div className="input-group">
                            <label htmlFor="enrollment">Enrollment Number</label>
                            <input
                                type="text"
                                id="enrollment"
                                className="input"
                                placeholder="e.g. 21103001"
                                value={enrollment}
                                onChange={(e) => setEnrollment(e.target.value)}
                                disabled={savingCreds}
                            />
                        </div>

                        <div className="input-group">
                            <label htmlFor="jiitPassword">Password</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    id="jiitPassword"
                                    className="input w-full"
                                    placeholder={jiitCredentials ? '••••••••' : 'Enter password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={savingCreds}
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

                        <div className="flex items-center justify-between">
                            <span className="text-muted" style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                Status: {jiitStatus === 'online' ? <><Wifi size={12} className="text-success" /> Connected</> :
                                    jiitStatus === 'syncing' ? <><RefreshCw size={12} className="animate-spin" /> Syncing</> :
                                        jiitStatus === 'offline' ? <><WifiOff size={12} className="text-danger" /> Offline</> : <><Circle size={12} /> Not synced</>}
                            </span>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={savingCreds}
                            >
                                {savingCreds ? 'Saving...' : 'Save & Sync'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Subjects Section */}
                <div className="card">
                    <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
                        <h3>Subjects</h3>
                        <button className="btn btn-secondary" onClick={() => setShowAddModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Plus size={14} /> Add
                        </button>
                    </div>

                    <p className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '16px' }}>
                        Toggle visibility or add custom subjects. Hidden subjects won't appear in timetable dropdown.
                    </p>

                    {loadingSubjects ? (
                        <div className="flex items-center justify-center" style={{ padding: '24px' }}>
                            <div className="spinner"></div>
                        </div>
                    ) : subjects.length === 0 ? (
                        <div className="empty-state" style={{ padding: '24px' }}>
                            <p className="text-muted">No subjects yet. Sync with JIIT or add custom subjects.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-sm">
                            {subjects.map(subject => (
                                <div
                                    key={subject.id}
                                    className="card-inner flex items-center justify-between"
                                    style={{ opacity: subject.isHidden ? 0.5 : 1 }}
                                >
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                                            {subject.name}
                                            {subject.isCustom && (
                                                <span className="text-muted" style={{ marginLeft: '8px', fontSize: '0.75rem' }}>
                                                    (Custom)
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                                            {subject.code}
                                            {subject.attendance !== null && ` • ${subject.attendance}%`}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-sm">
                                        {/* Visibility Toggle */}
                                        <button
                                            className="btn btn-ghost"
                                            onClick={() => toggleSubjectVisibility(subject)}
                                            title={subject.isHidden ? 'Show' : 'Hide'}
                                        >
                                            {subject.isHidden ? <Eye size={16} /> : <EyeOff size={16} />}
                                        </button>

                                        {/* Delete (only for custom) */}
                                        {subject.isCustom && (
                                            <button
                                                className="btn btn-ghost"
                                                onClick={() => deleteSubject(subject)}
                                                style={{ color: 'var(--danger)' }}
                                                title="Delete"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Appearance Section */}
                <div className="card">
                    <h3 style={{ marginBottom: '16px' }}>Appearance</h3>
                    <p className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '16px' }}>
                        Choose a theme that fits your vibe.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                        {themes.map(t => (
                            <div
                                key={t.id}
                                onClick={() => setTheme(t.id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '12px',
                                    borderRadius: 'var(--radius-sm)',
                                    border: theme === t.id ? `2px solid ${t.accent}` : '2px solid var(--grid-lines)',
                                    cursor: 'pointer',
                                    backgroundColor: 'var(--surface-secondary)',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {/* Color preview */}
                                <div style={{
                                    display: 'flex',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    width: '36px',
                                    height: '36px',
                                    flexShrink: 0
                                }}>
                                    <div style={{ flex: 1, backgroundColor: t.preview[0] }} />
                                    <div style={{ flex: 1, backgroundColor: t.preview[1] }} />
                                    <div style={{ flex: 1, backgroundColor: t.preview[2] }} />
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{t.name}</div>
                                </div>

                                {theme === t.id && (
                                    <Check size={16} style={{ color: t.accent }} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Account Section */}
                <div className="card">
                    <h3 style={{ marginBottom: '16px' }}>Account</h3>

                    <div className="flex items-center justify-between">
                        <div>
                            <p style={{ fontWeight: 500 }}>{user?.email}</p>
                            <p className="text-muted" style={{ fontSize: '0.75rem' }}>Signed in</p>
                        </div>
                        <button className="btn btn-danger" onClick={handleLogout}>
                            Sign Out
                        </button>
                    </div>
                </div>
            </div>

            {/* Add Subject Modal */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Add Custom Subject</h2>
                            <button className="btn btn-ghost" onClick={() => setShowAddModal(false)}>✕</button>
                        </div>

                        <form onSubmit={handleAddSubject}>
                            <div className="modal-body">
                                <div className="input-group">
                                    <label htmlFor="subjectCode">Subject Code</label>
                                    <input
                                        type="text"
                                        id="subjectCode"
                                        className="input"
                                        placeholder="e.g. CS101"
                                        value={newSubjectCode}
                                        onChange={(e) => setNewSubjectCode(e.target.value)}
                                        disabled={addingSubject}
                                    />
                                </div>

                                <div className="input-group">
                                    <label htmlFor="subjectName">Subject Name</label>
                                    <input
                                        type="text"
                                        id="subjectName"
                                        className="input"
                                        placeholder="e.g. Introduction to Programming"
                                        value={newSubjectName}
                                        onChange={(e) => setNewSubjectName(e.target.value)}
                                        disabled={addingSubject}
                                    />
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={addingSubject}>
                                    {addingSubject ? 'Adding...' : 'Add Subject'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
