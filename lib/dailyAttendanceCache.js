/**
 * DailyAttendanceCache - 2-layer caching for per-subject daily attendance
 * Layer 1: localStorage (fast, immediate)
 * Layer 2: Firestore (persistent, cross-device)
 * 
 * Cache expires after 6 hours
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Portal } from './JiitManager';
import { Storage } from './storage';

const SIX_HOURS = 6 * 60 * 60 * 1000;

// Track if silent caching is in progress
let isSilentCaching = false;
let silentCacheListeners = [];

/**
 * Subscribe to silent cache status
 */
export function onSilentCacheStatus(callback) {
    silentCacheListeners.push(callback);
    return () => {
        silentCacheListeners = silentCacheListeners.filter(cb => cb !== callback);
    };
}

function notifySilentCacheStatus(status) {
    silentCacheListeners.forEach(cb => cb(status));
}

/**
 * Get daily attendance for a subject (checks cache first)
 * @param {string} subjectCode - The subject code (e.g., "15B11CI514")
 * @param {Object} subjectInfo - Full subject info with _subjectId, _componentIds, percentage
 * @param {Object} credentials - JIIT credentials
 * @param {string} uid - Firebase user ID (optional)
 * @returns {Promise<{ data: Array, fromCache: boolean }>}
 */
export async function getDailyAttendance(subjectCode, subjectInfo, credentials, uid = null) {
    // Get current overall percentage for smart cache invalidation
    const currentOverallPercentage = subjectInfo?.percentage ?? null;

    // Layer 1: Check localStorage (with overall percentage validation)
    const localCache = Storage.getSubjectDailyAttendance(subjectCode, currentOverallPercentage);

    if (localCache && !localCache.isStale) {
        console.log(`[DailyCache] ✓ Cache hit for ${subjectCode} (localStorage)`);
        return { data: localCache.data, fromCache: true };
    }

    // Layer 2: Check Firestore (if we have uid and localStorage is empty/stale)
    if (uid && (!localCache || localCache.isStale)) {
        try {
            const firestoreData = await loadFromFirestore(uid, subjectCode, currentOverallPercentage);
            if (firestoreData && !firestoreData.isStale) {
                console.log(`[DailyCache] ✓ Cache hit for ${subjectCode} (Firestore)`);
                // Update localStorage with overall percentage
                Storage.saveSubjectDailyAttendance(subjectCode, firestoreData.data, currentOverallPercentage);
                return { data: firestoreData.data, fromCache: true };
            }
        } catch (err) {
            console.warn(`[DailyCache] Firestore read failed:`, err.message);
        }
    }

    // Cache miss or stale - fetch fresh data
    console.log(`[DailyCache] Cache miss/stale for ${subjectCode}, fetching fresh...`);

    try {
        const freshData = await fetchFromPortal(subjectInfo, credentials);

        if (freshData && freshData.length > 0) {
            // Update both cache layers with overall percentage
            Storage.saveSubjectDailyAttendance(subjectCode, freshData, currentOverallPercentage);

            if (uid) {
                saveToFirestore(uid, subjectCode, freshData, currentOverallPercentage).catch(err =>
                    console.warn('[DailyCache] Firestore write failed:', err.message)
                );
            }

            return { data: freshData, fromCache: false };
        }

        // Return stale cache if fetch failed but we have old data
        if (localCache) {
            console.log(`[DailyCache] Fetch failed, returning stale cache for ${subjectCode}`);
            return { data: localCache.data, fromCache: true };
        }

        return { data: [], fromCache: false };
    } catch (err) {
        console.warn(`[DailyCache] Fetch failed for ${subjectCode}:`, err.message);

        // Return stale cache if available
        if (localCache) {
            return { data: localCache.data, fromCache: true };
        }

        throw err;
    }
}

/**
 * Fetch fresh daily attendance from JIIT portal
 */
async function fetchFromPortal(subjectInfo, credentials) {
    if (!credentials?.enrollment || !credentials?.password) {
        throw new Error('No credentials available');
    }

    if (!subjectInfo?._subjectId) {
        throw new Error('Missing subject ID');
    }

    await Portal.login(credentials.enrollment, credentials.password);
    const semester = await Portal.getLatestSemester();

    const subjectCode = subjectInfo.individualsubjectcode || subjectInfo.subjectCode;

    const daily = await Portal.getSubjectDailyAttendance(
        semester,
        subjectInfo._subjectId,
        subjectCode,
        subjectInfo._componentIds || []
    );

    return daily;
}

