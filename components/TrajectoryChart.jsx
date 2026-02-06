"use client";

/**
 * TrajectoryChart - Attendance trajectory visualization
 * 
 * Features:
 * - Solid line for past (ERP data)
 * - Dashed line for projected (future slots)
 * - "Today" vertical marker
 * - Threshold horizontal line
 * - Dynamic segment colors (green/yellow/red)
 * - Horizontal scrolling for many data points
 * - Double-click to open fullscreen modal
 */

import { useMemo, useRef, useEffect, useState } from 'react';
import { X, Maximize2 } from 'lucide-react';

function getAttendanceColor(percentage, threshold = 75) {
    if (percentage >= threshold) return '#00D9FF';
    if (percentage >= threshold - 5) return '#F5A623';
    return '#FF6B6B';
}

export default function TrajectoryChart({
    trajectory = [],
    todayIndex = 0,
    height = 220,
    threshold = 75
}) {
    const scrollRef = useRef(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const pointSpacing = 12;
    const padding = { top: 30, right: 50, bottom: 40, left: 50 };

    // Scroll to today on mount
    useEffect(() => {
        if (scrollRef.current && todayIndex > 0) {
            const scrollPos = (todayIndex * pointSpacing) - (scrollRef.current.clientWidth / 2);
            scrollRef.current.scrollLeft = Math.max(0, scrollPos);
        }
    }, [trajectory, todayIndex]);

    // Close fullscreen on Escape
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setIsFullscreen(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    if (!trajectory.length) {
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

    // Chart calculations
    const contentWidth = Math.max(400, trajectory.length * pointSpacing + padding.left + padding.right);
    const minY = Math.min(50, ...trajectory.map(t => t.y)) - 5;
    const maxY = Math.max(100, ...trajectory.map(t => t.y)) + 5;
    const rangeY = maxY - minY;
    const chartHeight = height - padding.top - padding.bottom;

    const scaleX = (i) => padding.left + i * pointSpacing;
    const scaleY = (y) => height - padding.bottom - ((y - minY) / rangeY) * chartHeight;

    const pastData = trajectory.filter((_, i) => i < todayIndex);
    const projectedData = trajectory.filter((_, i) => i >= todayIndex);

    const toPath = (data, startIdx = 0) => {
        if (!data.length) return '';
        return data.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(startIdx + i)} ${scaleY(pt.y)}`).join(' ');
    };

    // Build projected segments with colors
    const projectedSegments = [];
    if (projectedData.length > 0) {
        let currentColor = getAttendanceColor(projectedData[0].y, threshold);
        let segmentStart = 0;
        for (let i = 1; i <= projectedData.length; i++) {
            const pt = projectedData[i];
            const newColor = pt ? getAttendanceColor(pt.y, threshold) : currentColor;
            if (newColor !== currentColor || i === projectedData.length) {
                projectedSegments.push({
                    path: toPath(projectedData.slice(segmentStart, i), todayIndex + segmentStart),
                    color: currentColor
                });
                segmentStart = i - 1;
                currentColor = newColor;
            }
        }
    }

    // Date labels
    const labelInterval = Math.max(1, Math.floor(trajectory.length / 10));
    const dateLabels = [];
    for (let i = 0; i < trajectory.length; i += labelInterval) {
        const pt = trajectory[i];
        if (pt.date) {
            const d = new Date(pt.date);
            dateLabels.push({ x: scaleX(i), label: `${d.getDate()}/${d.getMonth() + 1}` });
        }
    }

    const lastPoint = trajectory[trajectory.length - 1];

    const renderSVG = (h, w, pad, pSpacing) => (
        <svg width={w} height={h} style={{ display: 'block' }}>
            {/* Threshold line */}
            <line
                x1={pad.left}
                y1={h - pad.bottom - ((threshold - minY) / rangeY) * (h - pad.top - pad.bottom)}
                x2={w - pad.right}
                y2={h - pad.bottom - ((threshold - minY) / rangeY) * (h - pad.top - pad.bottom)}
                stroke="#F5A623"
                strokeWidth="1.5"
                strokeDasharray="6 4"
                opacity="0.7"
            />
            <text
                x={pad.left - 8}
                y={h - pad.bottom - ((threshold - minY) / rangeY) * (h - pad.top - pad.bottom)}
                fontSize="10"
                fill="#F5A623"
                textAnchor="end"
                dominantBaseline="middle"
            >
                {threshold}%
            </text>

            {/* Y-axis labels */}
            {[100, 75, 50].map(val => {
                const y = h - pad.bottom - ((val - minY) / rangeY) * (h - pad.top - pad.bottom);
                if (y < pad.top || y > h - pad.bottom) return null;
                return (
                    <g key={val}>
                        <line x1={pad.left} y1={y} x2={w - pad.right} y2={y} stroke="var(--border)" strokeWidth="0.5" opacity="0.3" />
                        {val !== threshold && (
                            <text x={pad.left - 8} y={y} fontSize="9" fill="var(--text-muted)" textAnchor="end" dominantBaseline="middle">
                                {val}%
                            </text>
                        )}
                    </g>
                );
            })}

            {/* Today marker */}
            {todayIndex > 0 && todayIndex < trajectory.length && (
                <>
                    <line
                        x1={pad.left + todayIndex * pSpacing}
                        y1={pad.top}
                        x2={pad.left + todayIndex * pSpacing}
                        y2={h - pad.bottom}
                        stroke="var(--accent-primary)"
                        strokeWidth="2"
                        strokeDasharray="4 4"
                    />
                    <rect x={pad.left + todayIndex * pSpacing - 22} y={pad.top - 18} width="44" height="16" rx="4" fill="var(--accent-primary)" />
                    <text x={pad.left + todayIndex * pSpacing} y={pad.top - 10} fontSize="9" fill="var(--black)" textAnchor="middle" dominantBaseline="middle" fontWeight="600">
                        TODAY
                    </text>
                </>
            )}

            {/* Past line */}
            {pastData.length > 0 && (
                <path
                    d={pastData.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pad.left + i * pSpacing} ${h - pad.bottom - ((pt.y - minY) / rangeY) * (h - pad.top - pad.bottom)}`).join(' ')}
                    fill="none"
                    stroke="#00D9FF"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            )}

            {/* Projected segments */}
            {projectedData.length > 0 && projectedData.map((pt, i) => {
                if (i === 0) return null;
                const prevPt = projectedData[i - 1];
                const x1 = pad.left + (todayIndex + i - 1) * pSpacing;
                const y1 = h - pad.bottom - ((prevPt.y - minY) / rangeY) * (h - pad.top - pad.bottom);
                const x2 = pad.left + (todayIndex + i) * pSpacing;
                const y2 = h - pad.bottom - ((pt.y - minY) / rangeY) * (h - pad.top - pad.bottom);
                return (
                    <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={getAttendanceColor(pt.y, threshold)} strokeWidth="2.5" strokeDasharray="6 3" strokeLinecap="round" />
                );
            })}

            {/* Date labels */}
            {dateLabels.map((lbl, i) => (
                <text key={i} x={lbl.x} y={h - pad.bottom + 16} fontSize="8" fill="var(--text-muted)" textAnchor="middle">
                    {lbl.label}
                </text>
            ))}

            {/* End badge */}
            {lastPoint && (
                <g>
                    <rect
                        x={pad.left + (trajectory.length - 1) * pSpacing + 8}
                        y={h - pad.bottom - ((lastPoint.y - minY) / rangeY) * (h - pad.top - pad.bottom) - 10}
                        width="38"
                        height="20"
                        rx="4"
                        fill={getAttendanceColor(lastPoint.y, threshold)}
                    />
                    <text
                        x={pad.left + (trajectory.length - 1) * pSpacing + 27}
                        y={h - pad.bottom - ((lastPoint.y - minY) / rangeY) * (h - pad.top - pad.bottom)}
                        fontSize="10"
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
    );

    return (
        <>
            {/* Fullscreen Modal */}
            {isFullscreen && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.95)',
                        zIndex: 1000,
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '20px'
                    }}
                    onClick={() => setIsFullscreen(false)}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h2 style={{ color: 'var(--text-primary)', fontSize: '1.1rem', margin: 0 }}>Attendance Trajectory</h2>
                        <button
                            onClick={() => setIsFullscreen(false)}
                            style={{
                                background: 'var(--surface)',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '8px 12px',
                                cursor: 'pointer',
                                color: 'var(--text-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <X size={16} /> Close
                        </button>
                    </div>
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            flex: 1,
                            overflowX: 'auto',
                            backgroundColor: 'var(--surface)',
                            borderRadius: '12px',
                            padding: '16px'
                        }}
                    >
                        {renderSVG(400, Math.max(800, trajectory.length * 16 + 120), { top: 40, right: 60, bottom: 50, left: 60 }, 16)}
                    </div>
                </div>
            )}

            {/* Normal chart */}
            <div
                style={{ position: 'relative', cursor: 'pointer' }}
                onDoubleClick={() => setIsFullscreen(true)}
                title="Double-click to expand"
            >
                {/* Expand hint */}
                <div style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    zIndex: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 6px',
                    backgroundColor: 'var(--surface)',
                    borderRadius: '4px',
                    fontSize: '0.6rem',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border)'
                }}>
                    <Maximize2 size={10} /> Expand
                </div>

                <div
                    ref={scrollRef}
                    style={{
                        overflowX: 'auto',
                        overflowY: 'hidden',
                        borderRadius: '8px',
                        backgroundColor: 'var(--background)'
                    }}
                >
                    {renderSVG(height, contentWidth, padding, pointSpacing)}
                </div>

                {/* Legend */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '16px',
                    marginTop: '10px',
                    fontSize: '0.7rem',
                    color: 'var(--text-secondary)'
                }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ width: '16px', height: '2px', backgroundColor: '#00D9FF' }} />
                        Past
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ width: '16px', height: '2px', background: 'repeating-linear-gradient(to right, #00D9FF 0, #00D9FF 4px, transparent 4px, transparent 6px)' }} />
                        Projected
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ width: '16px', height: '2px', backgroundColor: '#F5A623' }} />
                        Target
                    </span>
                </div>
            </div>
        </>
    );
}
