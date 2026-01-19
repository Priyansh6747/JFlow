"use client";

/**
 * AttendanceCard - Card component with circular progress ring
 * Shows subject name, attendance percentage, and attended/total classes
 */

import { useRouter } from 'next/navigation';

export default function AttendanceCard({
    code,
    name,
    percentage = 0,
    attendedClasses,
    totalClasses,
    Lpercentage,
    Tpercentage,
    targetAttendance = 75
}) {
    const router = useRouter();

    // Determine color based on percentage relative to target
    // Cyan/teal aesthetic color scheme
    const getColor = (pct) => {
        if (pct >= targetAttendance) return '#00D9FF';      // Cyan - above target
        if (pct >= targetAttendance - 10) return '#F5A623'; // Warm orange - close to target
        return '#FF6B6B';                                    // Coral red - below target
    };

    const color = getColor(percentage);

    // SVG circular progress calculations
    const size = 70;
    const strokeWidth = 6;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    const handleClick = () => {
        router.push(`/attendance/${encodeURIComponent(code)}`);
    };

    return (
        <div
            className="attendance-card"
            onClick={handleClick}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '16px',
                backgroundColor: 'var(--surface)',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                border: '1px solid var(--border)'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
            }}
        >
            {/* Circular Progress Ring */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
                <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                    {/* Background circle */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke="var(--border)"
                        strokeWidth={strokeWidth}
                    />
                    {/* Progress circle */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke={color}
                        strokeWidth={strokeWidth}
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                    />
                </svg>
                {/* Percentage text in center */}
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    color: color
                }}>
                    {Math.round(percentage)}%
                </div>
            </div>

            {/* Subject Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    fontSize: '0.95rem',
                    fontWeight: '500',
                    color: 'var(--text-primary)',
                    marginBottom: '4px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                }}>
                    {name || code}
                </div>
                <div style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    marginBottom: '6px'
                }}>
                    {code}
                </div>

                {/* Component breakdown if available */}
                <div style={{ display: 'flex', gap: '12px', fontSize: '0.7rem' }}>
                    {Lpercentage !== undefined && (
                        <span style={{ color: 'var(--accent-primary)' }}>
                            L: {Lpercentage}%
                        </span>
                    )}
                    {Tpercentage !== undefined && (
                        <span style={{ color: 'var(--success)' }}>
                            T: {Tpercentage}%
                        </span>
                    )}
                </div>
            </div>

            {/* Attended/Total */}
            {attendedClasses !== undefined && totalClasses !== undefined && (
                <div style={{
                    textAlign: 'right',
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                    flexShrink: 0
                }}>
                    <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>
                        {attendedClasses}
                    </div>
                    <div style={{ fontSize: '0.7rem' }}>
                        /{totalClasses}
                    </div>
                </div>
            )}
        </div>
    );
}
