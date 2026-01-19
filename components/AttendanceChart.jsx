"use client";

/**
 * AttendanceChart - Line chart for attendance history
 * Shows attendance percentage over time using SVG
 */

import { useMemo } from 'react';

// Parse date from various formats including "DD/MM/YYYY (...)"
function parseDate(dateStr) {
    if (!dateStr) return null;

    // Extract just the date part before any parentheses
    const datePart = dateStr.split(' (')[0].trim();

    // Try DD/MM/YYYY format first
    const ddmmyyyy = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyy) {
        const [, day, month, year] = ddmmyyyy;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }

    // Fall back to standard Date parsing
    const parsed = new Date(datePart);
    return isNaN(parsed.getTime()) ? null : parsed;
}

// Format date for display
function formatDate(dateStr) {
    const date = parseDate(dateStr);
    if (!date || isNaN(date.getTime())) {
        // Try to extract from DD/MM/YYYY directly
        const datePart = dateStr?.split(' (')[0]?.trim() || '';
        const parts = datePart.split('/');
        if (parts.length === 3) {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${months[parseInt(parts[1]) - 1]} ${parseInt(parts[0])}`;
        }
        return 'N/A';
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function AttendanceChart({ data = [], height = 200, targetAttendance = 75 }) {
    // data expected format: [{ date: 'YYYY-MM-DD' or 'DD/MM/YYYY (...)', percentage: number }]

    const chartData = useMemo(() => {
        if (!data || data.length === 0) return null;

        // Sort by date (handle various formats)
        const sorted = [...data].sort((a, b) => {
            const dateA = parseDate(a.date);
            const dateB = parseDate(b.date);
            if (!dateA || !dateB) return 0;
            return dateA - dateB;
        });

        const padding = { top: 20, right: 20, bottom: 40, left: 50 };
        const width = 400; // Will be responsive via viewBox
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        // Calculate points
        const minPct = 0;
        const maxPct = 100;

        const points = sorted.map((d, i) => {
            const x = padding.left + (i / (sorted.length - 1 || 1)) * chartWidth;
            const y = padding.top + chartHeight - ((d.percentage - minPct) / (maxPct - minPct)) * chartHeight;
            return { x, y, ...d };
        });

        // Create path
        const pathD = points.length > 0
            ? `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`
            : '';

        // Grid lines at 25%, 50%, 75%, 100%
        const gridLines = [25, 50, 75, 100].map(pct => ({
            pct,
            y: padding.top + chartHeight - (pct / 100) * chartHeight
        }));

        return { points, pathD, gridLines, width, padding, chartWidth, chartHeight };
    }, [data, height]);

    if (!chartData || chartData.points.length === 0) {
        return (
            <div style={{
                height,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary)',
                fontSize: '0.9rem'
            }}>
                No attendance history available
            </div>
        );
    }

    const { points, pathD, gridLines, width, padding, chartWidth, chartHeight } = chartData;

    // Determine line color based on latest percentage using target-based colors
    const latestPct = points[points.length - 1]?.percentage || 0;
    const lineColor = latestPct >= targetAttendance ? '#00D9FF' :
        latestPct >= targetAttendance - 10 ? '#F5A623' : '#FF6B6B';

    // Create area path (closed polygon for gradient fill)
    const areaD = points.length > 0
        ? `M ${padding.left},${padding.top + chartHeight} ` +
        `L ${points.map(p => `${p.x},${p.y}`).join(' L ')} ` +
        `L ${points[points.length - 1].x},${padding.top + chartHeight} Z`
        : '';

    return (
        <div style={{ width: '100%', maxWidth: '100%', overflowX: 'auto' }}>
            <svg
                viewBox={`0 0 ${width} ${height}`}
                style={{ width: '100%', height: 'auto', minHeight: height }}
                preserveAspectRatio="xMidYMid meet"
            >
                {/* Gradient definition */}
                <defs>
                    <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={lineColor} stopOpacity="0.4" />
                        <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/* Background */}
                <rect
                    x={padding.left}
                    y={padding.top}
                    width={chartWidth}
                    height={chartHeight}
                    fill="rgba(255,255,255,0.02)"
                    stroke="var(--border)"
                    strokeWidth="1"
                />

                {/* Grid lines */}
                {gridLines.map(({ pct, y }) => (
                    <g key={pct}>
                        <line
                            x1={padding.left}
                            y1={y}
                            x2={padding.left + chartWidth}
                            y2={y}
                            stroke="var(--border)"
                            strokeWidth="1"
                            strokeDasharray="4,4"
                        />
                        <text
                            x={padding.left - 8}
                            y={y + 4}
                            fill="var(--text-secondary)"
                            fontSize="10"
                            textAnchor="end"
                        >
                            {pct}%
                        </text>
                    </g>
                ))}

                {/* Gradient fill area */}
                <path
                    d={areaD}
                    fill="url(#areaGradient)"
                />

                {/* Line */}
                <path
                    d={pathD}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* Data points */}
                {points.map((point, i) => (
                    <g key={i}>
                        <circle
                            cx={point.x}
                            cy={point.y}
                            r="5"
                            fill="var(--background)"
                            stroke={lineColor}
                            strokeWidth="2"
                        />
                        {/* X-axis label (date) - show only first, last, and middle */}
                        {(i === 0 || i === points.length - 1 || i === Math.floor(points.length / 2)) && (
                            <text
                                x={point.x}
                                y={height - 10}
                                fill="var(--text-secondary)"
                                fontSize="9"
                                textAnchor="middle"
                            >
                                {formatDate(point.date)}
                            </text>
                        )}
                    </g>
                ))}
            </svg>
        </div>
    );
}
