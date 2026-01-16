/**
 * DataManager - Central refresh module for JFlow
 * Handles login, data fetching from Portal, and caching
 */

import { Portal } from './JiitManager';
import { Storage } from './storage';

export const DataManager = {
    /**
     * Full data refresh from Portal
     * Logs in, fetches all data, and caches to localStorage
     */
    async refresh(enrollment, password) {
        try {
            // Step 1: Login
            await Portal.login(enrollment, password);
            console.log('✓ Login successful');

            // Step 2: Get semester
            const semester = await Portal.getLatestSemester();
            console.log('✓ Semester resolved:', semester);
            Storage.saveSemester(semester);

            // Step 3: Fetch data in parallel
            const [subjects, attendanceOverview, personalInfo] = await Promise.all([
                Portal.getRegisteredSubjects(semester),
                Portal.getAttendanceOverview(semester),
                Portal.getPersonalInfo()
            ]);

            console.log('✓ Basic data loaded');

            // Step 4: Enrich attendance with daily details
            const enrichedAttendance = await Promise.all(
                attendanceOverview.map(async (att) => {
                    try {
                        if (!att._subjectId) return att;

                        const daily = await Portal.getSubjectDailyAttendance(
                            semester,
                            att._subjectId,
                            att.subjectCode,
                            att._componentIds
                        );

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

            // Step 5: Save to localStorage
            Storage.saveSubjects(subjects);
            Storage.saveAttendance(enrichedAttendance);
            Storage.savePersonalInfo(personalInfo);
            Storage.setLastRefresh();

            return {
                semester,
                subjects,
                attendance: enrichedAttendance,
                personalInfo
            };
        } catch (error) {
            console.error('DataManager refresh failed:', error);
            throw error;
        }
    },

    /**
     * Load data from localStorage cache
     */
    loadCached() {
        return {
            semester: Storage.getSemester(),
            subjects: Storage.getSubjects(),
            attendance: Storage.getAttendance(),
            personalInfo: Storage.getPersonalInfo(),
            timetable: Storage.getTimetable(),
            lastRefresh: Storage.getLastRefresh()
        };
    },

    /**
     * Check if data is stale (older than 1 hour)
     */
    isDataStale() {
        const lastRefresh = Storage.getLastRefresh();
        if (!lastRefresh) return true;

        const oneHour = 60 * 60 * 1000;
        return (new Date() - lastRefresh) > oneHour;
    },

    /**
     * Check if we have valid cached data
     */
    hasCachedData() {
        return Storage.hasData();
    },

    /**
     * Get attendance percentage for a subject
     */
    getSubjectAttendance(subjectCode) {
        const attendance = Storage.getAttendance();
        const subject = attendance.find(a => a.subjectCode === subjectCode);
        return subject?.percentage ?? null;
    },

    /**
     * Clear all cached data and credentials
     */
    logout() {
        Storage.clearAll();
    }
};

export default DataManager;
