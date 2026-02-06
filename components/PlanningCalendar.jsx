"use client";

/**
 * PlanningCalendar - Interactive calendar for attendance planning
 * 
 * Features:
 * - Monthly view with timetable slots
 * - Click to toggle: Present → Absent → Cancelled → Present
 * - Visual indicators for current status
 */

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Check, X, Ban } from 'lucide-react';

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Get status color
 */
function getStatusColor(status) {
    switch (status) {
        case 'present': return '#00D9FF';
        case 'absent': return '#FF6B6B';
        case 'cancelled': return 'var(--text-muted)';
        default: return 'var(--text-secondary)';
    }
}

/**
 * Get status icon
 */
function StatusIcon({ status, size = 12 }) {
    switch (status) {
        case 'present':
            return <Check size={size} style={{ color: '#00D9FF' }} />;
        case 'absent':
            return <X size={size} style={{ color: '#FF6B6B' }} />;
        case 'cancelled':
            return <Ban size={size} style={{ color: 'var(--text-muted)' }} />;
        default:
            return null;
    }
}

export default function PlanningCalendar({
    futureSlots = [],
    overrides = {},
    onSlotToggle,
    subjectCode
}) {
    const [currentDate, setCurrentDate] = useState(new Date());

    // Get calendar grid data
    const calendarData = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startPad = firstDay.getDay();
        const totalDays = lastDay.getDate();

        const weeks = [];
        let currentWeek = [];

        // Padding for first week
        for (let i = 0; i < startPad; i++) {
            currentWeek.push(null);
        }

        // Days of month
        for (let day = 1; day <= totalDays; day++) {
            const date = new Date(year, month, day);
            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

            // Find slots for this day
            const daySlots = futureSlots.filter(slot => slot.dateKey === dateKey);

            currentWeek.push({
                day,
                date,
                dateKey,
                slots: daySlots,
                isPast: date < new Date(new Date().setHours(0, 0, 0, 0)),
                isToday: dateKey === getDateKey(new Date())
            });

            if (currentWeek.length === 7) {
                weeks.push(currentWeek);
                currentWeek = [];
            }
        }

        // Padding for last week
        if (currentWeek.length > 0) {
            while (currentWeek.length < 7) {
                currentWeek.push(null);
            }
            weeks.push(currentWeek);
        }

        return weeks;
    }, [currentDate, futureSlots]);

    const handlePrevMonth = () => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    };

    const handleSlotClick = (slot) => {
        if (!slot || !onSlotToggle) return;

        // Cycle: present → absent → cancelled → present
        const currentStatus = overrides[slot.slotId] || slot.status || 'present';
        let nextStatus;

        switch (currentStatus) {
            case 'present': nextStatus = 'absent'; break;
            case 'absent': nextStatus = 'cancelled'; break;
            case 'cancelled': nextStatus = 'present'; break;
            default: nextStatus = 'absent';
        }

        onSlotToggle(slot.slotId, nextStatus);
    };

    const getSlotStatus = (slot) => {
        return overrides[slot.slotId] || slot.status || 'present';
    };

    return (
        <div style={{
            backgroundColor: 'var(--surface)',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderBottom: '1px solid var(--grid-lines)'
            }}>
                <button
                    onClick={handlePrevMonth}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: '4px'
                    }}
                >
                    <ChevronLeft size={20} />
                </button>
                <span style={{ fontWeight: '600', fontSize: '0.95rem' }}>
                    {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
                </span>
                <button
                    onClick={handleNextMonth}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: '4px'
                    }}
                >
                    <ChevronRight size={20} />
                </button>
            </div>

            {/* Day headers */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                borderBottom: '1px solid var(--grid-lines)',
                backgroundColor: 'var(--surface-secondary)'
            }}>
                {DAYS_SHORT.map(day => (
                    <div
                        key={day}
                        style={{
                            textAlign: 'center',
                            padding: '8px 4px',
                            fontSize: '0.7rem',
                            fontWeight: '500',
                            color: 'var(--text-secondary)'
                        }}
                    >
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar grid */}
            <div style={{ padding: '8px' }}>
                {calendarData.map((week, weekIdx) => (
                    <div
                        key={weekIdx}
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(7, 1fr)',
                            gap: '4px',
                            marginBottom: weekIdx < calendarData.length - 1 ? '4px' : 0
                        }}
                    >
                        {week.map((dayData, dayIdx) => (
                            <div
                                key={dayIdx}
                                style={{
                                    minHeight: '50px',
                                    backgroundColor: dayData?.isToday
                                        ? 'rgba(0, 217, 255, 0.1)'
                                        : dayData?.isPast
                                            ? 'var(--background)'
                                            : 'transparent',
                                    borderRadius: '6px',
                                    padding: '4px',
                                    border: dayData?.isToday ? '1px solid var(--accent-primary)' : 'none',
                                    opacity: dayData?.isPast ? 0.5 : 1
                                }}
                            >
                                {dayData && (
                                    <>
                                        {/* Day number */}
                                        <div style={{
                                            fontSize: '0.7rem',
                                            fontWeight: dayData.isToday ? '600' : '400',
                                            color: dayData.isToday
                                                ? 'var(--accent-primary)'
                                                : 'var(--text-primary)',
                                            marginBottom: '2px'
                                        }}>
                                            {dayData.day}
                                        </div>

                                        {/* Slots */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            {dayData.slots.map((slot, slotIdx) => {
                                                const status = getSlotStatus(slot);
                                                return (
                                                    <button
                                                        key={slotIdx}
                                                        onClick={() => !dayData.isPast && handleSlotClick(slot)}
                                                        disabled={dayData.isPast}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            gap: '2px',
                                                            padding: '3px 4px',
                                                            borderRadius: '4px',
                                                            backgroundColor: status === 'cancelled'
                                                                ? 'transparent'
                                                                : `${getStatusColor(status)}20`,
                                                            border: `1px solid ${getStatusColor(status)}`,
                                                            cursor: dayData.isPast ? 'default' : 'pointer',
                                                            fontSize: '0.55rem',
                                                            color: getStatusColor(status),
                                                            fontWeight: '500',
                                                            textDecoration: status === 'cancelled' ? 'line-through' : 'none',
                                                            transition: 'all 0.15s'
                                                        }}
                                                        title={`${slot.startTime} - Click to toggle`}
                                                    >
                                                        <StatusIcon status={status} size={8} />
                                                        {slot.startTime?.slice(0, 5)}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            {/* Legend */}
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '16px',
                padding: '8px 16px 12px',
                fontSize: '0.65rem',
                color: 'var(--text-secondary)',
                borderTop: '1px solid var(--grid-lines)'
            }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Check size={10} style={{ color: '#00D9FF' }} /> Present
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <X size={10} style={{ color: '#FF6B6B' }} /> Absent
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Ban size={10} style={{ color: 'var(--text-muted)' }} /> Cancelled
                </span>
            </div>
        </div>
    );
}

function getDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