/**
 * Load daily attendance from Firestore
 * @param {string} uid - Firebase user ID
 * @param {string} subjectCode - Subject code
 * @param {number} currentOverallPercentage - Current overall % for validation
 */
async function loadFromFirestore(uid, subjectCode, currentOverallPercentage = null) {
    const docRef = doc(db, 'users', uid, 'dailyAttendance', subjectCode);
    const snap = await getDoc(docRef);

    if (!snap.exists()) return null;

    const data = snap.data();
    let isStale = Date.now() - data.cachedAt > SIX_HOURS;

    // Smart invalidation: check if overall percentage changed
    if (currentOverallPercentage !== null && data.overallPercentage !== undefined) {
        if (Math.round(data.overallPercentage) !== Math.round(currentOverallPercentage)) {
            console.log(`[DailyCache] Firestore cache stale: overall changed from ${data.overallPercentage}% to ${currentOverallPercentage}%`);
            isStale = true;
        }
    }

    return {
        data: data.attendance || [],
        cachedAt: data.cachedAt,
        overallPercentage: data.overallPercentage,
        isStale
    };
}

/**
 * Save daily attendance to Firestore
 * @param {string} uid - Firebase user ID
 * @param {string} subjectCode - Subject code
 * @param {Array} data - Daily attendance data
 * @param {number} overallPercentage - Overall % at time of caching
 */
async function saveToFirestore(uid, subjectCode, data, overallPercentage = null) {
    const docRef = doc(db, 'users', uid, 'dailyAttendance', subjectCode);
    await setDoc(docRef, {
        attendance: data,
        cachedAt: Date.now(),
        overallPercentage,
        updatedAt: new Date().toISOString()
    });
}

/**
 * Silent background cacher - fetches all subjects' daily attendance
 * Runs when cache is empty or on app startup (every 6 hours)
 */
export async function silentCacheAllSubjects(credentials, uid = null) {
    if (isSilentCaching) {
        console.log('[DailyCache] Silent caching already in progress');
        return;
    }

    // Get all subjects from attendance overview
    const attendance = Storage.getAttendance();
    if (!attendance || attendance.length === 0) {
        console.log('[DailyCache] No subjects to cache');
        return;
    }

    // Find subjects that need caching (missing or stale)
    const subjectCodes = attendance.map(a => a.subjectCode || a.individualsubjectcode).filter(Boolean);
    const needsCache = Storage.getSubjectsNeedingCache(subjectCodes);

    if (needsCache.length === 0) {
        console.log('[DailyCache] All subjects are cached and fresh');
        return;
    }

    console.log(`[DailyCache] Starting silent cache for ${needsCache.length} subjects...`);
    isSilentCaching = true;
    notifySilentCacheStatus({ caching: true, total: needsCache.length, completed: 0 });

    let completed = 0;

    for (const code of needsCache) {
        try {
            // Find full subject info
            const subjectInfo = attendance.find(a =>
                (a.subjectCode === code || a.individualsubjectcode === code)
            );

            if (!subjectInfo) continue;

            await getDailyAttendance(code, subjectInfo, credentials, uid);
            completed++;
            notifySilentCacheStatus({ caching: true, total: needsCache.length, completed });

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {
            console.warn(`[DailyCache] Failed to cache ${code}:`, err.message);
        }
    }

    isSilentCaching = false;
    notifySilentCacheStatus({ caching: false, total: needsCache.length, completed });
    console.log(`[DailyCache] Silent caching complete. Cached ${completed}/${needsCache.length} subjects.`);
}

/**
 * Check if cache is empty and trigger silent caching
 */
export function triggerCacheIfNeeded(credentials, uid = null) {
    const cache = Storage.getDailyAttendanceCache();
    const isEmpty = Object.keys(cache).length === 0;

    if (isEmpty) {
        console.log('[DailyCache] Cache is empty, triggering silent cache...');
        // Run in background
        silentCacheAllSubjects(credentials, uid);
    }
}

export const DailyAttendanceCache = {
    get: getDailyAttendance,
    cacheAll: silentCacheAllSubjects,
    triggerIfNeeded: triggerCacheIfNeeded,
    onStatus: onSilentCacheStatus
};

export default DailyAttendanceCache;
