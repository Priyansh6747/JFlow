"use client";

/**
 * Attendance Page - Shows all subjects with attendance
 * Triggers silent caching of daily attendance for all subjects
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Storage } from '@/lib/storage';
import { DailyAttendanceCache } from '@/lib/dailyAttendanceCache';
import AttendanceCard from '@/components/AttendanceCard';
import { ArrowLeft, RefreshCw, Target } from 'lucide-react';

export default function AttendancePage() {
    const router = useRouter();
    const { user, jiitCredentials, silentSync, jiitStatus } = useAuth();
    const [attendance, setAttendance] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [targetAttendance, setTargetAttendance] = useState(75);

    useEffect(() => {
        // Load attendance from localStorage
        const cached = Storage.getAttendance();
        if (cached && cached.length > 0) {
            setAttendance(cached);
        }
        // Load target attendance
        setTargetAttendance(Storage.getTargetAttendance());
        setIsLoading(false);
    }, []);

    // Trigger silent caching of daily attendance when JIIT is online
    useEffect(() => {
        if (jiitStatus === 'online' && jiitCredentials) {
            const uid = user?.uid || null;
            DailyAttendanceCache.triggerIfNeeded(jiitCredentials, uid);
        }
    }, [jiitStatus, jiitCredentials, user]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            const result = await silentSync();
            if (result.status === 'success' && result.data.attendance) {
                setAttendance(result.data.attendance);
            }
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleTargetChange = (newTarget) => {
        const target = Math.min(100, Math.max(0, parseInt(newTarget, 10) || 75));
        setTargetAttendance(target);
        Storage.saveTargetAttendance(target);
    };

    return (
        <div className="page-container">
            {/* Header */}
            <header className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                        className="btn btn-ghost"
                        onClick={() => router.back()}
                        style={{ padding: '8px' }}
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 style={{ fontSize: '1.25rem', margin: 0 }}>Attendance</h1>
                        <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                            {attendance.length} subjects
                        </span>
                    </div>
                </div>
                <button
                    className="btn btn-ghost"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    style={{ padding: '8px' }}
                >
                    <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
                </button>
            </header>

            {/* Target Attendance Selector */}
            <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--grid-lines)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--surface-primary)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Target size={16} style={{ color: 'var(--accent-primary)' }} />
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Target</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {[65, 75, 85].map((preset) => (
                        <button
                            key={preset}
                            onClick={() => handleTargetChange(preset)}
                            style={{
                                padding: '4px 10px',
                                borderRadius: '16px',
                                border: targetAttendance === preset ? '1px solid var(--accent-primary)' : '1px solid var(--grid-lines)',
                                backgroundColor: targetAttendance === preset ? 'var(--accent-primary)' : 'transparent',
                                color: targetAttendance === preset ? 'var(--black)' : 'var(--text-secondary)',
                                fontSize: '0.75rem',
                                fontWeight: '500',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            {preset}%
                        </button>
                    ))}
                    <input
                        type="number"
                        value={targetAttendance}
                        onChange={(e) => handleTargetChange(e.target.value)}
                        min="0"
                        max="100"
                        style={{
                            width: '50px',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: '1px solid var(--grid-lines)',
                            backgroundColor: 'var(--surface-secondary)',
                            color: 'var(--text-primary)',
                            fontSize: '0.8rem',
                            textAlign: 'center'
                        }}
                    />
                </div>
            </div>

            {/* Content */}
            <main style={{ padding: '16px', paddingBottom: '32px' }}>
                {isLoading ? (
                    <div className="empty-state">
                        <RefreshCw size={32} className="animate-spin" />
                        <p>Loading attendance...</p>
                    </div>
                ) : attendance.length === 0 ? (
                    <div className="empty-state">
                        <p>No attendance data available</p>
                        <button className="btn btn-primary" onClick={handleRefresh}>
                            Sync Now
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {(() => {
                            // Get fraction summaries from cached daily attendance
                            const fractionSummaries = Storage.getSubjectFractionSummaries();

                            return attendance.map((att, index) => {
                                // Get fraction for this subject
                                const subjectCode = att.individualsubjectcode || att.subjectCode;
                                const fraction = fractionSummaries[subjectCode];

                                return (
                                    <AttendanceCard
                                        key={att.subjectCode || index}
                                        code={att.subjectCode}
                                        name={att.subjectName}
                                        percentage={att.percentage || 0}
                                        attendedClasses={fraction?.attended ?? att.attendedClasses}
                                        totalClasses={fraction?.total ?? att.totalClasses}
                                        Lpercentage={att.Lpercentage}
                                        Tpercentage={att.Tpercentage}
                                        targetAttendance={targetAttendance}
                                    />
                                );
                            });
                        })()}
                    </div>
                )}
            </main>
        </div>
    );
}
