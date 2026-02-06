/**
 * localStorage utility module for JFlow Timetable
 * Handles all client-side data persistence
 */

const KEYS = {
    ENROLLMENT: 'jflow_enrollment',
    PASSWORD: 'jflow_password',
    AUTO_LOGIN: 'jflow_autoLogin',
    SUBJECTS: 'jflow_subjects',
    ATTENDANCE: 'jflow_attendance',
    DAILY_ATTENDANCE: 'jflow_dailyAttendance', // Per-subject daily attendance cache
    TIMETABLE: 'jflow_timetable',
    LAST_REFRESH: 'jflow_lastRefresh',
    PERSONAL_INFO: 'jflow_personalInfo',
    SEMESTER: 'jflow_semester',
    TARGET_ATTENDANCE: 'jflow_targetAttendance',
    PLANNING_OVERRIDES: 'jflow_planningOverrides' // Per-subject planning overrides
};

// Helper to safely access localStorage (SSR-safe)
const safeStorage = {
    getItem: (key) => {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem(key);
    },
    setItem: (key, value) => {
        if (typeof window === 'undefined') return;
        localStorage.setItem(key, value);
    },
    removeItem: (key) => {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(key);
    }
};

export const Storage = {
    // ==========================================
    // Credentials
    // ==========================================

    getCredentials() {
        const enrollment = safeStorage.getItem(KEYS.ENROLLMENT);
        const password = safeStorage.getItem(KEYS.PASSWORD);
        const autoLogin = safeStorage.getItem(KEYS.AUTO_LOGIN) === 'true';

        if (!enrollment || !password) return null;

        return { enrollment, password, autoLogin };
    },

    saveCredentials(enrollment, password, autoLogin = true) {
        safeStorage.setItem(KEYS.ENROLLMENT, enrollment);
        safeStorage.setItem(KEYS.PASSWORD, password);
        safeStorage.setItem(KEYS.AUTO_LOGIN, autoLogin.toString());
    },

    clearCredentials() {
        safeStorage.removeItem(KEYS.ENROLLMENT);
        safeStorage.removeItem(KEYS.PASSWORD);
        safeStorage.removeItem(KEYS.AUTO_LOGIN);
    },

    // ==========================================
    // Personal Info
    // ==========================================

    getPersonalInfo() {
        const data = safeStorage.getItem(KEYS.PERSONAL_INFO);
        return data ? JSON.parse(data) : null;
    },

    savePersonalInfo(info) {
        safeStorage.setItem(KEYS.PERSONAL_INFO, JSON.stringify(info));
    },

    // ==========================================
    // Semester
    // ==========================================

    getSemester() {
        const data = safeStorage.getItem(KEYS.SEMESTER);
        return data ? JSON.parse(data) : null;
    },

    saveSemester(semester) {
        safeStorage.setItem(KEYS.SEMESTER, JSON.stringify(semester));
    },

    // ==========================================
    // Subjects
    // ==========================================

    getSubjects() {
        const data = safeStorage.getItem(KEYS.SUBJECTS);
        return data ? JSON.parse(data) : [];
    },

    saveSubjects(subjects) {
        safeStorage.setItem(KEYS.SUBJECTS, JSON.stringify(subjects));
    },

    // ==========================================
    // Attendance
    // ==========================================

    getAttendance() {
        const data = safeStorage.getItem(KEYS.ATTENDANCE);
        return data ? JSON.parse(data) : [];
    },

    saveAttendance(attendance) {
        safeStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(attendance));
    },

    // ==========================================
    // Target Attendance
    // ==========================================

    getTargetAttendance() {
        const data = safeStorage.getItem(KEYS.TARGET_ATTENDANCE);
        return data ? parseInt(data, 10) : 75; // Default 75%
    },

    saveTargetAttendance(target) {
        safeStorage.setItem(KEYS.TARGET_ATTENDANCE, target.toString());
    },

    // ==========================================
    // Timetable
    // ==========================================

    getTimetable() {
        const data = safeStorage.getItem(KEYS.TIMETABLE);
        return data ? JSON.parse(data) : {};
    },

    saveTimetable(timetable) {
        safeStorage.setItem(KEYS.TIMETABLE, JSON.stringify(timetable));
    },

    // ==========================================
    // Last Refresh Timestamp
    // ==========================================

    getLastRefresh() {
        const timestamp = safeStorage.getItem(KEYS.LAST_REFRESH);
        return timestamp ? new Date(timestamp) : null;
    },

    setLastRefresh(date = new Date()) {
        safeStorage.setItem(KEYS.LAST_REFRESH, date.toISOString());
    },

    // ==========================================
    // Utility
    // ==========================================

    clearAll() {
        Object.values(KEYS).forEach(key => {
            safeStorage.removeItem(key);
        });
    },

    // Check if we have cached data (not just credentials)
    hasData() {
        return !!(safeStorage.getItem(KEYS.SUBJECTS) && safeStorage.getItem(KEYS.ATTENDANCE));
    },

    // Check if we have a timetable in localStorage
    hasTimetable() {
        const data = safeStorage.getItem(KEYS.TIMETABLE);
        if (!data) return false;
        try {
            const parsed = JSON.parse(data);
            return Object.keys(parsed).length > 0;
        } catch {
            return false;
        }
    },

    // Load all cached data at once
    loadCached() {
        return {
            semester: this.getSemester(),
            subjects: this.getSubjects(),
            attendance: this.getAttendance(),
            personalInfo: this.getPersonalInfo(),
            timetable: this.getTimetable(),
            lastRefresh: this.getLastRefresh()
        };
    },

    // ==========================================
    // Daily Attendance Cache (per-subject)
    // Structure: { [subjectCode]: { data: [...], cachedAt: timestamp, attended, total } }
    // ==========================================

    /**
     * Compute attended/total from daily attendance data
     * @param {Array} dailyData - Array of daily attendance records
     * @returns {{ attended: number, total: number }}
     */
    computeFractionFromDaily(dailyData) {
        if (!dailyData || !Array.isArray(dailyData) || dailyData.length === 0) {
            return { attended: 0, total: 0 };
        }

        const total = dailyData.length;
        let attended = 0;

        for (const record of dailyData) {
            const status = record.present || record.studentstatus || '';
            if (status === 'Present' || status === 'P') {
                attended++;
            }
        }

        return { attended, total };
    },

    getDailyAttendanceCache() {
        const data = safeStorage.getItem(KEYS.DAILY_ATTENDANCE);
        return data ? JSON.parse(data) : {};
    },

    /**
     * Get cached daily attendance for a specific subject
     * @param {string} subjectCode - The subject code
     * @param {number} currentOverallPercentage - Current overall attendance % from JIIT sync
     * @returns {{ data: Array, cachedAt: number, isStale: boolean, attended: number, total: number } | null}
     */
    getSubjectDailyAttendance(subjectCode, currentOverallPercentage = null) {
        const cache = this.getDailyAttendanceCache();
        const entry = cache[subjectCode];

        if (!entry) return null;

        const SIX_HOURS = 6 * 60 * 60 * 1000;
        let isStale = Date.now() - entry.cachedAt > SIX_HOURS;

        // Smart invalidation: if overall percentage changed, cache is stale
        if (currentOverallPercentage !== null && entry.overallPercentage !== undefined) {
            if (Math.round(entry.overallPercentage) !== Math.round(currentOverallPercentage)) {
                console.log(`[Storage] Cache stale for ${subjectCode}: overall changed from ${entry.overallPercentage}% to ${currentOverallPercentage}%`);
                isStale = true;
            }
        }

        return {
            data: entry.data,
            cachedAt: entry.cachedAt,
            overallPercentage: entry.overallPercentage,
            attended: entry.attended,
            total: entry.total,
            isStale
        };
    },

    /**
     * Save daily attendance for a specific subject
     * Also computes and stores attended/total fraction
     * @param {string} subjectCode - The subject code
     * @param {Array} data - The daily attendance data
     * @param {number} overallPercentage - Overall attendance % at time of caching
     */
    saveSubjectDailyAttendance(subjectCode, data, overallPercentage = null) {
        const cache = this.getDailyAttendanceCache();
        const { attended, total } = this.computeFractionFromDaily(data);

        cache[subjectCode] = {
            data,
            cachedAt: Date.now(),
            overallPercentage,
            attended,
            total
        };
        safeStorage.setItem(KEYS.DAILY_ATTENDANCE, JSON.stringify(cache));
    },

    /**
     * Get fraction summaries for all cached subjects (without loading full daily data)
     * @returns {{ [subjectCode]: { attended: number, total: number } }}
     */
    getSubjectFractionSummaries() {
        const cache = this.getDailyAttendanceCache();
        const summaries = {};

        for (const [code, entry] of Object.entries(cache)) {
            if (entry.attended !== undefined && entry.total !== undefined) {
                summaries[code] = {
                    attended: entry.attended,
                    total: entry.total
                };
            }
        }

        return summaries;
    },

    /**
     * Get all stale subjects that need refresh
     * @returns {string[]} - Array of subject codes that are stale
     */
    getStaleSubjects() {
        const cache = this.getDailyAttendanceCache();
        const SIX_HOURS = 6 * 60 * 60 * 1000;
        const now = Date.now();

        return Object.keys(cache).filter(code => {
            return now - cache[code].cachedAt > SIX_HOURS;
        });
    },

    /**
     * Check if any subject needs caching
     * @param {string[]} subjectCodes - Array of all subject codes
     * @returns {string[]} - Subjects that are missing or stale
     */
    getSubjectsNeedingCache(subjectCodes) {
        const cache = this.getDailyAttendanceCache();
        const SIX_HOURS = 6 * 60 * 60 * 1000;
        const now = Date.now();

        return subjectCodes.filter(code => {
            const entry = cache[code];
            if (!entry) return true; // Missing
            return now - entry.cachedAt > SIX_HOURS; // Stale
        });
    },

    /**
     * Clear all daily attendance cache
     */
    clearDailyAttendanceCache() {
        safeStorage.removeItem(KEYS.DAILY_ATTENDANCE);
    },

    // ==========================================
    // Planning Overrides (per-subject)
    // Structure: { [subjectCode]: { [slotId]: status } }
    // ==========================================

    /**
     * Get planning overrides for a subject
     */
    getPlanningOverrides(subjectCode) {
        const data = safeStorage.getItem(KEYS.PLANNING_OVERRIDES);
        if (!data) return {};
        try {
            const allOverrides = JSON.parse(data);
            return allOverrides[subjectCode] || {};
        } catch {
            return {};
        }
    },

    /**
     * Save planning overrides for a subject
     */
    savePlanningOverrides(subjectCode, overrides) {
        let allOverrides = {};
        const existing = safeStorage.getItem(KEYS.PLANNING_OVERRIDES);
        if (existing) {
            try {
                allOverrides = JSON.parse(existing);
            } catch {
                allOverrides = {};
            }
        }
        allOverrides[subjectCode] = overrides;
        safeStorage.setItem(KEYS.PLANNING_OVERRIDES, JSON.stringify(allOverrides));
    },

    /**
     * Clear planning overrides for a subject or all
     */
    clearPlanningOverrides(subjectCode = null) {
        if (subjectCode) {
            const allOverrides = this.getPlanningOverrides(subjectCode);
            delete allOverrides[subjectCode];
            safeStorage.setItem(KEYS.PLANNING_OVERRIDES, JSON.stringify(allOverrides));
        } else {
            safeStorage.removeItem(KEYS.PLANNING_OVERRIDES);
        }
    }
};

export default Storage;
