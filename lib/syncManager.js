/**
 * SyncManager - Central sync orchestrator for JFlow
 * Handles dual sync: Firebase (timetable) + JIIT (attendance)
 */

import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { Portal } from './JiitManager';
import { Storage } from './storage';

// Sync status state (in-memory, not persisted)
let syncStatus = {
    firebase: 'idle',  // 'idle' | 'syncing' | 'synced' | 'failed'
    jiit: 'unknown'    // 'unknown' | 'syncing' | 'online' | 'offline'
};

// Lock to prevent multiple simultaneous syncs
let syncInProgress = false;

let statusListeners = [];

/**
 * Subscribe to sync status changes
 */
export function onSyncStatusChange(callback) {
    statusListeners.push(callback);
    // Return unsubscribe function
    return () => {
        statusListeners = statusListeners.filter(cb => cb !== callback);
    };
}

/**
 * Notify all listeners of status change
 */
function notifyStatusChange() {
    statusListeners.forEach(cb => cb({ ...syncStatus }));
}

/**
 * Get current sync status
 */
export function getSyncStatus() {
    return { ...syncStatus };
}

/**
 * Check if timetable exists in localStorage, fallback to Firebase
 * @param {string} uid - Firebase user ID
 * @returns {Promise<Object>} - Timetable data
 */
export async function checkTimetableSync(uid) {
    // Check localStorage first
    const localTimetable = Storage.getTimetable();

    if (localTimetable && Object.keys(localTimetable).length > 0) {
        console.log('✓ Timetable loaded from localStorage');
        syncStatus.firebase = 'synced';
        notifyStatusChange();
        return localTimetable;
    }

    // No local timetable, fetch from Firebase
    if (!uid) {
        console.log('✗ No user ID for Firebase sync');
        syncStatus.firebase = 'failed';
        notifyStatusChange();
        return {};
    }

    syncStatus.firebase = 'syncing';
    notifyStatusChange();

    try {
        const docRef = doc(db, 'users', uid, 'timetable', 'schedule');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            const timetable = data.schedule || {};

            // Save to localStorage
            Storage.saveTimetable(timetable);
            console.log('✓ Timetable synced from Firebase');

            syncStatus.firebase = 'synced';
            notifyStatusChange();
            return timetable;
        } else {
            console.log('✗ No timetable in Firebase');
            syncStatus.firebase = 'synced'; // No error, just empty
            notifyStatusChange();
            return {};
        }
    } catch (err) {
        console.error('Firebase timetable sync failed:', err);
        syncStatus.firebase = 'failed';
        notifyStatusChange();
        return {};
    }
}

/**
 * Save timetable to both localStorage and Firebase
 * @param {Object} timetable - Timetable data
 * @param {string} uid - Firebase user ID (optional)
 */
export async function saveTimetable(timetable, uid) {
    // Always save to localStorage
    Storage.saveTimetable(timetable);

    // Save to Firebase if user is logged in
    if (uid) {
        try {
            const docRef = doc(db, 'users', uid, 'timetable', 'schedule');
            await setDoc(docRef, {
                schedule: timetable,
                updatedAt: new Date().toISOString()
            });
            console.log('✓ Timetable saved to Firebase');
        } catch (err) {
            console.warn('Failed to save timetable to Firebase:', err);
        }
    }
}

/**
 * Trigger JIIT portal sync (attendance, subjects)
 * @param {Object} credentials - { enrollment, password }
 * @param {string} uid - Firebase user ID (optional, for Firestore sync)
 * @returns {Promise<Object>} - Sync result
 */
