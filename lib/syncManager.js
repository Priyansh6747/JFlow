/**
 * SyncManager - Central sync orchestrator for JFlow
 * Handles dual sync: Firebase (timetable) + JIIT (attendance)
 */

import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { Portal } from './JiitManager';
import { Storage } from './storage';

// ============================================
// Diff Detection Utility
// ============================================

/**
 * Check if data has changed between two arrays
 * @param {Array} newData - New data from JIIT
 * @param {Array} cachedData - Cached data (from localStorage/Firebase)
 * @param {string} key - Key to compare by (e.g., 'code' or 'subjectCode')
 * @returns {boolean} - True if data changed
 */
function hasDataChanged(newData, cachedData, key) {
    if (!newData || !cachedData) return true;
    if (newData.length !== cachedData.length) return true;

    const newMap = new Map(newData.map(item => [item[key], JSON.stringify(item)]));
    const cachedMap = new Map(cachedData.map(item => [item[key], JSON.stringify(item)]));

    for (const [k, v] of newMap) {
        if (cachedMap.get(k) !== v) return true;
    }
    return false;
}

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

// ============================================
// Firebase Cache Layer (subjects + attendance)
// ============================================

/**
 * Sync JIIT data to Firebase cache
 * @param {string} uid - Firebase user ID
 * @param {Array} subjects - Subjects from JIIT
 * @param {Array} attendance - Attendance from JIIT
 */
async function syncCacheToFirebase(uid, subjects, attendance) {
    try {
        const cacheRef = doc(db, 'users', uid, 'cache', 'jiitData');
        await setDoc(cacheRef, {
            subjects,
            attendance,
            lastSynced: new Date().toISOString()
        });
        console.log('✓ Synced subjects/attendance to Firebase cache');
    } catch (err) {
        console.warn('Failed to sync cache to Firebase:', err);
    }
}

/**
 * Load JIIT cache from Firebase
 * @param {string} uid - Firebase user ID
 * @returns {Promise<{subjects: Array, attendance: Array, lastSynced: string}|null>}
 */
export async function loadCacheFromFirebase(uid) {
    if (!uid) return null;

    try {
        const cacheRef = doc(db, 'users', uid, 'cache', 'jiitData');
        const snap = await getDoc(cacheRef);

        if (snap.exists()) {
            const data = snap.data();
            console.log('✓ Loaded subjects/attendance from Firebase cache');
            return {
                subjects: data.subjects || [],
                attendance: data.attendance || [],
                lastSynced: data.lastSynced
            };
        }
        return null;
    } catch (err) {
        console.warn('Failed to load cache from Firebase:', err);
        return null;
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

        // Get semester and data in parallel
        const semester = await Portal.getLatestSemester();

        // Fetch subjects and attendance (fast) - personal info separately (can be slow)
        const [subjects, attendance] = await Promise.all([
            Portal.getRegisteredSubjects(semester),
            Portal.getAttendanceOverview(semester),
        ]);

        // Personal info is slow and non-critical - fetch in background, don't block
        let personalInfo = null;
        Portal.getPersonalInfo()
            .then(info => {
                personalInfo = info;
                Storage.savePersonalInfo(info);
            })
            .catch(err => console.warn('Personal info fetch failed:', err.message));

        // ============================================
        // 3-Layer Sync: Compare and update if changed
        // ============================================

        // Load current cached data from localStorage
        const cachedSubjects = Storage.getSubjects();
        const cachedAttendance = Storage.getAttendance();

        // Check if data changed
        const subjectsChanged = hasDataChanged(subjects, cachedSubjects, 'code');
        const attendanceChanged = hasDataChanged(attendance, cachedAttendance, 'subjectCode');
        const dataChanged = subjectsChanged || attendanceChanged;

        if (dataChanged) {
            console.log('📊 Data changed - updating caches...');

            // Layer 3: Update localStorage
            Storage.saveSemester(semester);
            Storage.saveSubjects(subjects);
            Storage.saveAttendance(attendance);
            Storage.setLastRefresh();

            // Layer 2: Update Firebase cache (if logged in)
            if (uid) {
                await syncCacheToFirebase(uid, subjects, attendance);
                // Also sync individual subject docs (for isHidden flags)
                await syncSubjectsToFirestore(uid, subjects, attendance);
            }
        } else {
            console.log('✓ No data changes detected, skipping cache updates');
            Storage.setLastRefresh(); // Still update timestamp
        }

        syncStatus.jiit = 'online';
        notifyStatusChange();

        console.log('✓ JIIT sync completed');
        return {
            status: 'success',
            data: { semester, subjects, attendance, personalInfo }
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
    loadSubjectsFromFirestore,
    loadCacheFromFirebase
};

export default SyncManager;
