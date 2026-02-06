"use client";

/**
 * AttendanceCalendar - Monthly calendar view showing attendance status
 * Green dot = Present, Red dot = Absent
 * Uses theme CSS variables for consistent styling
 */

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Parse attendance date from API format
 * @param {string} dateStr - Date string like "16/01/2026 (12:00:PM - 12:50 PM)"
 * @returns {Date|null}
 */
function parseAttendanceDate(dateStr) {
    if (!dateStr) return null;
    const datePart = dateStr.split(' (')[0]; // "16/01/2026"
    const parts = datePart.split('/');
    if (parts.length !== 3) return null;
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
}

/**
 * Build attendance map from daily data
 * @param {Array} dailyData - Array of daily attendance records
 * @returns {Map<string, {present: boolean, count: number}>} Map of date -> status
 */
function buildAttendanceMap(dailyData) {
    const map = new Map();

    for (const record of dailyData) {
        const date = parseAttendanceDate(record.datetime || record.attendancedate);
        if (!date) continue;

        const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
        const status = record.present || record.studentstatus || '';
        const isPresent = status === 'Present' || status === 'P';

        if (!map.has(dateKey)) {
            map.set(dateKey, { present: 0, absent: 0 });
        }

        const entry = map.get(dateKey);
        if (isPresent) {
            entry.present++;
        } else {
            entry.absent++;
        }
    }

    return map;
}

export default function AttendanceCalendar({ dailyData = [] }) {
    const [currentDate, setCurrentDate] = useState(() => {
        // Start with most recent attendance date or current month
        if (dailyData.length > 0) {
            const dates = dailyData
                .map(d => parseAttendanceDate(d.datetime || d.attendancedate))
                .filter(Boolean)
                .sort((a, b) => b - a);
            if (dates.length > 0) {
                return new Date(dates[0].getFullYear(), dates[0].getMonth(), 1);
            }
        }
        return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    });

    // Build attendance map for quick lookup
    const attendanceMap = useMemo(() => buildAttendanceMap(dailyData), [dailyData]);

    // Get calendar grid for current month
    const calendarDays = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startPadding = firstDay.getDay();
        const daysInMonth = lastDay.getDate();

        const days = [];

        // Previous month padding
        for (let i = 0; i < startPadding; i++) {
            days.push({ day: null, status: null });
        }

        // Current month days
        for (let day = 1; day <= daysInMonth; day++) {
            const dateKey = `${year}-${month}-${day}`;
            const status = attendanceMap.get(dateKey) || null;
            days.push({ day, status });
        }

        return days;
    }, [currentDate, attendanceMap]);

    const goToPreviousMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const goToNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const today = new Date();
    const isCurrentMonth = today.getMonth() === currentDate.getMonth() &&
        today.getFullYear() === currentDate.getFullYear();

    return (
        <div style={{
            backgroundColor: 'var(--surface)',
            borderRadius: '12px',
            padding: '16px',
            border: '1px solid var(--border)'
        }}>
            {/* Header with navigation */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px'
            }}>
                <button
                    onClick={goToPreviousMonth}
                    style={{
                        background: 'var(--surface-secondary)',
                        border: '1px solid var(--grid-lines)',
                        borderRadius: '8px',
                        padding: '8px',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <ChevronLeft size={18} />
                </button>

                <span style={{
                    fontSize: '1rem',
                    fontWeight: '600',
                    color: 'var(--text-primary)'
                }}>
                    {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
                </span>

                <button
                    onClick={goToNextMonth}
                    style={{
                        background: 'var(--surface-secondary)',
                        border: '1px solid var(--grid-lines)',
                        borderRadius: '8px',
                        padding: '8px',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <ChevronRight size={18} />
                </button>
            </div>

            {/* Day names header */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '4px',
                marginBottom: '8px'
            }}>
                {DAY_NAMES.map(day => (
                    <div key={day} style={{
                        textAlign: 'center',
                        fontSize: '0.7rem',
                        fontWeight: '500',
                        color: 'var(--text-muted)',
                        padding: '4px 0'
                    }}>
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '4px'
            }}>
                {calendarDays.map(({ day, status }, index) => {
                    const isToday = isCurrentMonth && day === today.getDate();
                    const hasClasses = status !== null;

                    // Determine cell color based on attendance
                    let dotColor = null;
                    if (hasClasses) {
                        if (status.absent === 0) {
                            dotColor = '#00D9FF'; // All present - cyan
                        } else if (status.present === 0) {
                            dotColor = '#FF6B6B'; // All absent - red
                        } else {
                            dotColor = '#F5A623'; // Mixed - orange
                        }
                    }

                    return (
                        <div
                            key={index}
                            style={{
                                aspectRatio: '1',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '8px',
                                backgroundColor: isToday ? 'var(--accent-primary)' :
                                    day ? 'var(--surface-secondary)' : 'transparent',
                                color: isToday ? 'var(--black)' :
                                    day ? 'var(--text-primary)' : 'transparent',
                                fontSize: '0.8rem',
                                fontWeight: isToday ? '600' : '400',
                                position: 'relative',
                                minHeight: '36px'
                            }}
                        >
                            {day && (
                                <>
                                    <span>{day}</span>
                                    {hasClasses && (
                                        <div style={{
                                            width: '6px',
                                            height: '6px',
                                            borderRadius: '50%',
                                            backgroundColor: dotColor,
                                            marginTop: '2px'
                                        }} />
                                    )}
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Legend */}
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '16px',
                marginTop: '16px',
                paddingTop: '12px',
                borderTop: '1px solid var(--grid-lines)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#00D9FF' }} />
                    Present
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#FF6B6B' }} />
                    Absent
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#F5A623' }} />
                    Mixed
                </div>
            </div>
        </div>
    );
}