export async function triggerJiitSync(credentials, uid) {
    if (!credentials?.enrollment || !credentials?.password) {
        syncStatus.jiit = 'offline';
        notifyStatusChange();
        return { status: 'no-credentials' };
    }

    // Prevent multiple simultaneous syncs
    if (syncInProgress) {
        console.log('⏳ Sync already in progress, skipping...');
        return { status: 'already-syncing' };
    }

    syncInProgress = true;
    syncStatus.jiit = 'syncing';
    notifyStatusChange();

    try {
        // Attempt login
        await Portal.login(credentials.enrollment, credentials.password);

        // Get semester and data
        const semester = await Portal.getLatestSemester();
        const [subjects, attendanceOverview, personalInfo] = await Promise.all([
            Portal.getRegisteredSubjects(semester),
            Portal.getAttendanceOverview(semester),
            Portal.getPersonalInfo()
        ]);

        // Enrich attendance with daily details (with error handling for each)
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

                    // Handle undefined or invalid response
                    if (!daily || !Array.isArray(daily)) {
                        console.warn(`No daily data for ${att.subjectCode}`);
                        return att;
                    }

                    return {
                        ...att,
                        totalClasses: daily.length,
                        attendedClasses: daily.filter(d =>
                            d.studentstatus === 'Present' || d.studentstatus === 'P' || d.present === 'Present'
                        ).length
                    };
                } catch (err) {
                    console.warn(`Failed to get daily attendance for ${att.subjectCode}:`, err.message);
                    return att;
                }
            })
        );

        // Save to localStorage
        Storage.saveSemester(semester);
        Storage.saveSubjects(subjects);
        Storage.saveAttendance(enrichedAttendance);
        Storage.savePersonalInfo(personalInfo);
        Storage.setLastRefresh();

        // Sync subjects to Firestore if user is logged in
        if (uid) {
            await syncSubjectsToFirestore(uid, subjects, enrichedAttendance);
        }

        syncStatus.jiit = 'online';
        notifyStatusChange();

        console.log('✓ JIIT sync completed');
        return {
            status: 'success',
            data: { semester, subjects, attendance: enrichedAttendance, personalInfo }
        };
    } catch (err) {
        console.warn('JIIT sync failed:', err.message);
        syncStatus.jiit = 'offline';
        notifyStatusChange();
        return { status: 'offline', error: err.message };
    } finally {
        syncInProgress = false;
    }
}

/**
 * Sync subjects to Firestore
 */
async function syncSubjectsToFirestore(uid, subjects, attendance) {
    try {
        for (const subject of subjects) {
            const att = attendance.find(a => a.subjectCode === subject.code);
            const docRef = doc(db, 'users', uid, 'subjects', subject.code);

            // Check if exists (preserve isHidden flag)
            const existing = await getDoc(docRef);

            await setDoc(docRef, {
                code: subject.code,
                name: subject.name,
                components: subject.components || [],
                attendance: att?.percentage || null,
                attendedClasses: att?.attendedClasses || null,
                totalClasses: att?.totalClasses || null,
                isHidden: existing.exists() ? existing.data().isHidden : false,
                isCustom: false,
                lastSynced: new Date().toISOString()
            }, { merge: true });
        }
    } catch (err) {
        console.error('Failed to sync subjects to Firestore:', err);
    }
}

/**
 * Load subjects from Firestore
 * @param {string} uid - Firebase user ID
 * @returns {Promise<{subjects: Array, attendance: Array}>}
 */
export async function loadSubjectsFromFirestore(uid) {
    if (!uid) return { subjects: [], attendance: [] };

    try {
        const subjectsRef = collection(db, 'users', uid, 'subjects');
        const snapshot = await getDocs(subjectsRef);

        if (snapshot.empty) {
            return { subjects: [], attendance: [] };
        }

        const subjects = [];
        const attendance = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            if (!data.isHidden) {
                subjects.push({
                    code: data.code,
                    name: data.name,
                    components: data.components || []
                });

                if (data.attendance !== null) {
                    attendance.push({
                        subjectCode: data.code,
                        subjectName: data.name,
                        percentage: data.attendance,
                        attendedClasses: data.attendedClasses,
                        totalClasses: data.totalClasses
                    });
                }
            }
        });

        return { subjects, attendance };
    } catch (err) {
        console.warn('Failed to load subjects from Firestore:', err);
        return { subjects: [], attendance: [] };
    }
}

export const SyncManager = {
    getSyncStatus,
    onSyncStatusChange,
    checkTimetableSync,
    saveTimetable,
    triggerJiitSync,
    loadSubjectsFromFirestore
};

export default SyncManager;
