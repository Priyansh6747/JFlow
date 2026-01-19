"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Storage } from '@/lib/storage';
import { SyncManager } from '@/lib/syncManager';
import ScheduleModal from '@/components/ScheduleModal';
import {
    Wifi,
    WifiOff,
    RefreshCw,
    Circle,
    Settings,
    Clock,
    MapPin,
    User,
    Calendar,
    Plus,
    BarChart3
} from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Format time string for display
 */
function formatTime(time) {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
}

/**
 * Calculate end time given start time and duration
 */
function getEndTime(startTime, durationMinutes) {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMins = totalMinutes % 60;
    return `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
}

/**
 * Calculate gap between two schedule items in minutes
 */
function getGapMinutes(endTime, nextStartTime) {
    const [endH, endM] = endTime.split(':').map(Number);
    const [startH, startM] = nextStartTime.split(':').map(Number);
    return (startH * 60 + startM) - (endH * 60 + endM);
}

/**
 * Format gap duration
 */
function formatGap(minutes) {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours} hr`;
    return `${hours} hr ${mins} min`;
}

/**
 * JIIT Status indicator component
 */
function JiitStatusBadge({ status }) {
    const getIcon = () => {
        switch (status) {
            case 'online':
                return <Wifi size={14} className="text-success" />;
            case 'offline':
                return <WifiOff size={14} className="text-danger" />;
            case 'syncing':
                return <RefreshCw size={14} className="animate-spin" />;
            default:
                return <Circle size={14} className="text-muted" />;
        }
    };

    const labels = {
        online: 'JIIT Online',
        offline: 'JIIT Offline',
        syncing: 'Syncing...',
        unknown: 'Not synced'
    };

    return (
        <span
            className="text-muted"
            style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
            title={labels[status] || labels.unknown}
        >
            {getIcon()} {status === 'syncing' ? 'Syncing' : ''}
        </span>
    );
}

