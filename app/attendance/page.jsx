"use client";

/**
 * Attendance Page - Shows all subjects with attendance
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Storage } from '@/lib/storage';
import AttendanceCard from '@/components/AttendanceCard';
import { ArrowLeft, RefreshCw } from 'lucide-react';

export default function AttendancePage() {
    const router = useRouter();
    const { user, silentSync, jiitStatus } = useAuth();
    const [attendance, setAttendance] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        // Load attendance from localStorage
        const cached = Storage.getAttendance();
        if (cached && cached.length > 0) {
            setAttendance(cached);
        }
        setIsLoading(false);
    }, []);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            const result = await silentSync();
            if (result.status === 'success' && result.data.attendance) {
                setAttendance(result.data.attendance);
            }
        } finally {
            setIsRefreshing(false);
        }
    };

    return (
        <div className="page-container">
            {/* Header */}
            <header className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                        className="btn btn-ghost"
                        onClick={() => router.back()}
                        style={{ padding: '8px' }}
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 style={{ fontSize: '1.25rem', margin: 0 }}>Attendance</h1>
                        <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                            {attendance.length} subjects
                        </span>
                    </div>
                </div>
                <button
                    className="btn btn-ghost"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    style={{ padding: '8px' }}
                >
                    <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
                </button>
            </header>

            {/* Content */}
            <main style={{ padding: '16px', paddingBottom: '32px' }}>
                {isLoading ? (
                    <div className="empty-state">
                        <RefreshCw size={32} className="animate-spin" />
                        <p>Loading attendance...</p>
                    </div>
                ) : attendance.length === 0 ? (
                    <div className="empty-state">
                        <p>No attendance data available</p>
                        <button className="btn btn-primary" onClick={handleRefresh}>
                            Sync Now
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {attendance.map((att, index) => (
                            <AttendanceCard
                                key={att.subjectCode || index}
                                code={att.subjectCode}
                                name={att.subjectName}
                                percentage={att.percentage || 0}
                                attendedClasses={att.attendedClasses}
                                totalClasses={att.totalClasses}
                                Lpercentage={att.Lpercentage}
                                Tpercentage={att.Tpercentage}
                            />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
