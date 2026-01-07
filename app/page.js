"use client"
import { useState, useEffect } from 'react';
import { Portal } from '@/lib/engine';

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

        // Step 3: Get subjects
        const [subjects, attendance] = await Promise.all([
          Portal.getRegisteredSubjects(semester),
          Portal.getAttendanceOverview(semester)
        ]);

        console.log('✓ Data loaded');

        // Calculate stats  
        const totalSubjects = subjects.length;
        const belowThreshold = attendance.filter(a => a.percentage < 75).length;
        const avgAttendance = attendance.reduce((sum, a) => sum + a.percentage, 0) / attendance.length;

        setData({
          semester,
          subjects,
          attendance,
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
        </div>    );
  }

  if (status !== 'success' || !data) {
    return <div style={{ padding: '20px' }}>Initializing...</div>;
  }

  // Success - show data  
  const { semester, subjects, attendance, stats } = data;

  return (
      <div style={{ padding: '20px', fontFamily: 'monospace' }}>
        <h1>JAtten Portal Demo</h1>
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
            </tr>          ))}
        </tbody>
        </table>
        <hr />
        <h2>📈 Attendance Overview</h2>
        <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>          <tr>            <th>Code</th>
            <th>Subject</th>
            <th>Attendance</th>
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
                    <td>                        {isDanger && '🚨 Danger'}
                      {isWarning && '⚠️ Warning'}
                      {!isDanger && !isWarning && '✅ Safe'}
                    </td>
                  </tr>                );
            })}
        </tbody>
        </table>
        </div>
  );
}

export default PortalDemo;