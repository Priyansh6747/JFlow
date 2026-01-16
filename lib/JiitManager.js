import { WebPortal } from 'jsjiit';



export class PortalError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PortalError';
    }
}

export class LoginFailedError extends PortalError {
    constructor(reason) {
        super(`Login failed: ${reason}`);
        this.name = 'LoginFailedError';
    }
}

export class PortalUnavailableError extends PortalError {
    constructor() {
        super('JIIT portal is currently unreachable');
        this.name = 'PortalUnavailableError';
    }
}

export class SessionExpiredError extends PortalError {
    constructor() {
        super('Your session has expired. Please login again.');
        this.name = 'SessionExpiredError';
    }
}


// Proxy URL from environment, defaults to local dev server
const PROXY_URL = process.env.NEXT_PUBLIC_CORS_PROXY_URL || "http://localhost:8000";

class PortalEngine {
    constructor() {
        this.portal = new WebPortal({
            useProxy: true,
            proxyUrl: PROXY_URL
        });
        this.isLoggedIn = false;

        // Cache
        this.cachedSemester = null;
        this.rawSemester = null; // Store raw JSJIIT semester object
        this.cachedSubjects = new Map();
        this.cachedAttendance = new Map();

        this.log('Portal jiitManager initialized');
    }


    log(message, data) {
        const timestamp = new Date().toISOString();
        console.log(`[Portal ${timestamp}] ${message}`, data || '');
    }

    async login(username, password) {
        this.log('Login attempt started', { username });

        try {
            await this.portal.student_login(username, password);

            if (!this.portal.session) {
                throw new LoginFailedError('Session not established');
            }

            this.isLoggedIn = true;
            // Clear stale cache on re-login
            this.cachedSemester = null;
            this.rawSemester = null;
            this.cachedSubjects.clear();
            this.cachedAttendance.clear();

            this.log('Login successful');
        } catch (error) {
            this.log('Login failed', error);

            if (error.message?.includes('Failed to fetch')) {
                throw new PortalUnavailableError();
            }
            if (error.message?.includes('Invalid credentials')) {
                throw new LoginFailedError('Invalid username or password');
            }
            throw new LoginFailedError(error.message || 'Unknown error');
        }
    }

    ensureLoggedIn() {
        if (!this.isLoggedIn) {
            throw new SessionExpiredError();
        }
    }

    async getLatestSemester() {
        this.ensureLoggedIn();

        // Return cached if available
        if (this.cachedSemester) {
            this.log('Semester cache hit', this.cachedSemester);
            return this.cachedSemester;
        }

        this.log('Fetching semester metadata');

        try {
            // For subjects, we need get_registered_semesters
            const registeredSems = await this.portal.get_registered_semesters();
            // registeredSems[0] is the latest semester
            const latestSem = registeredSems[0];

            if (!latestSem) {
                throw new PortalError('Could not determine current semester');
            }

            // Store raw semester for API calls
            this.rawSemester = latestSem;

            // Return normalized version to app
            // jsjiit Semester class has registration_id and registration_code
            this.cachedSemester = {
                id: latestSem.registration_id,
                label: latestSem.registration_code || `Semester ${latestSem.registration_id}`
            };

            this.log('Semester resolved', this.cachedSemester);
            return this.cachedSemester;
        } catch (error) {
            this.log('Semester resolution failed', error);
            throw new PortalError(`Failed to get semester: ${error.message}`);
        }
    }


    async getRegisteredSubjects(semester) {
        this.ensureLoggedIn();

        // Check cache
        const cached = this.cachedSubjects.get(semester.id);
        if (cached) {
            this.log('Subjects cache hit', { semesterId: semester.id, count: cached.length });
            return cached;
        }

        this.log('Fetching registered subjects', { semesterId: semester.id });

        try {
            // Use the raw semester object that JSJIIT expects
            if (!this.rawSemester) {
                throw new PortalError('Semester not initialized. Call getLatestSemester first.');
            }

            // get_registered_subjects_and_faculties returns a Registrations object
            const registrations = await this.portal.get_registered_subjects_and_faculties(this.rawSemester);

            if (!registrations?.subjects || registrations.subjects.length === 0) {
                this.log('No subjects found or partial data');
                return [];
            }

            // Normalize into clean domain types
            // registrations.subjects is an array of RegisteredSubject objects
            const subjects = registrations.subjects.map((raw) => {
                // RegisteredSubject has: subject_code, subject_desc, subject_component_code, etc.
                const componentCode = raw.subject_component_code || '';
                const components = [];

                // Extract component types from component code
                if (componentCode.includes('L')) components.push('L');
                if (componentCode.includes('T')) components.push('T');
                if (componentCode.includes('P')) components.push('P');

                return {
                    code: raw.subject_code || 'UNKNOWN',
                    name: raw.subject_desc || 'Unknown Subject',
                    components: components.length > 0 ? components : ['L'] // default to lecture if none
                };
            });

            // Cache it
            this.cachedSubjects.set(semester.id, subjects);
            this.log('Subjects fetched and cached', { count: subjects.length });

            return subjects;
        } catch (error) {
            this.log('Failed to fetch subjects', error);
            throw new PortalError(`Failed to get subjects: ${error.message}`);
        }
    }

