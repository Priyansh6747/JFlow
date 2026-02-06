"use client";

/**
 * Attendance Planning Page
 * 
 * Shows attendance trajectory with projections based on:
 * - ERP history (solid line)
 * - Timetable future + user overrides (dashed line)
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Storage } from '@/lib/storage';
import { buildTrajectory, generateFutureSlots } from '@/lib/trajectoryEngine';
import TrajectoryChart from '@/components/TrajectoryChart';
import PlanningCalendar from '@/components/PlanningCalendar';
import { ArrowLeft, TrendingUp, TrendingDown, Target, Calendar, RefreshCw, CalendarDays } from 'lucide-react';

export default function PlanningPage() {
    const params = useParams();
    const router = useRouter();
    const subjectCode = decodeURIComponent(params.code || '');

    const { user } = useAuth();

    // Data state
    const [dailyData, setDailyData] = useState([]);
    const [timetable, setTimetable] = useState({});
    const [overrides, setOverrides] = useState({});
    const [events, setEvents] = useState([]);
    const [subjectInfo, setSubjectInfo] = useState(null);

    // UI state
    const [isLoading, setIsLoading] = useState(true);
    const [targetAttendance, setTargetAttendance] = useState(75);

    // End date for projection (default: 3 months from now)
    const getDefaultEndDate = () => {
        const d = new Date();
        d.setMonth(d.getMonth() + 3);
        return d.toISOString().split('T')[0];
    };
    const [projectionEndDate, setProjectionEndDate] = useState(getDefaultEndDate());

    // Load data on mount
    useEffect(() => {
        loadData();
    }, [subjectCode]);

    const loadData = async () => {
        setIsLoading(true);

        try {
            // Load target
            setTargetAttendance(Storage.getTargetAttendance());

            // Load timetable
            const cachedTimetable = Storage.getTimetable();
            if (cachedTimetable) {
                setTimetable(cachedTimetable);
            }

            // Load attendance data
            const attendanceList = Storage.getAttendance();
            const matchingSubject = attendanceList?.find(a => {
                const code = a.individualsubjectcode || a.subjectCode || '';
                return code.includes(subjectCode) || subjectCode.includes(code);
            });

            if (matchingSubject) {
                setSubjectInfo(matchingSubject);
            }

            // Load daily attendance from cache
            const dailyCache = Storage.getSubjectDailyAttendance(subjectCode);
            if (dailyCache?.data) {
                setDailyData(dailyCache.data);
            }

            // Load planning overrides from localStorage
            const savedOverrides = Storage.getPlanningOverrides(subjectCode);
            if (savedOverrides) {
                setOverrides(savedOverrides);
            }

        } catch (error) {
            console.error('Error loading planning data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Calculate weeks based on end date
    const weeksAhead = useMemo(() => {
        const today = new Date();
        const endDate = new Date(projectionEndDate);
        const diffMs = endDate - today;
        return Math.max(1, Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000)));
    }, [projectionEndDate]);

    // Compute trajectory whenever data changes
    const trajectoryResult = useMemo(() => {
        if (!dailyData.length || !Object.keys(timetable).length) {
            return { trajectory: [], todayIndex: 0, stats: null };
        }

        // Convert overrides object to array format
        const overridesArray = Object.entries(overrides).map(([slotId, status]) => ({
            slotId,
            status
        }));

        return buildTrajectory(
            dailyData,
            timetable,
            subjectCode,
            overridesArray,
            events,
            weeksAhead
        );
    }, [dailyData, timetable, subjectCode, overrides, events, weeksAhead]);

    // Generate future slots for calendar
    const futureSlots = useMemo(() => {
        if (!Object.keys(timetable).length) return [];

        const today = new Date();
        const endDate = new Date(projectionEndDate);

        return generateFutureSlots(timetable, subjectCode, today, endDate);
    }, [timetable, subjectCode, projectionEndDate]);

    // Handle slot toggle
    const handleSlotToggle = useCallback((slotId, newStatus) => {
        setOverrides(prev => {
            const updated = { ...prev };

            // If toggling back to default (present), remove override
            if (newStatus === 'present') {
                delete updated[slotId];
            } else {
                updated[slotId] = newStatus;
            }

            // Save to localStorage
            Storage.savePlanningOverrides(subjectCode, updated);

            return updated;
        });
    }, [subjectCode]);

    const { trajectory, todayIndex, stats } = trajectoryResult;

    if (isLoading) {
        return (
            <div className="loading-screen">
                <div className="spinner spinner-lg"></div>
                <p className="loading-text">Loading planning data...</p>
            </div>
        );
    }

    return (
        <div className="page">
            {/* Header */}
            <div className="header">
                <div className="header-title">
                    <button
                        className="btn btn-ghost"
                        onClick={() => router.back()}
                        style={{ marginRight: '8px' }}
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <span className="header-name">Attendance Planner</span>
                </div>
                <button
                    className="btn btn-ghost"
                    onClick={loadData}
                    title="Refresh data"
                >
                    <RefreshCw size={18} />
                </button>
            </div>

            {/* Content */}
            <div className="page-content" style={{ padding: '20px', gap: '20px', display: 'flex', flexDirection: 'column' }}>

                {/* Subject info header */}
                <div style={{
                    padding: '16px 20px',
                    backgroundColor: 'var(--surface)',
                    borderRadius: '12px',
                    border: '1px solid var(--border)'
                }}>
                    <h2 style={{
                        fontSize: '1.1rem',
                        fontWeight: '600',
                        marginBottom: '6px',
                        color: 'var(--text-primary)'
                    }}>
                        {subjectInfo?.subjectName || subjectCode}
                    </h2>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {subjectCode}
                    </span>
                </div>

                {/* Projection Settings */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    padding: '16px 20px',
                    backgroundColor: 'var(--surface)',
                    borderRadius: '12px',
                    border: '1px solid var(--border)',
                    flexWrap: 'wrap'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Target size={16} style={{ color: 'var(--accent-primary)' }} />
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            Target: <strong style={{ color: 'var(--text-primary)' }}>{targetAttendance}%</strong>
                        </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <CalendarDays size={16} style={{ color: 'var(--text-secondary)' }} />
                        <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            Project until:
                        </label>
                        <input
                            type="date"
                            value={projectionEndDate}
                            onChange={(e) => setProjectionEndDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid var(--border)',
                                backgroundColor: 'var(--background)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                cursor: 'pointer'
                            }}
                        />
                    </div>
                </div>

                {/* Trajectory Chart */}
                <div style={{
                    backgroundColor: 'var(--surface)',
                    borderRadius: '12px',
                    padding: '20px',
                    border: '1px solid var(--border)'
                }}>
                    <h3 style={{
                        fontSize: '0.95rem',
                        color: 'var(--text-secondary)',
                        marginBottom: '16px'
                    }}>
                        Attendance Trajectory
                    </h3>

                    <TrajectoryChart
                        trajectory={trajectory}
                        todayIndex={todayIndex}
                        height={260}
                        threshold={targetAttendance}
                    />
                </div>

                {/* Stats Cards */}
                {stats && (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '16px'
                    }}>
                        {/* Current */}
                        <div style={{
                            backgroundColor: 'var(--surface)',
                            borderRadius: '12px',
                            padding: '16px',
                            border: '1px solid var(--border)',
                            textAlign: 'center'
                        }}>
                            <div style={{
                                fontSize: '0.75rem',
                                color: 'var(--text-secondary)',
                                marginBottom: '6px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                            }}>
                                Current
                            </div>
                            <div style={{
                                fontSize: '1.5rem',
                                fontWeight: '700',
                                color: stats.current.percentage >= targetAttendance ? '#00D9FF' : '#FF6B6B'
                            }}>
                                {stats.current.percentage}%
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                {stats.current.present}/{stats.current.total} classes
                            </div>
                        </div>

                        {/* Projected */}
                        <div style={{
                            backgroundColor: 'var(--surface)',
                            borderRadius: '12px',
                            padding: '16px',
                            border: '1px solid var(--border)',
                            textAlign: 'center'
                        }}>
                            <div style={{
                                fontSize: '0.75rem',
                                color: 'var(--text-secondary)',
                                marginBottom: '6px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                            }}>
                                Projected
                            </div>
                            <div style={{
                                fontSize: '1.5rem',
                                fontWeight: '700',
                                color: stats.projected.percentage >= targetAttendance ? '#00D9FF' :
                                    stats.projected.percentage >= targetAttendance - 5 ? '#F5A623' : '#FF6B6B'
                            }}>
                                {stats.projected.percentage}%
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                {stats.projected.present}/{stats.projected.total} classes
                            </div>
                        </div>

                        {/* Delta */}
                        <div style={{
                            backgroundColor: 'var(--surface)',
                            borderRadius: '12px',
                            padding: '16px',
                            border: '1px solid var(--border)',
                            textAlign: 'center'
                        }}>
                            <div style={{
                                fontSize: '0.75rem',
                                color: 'var(--text-secondary)',
                                marginBottom: '6px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                            }}>
                                Change
                            </div>
                            <div style={{
                                fontSize: '1.5rem',
                                fontWeight: '700',
                                color: stats.delta >= 0 ? '#00D9FF' : '#FF6B6B',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                            }}>
                                {stats.delta >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                                {stats.delta >= 0 ? '+' : ''}{stats.delta.toFixed(1)}%
                            </div>
                        </div>
                    </div>
                )}

                {/* Planning Calendar */}
                <div>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        marginBottom: '16px'
                    }}>
                        <Calendar size={18} style={{ color: 'var(--accent-primary)' }} />
                        <h3 style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                            Plan Your Attendance
                        </h3>
                    </div>

                    <PlanningCalendar
                        futureSlots={futureSlots}
                        overrides={overrides}
                        onSlotToggle={handleSlotToggle}
                        subjectCode={subjectCode}
                    />
                </div>

                {/* Instructions */}
                <div style={{
                    padding: '16px 20px',
                    backgroundColor: 'rgba(0, 217, 255, 0.05)',
                    borderRadius: '12px',
                    border: '1px solid rgba(0, 217, 255, 0.2)',
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                    lineHeight: '1.6'
                }}>
                    <strong style={{ color: 'var(--accent-primary)' }}>💡 How it works:</strong>
                    <br />
                    Click on future class slots in the calendar to toggle between Present, Absent, or Cancelled.
                    The trajectory graph updates in real-time to show your projected attendance.
                </div>
            </div>
        </div>
    );
}
