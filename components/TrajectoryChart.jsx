"use client";

/**
 * TrajectoryChart - Attendance trajectory visualization
 * 
 * Features:
 * - Solid line for past (ERP data)
 * - Dashed line for projected (future slots)
 * - "Today" vertical marker
 * - 75% threshold horizontal line
 * - Dynamic segment colors (green/yellow/red)
 * - Horizontal scrolling for many data points
 */

import { useMemo, useRef, useEffect, useState } from 'react';

/**
 * Get color based on attendance percentage
 */
function getAttendanceColor(percentage, threshold = 75) {
    if (percentage >= threshold) return '#00D9FF'; // Cyan - safe
    if (percentage >= threshold - 5) return '#F5A623'; // Yellow - warning
    return '#FF6B6B'; // Red - danger
}

export default function TrajectoryChart({
    trajectory = [],
    todayIndex = 0,
    height = 220,
    threshold = 75
}) {
    const scrollRef = useRef(null);
    const [isScrollable, setIsScrollable] = useState(false);

    // Fixed dimensions per data point for better readability
    const pointSpacing = 12; // pixels per data point
    const padding = { top: 30, right: 40, bottom: 40, left: 50 };

    // Calculate total width based on data points
    const contentWidth = Math.max(
        400, // minimum width
        trajectory.length * pointSpacing + padding.left + padding.right
    );

    // Check if scrollable
    useEffect(() => {
        if (scrollRef.current) {
            setIsScrollable(scrollRef.current.scrollWidth > scrollRef.current.clientWidth);
            // Scroll to show "today" position
            if (todayIndex > 0) {
                const scrollPos = (todayIndex * pointSpacing) - (scrollRef.current.clientWidth / 2);
                scrollRef.current.scrollLeft = Math.max(0, scrollPos);
            }
        }
    }, [trajectory, todayIndex]);

    // Compute chart data
    const chartData = useMemo(() => {
        if (trajectory.length === 0) return null;

        const minY = Math.min(50, ...trajectory.map(t => t.y)) - 5;
        const maxY = Math.max(100, ...trajectory.map(t => t.y)) + 5;
        const rangeY = maxY - minY;

        const chartHeight = height - padding.top - padding.bottom;

        const scaleX = (i) => padding.left + i * pointSpacing;
        const scaleY = (y) => height - padding.bottom - ((y - minY) / rangeY) * chartHeight;

        // Create path points
        const pastData = trajectory.filter((_, i) => i < todayIndex);
        const projectedData = trajectory.filter((_, i) => i >= todayIndex);

        const toPath = (data, startIdx = 0) => {
            if (data.length === 0) return '';
            return data.map((point, i) => {
                const x = scaleX(startIdx + i);
                const y = scaleY(point.y);
                return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
            }).join(' ');
        };

        // Projected segments with colors
        const projectedSegments = [];
        if (projectedData.length > 0) {
            let currentColor = getAttendanceColor(projectedData[0].y, threshold);
            let segmentStart = 0;

            for (let i = 1; i <= projectedData.length; i++) {
                const point = projectedData[i];
                const newColor = point ? getAttendanceColor(point.y, threshold) : currentColor;

                if (newColor !== currentColor || i === projectedData.length) {
                    const segment = projectedData.slice(segmentStart, i);
                    projectedSegments.push({
                        path: toPath(segment, todayIndex + segmentStart),
                        color: currentColor
                    });
                    segmentStart = i - 1;
                    currentColor = newColor;
                }
            }
        }

        // Generate date labels (every ~10 points or weekly)
        const dateLabels = [];
        const labelInterval = Math.max(1, Math.floor(trajectory.length / 10));
        for (let i = 0; i < trajectory.length; i += labelInterval) {
            const point = trajectory[i];
            if (point.date) {
                const date = new Date(point.date);
                dateLabels.push({
                    x: scaleX(i),
                    label: `${date.getDate()}/${date.getMonth() + 1}`
                });
            }
        }

        return {
            pastPath: toPath(pastData),
            projectedSegments,
            todayX: scaleX(todayIndex),
            thresholdY: scaleY(threshold),
            scaleX,
            scaleY,
            dateLabels,
            minY,
            maxY
        };
    }, [trajectory, todayIndex, height, threshold, pointSpacing, padding]);

    if (trajectory.length === 0) {
        return (
            <div style={{
                height,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                fontSize: '0.9rem',
                backgroundColor: 'var(--background)',
                borderRadius: '8px'
            }}>
                No trajectory data available
            </div>
        );
    }

    const lastPoint = trajectory[trajectory.length - 1];
    const firstPoint = trajectory[0];

    return (
        <div style={{ position: 'relative' }}>
            {/* Scrollable chart container */}
            <div
                ref={scrollRef}
                style={{
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    position: 'relative',
                    borderRadius: '8px',
                    backgroundColor: 'var(--background)'
                }}
            >
                <svg
                    width={contentWidth}
                    height={height}
                    style={{ display: 'block' }}
                >
                    {/* Background grid */}
                    <defs>
                        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--grid-lines)" strokeWidth="0.5" opacity="0.3" />
                        </pattern>
                    </defs>
                    <rect x={padding.left} y={padding.top} width={contentWidth - padding.left - padding.right} height={height - padding.top - padding.bottom} fill="url(#grid)" />

                    {/* Threshold line */}
                    <line
                        x1={padding.left}
                        y1={chartData.thresholdY}
                        x2={contentWidth - padding.right}
                        y2={chartData.thresholdY}
                        stroke="#F5A623"
                        strokeWidth="1.5"
                        strokeDasharray="6 4"
                        opacity="0.7"
                    />
                    <text
                        x={padding.left - 8}
                        y={chartData.thresholdY}
                        fontSize="11"
                        fill="#F5A623"
                        textAnchor="end"
                        dominantBaseline="middle"
                        fontWeight="500"
                    >
                        {threshold}%
                    </text>

                    {/* Y-axis labels */}
                    {[100, 75, 50].map(val => {
                        const y = chartData.scaleY(val);
                        if (y < padding.top || y > height - padding.bottom) return null;
                        return (
                            <g key={val}>
                                <line
                                    x1={padding.left}
                                    y1={y}
                                    x2={contentWidth - padding.right}
                                    y2={y}
                                    stroke="var(--grid-lines)"
                                    strokeWidth="0.5"
                                    opacity="0.5"
                                />
                                {val !== threshold && (
                                    <text
                                        x={padding.left - 8}
                                        y={y}
                                        fontSize="10"
                                        fill="var(--text-muted)"
                                        textAnchor="end"
                                        dominantBaseline="middle"
                                    >
                                        {val}%
                                    </text>
                                )}
                            </g>
                        );
                    })}

                    {/* Today vertical marker */}
                    {todayIndex > 0 && todayIndex < trajectory.length && (
                        <>
                            <line
                                x1={chartData.todayX}
                                y1={padding.top}
                                x2={chartData.todayX}
                                y2={height - padding.bottom}
                                stroke="var(--accent-primary)"
                                strokeWidth="2"
                                strokeDasharray="4 4"
                            />
                            <rect
                                x={chartData.todayX - 22}
                                y={padding.top - 18}
                                width="44"
                                height="16"
                                rx="4"
                                fill="var(--accent-primary)"
                            />
                            <text
                                x={chartData.todayX}
                                y={padding.top - 10}
                                fontSize="10"
                                fill="var(--black)"
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontWeight="600"
                            >
                                TODAY
                            </text>
                        </>
                    )}

                    {/* Past line (solid, thicker) */}
                    {chartData.pastPath && (
                        <path
                            d={chartData.pastPath}
                            fill="none"
                            stroke="#00D9FF"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    )}

                    {/* Projected segments (dashed) */}
                    {chartData.projectedSegments.map((segment, i) => (
                        <path
                            key={i}
                            d={segment.path}
                            fill="none"
                            stroke={segment.color}
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray="8 4"
                        />
                    ))}

                    {/* Data points */}
                    {trajectory.map((point, i) => {
                        const x = chartData.scaleX(i);
                        const y = chartData.scaleY(point.y);
                        const color = point.type === 'past' ? '#00D9FF' : getAttendanceColor(point.y, threshold);

                        // Only show dots at intervals to avoid clutter
                        if (i % Math.max(1, Math.floor(trajectory.length / 30)) !== 0 && i !== todayIndex && i !== trajectory.length - 1) {
                            return null;
                        }

                        return (
                            <circle
                                key={i}
                                cx={x}
                                cy={y}
                                r={i === todayIndex || i === trajectory.length - 1 ? 5 : 3}
                                fill={color}
                                stroke="var(--background)"
                                strokeWidth="2"
                            />
                        );
                    })}

                    {/* Date labels on X-axis */}
                    {chartData.dateLabels.map((label, i) => (
                        <text
                            key={i}
                            x={label.x}
                            y={height - padding.bottom + 16}
                            fontSize="9"
                            fill="var(--text-muted)"
                            textAnchor="middle"
                        >
                            {label.label}
                        </text>
                    ))}

                    {/* End value label */}
                    {lastPoint && (
                        <g>
                            <rect
                                x={chartData.scaleX(trajectory.length - 1) + 8}
                                y={chartData.scaleY(lastPoint.y) - 10}
                                width="40"
                                height="20"
                                rx="4"
                                fill={getAttendanceColor(lastPoint.y, threshold)}
                            />
                            <text
                                x={chartData.scaleX(trajectory.length - 1) + 28}
                                y={chartData.scaleY(lastPoint.y)}
                                fontSize="11"
                                fill="var(--black)"
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontWeight="600"
                            >
                                {lastPoint.y}%
                            </text>
                        </g>
                    )}
                </svg>
            </div>

            {/* Scroll indicator */}
            {isScrollable && (
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    marginTop: '8px',
                    fontSize: '0.7rem',
                    color: 'var(--text-muted)'
                }}>
                    ← Scroll to explore →
                </div>
            )}

            {/* Legend */}
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '20px',
                marginTop: '12px',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)'
            }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '20px', height: '3px', backgroundColor: '#00D9FF', borderRadius: '2px' }} />
                    Past
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                        width: '20px',
                        height: '3px',
                        background: 'repeating-linear-gradient(to right, #00D9FF 0, #00D9FF 5px, transparent 5px, transparent 8px)',
                        borderRadius: '2px'
                    }} />
                    Projected
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '20px', height: '3px', backgroundColor: '#F5A623', borderRadius: '2px' }} />
                    Target
                </span>
            </div>
        </div>
    );
}
