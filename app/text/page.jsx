"use client"
import { useState, useEffect } from 'react';
import { Portal } from '@/lib/JiitManager';

function PortalDemo() {
    const [status, setStatus] = useState('idle'); // idle, logging-in, loading, success, error
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);

    // Hardcoded credentials
    const USERNAME = 'demo';
    const PASSWORD = 'demo';

    useEffect(() => {
        async function init() {
            try {
                setStatus('logging-in');
                setError(null);

                // Step 1: Login
                await Portal.login(USERNAME, PASSWORD);
                console.log('✓ Login successful');

                setStatus('loading');

                // Step 2: Get semester (gates everything else)
                const semester = await Portal.getLatestSemester();
                console.log('✓ Semester resolved:', semester);

                // Step 3: Get subjects and basic overview
                const [subjects, attendanceOverview, personalInfo] = await Promise.all([
                    Portal.getRegisteredSubjects(semester),
                    Portal.getAttendanceOverview(semester),
                    Portal.getPersonalInfo()
                ]);

                console.log('✓ Basic data loaded');
                console.log('Fetching detailed attendance for', attendanceOverview.length, 'subjects...');

                // Step 4: Enrich with daily attendance (in parallel)
                // We need this to get "Attended / Total" counts
                const enrichedAttendance = await Promise.all(
                    attendanceOverview.map(async (att) => {
                        try {
                            // We need subjectId and componentIds which we stored in _subjectId and _componentIds
                            // If those are missing (old cache?), we might fail, but let's assume they are there.
                            if (!att._subjectId) return att;

                            const daily = await Portal.getSubjectDailyAttendance(
                                semester,
                                att._subjectId,
                                att.subjectCode,
                                att._componentIds
                            );

                            // Calculate attended vs total
                            // Daily attendance item usually has 'status' or similar.
                            // Based on user snippet: "specifically attended vs total per subject"
                            // let's assume daily list length is total classes?
                            // Or we need to filter by status='Present'?
                            // Usually daily attendance list contains all scheduled classes.
                            // Let's count "Present" or "P".

                            // Note: The user didn't specify how to count present, but standard logic:
                            // status could be "Present", "Absent", etc.
                            // Let's log one item if possible or just count total for now.
                            // Actually, wait. The user code snippet just pushes to `subjectcomponentids`.
                            // It doesn't show how `get_subject_daily_attendance` response looks like.
                            // But standard JSJIIT response has `studentstatus` which is 'Present' or 'Absent'.

                            const totalClasses = daily.length;
                            const attendedClasses = daily.filter(d =>
                                d.studentstatus === 'Present' || d.studentstatus === 'P'
                            ).length;

                            return {
                                ...att,
                                totalClasses,
                                attendedClasses
                            };
                        } catch (e) {
                            console.warn(`Failed to get details for ${att.subjectCode}`, e);
                            return att;
                        }
                    })
                );

                console.log('✓ Detailed data loaded');

                // Calculate stats
                const totalSubjects = subjects.length;
                const belowThreshold = enrichedAttendance.filter(a => a.percentage < 75).length;
                const avgAttendance = enrichedAttendance.reduce((sum, a) => sum + a.percentage, 0) / enrichedAttendance.length;

                setData({
                    semester,
                    subjects,
                    attendance: enrichedAttendance,
                    personalInfo,
                    stats: {
                        totalSubjects,
                        belowThreshold,
                        avgAttendance: avgAttendance.toFixed(1)
                    }
                });

                setStatus('success');
            } catch (err) {
                console.error('Failed:', err);
                setError(err.message);
                setStatus('error');
            }
        }
        init();
    }, []);

    // Loading states
    if (status === 'logging-in') {
        return <div style={{ padding: '20px' }}>Logging in as {USERNAME}...</div>;
    }

    if (status === 'loading') {
        return <div style={{ padding: '20px' }}>Loading student data...</div>;
    }

    if (status === 'error') {
        return (
            <div style={{ padding: '20px', color: 'red' }}>
                <h2>Error</h2>
                <p>{error}</p>
            </div>);
    }

    if (status !== 'success' || !data) {
        return <div style={{ padding: '20px' }}>Initializing...</div>;
    }

    // Success - show data
    const { semester, subjects, attendance, personalInfo, stats } = data;

    return (
        <div style={{ padding: '20px', fontFamily: 'monospace' }}>
            <h1>JAtten Portal Demo</h1>
            {personalInfo && (
                <div style={{ marginBottom: '20px', padding: '10px', background: '#f5f5f5', borderRadius: '4px' }}>
                    <h3 style={{ margin: '0 0 5px 0' }}>👤 {personalInfo.studentname}</h3>
                    <p style={{ margin: 0, color: '#666' }}>
                        {personalInfo.enrollmentno} • {personalInfo.programname}
                    </p>
                </div>
            )}
            <p style={{ color: 'gray' }}>Logged in as: {USERNAME}</p>

            <hr />
            <h2>📅 Semester</h2>
            <p><strong>{semester.label}</strong> (ID: {semester.id})</p>

            <hr />
            <h2>📊 Overview</h2>
            <ul>          <li>Total Subjects: {stats.totalSubjects}</li>
                <li>Average Attendance: {stats.avgAttendance}%</li>
                <li>Below 75%: {stats.belowThreshold} subjects ⚠️</li>
            </ul>
            <hr />
            <h2>📚 Registered Subjects</h2>
            <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>          <tr>            <th>Code</th>
                    <th>Name</th>
                    <th>Components</th>
                </tr>          </thead>          <tbody>          {subjects.map(subject => (
                <tr key={subject.code}>
                    <td>{subject.code}</td>
                    <td>{subject.name}</td>
                    <td>{subject.components.join(', ')}</td>
                </tr>))}
            </tbody>
            </table>
            <hr />
            <h2>📈 Attendance Overview</h2>
            <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>          <tr>            <th>Code</th>
                    <th>Subject</th>
                    <th>Attendance %</th>
                    <th>Classes (Att/Tot)</th>
                    <th>Status</th>
                </tr>          </thead>          <tbody>          {attendance
                .sort((a, b) => a.percentage - b.percentage)
                .map(att => {
                    const isDanger = att.percentage < 75;
                    const isWarning = att.percentage >= 75 && att.percentage < 80;

                    return (
                        <tr key={att.subjectCode} style={{
                            backgroundColor: isDanger ? '#ffebee' : isWarning ? '#fff9c4' : '#e8f5e9'
                        }}>
                            <td>{att.subjectCode}</td>
                            <td>{att.subjectName}</td>
                            <td><strong>{att.percentage}%</strong></td>
                            <td>
                                {att.attendedClasses !== undefined
                                    ? `${att.attendedClasses} / ${att.totalClasses}`
                                    : 'Loading...'}
                            </td>
                            <td>                        {isDanger && '🚨 Danger'}
                                {isWarning && '⚠️ Warning'}
                                {!isDanger && !isWarning && '✅ Safe'}
                            </td>
                        </tr>);
                })}
            </tbody>
            </table>
        </div>
    );
}

export default PortalDemo;