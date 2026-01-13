"use client";

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut as firebaseSignOut,
    GoogleAuthProvider,
    GithubAuthProvider,
    signInWithPopup
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Storage } from '@/lib/storage';
import { SyncManager, onSyncStatusChange } from '@/lib/syncManager';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [needsOnboarding, setNeedsOnboarding] = useState(false);
    const [jiitStatus, setJiitStatus] = useState('unknown');
    const [firebaseStatus, setFirebaseStatus] = useState('idle');
    const [jiitCredentials, setJiitCredentials] = useState(null);

    // Subscribe to sync status changes
    useEffect(() => {
        const unsubscribe = onSyncStatusChange((status) => {
            setJiitStatus(status.jiit);
            setFirebaseStatus(status.firebase);
        });
        return unsubscribe;
    }, []);

    // Listen to Firebase auth state
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                setUser(firebaseUser);
                // Check if user has JIIT credentials (determines onboarding need)
                const hasCredentials = await loadJiitCredentials(firebaseUser.uid);
                setNeedsOnboarding(!hasCredentials);
            } else {
                setUser(null);
                setJiitCredentials(null);
                setJiitStatus('unknown');
                setNeedsOnboarding(false);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Load JIIT credentials from localStorage first, then Firestore
    const loadJiitCredentials = async (uid) => {
        // Check localStorage first
        const localCreds = Storage.getCredentials();
        if (localCreds?.enrollment && localCreds?.password) {
            setJiitCredentials(localCreds);
            return true;
        }

        // Fallback to Firestore (for cross-device sync)
        try {
            const docRef = doc(db, 'users', uid, 'profile', 'jiit');
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                const creds = {
                    enrollment: data.enrollment,
                    password: data.password
                };
                setJiitCredentials(creds);
                Storage.saveCredentials(data.enrollment, data.password, true);
                return true;
            }
        } catch (err) {
            console.warn('Failed to load JIIT credentials from Firestore:', err);
        }

        return false;
    };

    // Save JIIT credentials to localStorage (primary) and optionally Firestore
    const saveJiitCredentials = async (enrollment, password, syncToCloud = false) => {
        // Always save to localStorage
        Storage.saveCredentials(enrollment, password, true);
        const creds = { enrollment, password };
        setJiitCredentials(creds);
        setNeedsOnboarding(false);

        // Optionally sync to Firestore for cross-device access
        if (syncToCloud && user) {
            try {
                const docRef = doc(db, 'users', user.uid, 'profile', 'jiit');
                await setDoc(docRef, {
                    enrollment,
                    password,
                    updatedAt: new Date().toISOString()
                });
            } catch (err) {
                console.warn('Failed to sync credentials to cloud:', err);
            }
        }
    };

    // Mark onboarding as complete (user skipped)
    const skipOnboarding = () => {
        setNeedsOnboarding(false);
    };

    // Trigger JIIT sync using SyncManager
    const silentSync = useCallback(async () => {
        const creds = jiitCredentials || Storage.getCredentials();
        return await SyncManager.triggerJiitSync(creds, user?.uid);
    }, [jiitCredentials, user]);

    // Trigger Firebase timetable sync
    const syncTimetable = useCallback(async () => {
        if (!user) return {};
        return await SyncManager.checkTimetableSync(user.uid);
    }, [user]);

    // Save timetable
    const saveTimetable = useCallback(async (timetable) => {
        await SyncManager.saveTimetable(timetable, user?.uid);
    }, [user]);

    // Sign in with Email/Password
    const signIn = async (email, password) => {
        const result = await signInWithEmailAndPassword(auth, email, password);
        return result.user;
    };

    // Sign up with Email/Password
    const signUp = async (email, password) => {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        return result.user;
    };

    // Sign in with Google
    const signInWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        return result.user;
    };

    // Sign in with GitHub
    const signInWithGithub = async () => {
        const provider = new GithubAuthProvider();
        const result = await signInWithPopup(auth, provider);
        return result.user;
    };

    // Sign out
    const signOutUser = async () => {
        await firebaseSignOut(auth);
        Storage.clearAll();
        setUser(null);
        setJiitCredentials(null);
        setJiitStatus('unknown');
        setNeedsOnboarding(false);
    };

    const value = {
        user,
        loading,
        needsOnboarding,
        jiitStatus,
        firebaseStatus,
        jiitCredentials,
        signIn,
        signUp,
        signInWithGoogle,
        signInWithGithub,
        signOut: signOutUser,
        saveJiitCredentials,
        skipOnboarding,
        silentSync,
        syncTimetable,
        saveTimetable
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export default AuthContext;