export default function Timetable() {
    const router = useRouter();
    const { user, loading: authLoading, jiitStatus, silentSync, signOut } = useAuth();

    // Data state
    const [personalInfo, setPersonalInfo] = useState(null);
    const [subjects, setSubjects] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [timetable, setTimetable] = useState({});
    const [lastRefresh, setLastRefresh] = useState(null);

    // UI state
    const [selectedDay, setSelectedDay] = useState('Monday');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [targetAttendance, setTargetAttendance] = useState(75);

    // Get today's day name and load target attendance
    useEffect(() => {
        const today = new Date().getDay();
        if (today >= 1 && today <= 6) {
            setSelectedDay(DAYS[today - 1]);
        }
        // Load target attendance from storage
        setTargetAttendance(Storage.getTargetAttendance());
    }, []);

    // Auth check
    useEffect(() => {
        if (!authLoading && !user) {
            router.replace('/signin');
        }
    }, [user, authLoading, router]);

    // Load data on mount (3-layer: localStorage → Firebase → JIIT)
    useEffect(() => {
        if (!user) return;

        const loadData = async () => {
            // Layer 3: Load from localStorage first (instant)
            const cached = Storage.loadCached();

            if (cached.subjects.length > 0) {
                setSubjects(cached.subjects);
                setAttendance(cached.attendance);
                setPersonalInfo(cached.personalInfo);
                setLastRefresh(cached.lastRefresh);
            }

            if (cached.timetable && Object.keys(cached.timetable).length > 0) {
                setTimetable(cached.timetable);
            }

            // Layer 2: If no local data, try Firebase cache
            if (cached.subjects.length === 0 && user) {
                const firebaseCache = await SyncManager.loadCacheFromFirebase(user.uid);
                if (firebaseCache) {
                    setSubjects(firebaseCache.subjects);
                    setAttendance(firebaseCache.attendance);
                    // Also save to localStorage for next time
                    Storage.saveSubjects(firebaseCache.subjects);
                    Storage.saveAttendance(firebaseCache.attendance);
                }
            }

            // Load timetable from Firebase if not in localStorage
            if (!Storage.hasTimetable() && user) {
                const firebaseTT = await SyncManager.checkTimetableSync(user.uid);
                if (Object.keys(firebaseTT).length > 0) {
                    setTimetable(firebaseTT);
                }
            }

            // Load subjects with isHidden flags from Firestore
            const { subjects: fsSubjects, attendance: fsAttendance } = await SyncManager.loadSubjectsFromFirestore(user.uid);
            if (fsSubjects.length > 0) {
                setSubjects(fsSubjects);
                setAttendance(fsAttendance);
            }

            setIsLoading(false);

            // Layer 1: Trigger JIIT sync in background and update UI when done
            silentSync().then(result => {
                if (result.status === 'success') {
                    setSubjects(result.data.subjects);
                    setAttendance(result.data.attendance);
                    setPersonalInfo(result.data.personalInfo);
                    setLastRefresh(new Date());
                }
            });
        };

        loadData();
    }, [user, silentSync]);

    // Note: loadSubjectsFromFirestore is now handled by SyncManager

    // Note: loadTimetableFromFirestore is now handled by SyncManager

    // Save timetable using SyncManager
    const saveTimetableToFirestore = async (newTimetable) => {
        setIsSaving(true);
        try {
            await SyncManager.saveTimetable(newTimetable, user?.uid);
        } finally {
            setIsSaving(false);
        }
    };

    // Refresh data
    const handleRefresh = async () => {
        const result = await silentSync();
        if (result.status === 'success') {
            setSubjects(result.data.subjects);
            setAttendance(result.data.attendance);
            setPersonalInfo(result.data.personalInfo);
            setLastRefresh(new Date());
        }
    };

    // Logout
    const handleLogout = async () => {
        await signOut();
        router.replace('/signin');
    };

    // Navigate to settings
    const handleSettings = () => {
        router.push('/settings');
    };

    // Open modal for add
    const handleAddSchedule = () => {
        setEditingSchedule(null);
        setIsModalOpen(true);
    };

    // Open modal for edit
    const handleEditSchedule = (schedule) => {
        setEditingSchedule(schedule);
        setIsModalOpen(true);
    };

    // Save schedule entry
    const handleSaveSchedule = (scheduleData) => {
        const daySchedule = timetable[selectedDay] || [];

        let newDaySchedule;
        if (editingSchedule) {
            newDaySchedule = daySchedule.map(s =>
                s.id === scheduleData.id ? scheduleData : s
            );
        } else {
            newDaySchedule = [...daySchedule, scheduleData];
        }

        newDaySchedule.sort((a, b) => a.startTime.localeCompare(b.startTime));

        const newTimetable = {
            ...timetable,
            [selectedDay]: newDaySchedule
        };

        setTimetable(newTimetable);
        saveTimetableToFirestore(newTimetable);
        setIsModalOpen(false);
    };

    // Delete schedule entry
    const handleDeleteSchedule = (scheduleId) => {
        const daySchedule = timetable[selectedDay] || [];
        const newDaySchedule = daySchedule.filter(s => s.id !== scheduleId);

        const newTimetable = {
            ...timetable,
            [selectedDay]: newDaySchedule
        };

        setTimetable(newTimetable);
        saveTimetableToFirestore(newTimetable);
        setIsModalOpen(false);
    };

    // Get attendance info for a subject (percentage + present/total)
    const getAttendanceInfo = (subjectCode) => {
        // Try exact match first
        let subjectAtt = attendance.find(a => a.subjectCode === subjectCode);

        // If not found, try matching by extracting code from parentheses
        // e.g., "ARTIFICIAL INTELLIGENCE(15B11CI514)" -> match "15B11CI514"
        if (!subjectAtt && subjectCode) {
            subjectAtt = attendance.find(a => {
                // Extract code from a.subjectCode if it has format "NAME(CODE)"
                const match = a.subjectCode?.match(/\(([^)]+)\)$/);
                const extractedCode = match ? match[1] : a.subjectCode;
                return extractedCode === subjectCode || a.subjectCode?.includes(subjectCode);
            });
        }

        if (!subjectAtt) return null;

        return {
            percentage: subjectAtt.percentage,
            Lpercentage: subjectAtt.Lpercentage,
            Tpercentage: subjectAtt.Tpercentage,
            present: subjectAtt.LTpresent,
            total: subjectAtt.LTtotal
        };
    };

    // Keep old function for backward compatibility
    const getAttendancePercent = (subjectCode) => {
        return getAttendanceInfo(subjectCode)?.percentage;
    };

    // Create attendance map for modal - map both full name and code
    const attendanceMap = attendance.reduce((acc, a) => {
        acc[a.subjectCode] = a.percentage;
        // Also add by extracted code
        const match = a.subjectCode?.match(/\(([^)]+)\)$/);
        if (match) {
            acc[match[1]] = a.percentage;
        }
        return acc;
    }, {});

    // Get today's schedule sorted by time
    const todaySchedule = (timetable[selectedDay] || []).sort((a, b) =>
        a.startTime.localeCompare(b.startTime)
    );

    // Loading state
    if (authLoading || isLoading) {
        return (
            <div className="loading-screen">
                <div className="spinner spinner-lg"></div>
                <p className="loading-text">Loading timetable...</p>
            </div>
        );
    }

    return (
        <div className="page">
            {/* Header */}
            <div className="header">
                <div className="header-title">
                    <span className="header-name">JFlow</span>
                </div>
                <div className="flex items-center gap-sm">
                    <JiitStatusBadge status={jiitStatus} />
                    <button
                        className="btn btn-ghost"
                        onClick={() => router.push('/attendance')}
                        title="Attendance"
                    >
                        <BarChart3 size={18} />
                    </button>
                    <button className="btn btn-ghost" onClick={handleSettings}>
                        <Settings size={18} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="page-content">
                {/* Last refresh info */}
                <div className="flex items-center justify-between">
                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                        Last refresh: {lastRefresh ? new Date(lastRefresh).toLocaleString() : 'Never'}
                    </span>
                    <button
                        className="btn btn-ghost"
                        onClick={handleRefresh}
                        disabled={jiitStatus === 'syncing'}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                        <RefreshCw size={14} className={jiitStatus === 'syncing' ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>

                {/* Day Selector */}
                <div className="day-selector">
                    {DAYS.map(day => (
                        <button
                            key={day}
                            className={`day-btn ${selectedDay === day ? 'active' : ''}`}
                            onClick={() => setSelectedDay(day)}
                        >
                            {day.slice(0, 3)}
                        </button>
                    ))}
                </div>

                {/* Add/Edit header */}
                <div className="flex items-center justify-between">
                    <button className="btn btn-secondary" onClick={handleAddSchedule} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Plus size={14} /> Add
                    </button>
                    <span className="text-secondary" style={{ fontSize: '0.875rem' }}>
                        {selectedDay}
                    </span>
                    {isSaving && (
                        <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                            Saving...
                        </span>
                    )}
                </div>

                {/* Schedule list */}
                <div className="flex flex-col gap-sm">
                    {todaySchedule.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon"><Calendar size={48} /></div>
                            <p>No classes scheduled for {selectedDay}</p>
                            <button
                                className="btn btn-primary"
                                style={{ marginTop: '16px' }}
                                onClick={handleAddSchedule}
                            >
                                Add First Class
                            </button>
                        </div>
                    ) : (
                        todaySchedule.map((schedule, index) => {
                            const endTime = getEndTime(schedule.startTime, schedule.duration);
                            const attendanceInfo = getAttendanceInfo(schedule.subjectCode);
                            const attendancePercent = attendanceInfo?.percentage;

                            const nextSchedule = todaySchedule[index + 1];
                            const gap = nextSchedule ? getGapMinutes(endTime, nextSchedule.startTime) : null;

                            return (
                                <div key={schedule.id}>
                                    <div
                                        className="schedule-card"
                                        onClick={() => handleEditSchedule(schedule)}
                                    >
                                        <div className="schedule-card-content">
                                            <div className="schedule-card-subject">
                                                {schedule.subjectName || schedule.subjectCode}
                                                <span style={{
                                                    fontSize: '0.7rem',
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    marginLeft: '8px',
                                                    backgroundColor: schedule.type === 'P' ? 'rgba(255, 213, 79, 0.1)' : schedule.type === 'T' ? 'rgba(129, 199, 132, 0.1)' : 'rgba(136, 155, 154, 0.1)',
                                                    color: schedule.type === 'P' ? 'var(--warning)' : schedule.type === 'T' ? 'var(--success)' : 'var(--accent-primary)',
                                                    border: `1px solid ${schedule.type === 'P' ? 'var(--warning)' : schedule.type === 'T' ? 'var(--success)' : 'var(--accent-primary)'}`,
                                                    verticalAlign: 'middle',
                                                    display: 'inline-block'
                                                }}>
                                                    {schedule.type || 'L'}
                                                </span>
                                            </div>
                                            <div className="schedule-card-meta">
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Clock size={12} /> {formatTime(schedule.startTime)} - {formatTime(endTime)}
                                                </span>
                                                {schedule.room && (
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <MapPin size={12} /> {schedule.room}
                                                    </span>
                                                )}
                                                {schedule.teacher && (
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <User size={12} /> {schedule.teacher}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {attendancePercent !== undefined && (
                                            <div style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                minWidth: '52px',
                                                gap: '2px'
                                            }}>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    width: '44px',
                                                    height: '44px',
                                                    borderRadius: '9999px',
                                                    border: `2px solid ${attendancePercent >= targetAttendance ? '#00D9FF' : attendancePercent >= targetAttendance - 10 ? '#F5A623' : '#FF6B6B'}`,
                                                    fontSize: '0.75rem',
                                                    fontWeight: '600',
                                                    color: attendancePercent >= targetAttendance ? '#00D9FF' : attendancePercent >= targetAttendance - 10 ? '#F5A623' : '#FF6B6B'
                                                }}>
                                                    {attendancePercent}%
                                                </div>
                                                {attendanceInfo?.present !== undefined && attendanceInfo?.total !== undefined && (
                                                    <span style={{
                                                        fontSize: '0.65rem',
                                                        color: 'var(--text-secondary)',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {attendanceInfo.present}/{attendanceInfo.total}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {gap !== null && gap > 0 && (
                                        <div className="gap-indicator">
                                            {formatGap(gap)}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Floating Add Button (mobile) */}
            {todaySchedule.length > 0 && (
                <button className="fab" onClick={handleAddSchedule}>
                    <Plus size={24} />
                </button>
            )}

            {/* Schedule Modal */}
            <ScheduleModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveSchedule}
                onDelete={handleDeleteSchedule}
                subjects={subjects}
                attendance={attendanceMap}
                editData={editingSchedule}
            />
        </div>
    );
}
