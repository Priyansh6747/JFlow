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
    TIMETABLE: 'jflow_timetable',
    LAST_REFRESH: 'jflow_lastRefresh',
    PERSONAL_INFO: 'jflow_personalInfo',
    SEMESTER: 'jflow_semester'
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
    }
};

export default Storage;
