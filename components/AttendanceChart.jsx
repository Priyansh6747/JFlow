"use client";

/**
 * AttendanceChart - Line chart for attendance history
 * Shows attendance percentage over time using SVG
 */

import { useMemo } from 'react';

export default function AttendanceChart({ data = [], height = 200 }) {
    // data expected format: [{ date: 'YYYY-MM-DD', percentage: number }]

    const chartData = useMemo(() => {
        if (!data || data.length === 0) return null;

        // Sort by date
        const sorted = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));

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

    // Determine line color based on latest percentage
    const latestPct = points[points.length - 1]?.percentage || 0;
    const lineColor = latestPct >= 75 ? 'var(--success)' : latestPct >= 50 ? 'var(--warning)' : 'var(--danger)';

    return (
        <div style={{ width: '100%', maxWidth: '100%', overflowX: 'auto' }}>
            <svg
                viewBox={`0 0 ${width} ${height}`}
                style={{ width: '100%', height: 'auto', minHeight: height }}
                preserveAspectRatio="xMidYMid meet"
            >
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
                                {new Date(point.date).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric'
                                })}
                            </text>
                        )}
                    </g>
                ))}
            </svg>
        </div>
    );
}