    async getAttendanceOverview(semester) {
        this.ensureLoggedIn();

        // Check cache
        const cached = this.cachedAttendance.get(semester.id);
        if (cached) {
            this.log('Attendance cache hit', { semesterId: semester.id, count: cached.length });
            return cached;
        }

        this.log('Fetching attendance overview', { semesterId: semester.id });

        try {
            // Ensure we have the raw semester object
            if (!this.rawSemester) {
                throw new PortalError('Semester not initialized. Call getLatestSemester first.');
            }

            const meta = await this.portal.get_attendance_meta();
            const header = meta.latest_header();

            // ⚠️ FIX: Use this.rawSemester instead of semester parameter
            const rawData = await this.portal.get_attendance(header, this.rawSemester);

            this.log('Raw attendance data:', rawData);

            if (!rawData?.studentattendancelist) {
                this.log('No attendance data found');
                return [];
            }

            // Debug: Log first item to see structure
            if (rawData.studentattendancelist.length > 0) {
                this.log('Sample attendance item:', rawData.studentattendancelist[0]);
                this.log('Sample item keys:', Object.keys(rawData.studentattendancelist[0]));
                this.log('Sample item JSON:', JSON.stringify(rawData.studentattendancelist[0], null, 2));
            }

            // Normalize into clean structure
            const overview = rawData.studentattendancelist.map((raw) => {
                // Extract component IDs for future daily attendance calls (Phase 2)
                const componentIds = [];
                if (raw.Lsubjectcomponentid) componentIds.push(raw.Lsubjectcomponentid);
                if (raw.Tsubjectcomponentid) componentIds.push(raw.Tsubjectcomponentid);
                if (raw.Psubjectcomponentid) componentIds.push(raw.Psubjectcomponentid);

                // Try multiple possible field names (API inconsistency)
                const subjectCode = raw.subjectcode || raw.Subjectcode || raw.SubjectCode || raw.individualsubjectcode || 'UNKNOWN';
                const subjectName = raw.subjectdesc || raw.Subjectdesc || raw.SubjectDesc || raw.subjectdescription || 'Unknown Subject';

                // Percentage might be named differently - try several variants
                // Also check LT (Lecture+Tutorial) and individual L/T/P percentages
                let percentage = 0;
                if (raw.LTpercantage !== undefined) {
                    percentage = parseFloat(raw.LTpercantage || '0');
                } else if (raw.attpercantage !== undefined) {
                    percentage = parseFloat(raw.attpercantage || '0');
                } else if (raw.Lpercentage !== undefined) {
                    percentage = parseFloat(raw.Lpercentage || '0');
                } else if (raw.totalpercantage !== undefined) {
                    percentage = parseFloat(raw.totalpercantage || '0');
                }

                return {
                    subjectCode,
                    subjectName,
                    percentage,
                    // Store internals for Phase 2
                    _subjectId: raw.subjectid,
                    _componentIds: componentIds
                };
            });

            // Cache it
            this.cachedAttendance.set(semester.id, overview);
            this.log('Attendance fetched and cached', { count: overview.length });

            return overview;
        } catch (error) {
            this.log('Failed to fetch attendance', error);
            throw new PortalError(`Failed to get attendance: ${error.message}`);
        }
    }

    async getPersonalInfo() {
        this.ensureLoggedIn();
        this.log('Fetching personal info');
        try {
            const info = await this.portal.get_personal_info();
            this.log('Personal info fetched', { name: info.studentname });
            return info;
        } catch (error) {
            this.log('Failed to fetch personal info', error);
            throw new PortalError(`Failed to get personal info: ${error.message}`);
        }
    }

    async getSubjectDailyAttendance(semester, subjectId, subjectCode, componentIds) {
        this.ensureLoggedIn();
        // Check cache? For now, no caching for deep details to keep it simple, 
        // or we could cache by subjectId if needed.

        this.log('Fetching daily attendance', { subjectId, subjectCode });

        try {
            // ⚠️ FIX: Use this.rawSemester instead of semester parameter if needed, 
            // but here the underlying API likely uses the sem object we pass or just ID.
            // The user snippet suggests: portal.get_subject_daily_attendance(sem, subjectid, individualsubjectcode, subjectcomponentids)

            if (!this.rawSemester) {
                throw new PortalError('Semester not initialized. Call getLatestSemester first.');
            }

            const daily = await this.portal.get_subject_daily_attendance(
                this.rawSemester,
                subjectId,
                subjectCode,
                componentIds
            );

            this.log('Daily attendance fetched', { count: daily.length });
            return daily;

        } catch (error) {
            this.log('Failed to fetch daily attendance', error);
            throw new PortalError(`Failed to get daily attendance: ${error.message}`);
        }
    }
}


const jiitManager = new PortalEngine();


export const Portal = {
    login: (username, password) => jiitManager.login(username, password),
    getLatestSemester: () => jiitManager.getLatestSemester(),
    getRegisteredSubjects: (semester) => jiitManager.getRegisteredSubjects(semester),
    getAttendanceOverview: (semester) => jiitManager.getAttendanceOverview(semester),
    getPersonalInfo: () => jiitManager.getPersonalInfo(),
    getSubjectDailyAttendance: (semester, subjectId, subjectCode, componentIds) => jiitManager.getSubjectDailyAttendance(semester, subjectId, subjectCode, componentIds),
};