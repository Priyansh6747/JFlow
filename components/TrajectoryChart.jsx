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
 * - Interactive crosshairs and tooltip on hover (fullscreen)
 */

import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { X, Maximize2 } from 'lucide-react';

function getAttendanceColor(percentage, threshold = 75) {
    if (percentage >= threshold) return '#00D9FF';
    if (percentage >= threshold - 5) return '#F5A623';
    return '#FF6B6B';
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()} ${months[d.getMonth()]}`;
}

export default function TrajectoryChart({
    trajectory = [],
    todayIndex = 0,
    height = 220,
    threshold = 75
}) {
    const scrollRef = useRef(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [hoverData, setHoverData] = useState(null); // { x, y, dataPoint, index }

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

    const pastData = trajectory.filter((_, i) => i < todayIndex);
    const projectedData = trajectory.filter((_, i) => i >= todayIndex);
    const lastPoint = trajectory[trajectory.length - 1];

    // Date labels
    const labelInterval = Math.max(1, Math.floor(trajectory.length / 10));

    // Render SVG for normal view
    const renderNormalSVG = () => {
        const h = height;
        const w = contentWidth;
        const pad = padding;
        const pSpacing = pointSpacing;

        const scaleX = (i) => pad.left + i * pSpacing;
        const scaleY = (y) => h - pad.bottom - ((y - minY) / rangeY) * (h - pad.top - pad.bottom);

        const dateLabels = [];
        for (let i = 0; i < trajectory.length; i += labelInterval) {
            const pt = trajectory[i];
            if (pt.date) {
                const d = new Date(pt.date);
                dateLabels.push({ x: scaleX(i), label: `${d.getDate()}/${d.getMonth() + 1}` });
            }
        }

        // Build area path for gradient fill
        const areaPath = trajectory.length > 0
            ? trajectory.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(pt.y)}`).join(' ')
            + ` L ${scaleX(trajectory.length - 1)} ${h - pad.bottom} L ${scaleX(0)} ${h - pad.bottom} Z`
            : '';

        return (
            <svg width={w} height={h} style={{ display: 'block' }}>
                <defs>
                    <linearGradient id="normalChartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={getAttendanceColor(lastPoint?.y || 75, threshold)} stopOpacity="0.25" />
                        <stop offset="100%" stopColor={getAttendanceColor(lastPoint?.y || 75, threshold)} stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/* Gradient area fill */}
                {areaPath && (
                    <path d={areaPath} fill="url(#normalChartGradient)" />
                )}

                {/* Threshold line */}
                <line
                    x1={pad.left}
                    y1={scaleY(threshold)}
                    x2={w - pad.right}
                    y2={scaleY(threshold)}
                    stroke="#F5A623"
                    strokeWidth="1.5"
                    strokeDasharray="6 4"
                    opacity="0.7"
                />
                <text x={pad.left - 8} y={scaleY(threshold)} fontSize="10" fill="#F5A623" textAnchor="end" dominantBaseline="middle">
                    {threshold}%
                </text>

                {/* Grid lines */}
                {[100, 75, 50].map(val => {
                    const y = scaleY(val);
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
                        <line x1={scaleX(todayIndex)} y1={pad.top} x2={scaleX(todayIndex)} y2={h - pad.bottom} stroke="var(--accent-primary)" strokeWidth="2" strokeDasharray="4 4" />
                        <rect x={scaleX(todayIndex) - 22} y={pad.top - 18} width="44" height="16" rx="4" fill="var(--accent-primary)" />
                        <text x={scaleX(todayIndex)} y={pad.top - 10} fontSize="9" fill="var(--black)" textAnchor="middle" dominantBaseline="middle" fontWeight="600">TODAY</text>
                    </>
                )}

                {/* Past line */}
                {pastData.length > 0 && (
                    <path
                        d={pastData.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(pt.y)}`).join(' ')}
                        fill="none"
                        stroke="#00D9FF"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}

                {/* Projected segments */}
                {projectedData.map((pt, i) => {
                    if (i === 0) return null;
                    const prevPt = projectedData[i - 1];
                    return (
                        <line
                            key={i}
                            x1={scaleX(todayIndex + i - 1)}
                            y1={scaleY(prevPt.y)}
                            x2={scaleX(todayIndex + i)}
                            y2={scaleY(pt.y)}
                            stroke={getAttendanceColor(pt.y, threshold)}
                            strokeWidth="2.5"
                            strokeDasharray="6 3"
                            strokeLinecap="round"
                        />
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
                            x={scaleX(trajectory.length - 1) + 8}
                            y={scaleY(lastPoint.y) - 10}
                            width="38"
                            height="20"
                            rx="4"
                            fill={getAttendanceColor(lastPoint.y, threshold)}
                        />
                        <text x={scaleX(trajectory.length - 1) + 27} y={scaleY(lastPoint.y)} fontSize="10" fill="var(--black)" textAnchor="middle" dominantBaseline="middle" fontWeight="600">
                            {lastPoint.y}%
                        </text>
                    </g>
                )}
            </svg>
        );
    };

    // Interactive fullscreen chart
    const renderFullscreenChart = () => {
        const h = 420;
        const pSpacing = 18;
        const w = Math.max(800, trajectory.length * pSpacing + 140);
        const pad = { top: 50, right: 70, bottom: 60, left: 70 };

        const scaleX = (i) => pad.left + i * pSpacing;
        const scaleY = (y) => h - pad.bottom - ((y - minY) / rangeY) * (h - pad.top - pad.bottom);

        // Find closest data point based on mouse X
        const handleMouseMove = (e) => {
            const svgRect = e.currentTarget.getBoundingClientRect();
            const mouseX = e.clientX - svgRect.left;

            // Find nearest data point
            let closestIdx = 0;
            let closestDist = Infinity;
            for (let i = 0; i < trajectory.length; i++) {
                const x = scaleX(i);
                const dist = Math.abs(mouseX - x);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestIdx = i;
                }
            }

            if (closestDist < 40) {
                const pt = trajectory[closestIdx];
                setHoverData({
                    x: scaleX(closestIdx),
                    y: scaleY(pt.y),
                    dataPoint: pt,
                    index: closestIdx
                });
            } else {
                setHoverData(null);
            }
        };

        const handleMouseLeave = () => setHoverData(null);

        const dateLabels = [];
        const fullLabelInterval = Math.max(1, Math.floor(trajectory.length / 15));
        for (let i = 0; i < trajectory.length; i += fullLabelInterval) {
            const pt = trajectory[i];
            if (pt.date) {
                dateLabels.push({ x: scaleX(i), label: formatDate(pt.date) });
            }
        }

        return (
            <svg
                width={w}
                height={h}
                style={{ display: 'block', cursor: 'crosshair' }}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
            >
                <defs>
                    <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={getAttendanceColor(lastPoint?.y || 75, threshold)} stopOpacity="0.35" />
                        <stop offset="100%" stopColor={getAttendanceColor(lastPoint?.y || 75, threshold)} stopOpacity="0.02" />
                    </linearGradient>
                </defs>

                {/* Gradient area fill */}
                <path
                    d={trajectory.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(pt.y)}`).join(' ')
                        + ` L ${scaleX(trajectory.length - 1)} ${h - pad.bottom} L ${scaleX(0)} ${h - pad.bottom} Z`}
                    fill="url(#chartGradient)"
                />
                {[100, 90, 80, 70, 60, 50].map(val => {
                    const y = scaleY(val);
                    if (y < pad.top || y > h - pad.bottom) return null;
                    return (
                        <g key={val}>
                            <line x1={pad.left} y1={y} x2={w - pad.right} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                            <text x={pad.left - 12} y={y} fontSize="11" fill="var(--text-secondary)" textAnchor="end" dominantBaseline="middle">
                                {val}%
                            </text>
                        </g>
                    );
                })}

                {/* Threshold line */}
                <line x1={pad.left} y1={scaleY(threshold)} x2={w - pad.right} y2={scaleY(threshold)} stroke="#F5A623" strokeWidth="2" strokeDasharray="8 4" opacity="0.8" />
                <rect x={w - pad.right + 5} y={scaleY(threshold) - 10} width="45" height="20" rx="4" fill="#F5A623" />
                <text x={w - pad.right + 27} y={scaleY(threshold)} fontSize="11" fill="var(--black)" textAnchor="middle" dominantBaseline="middle" fontWeight="600">
                    {threshold}%
                </text>

                {/* Today marker */}
                {todayIndex > 0 && todayIndex < trajectory.length && (
                    <>
                        <line x1={scaleX(todayIndex)} y1={pad.top} x2={scaleX(todayIndex)} y2={h - pad.bottom} stroke="var(--accent-primary)" strokeWidth="2" strokeDasharray="5 5" />
                        <rect x={scaleX(todayIndex) - 26} y={pad.top - 22} width="52" height="20" rx="5" fill="var(--accent-primary)" />
                        <text x={scaleX(todayIndex)} y={pad.top - 12} fontSize="10" fill="var(--black)" textAnchor="middle" dominantBaseline="middle" fontWeight="700">TODAY</text>
                    </>
                )}

                {/* Past line */}
                {pastData.length > 0 && (
                    <path
                        d={pastData.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(pt.y)}`).join(' ')}
                        fill="none"
                        stroke="#00D9FF"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}

                {/* Projected segments */}
                {projectedData.map((pt, i) => {
                    if (i === 0) return null;
                    const prevPt = projectedData[i - 1];
                    return (
                        <line
                            key={i}
                            x1={scaleX(todayIndex + i - 1)}
                            y1={scaleY(prevPt.y)}
                            x2={scaleX(todayIndex + i)}
                            y2={scaleY(pt.y)}
                            stroke={getAttendanceColor(pt.y, threshold)}
                            strokeWidth="3"
                            strokeDasharray="8 4"
                            strokeLinecap="round"
                        />
                    );
                })}

                {/* Data points (dots) */}
                {trajectory.map((pt, i) => (
                    <circle
                        key={i}
                        cx={scaleX(i)}
                        cy={scaleY(pt.y)}
                        r={hoverData?.index === i ? 6 : 3}
                        fill={i < todayIndex ? '#00D9FF' : getAttendanceColor(pt.y, threshold)}
                        stroke="var(--background)"
                        strokeWidth={hoverData?.index === i ? 2 : 1}
                        style={{ transition: 'r 0.1s' }}
                    />
                ))}

                {/* Date labels */}
                {dateLabels.map((lbl, i) => (
                    <text key={i} x={lbl.x} y={h - pad.bottom + 20} fontSize="10" fill="var(--text-secondary)" textAnchor="middle">
                        {lbl.label}
                    </text>
                ))}

                {/* Crosshairs on hover */}
                {hoverData && (
                    <>
                        {/* Vertical line */}
                        <line
                            x1={hoverData.x}
                            y1={pad.top}
                            x2={hoverData.x}
                            y2={h - pad.bottom}
                            stroke="rgba(255,255,255,0.5)"
                            strokeWidth="1"
                            strokeDasharray="4 2"
                        />
                        {/* Horizontal line */}
                        <line
                            x1={pad.left}
                            y1={hoverData.y}
                            x2={w - pad.right}
                            y2={hoverData.y}
                            stroke="rgba(255,255,255,0.5)"
                            strokeWidth="1"
                            strokeDasharray="4 2"
                        />

                        {/* Y-axis value label */}
                        <rect
                            x={pad.left - 45}
                            y={hoverData.y - 12}
                            width="40"
                            height="24"
                            rx="4"
                            fill={getAttendanceColor(hoverData.dataPoint.y, threshold)}
                        />
                        <text
                            x={pad.left - 25}
                            y={hoverData.y}
                            fontSize="11"
                            fill="var(--black)"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontWeight="600"
                        >
                            {hoverData.dataPoint.y}%
                        </text>

                        {/* X-axis date label */}
                        <rect
                            x={hoverData.x - 32}
                            y={h - pad.bottom + 5}
                            width="64"
                            height="22"
                            rx="4"
                            fill="var(--surface)"
                            stroke="var(--border)"
                        />
                        <text
                            x={hoverData.x}
                            y={h - pad.bottom + 16}
                            fontSize="10"
                            fill="var(--text-primary)"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontWeight="500"
                        >
                            {formatDate(hoverData.dataPoint.date)}
                        </text>

                        {/* Tooltip box */}
                        <g transform={`translate(${hoverData.x + 15}, ${hoverData.y - 50})`}>
                            <rect
                                x="0"
                                y="0"
                                width="100"
                                height="44"
                                rx="6"
                                fill="var(--surface)"
                                stroke="var(--border)"
                                strokeWidth="1"
                            />
                            <text x="10" y="16" fontSize="10" fill="var(--text-secondary)">
                                {formatDate(hoverData.dataPoint.date)}
                            </text>
                            <text x="10" y="34" fontSize="14" fill={getAttendanceColor(hoverData.dataPoint.y, threshold)} fontWeight="700">
                                {hoverData.dataPoint.y}%
                            </text>
                            <text x="50" y="34" fontSize="10" fill="var(--text-muted)">
                                {hoverData.index < todayIndex ? 'Actual' : 'Projected'}
                            </text>
                        </g>
                    </>
                )}

                {/* End badge */}
                {lastPoint && (
                    <g>
                        <rect x={scaleX(trajectory.length - 1) + 10} y={scaleY(lastPoint.y) - 12} width="48" height="24" rx="5" fill={getAttendanceColor(lastPoint.y, threshold)} />
                        <text x={scaleX(trajectory.length - 1) + 34} y={scaleY(lastPoint.y)} fontSize="12" fill="var(--black)" textAnchor="middle" dominantBaseline="middle" fontWeight="700">
                            {lastPoint.y}%
                        </text>
                    </g>
                )}
            </svg>
        );
    };

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
                        <div>
                            <h2 style={{ color: 'var(--text-primary)', fontSize: '1.2rem', margin: 0 }}>Attendance Trajectory</h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '4px 0 0 0' }}>
                                Hover over the chart to see details
                            </p>
                        </div>
                        <button
                            onClick={() => setIsFullscreen(false)}
                            style={{
                                background: 'var(--surface)',
                                border: '1px solid var(--border)',
                                borderRadius: '8px',
                                padding: '10px 16px',
                                cursor: 'pointer',
                                color: 'var(--text-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '0.9rem'
                            }}
                        >
                            <X size={18} /> Close
                        </button>
                    </div>

                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            flex: 1,
                            overflowX: 'auto',
                            overflowY: 'hidden',
                            backgroundColor: 'var(--surface)',
                            borderRadius: '16px',
                            padding: '20px',
                            border: '1px solid var(--border)'
                        }}
                    >
                        {renderFullscreenChart()}
                    </div>

                    {/* Selected Point Info Panel */}
                    <div style={{
                        marginTop: '16px',
                        padding: '16px 20px',
                        backgroundColor: 'var(--surface)',
                        borderRadius: '12px',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        minHeight: '60px'
                    }}>
                        {hoverData ? (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                    <div style={{
                                        width: '50px',
                                        height: '50px',
                                        borderRadius: '12px',
                                        backgroundColor: getAttendanceColor(hoverData.dataPoint.y, threshold),
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.1rem',
                                        fontWeight: '700',
                                        color: 'var(--black)'
                                    }}>
                                        {hoverData.dataPoint.y}%
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                                            {formatDate(hoverData.dataPoint.date)}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                            {hoverData.index < todayIndex ? 'Actual attendance' : 'Projected attendance'}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '24px' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</div>
                                        <div style={{
                                            fontSize: '0.9rem',
                                            fontWeight: '600',
                                            color: getAttendanceColor(hoverData.dataPoint.y, threshold),
                                            marginTop: '2px'
                                        }}>
                                            {hoverData.dataPoint.y >= threshold ? 'On Track' : hoverData.dataPoint.y >= threshold - 5 ? 'Warning' : 'Critical'}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>vs Target</div>
                                        <div style={{
                                            fontSize: '0.9rem',
                                            fontWeight: '600',
                                            color: hoverData.dataPoint.y >= threshold ? '#00D9FF' : '#FF6B6B',
                                            marginTop: '2px'
                                        }}>
                                            {hoverData.dataPoint.y >= threshold ? '+' : ''}{(hoverData.dataPoint.y - threshold).toFixed(1)}%
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Type</div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-primary)', marginTop: '2px' }}>
                                            {hoverData.index < todayIndex ? 'Past' : 'Future'}
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div style={{
                                width: '100%',
                                textAlign: 'center',
                                color: 'var(--text-muted)',
                                fontSize: '0.85rem'
                            }}>
                                Hover over the chart to see point details
                            </div>
                        )}
                    </div>

                    {/* Legend */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: '24px',
                        marginTop: '12px',
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary)'
                    }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '24px', height: '3px', backgroundColor: '#00D9FF', borderRadius: '2px' }} />
                            Actual
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '24px', height: '3px', background: 'repeating-linear-gradient(to right, #00D9FF 0, #00D9FF 6px, transparent 6px, transparent 10px)', borderRadius: '2px' }} />
                            Projected
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '24px', height: '3px', backgroundColor: '#F5A623', borderRadius: '2px' }} />
                            Target ({threshold}%)
                        </span>
                    </div>
                </div>
            )}

            {/* Normal chart */}
            <div style={{ position: 'relative' }}>
                {/* Expand button */}
                <button
                    onClick={() => setIsFullscreen(true)}
                    style={{
                        position: 'absolute',
                        top: '6px',
                        right: '6px',
                        zIndex: 10,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '6px 10px',
                        backgroundColor: 'var(--surface)',
                        borderRadius: '6px',
                        fontSize: '0.7rem',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
                        e.currentTarget.style.color = 'var(--black)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--surface)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                    }}
                >
                    <Maximize2 size={12} /> Expand
                </button>

                <div
                    ref={scrollRef}
                    style={{
                        overflowX: 'auto',
                        overflowY: 'hidden',
                        borderRadius: '8px',
                        backgroundColor: 'var(--background)'
                    }}
                >
                    {renderNormalSVG()}
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
