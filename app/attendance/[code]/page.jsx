"use client";

/**
 * Attendance Detail Page - Shows daily attendance for a specific subject
 * Fetches per-class attendance from JIIT and displays a graph
 * Uses 2-layer cache (localStorage + Firestore) with 6-hour expiry
 */

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Storage } from '@/lib/storage';
import { Portal } from '@/lib/JiitManager';
import { DailyAttendanceCache } from '@/lib/dailyAttendanceCache';
import AttendanceChart from '@/components/AttendanceChart';
import AttendanceCalendar from '@/components/AttendanceCalendar';
import { ArrowLeft, RefreshCw, Calendar, Clock, CheckCircle, XCircle, Target, Loader2, TrendingUp } from 'lucide-react';

export default function AttendanceDetailPage({ params }) {
    // Unwrap params with React.use() for Next.js 15+
    const { code } = use(params);
    const decodedCode = decodeURIComponent(code);

    const router = useRouter();
    const { user, jiitCredentials, jiitStatus } = useAuth();
    const [subjectInfo, setSubjectInfo] = useState(null);
    const [dailyData, setDailyData] = useState([]);
    const [chartData, setChartData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFetchingDaily, setIsFetchingDaily] = useState(false);
    const [fromCache, setFromCache] = useState(false);
    const [error, setError] = useState(null);
    const [targetAttendance, setTargetAttendance] = useState(75);
    const [viewMode, setViewMode] = useState('calendar'); // 'calendar' or 'list'

    useEffect(() => {
        setTargetAttendance(Storage.getTargetAttendance());
    }, []);

    useEffect(() => {
        loadSubjectData();
    }, [decodedCode]);

    // When sync completes, try to fetch daily attendance if we don't have it yet
    useEffect(() => {
        if (jiitStatus === 'online' && subjectInfo && chartData.length === 0 && !isFetchingDaily) {
            console.log('Sync completed, fetching daily attendance...');
            fetchDailyAttendance(subjectInfo);
        }
    }, [jiitStatus, subjectInfo]);

    const loadSubjectData = async () => {
        setIsLoading(true);
        setError(null);

        try {
            // Get subject info from localStorage attendance
            const attendance = Storage.getAttendance();

            // Try multiple matching strategies:
            // 1. Exact match on subjectCode
            // 2. Match by extracting code from parentheses e.g., "NAME(CODE)" -> CODE
            // 3. Match on individualsubjectcode if available
            let subject = attendance.find(a => a.subjectCode === decodedCode);

            if (!subject) {
                subject = attendance.find(a => {
                    // Extract code from parentheses
                    const match = a.subjectCode?.match(/\(([^)]+)\)$/);
                    const extractedCode = match ? match[1] : null;
                    return extractedCode === decodedCode ||
                        a.individualsubjectcode === decodedCode ||
                        a.subjectCode?.includes(decodedCode);
                });
            }

            if (subject) {
                // Ensure we have the subjectId mapped correctly
                const normalizedSubject = {
                    ...subject,
                    _subjectId: subject._subjectId || subject.subjectid || subject.subjectId,
                    _componentIds: subject._componentIds || [
                        subject.Lsubjectcomponentid,
                        subject.Tsubjectcomponentid,
                        subject.Psubjectcomponentid
                    ].filter(Boolean)
                };
                setSubjectInfo(normalizedSubject);

                // Only attempt to fetch daily attendance if we're certain JIIT is online
                // This prevents race conditions with background sync
                if (jiitStatus === 'online' && jiitCredentials && normalizedSubject._subjectId) {
                    await fetchDailyAttendance(normalizedSubject);
                } else if (jiitStatus === 'syncing' || jiitStatus === 'unknown') {
                    // Wait for sync to complete - the useEffect watching jiitStatus will trigger fetch
                    console.log('Waiting for JIIT sync to complete before fetching daily attendance...');
                } else {
                    setDailyData([]);
                }
            } else {
                setDailyData([]);
            }
        } catch (err) {
            console.error('Failed to load subject data:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchDailyAttendance = async (subject, forceRefresh = false) => {
        setIsFetchingDaily(true);
        setFromCache(false);

        try {
            const subjectCode = subject.individualsubjectcode || subject.subjectCode;
            const uid = user?.uid || null;

            let daily;
            let wasFromCache = false;

            // Use cache unless force refresh
            if (!forceRefresh) {
                const cached = Storage.getSubjectDailyAttendance(subjectCode);
                if (cached && !cached.isStale) {
                    console.log(`[DetailPage] Using cached data for ${subjectCode}`);
                    daily = cached.data;
                    wasFromCache = true;
                }
            }

            // If no cache or stale, fetch through cache manager
            if (!daily && jiitCredentials) {
                const result = await DailyAttendanceCache.get(
                    subjectCode,
                    subject,
                    jiitCredentials,
                    uid
                );
                daily = result.data;
                wasFromCache = result.fromCache;
            }

            if (daily && Array.isArray(daily) && daily.length > 0) {
                setDailyData(daily);
                setFromCache(wasFromCache);

                // Sort chronologically for accurate cumulative calculation
                const sortedDaily = [...daily].sort((a, b) => {
                    const parseDate = (item) => {
                        const dt = item.datetime || item.attendancedate || '';
                        const datePart = dt.split(' (')[0];
                        const parts = datePart.split('/');
                        if (parts.length === 3) {
                            return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                        }
                        return new Date(0);
                    };
                    return parseDate(a) - parseDate(b); // Ascending order (oldest first)
                });

                // Transform to chart data - cumulative attendance over time
                const chartPoints = [];
                let attended = 0;
                let total = 0;

                sortedDaily.forEach((d, i) => {
                    total++;
                    // Check various field names for present status
                    const status = d.present || d.studentstatus || '';
                    if (status === 'Present' || status === 'P') {
                        attended++;
                    }

                    // Add a data point every few classes or on last
                    if (i === 0 || i === sortedDaily.length - 1 || i % Math.ceil(sortedDaily.length / 6) === 0) {
                        // Use 'datetime' field which has format like "16/01/2026 (12:00:PM - 12:50 PM)"
                        const date = d.datetime || d.attendancedate || d.date || new Date().toISOString();
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
        } finally {
            setIsFetchingDaily(false);
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
                <button
                    className="btn btn-ghost"
                    onClick={() => router.push(`/planning/${encodeURIComponent(decodedCode)}`)}
                    title="Plan Ahead"
                    style={{ padding: '8px' }}
                >
                    <TrendingUp size={18} />
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
                                    <div>
                                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                            Overall Attendance
                                        </span>
                                        {/* Attended/Total fraction */}
                                        {dailyData.length > 0 && (
                                            <div style={{
                                                fontSize: '0.8rem',
                                                color: 'var(--text-secondary)',
                                                marginTop: '4px'
                                            }}>
                                                {dailyData.filter(d => {
                                                    const status = d.present || d.studentstatus || '';
                                                    return status === 'Present' || status === 'P';
                                                }).length} / {dailyData.length} classes
                                            </div>
                                        )}
                                    </div>
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
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
                                    Attendance Trend
                                </h3>
                                {fromCache && !isFetchingDaily && (
                                    <span style={{
                                        fontSize: '0.7rem',
                                        color: 'var(--text-secondary)',
                                        padding: '2px 8px',
                                        backgroundColor: 'var(--surface-secondary)',
                                        borderRadius: '4px'
                                    }}>
                                        Cached
                                    </span>
                                )}
                            </div>
                            {jiitStatus === 'syncing' || isFetchingDaily ? (
                                <div style={{
                                    height: 180,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    color: 'var(--text-secondary)'
                                }}>
                                    <Loader2 size={24} className="animate-spin" style={{ color: '#00D9FF' }} />
                                    <span style={{ fontSize: '0.85rem' }}>
                                        {jiitStatus === 'syncing' ? 'Waiting for sync to complete...' : 'Loading attendance data...'}
                                    </span>
                                </div>
                            ) : (
                                <AttendanceChart data={chartData} height={180} targetAttendance={targetAttendance} />
                            )}
                        </div>

                        {/* Tabbed View: Calendar / List */}
                        {dailyData.length > 0 && (
                            <div style={{
                                backgroundColor: 'var(--surface)',
                                borderRadius: '12px',
                                border: '1px solid var(--border)',
                                overflow: 'hidden'
                            }}>
                                {/* Tab Headers */}
                                <div style={{
                                    display: 'flex',
                                    borderBottom: '1px solid var(--grid-lines)'
                                }}>
                                    <button
                                        onClick={() => setViewMode('calendar')}
                                        style={{
                                            flex: 1,
                                            padding: '12px 16px',
                                            background: viewMode === 'calendar' ? 'var(--surface-secondary)' : 'transparent',
                                            border: 'none',
                                            borderBottom: viewMode === 'calendar' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                                            color: viewMode === 'calendar' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                            fontSize: '0.85rem',
                                            fontWeight: '500',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px'
                                        }}
                                    >
                                        <Calendar size={16} />
                                        Calendar
                                    </button>
                                    <button
                                        onClick={() => setViewMode('list')}
                                        style={{
                                            flex: 1,
                                            padding: '12px 16px',
                                            background: viewMode === 'list' ? 'var(--surface-secondary)' : 'transparent',
                                            border: 'none',
                                            borderBottom: viewMode === 'list' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                                            color: viewMode === 'list' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                            fontSize: '0.85rem',
                                            fontWeight: '500',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px'
                                        }}
                                    >
                                        <Clock size={16} />
                                        History
                                    </button>
                                </div>

                                {/* Tab Content */}
                                <div style={{ padding: '16px' }}>
                                    {viewMode === 'calendar' ? (
                                        <AttendanceCalendar dailyData={dailyData} />
                                    ) : (
                                        <>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {[...dailyData]
                                                    .sort((a, b) => {
                                                        const parseDate = (item) => {
                                                            const dt = item.datetime || item.attendancedate || '';
                                                            const datePart = dt.split(' (')[0];
                                                            const parts = datePart.split('/');
                                                            if (parts.length === 3) {
                                                                return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                                                            }
                                                            return new Date(0);
                                                        };
                                                        return parseDate(b) - parseDate(a);
                                                    })
                                                    .slice(0, 10)
                                                    .map((d, i) => {
                                                        const status = d.present || d.studentstatus || 'Unknown';
                                                        const isPresent = status === 'Present' || status === 'P';
                                                        const datetime = d.datetime || d.attendancedate || '';
                                                        const datePart = datetime.split(' (')[0];
                                                        const timePart = datetime.match(/\((.+)\)/)?.[1] || '';

                                                        let formattedDate = datePart;
                                                        if (datePart) {
                                                            const parts = datePart.split('/');
                                                            if (parts.length === 3) {
                                                                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                                                                formattedDate = `${months[parseInt(parts[1]) - 1]} ${parseInt(parts[0])}`;
                                                            }
                                                        }

                                                        return (
                                                            <div
                                                                key={i}
                                                                style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'space-between',
                                                                    padding: '12px 14px',
                                                                    backgroundColor: 'var(--background)',
                                                                    borderRadius: '10px',
                                                                    fontSize: '0.85rem',
                                                                    borderLeft: `3px solid ${isPresent ? '#00D9FF' : '#FF6B6B'}`
                                                                }}
                                                            >
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                                    {isPresent ? (
                                                                        <CheckCircle size={18} style={{ color: '#00D9FF' }} />
                                                                    ) : (
                                                                        <XCircle size={18} style={{ color: '#FF6B6B' }} />
                                                                    )}
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                        <span style={{ fontWeight: '500' }}>
                                                                            {formattedDate || `Class ${dailyData.length - i}`}
                                                                        </span>
                                                                        {(d.classtype || timePart) && (
                                                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                                                {d.classtype}{d.classtype && timePart ? ' • ' : ''}{timePart}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <span style={{
                                                                    color: isPresent ? '#00D9FF' : '#FF6B6B',
                                                                    fontWeight: '600',
                                                                    fontSize: '0.8rem'
                                                                }}>
                                                                    {status}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                            {dailyData.length > 10 && (
                                                <p className="text-muted" style={{ textAlign: 'center', marginTop: '12px', fontSize: '0.75rem' }}>
                                                    Showing last 10 of {dailyData.length} classes
                                                </p>
                                            )}
                                        </>
                                    )}
                                </div>
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
