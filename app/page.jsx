"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function Home() {
    const router = useRouter();
    const { user, loading } = useAuth();

    useEffect(() => {
        if (loading) return;

        if (user) {
            router.replace('/timetable');
        } else {
            router.replace('/signin');
        }
    }, [user, loading, router]);

    return (
        <div className="loading-screen">
            <div className="spinner spinner-lg"></div>
            <p className="loading-text">Loading...</p>
        </div>
    );
}