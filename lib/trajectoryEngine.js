/**
 * Trajectory Engine for Attendance Planning
 * 
 * Combines ERP history + timetable future + user overrides
 * to compute running attendance % at each class instance.
 */

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Parse date from ERP format "DD/MM/YYYY (time)"
 * @param {string} dateStr - Date string like "16/01/2026 (12:00:PM - 12:50 PM)"
 * @returns {Date|null}
 */
export function parseERPDate(dateStr) {
    if (!dateStr) return null;
    const datePart = dateStr.split(' (')[0];
    const parts = datePart.split('/');
    if (parts.length !== 3) return null;
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
}

/**
 * Convert daily attendance data to session format
 * @param {Array} dailyData - ERP daily attendance records
 * @returns {Array} Normalized sessions with { date, status, type: 'past' }
 */
export function normalizePastSessions(dailyData) {
    if (!dailyData || !Array.isArray(dailyData)) return [];

    return dailyData
        .map(record => {
            const date = parseERPDate(record.datetime || record.attendancedate);
            if (!date) return null;

            const statusRaw = record.present || record.studentstatus || '';
            const status = (statusRaw === 'Present' || statusRaw === 'P') ? 'present' : 'absent';

            return {
                date,
                dateKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
                time: record.datetime?.match(/\((.+)\)/)?.[1] || '',
                classType: record.classtype || '',
                status,
                type: 'past'
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.date - b.date);
}

/**
 * Generate future class slots from timetable
 * @param {Object} timetable - Timetable by day: { Monday: [...], ... }
 * @param {string} subjectCode - Subject code to filter
 * @param {Date} startDate - Start date (typically today)
 * @param {Date} endDate - End date for projection (e.g., 8 weeks out)
 * @returns {Array} Future slots with { date, slotId, status: 'present', type: 'projected' }
 */
export function generateFutureSlots(timetable, subjectCode, startDate, endDate) {
    if (!timetable || !subjectCode) return [];

    const slots = [];
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    while (current <= end) {
        const dayName = DAYS[current.getDay()];
        const daySchedule = timetable[dayName] || [];

        // Find classes for this subject on this day
        const subjectClasses = daySchedule.filter(slot => {
            const slotCode = slot.subjectCode || slot.code || '';
            return slotCode.includes(subjectCode) || subjectCode.includes(slotCode);
        });

        for (const slot of subjectClasses) {
            const dateKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;

            slots.push({
                date: new Date(current),
                dateKey,
                slotId: `${dateKey}_${slot.startTime}`,
                startTime: slot.startTime,
                duration: slot.duration,
                status: 'present', // Default
                type: 'projected'
            });
        }

        current.setDate(current.getDate() + 1);
    }

    return slots;
}

/**
 * Apply user overrides to future slots
 * @param {Array} futureSlots - Generated future slots
 * @param {Array} overrides - User overrides: [{ slotId, status: 'present'|'absent'|'cancelled' }]
 * @returns {Array} Slots with overrides applied
 */
export function applyOverrides(futureSlots, overrides = []) {
    if (!overrides || overrides.length === 0) return futureSlots;

    const overrideMap = new Map(overrides.map(o => [o.slotId, o.status]));

    return futureSlots
        .map(slot => {
            const override = overrideMap.get(slot.slotId);
            if (override === 'cancelled') return null; // Remove cancelled
            return {
                ...slot,
                status: override || slot.status
            };
        })
        .filter(Boolean);
}

/**
 * Apply event blocks (mark date ranges as cancelled)
 * @param {Array} slots - Slots to filter
 * @param {Array} events - Events: [{ startDate, endDate }]
 * @returns {Array} Slots with event dates removed
 */
export function applyEvents(slots, events = []) {
    if (!events || events.length === 0) return slots;

    return slots.filter(slot => {
        const slotTime = slot.date.getTime();

        for (const event of events) {
            const start = new Date(event.startDate).setHours(0, 0, 0, 0);
            const end = new Date(event.endDate).setHours(23, 59, 59, 999);

            if (slotTime >= start && slotTime <= end) {
                return false; // Remove slots in event range
            }
        }
        return true;
    });
}

/**
 * Merge past and future sessions into single ordered list
 * @param {Array} pastSessions - Normalized past sessions
 * @param {Array} futureSessions - Future slots with overrides applied
 * @returns {Array} Merged sorted list
 */
export function mergeSessions(pastSessions, futureSessions) {
    return [...pastSessions, ...futureSessions].sort((a, b) => a.date - b.date);
}

/**
 * Compute running attendance at each session
 * @param {Array} sessions - Merged sessions list
 * @returns {Array} Trajectory data: [{ x, y, type, date }]
 */
export function computeTrajectory(sessions) {
    if (!sessions || sessions.length === 0) return [];

    const trajectory = [];
    let present = 0;
    let absent = 0;

    for (let i = 0; i < sessions.length; i++) {
        const session = sessions[i];

        if (session.status === 'present') {
            present++;
        } else if (session.status === 'absent') {
            absent++;
        }

        const total = present + absent;
        const attendance = total > 0 ? (present / total) * 100 : 0;

        trajectory.push({
            x: i,
            y: Math.round(attendance * 10) / 10, // 1 decimal place
            type: session.type,
            date: session.date,
            dateKey: session.dateKey,
            status: session.status
        });
    }

    return trajectory;
}

/**
 * Build complete trajectory from all data sources
 * @param {Array} dailyData - ERP daily attendance
 * @param {Object} timetable - Full timetable
 * @param {string} subjectCode - Subject code
 * @param {Array} overrides - User overrides
 * @param {Array} events - Event blocks
 * @param {number} weeksAhead - Number of weeks to project (default 8)
 * @returns {Object} { trajectory, stats }
 */
export function buildTrajectory(dailyData, timetable, subjectCode, overrides = [], events = [], weeksAhead = 8) {
    // 1. Normalize past sessions from ERP
    const pastSessions = normalizePastSessions(dailyData);

    // 2. Generate future slots from timetable
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + weeksAhead * 7);

    let futureSlots = generateFutureSlots(timetable, subjectCode, today, endDate);

    // 3. Apply events (cancel date ranges)
    futureSlots = applyEvents(futureSlots, events);

    // 4. Apply user overrides
    futureSlots = applyOverrides(futureSlots, overrides);

    // 5. Merge all sessions
    const allSessions = mergeSessions(pastSessions, futureSlots);

    // 6. Compute trajectory
    const trajectory = computeTrajectory(allSessions);

    // 7. Compute stats
    const currentStats = computeCurrentStats(pastSessions);
    const projectedStats = computeProjectedStats(trajectory);
    const todayIndex = trajectory.findIndex(t => t.type === 'projected');

    return {
        trajectory,
        todayIndex: todayIndex >= 0 ? todayIndex : trajectory.length,
        stats: {
            current: currentStats,
            projected: projectedStats,
            delta: projectedStats.percentage - currentStats.percentage
        }
    };
}

/**
 * Compute current stats from past sessions
 */
function computeCurrentStats(pastSessions) {
    const present = pastSessions.filter(s => s.status === 'present').length;
    const absent = pastSessions.filter(s => s.status === 'absent').length;
    const total = present + absent;

    return {
        present,
        absent,
        total,
        percentage: total > 0 ? Math.round((present / total) * 1000) / 10 : 0
    };
}

/**
 * Compute projected stats from full trajectory
 */
function computeProjectedStats(trajectory) {
    if (trajectory.length === 0) return { present: 0, absent: 0, total: 0, percentage: 0 };

    const last = trajectory[trajectory.length - 1];
    const present = trajectory.filter(t => t.status === 'present').length;
    const absent = trajectory.filter(t => t.status === 'absent').length;

    return {
        present,
        absent,
        total: present + absent,
        percentage: last.y
    };
}

/**
 * Get the next N upcoming slots for quick actions
 */
export function getUpcomingSlots(timetable, subjectCode, count = 10) {
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30); // Look 30 days ahead

    const slots = generateFutureSlots(timetable, subjectCode, today, endDate);
    return slots.slice(0, count);
}
