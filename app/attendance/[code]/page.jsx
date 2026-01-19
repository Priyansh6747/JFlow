"use client";

/**
 * Attendance Detail Page - Shows daily attendance for a specific subject
 * Fetches per-class attendance from JIIT and displays a graph
 */

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Storage } from '@/lib/storage';
import { Portal } from '@/lib/JiitManager';
import AttendanceChart from '@/components/AttendanceChart';
import { ArrowLeft, RefreshCw, Calendar, Clock, CheckCircle, XCircle, Target } from 'lucide-react';

export default function AttendanceDetailPage({ params }) {
    // Unwrap params with React.use() for Next.js 15+
    const { code } = use(params);
    const decodedCode = decodeURIComponent(code);

    const router = useRouter();
    const { jiitCredentials } = useAuth();
    const [subjectInfo, setSubjectInfo] = useState(null);
    const [dailyData, setDailyData] = useState([]);
    const [chartData, setChartData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [targetAttendance, setTargetAttendance] = useState(75);

    useEffect(() => {
        setTargetAttendance(Storage.getTargetAttendance());
    }, []);

    useEffect(() => {
        loadSubjectData();
    }, [decodedCode]);

    const loadSubjectData = async () => {
        setIsLoading(true);
        setError(null);

        try {
            // Get subject info from localStorage attendance
            const attendance = Storage.getAttendance();
            const subject = attendance.find(a => a.subjectCode === decodedCode);

            if (subject) {
                setSubjectInfo(subject);
            }

            // Try to fetch daily attendance from JIIT
            if (jiitCredentials && subject?._subjectId) {
                await fetchDailyAttendance(subject);
            } else {
                // Can't fetch - no credentials or subject info
                setDailyData([]);
            }
        } catch (err) {
            console.error('Failed to load subject data:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchDailyAttendance = async (subject) => {
        try {
            // Ensure we're logged in
            await Portal.login(jiitCredentials.enrollment, jiitCredentials.password);
            const semester = await Portal.getLatestSemester();

            const daily = await Portal.getSubjectDailyAttendance(
                semester,
                subject._subjectId,
                subject.subjectCode,
                subject._componentIds || []
            );

            if (daily && Array.isArray(daily)) {
                setDailyData(daily);

                // Transform to chart data - cumulative attendance over time
                const chartPoints = [];
                let attended = 0;
                let total = 0;

                daily.forEach((d, i) => {
                    total++;
                    if (d.studentstatus === 'Present' || d.studentstatus === 'P' || d.present === 'Present') {
                        attended++;
                    }

                    // Add a data point every few classes or on last
                    if (i === 0 || i === daily.length - 1 || i % Math.ceil(daily.length / 6) === 0) {
                        const date = d.attendancedate || d.date || new Date().toISOString();
                        chartPoints.push({
                            date,
                            percentage: total > 0 ? Math.round((attended / total) * 100) : 0
                        });
                    }
                });

                setChartData(chartPoints);
            }
        } catch (err) {
            console.warn('Failed to fetch daily attendance:', err.message);
            // Not critical - we still show the overview
        }
    };

    const getStatusColor = (status) => {
        if (status === 'Present' || status === 'P') return 'var(--success)';
        if (status === 'Absent' || status === 'A') return 'var(--danger)';
        return 'var(--text-secondary)';
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
                    <div style={{ minWidth: 0 }}>
                        <h1 style={{
                            fontSize: '1.1rem',
                            margin: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}>
                            {subjectInfo?.subjectName || decodedCode}
                        </h1>
                        <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                            {decodedCode}
                        </span>
                    </div>
                </div>
                <button
                    className="btn btn-ghost"
                    onClick={loadSubjectData}
                    disabled={isLoading}
                    style={{ padding: '8px' }}
                >
                    <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                </button>
            </header>

            {/* Content */}
            <main style={{ padding: '16px', paddingBottom: '32px' }}>
                {isLoading ? (
                    <div className="empty-state">
                        <RefreshCw size={32} className="animate-spin" />
                        <p>Loading attendance details...</p>
                    </div>
                ) : error ? (
                    <div className="empty-state">
                        <p className="text-danger">{error}</p>
                        <button className="btn btn-primary" onClick={loadSubjectData}>
                            Retry
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Overview Card */}
                        {subjectInfo && (
                            <div style={{
                                backgroundColor: 'var(--surface)',
                                borderRadius: '12px',
                                padding: '20px',
                                marginBottom: '20px',
                                border: '1px solid var(--border)'
                            }}>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '16px'
                                }}>
                                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                        Overall Attendance
                                    </span>
                                    <span style={{
                                        fontSize: '2rem',
                                        fontWeight: '600',
                                        color: subjectInfo.percentage >= targetAttendance ? '#00D9FF' :
                                            subjectInfo.percentage >= targetAttendance - 10 ? '#F5A623' : '#FF6B6B'
                                    }}>
                                        {Math.round(subjectInfo.percentage || 0)}%
                                    </span>
                                </div>

                                {/* Target indicator */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    marginBottom: '12px',
                                    padding: '6px 10px',
                                    backgroundColor: 'var(--surface-secondary)',
                                    borderRadius: '6px',
                                    width: 'fit-content'
                                }}>
                                    <Target size={14} style={{ color: 'var(--accent-primary)' }} />
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                        Target: {targetAttendance}%
                                    </span>
                                </div>

                                <div style={{ display: 'flex', gap: '20px', fontSize: '0.85rem' }}>
                                    {subjectInfo.Lpercentage !== undefined && (
                                        <div>
                                            <span className="text-muted">Lecture:</span>{' '}
                                            <span style={{ color: 'var(--accent-primary)' }}>{subjectInfo.Lpercentage}%</span>
                                        </div>
                                    )}
                                    {subjectInfo.Tpercentage !== undefined && (
                                        <div>
                                            <span className="text-muted">Tutorial:</span>{' '}
                                            <span style={{ color: 'var(--success)' }}>{subjectInfo.Tpercentage}%</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Chart */}
                        <div style={{
                            backgroundColor: 'var(--surface)',
                            borderRadius: '12px',
                            padding: '16px',
                            marginBottom: '20px',
                            border: '1px solid var(--border)'
                        }}>
                            <h3 style={{ fontSize: '0.9rem', marginBottom: '12px', color: 'var(--text-secondary)' }}>
                                Attendance Trend
                            </h3>
                            <AttendanceChart data={chartData} height={180} />
                        </div>

                        {/* Daily Breakdown */}
                        {dailyData.length > 0 && (
                            <div style={{
                                backgroundColor: 'var(--surface)',
                                borderRadius: '12px',
                                padding: '16px',
                                border: '1px solid var(--border)'
                            }}>
                                <h3 style={{ fontSize: '0.9rem', marginBottom: '12px', color: 'var(--text-secondary)' }}>
                                    Class History ({dailyData.length} classes)
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {dailyData.slice(-10).reverse().map((d, i) => (
                                        <div
                                            key={i}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '10px 12px',
                                                backgroundColor: 'var(--background)',
                                                borderRadius: '8px',
                                                fontSize: '0.85rem'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                {(d.studentstatus === 'Present' || d.studentstatus === 'P') ? (
                                                    <CheckCircle size={16} style={{ color: 'var(--success)' }} />
                                                ) : (
                                                    <XCircle size={16} style={{ color: 'var(--danger)' }} />
                                                )}
                                                <span>
                                                    {d.attendancedate ? new Date(d.attendancedate).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric'
                                                    }) : `Class ${dailyData.length - i}`}
                                                </span>
                                            </div>
                                            <span style={{
                                                color: getStatusColor(d.studentstatus),
                                                fontWeight: '500'
                                            }}>
                                                {d.studentstatus || 'N/A'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                {dailyData.length > 10 && (
                                    <p className="text-muted" style={{ textAlign: 'center', marginTop: '12px', fontSize: '0.75rem' }}>
                                        Showing last 10 of {dailyData.length} classes
                                    </p>
                                )}
                            </div>
                        )}

                        {dailyData.length === 0 && !isLoading && (
                            <div className="empty-state" style={{ marginTop: '20px' }}>
                                <Calendar size={32} />
                                <p>Daily attendance data not available</p>
                                <p className="text-muted" style={{ fontSize: '0.8rem' }}>
                                    The portal may not have detailed records for this subject
                                </p>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
