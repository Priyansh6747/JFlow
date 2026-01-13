/**
 * JFlow Parser Module
 * 
 * Utility functions for parsing and extracting data from JIIT Portal responses.
 */

// ============================================================================
// BATCH & SUBJECT EXTRACTORS (Converted from Python)
// ============================================================================

/**
 * Extracts the batch name from a string.
 * @param {string} text - The input string containing the batch name and possibly other info in brackets.
 * @returns {string} The extracted batch name, or the original text if no bracket is found.
 */
export function batchExtractor(text) {
    if (!text) return text;

    const startBracket = text.indexOf("(");

    if (startBracket !== -1) {
        return text.substring(1, startBracket).trim();
    }

    return text;
}

/**
 * Extracts the subject code from a string.
 * @param {string} text - The input string containing the subject code in brackets.
 * @returns {string} The extracted subject code, or the original text if no brackets are found.
 */
export function subjectExtractor(text) {
    if (!text) return text;

    const startBracket = text.indexOf("(");

    if (startBracket !== -1) {
        const endBracket = text.indexOf(")", startBracket);

        if (endBracket !== -1) {
            return text.substring(startBracket + 1, endBracket);
        }
    }

    return text;
}

/**
 * Extracts the faculty name from a string.
 * @param {string} text - The input string containing the faculty name after a forward slash.
 * @returns {string} The extracted faculty name, or the original text if no slash is found.
 */
export function facultyExtractor(text) {
    if (!text) return text;

    const slashIndex = text.indexOf("/");

    if (slashIndex !== -1) {
        return text.substring(slashIndex + 1).trim();
    }

    return text;
}

/**
 * Expand batch code into list of individual batches.
 * @param {string} batchCode - The batch code to expand (e.g., 'E1E2', 'ALL').
 * @returns {string[]} A list of individual batch strings.
 */
export function expandBatch(batchCode) {
    const defaultBatches = ["E", "F", "H", "D"];

    if (!batchCode) {
        return defaultBatches;
    }

    if (batchCode === "ALL") {
        return defaultBatches;
    }

    if (batchCode.toUpperCase() === "MINOR") {
        return defaultBatches;
    }

    // Match pattern like E1, F2, H3, etc.
    const regex = /([A-Z])(\d+)/g;
    const matches = [...batchCode.matchAll(regex)];

    if (matches.length > 0) {
        return matches.map(match => `${match[1]}${match[2]}`);
    }

    return [batchCode];
}

/**
 * Extracts the location from a string.
 * @param {string} text - The input string containing the location (e.g., after a dash and before a slash).
 * @returns {string} The extracted location string.
 */
export function locationExtractor(text) {
    if (!text) return text;

    const parts = text.split("-");

    if (parts.length < 2) {
        return text;
    }

    const location = parts[parts.length - 1].split("/")[0];
    return location.trim();
}

/**
 * Checks if a specific batch is included in the extracted batch input.
 * @param {string} searchBatch - The batch code to search for.
 * @param {string} extractedBatchInput - The string containing one or more batch codes.
 * @returns {boolean} True if the batch is included, False otherwise.
 */
export function isBatchIncluded(searchBatch, extractedBatchInput) {
    if (!extractedBatchInput) {
        return true;
    }

    const batchList = expandBatch(extractedBatchInput.trim());

    if (batchList.includes(searchBatch)) {
        return true;
    }

    // Check if first character matches (for single-letter batch codes)
    for (const batch of batchList) {
        if (batch.length === 1 && searchBatch[0] === batch) {
            return true;
        }
    }

    return false;
}

/**
 * Checks if the extracted batch represents an elective.
 * @param {string} extractedBatch - The batch code to check.
 * @returns {boolean} True if it's 'ALL', indicating an elective for all batches, False otherwise.
 */
export function isElective(extractedBatch) {
    return extractedBatch === "ALL";
}

/**
 * Checks if a subject code exists in a list of subject codes.
 * @param {string[]} subjectCodes - A list of available subject codes.
 * @param {string} subjectCode - The subject code to check for.
 * @returns {boolean} True if the code is in the list, False otherwise.
 */
export function doYouHaveSubject(subjectCodes, subjectCode) {
    return subjectCodes.includes(subjectCode);
}

/**
 * Retrieves the full subject name based on its code from a dictionary.
 * @param {Object[]} subjectsDict - A list of dictionaries containing subject information.
 * @param {string} code - The subject code to look up.
 * @returns {string} The subject name if found, otherwise the original code.
 */
export function subjectName(subjectsDict, code) {
    try {
        for (const subject of subjectsDict) {
            if (!subject.Code) {
                continue;
            }

            if (subject.Code === code) {
                return subject.Subject || code;
            }

            if (subject["Full Code"]) {
                const fullCode = subject["Full Code"];

                // Different comparison patterns
                const patterns = [
                    fullCode,
                    fullCode.substring(0, 2) + subject.Code,
                    fullCode.substring(3),
                    fullCode.substring(2),
                    fullCode.substring(0, 5) + subject.Code,
                    fullCode.substring(2, 5) + subject.Code,
                    fullCode.substring(3, 5) + subject.Code,
                ];

                if (patterns.some(pattern => pattern.trim() === code.trim())) {
                    return subject.Subject || code;
                }
            }

            if (subject.Code.substring(1).trim() === code.trim()) {
                return subject.Subject || code;
            }
        }
    } catch (e) {
        console.error(`Error extracting subject name for code ${code}:`, e);
    }

    return code;
}

// ============================================================================
// SEMESTER PARSING
// ============================================================================

/**
 * Parse raw semester data from the portal API
 * @param {Object} rawSemester - Raw semester object from JSJIIT
 * @returns {Object} Normalized semester object with id and label
 */
export function parseSemester(rawSemester) {
    if (!rawSemester) {
        return null;
    }

    return {
        id: rawSemester.registration_id || rawSemester.id || null,
        label: rawSemester.registration_code ||
            rawSemester.label ||
            `Semester ${rawSemester.registration_id || 'Unknown'}`
    };
}

/**
 * Get the latest semester from an array of semesters
 * @param {Array} semesters - Array of semester objects
 * @param {number} index - Index to pick (default: 1 for latest active)
 * @returns {Object|null} The selected semester or null
 */
export function getLatestSemester(semesters, index = 1) {
    if (!Array.isArray(semesters) || semesters.length === 0) {
        return null;
    }
    return semesters[index] || semesters[0] || null;
}

// ============================================================================
// SUBJECT PARSING
// ============================================================================

/**
 * Extract component types from a component code string
 * @param {string} componentCode - Component code like "LTP", "L", "LP", etc.
 * @returns {string[]} Array of component types ['L', 'T', 'P']
 */
export function parseComponentCode(componentCode) {
    const code = componentCode || '';
    const components = [];

    if (code.includes('L')) components.push('L');
    if (code.includes('T')) components.push('T');
    if (code.includes('P')) components.push('P');

    return components.length > 0 ? components : ['L'];
}

/**
 * Parse a single subject from raw registration data
 * @param {Object} rawSubject - Raw subject object from API
 * @returns {Object} Normalized subject object
 */
export function parseSubject(rawSubject) {
    if (!rawSubject) {
        return null;
    }

    const componentCode = rawSubject.subject_component_code || '';

    return {
        code: rawSubject.subject_code || rawSubject.subjectcode || 'UNKNOWN',
        name: rawSubject.subject_desc || rawSubject.subjectdesc || 'Unknown Subject',
        components: parseComponentCode(componentCode),
        _raw: {
            componentCode,
            subjectId: rawSubject.subjectid || rawSubject.subject_id || null
        }
    };
}

/**
 * Parse an array of subjects from registration data
 * @param {Object} registrations - Registrations object from get_registered_subjects_and_faculties
 * @returns {Object[]} Array of normalized subject objects
 */
export function parseSubjects(registrations) {
    if (!registrations?.subjects || !Array.isArray(registrations.subjects)) {
        return [];
    }

    return registrations.subjects
        .map(parseSubject)
        .filter(Boolean);
}

// ============================================================================
// ATTENDANCE PARSING
// ============================================================================

/**
 * Try to extract a field value from an object using multiple possible keys
 * @param {Object} obj - Object to search
 * @param {string[]} keys - Array of possible key names
 * @param {*} defaultValue - Default value if no key found
 * @returns {*} The found value or default
 */
export function extractField(obj, keys, defaultValue = null) {
    if (!obj || typeof obj !== 'object') {
        return defaultValue;
    }

    for (const key of keys) {
        if (obj[key] !== undefined && obj[key] !== null) {
            return obj[key];
        }
    }
    return defaultValue;
}

/**
 * Parse attendance percentage from raw data
 * @param {Object} raw - Raw attendance object
 * @returns {number} Attendance percentage as a number
 */
export function parseAttendancePercentage(raw) {
    const percentageFields = [
        'LTpercantage',
        'attpercantage',
        'Lpercentage',
        'Tpercentage',
        'Ppercentage',
        'totalpercantage',
        'percentage',
        'attendance_percentage'
    ];

    const value = extractField(raw, percentageFields, '0');
    const parsed = parseFloat(value);

    return isNaN(parsed) ? 0 : parsed;
}

/**
 * Extract component IDs from raw attendance data
 * @param {Object} raw - Raw attendance object
 * @returns {string[]} Array of component IDs
 */
export function extractComponentIds(raw) {
    const componentIds = [];

    if (raw.Lsubjectcomponentid) componentIds.push(raw.Lsubjectcomponentid);
    if (raw.Tsubjectcomponentid) componentIds.push(raw.Tsubjectcomponentid);
    if (raw.Psubjectcomponentid) componentIds.push(raw.Psubjectcomponentid);

    return componentIds;
}

/**
 * Parse a single attendance record from raw data
 * @param {Object} raw - Raw attendance object from studentattendancelist
 * @returns {Object} Normalized attendance object
 */
export function parseAttendanceRecord(raw) {
    if (!raw) {
        return null;
    }

    const subjectCode = extractField(raw, [
        'subjectcode', 'Subjectcode', 'SubjectCode', 'individualsubjectcode'
    ], 'UNKNOWN');

    const subjectName = extractField(raw, [
        'subjectdesc', 'Subjectdesc', 'SubjectDesc', 'subjectdescription', 'subject_desc'
    ], 'Unknown Subject');

    return {
        subjectCode,
        subjectName,
        percentage: parseAttendancePercentage(raw),
        _subjectId: raw.subjectid || raw.subject_id || null,
        _componentIds: extractComponentIds(raw),
        lecturePercentage: parseFloat(raw.Lpercentage || '0') || 0,
        tutorialPercentage: parseFloat(raw.Tpercentage || '0') || 0,
        practicalPercentage: parseFloat(raw.Ppercentage || '0') || 0
    };
}

/**
 * Parse the full attendance overview from raw API response
 * @param {Object} rawData - Raw response from get_attendance
 * @returns {Object[]} Array of normalized attendance records
 */
export function parseAttendanceOverview(rawData) {
    if (!rawData?.studentattendancelist || !Array.isArray(rawData.studentattendancelist)) {
        return [];
    }

    return rawData.studentattendancelist
        .map(parseAttendanceRecord)
        .filter(Boolean);
}

// ============================================================================
// DAILY ATTENDANCE PARSING
// ============================================================================

/**
 * Parse a single daily attendance entry
 * @param {Object} raw - Raw daily attendance object
 * @returns {Object} Normalized daily attendance entry
 */
export function parseDailyAttendanceEntry(raw) {
    if (!raw) {
        return null;
    }

    const status = raw.studentstatus || raw.status || raw.attendance_status || '';
    const isPresent = status === 'Present' || status === 'P' || status === '1';

    return {
        date: raw.datetime || raw.date || raw.class_date || null,
        status,
        isPresent,
        topic: raw.topic || raw.class_topic || '',
        faculty: raw.facultyname || raw.faculty || '',
        slot: raw.slot || raw.time_slot || '',
        componentType: raw.component_type || raw.attendancetype || ''
    };
}

/**
 * Parse an array of daily attendance entries
 * @param {Object[]} dailyData - Array of raw daily attendance objects
 * @returns {Object[]} Array of normalized daily attendance entries
 */
export function parseDailyAttendance(dailyData) {
    if (!Array.isArray(dailyData)) {
        return [];
    }

    return dailyData
        .map(parseDailyAttendanceEntry)
        .filter(Boolean);
}

/**
 * Calculate attendance statistics from daily attendance data
 * @param {Object[]} dailyEntries - Parsed daily attendance entries
 * @returns {Object} Statistics object with total, attended, absent, percentage
 */
export function calculateDailyStats(dailyEntries) {
    if (!Array.isArray(dailyEntries) || dailyEntries.length === 0) {
        return { total: 0, attended: 0, absent: 0, percentage: 0 };
    }

    const total = dailyEntries.length;
    const attended = dailyEntries.filter(e => e.isPresent).length;
    const absent = total - attended;
    const percentage = total > 0 ? (attended / total) * 100 : 0;

    return {
        total,
        attended,
        absent,
        percentage: Math.round(percentage * 100) / 100
    };
}

// ============================================================================
// PERSONAL INFO PARSING
// ============================================================================

/**
 * Parse personal info from raw API response
 * @param {Object} rawInfo - Raw personal info object
 * @returns {Object} Normalized personal info
 */
export function parsePersonalInfo(rawInfo) {
    if (!rawInfo) {
        return null;
    }

    return {
        name: rawInfo.studentname || rawInfo.name || 'Unknown',
        enrollmentNo: rawInfo.enrollmentno || rawInfo.enrollment_no || '',
        program: rawInfo.programname || rawInfo.program || '',
        branch: rawInfo.branchname || rawInfo.branch || '',
        batch: rawInfo.batchname || rawInfo.batch || '',
        section: rawInfo.sectionname || rawInfo.section || '',
        email: rawInfo.emailid || rawInfo.email || '',
        mobile: rawInfo.mobileno || rawInfo.mobile || '',
        _raw: rawInfo
    };
}

// ============================================================================
// STATISTICS & ANALYSIS
// ============================================================================

/**
 * Calculate overall attendance statistics
 * @param {Object[]} attendanceRecords - Array of normalized attendance records
 * @param {number} threshold - Minimum safe attendance percentage (default: 75)
 * @returns {Object} Statistics object
 */
export function calculateOverallStats(attendanceRecords, threshold = 75) {
    if (!Array.isArray(attendanceRecords) || attendanceRecords.length === 0) {
        return {
            totalSubjects: 0,
            belowThreshold: 0,
            atRisk: 0,
            safe: 0,
            average: 0,
            lowest: null,
            highest: null
        };
    }

    const percentages = attendanceRecords.map(r => r.percentage);
    const total = attendanceRecords.length;

    const belowThreshold = attendanceRecords.filter(r => r.percentage < threshold).length;
    const atRisk = attendanceRecords.filter(r => r.percentage >= threshold && r.percentage < threshold + 5).length;
    const safe = total - belowThreshold - atRisk;

    const sum = percentages.reduce((acc, p) => acc + p, 0);
    const average = sum / total;

    const lowestRecord = attendanceRecords.reduce((min, r) =>
        r.percentage < min.percentage ? r : min, attendanceRecords[0]);
    const highestRecord = attendanceRecords.reduce((max, r) =>
        r.percentage > max.percentage ? r : max, attendanceRecords[0]);

    return {
        totalSubjects: total,
        belowThreshold,
        atRisk,
        safe,
        average: Math.round(average * 100) / 100,
        lowest: {
            code: lowestRecord.subjectCode,
            name: lowestRecord.subjectName,
            percentage: lowestRecord.percentage
        },
        highest: {
            code: highestRecord.subjectCode,
            name: highestRecord.subjectName,
            percentage: highestRecord.percentage
        }
    };
}

/**
 * Calculate how many classes to attend/can bunk to reach a target percentage
 * @param {number} attended - Number of classes attended
 * @param {number} total - Total number of classes
 * @param {number} target - Target percentage (default: 75)
 * @returns {Object} Analysis object with classes needed info
 */
export function calculateClassesNeeded(attended, total, target = 75) {
    const current = total > 0 ? (attended / total) * 100 : 0;

    if (current >= target) {
        const canBunk = Math.floor((attended * 100 / target) - total);

        return {
            status: 'safe',
            current: Math.round(current * 100) / 100,
            canBunk: Math.max(0, canBunk),
            needed: 0,
            message: canBunk > 0
                ? `You can miss ${canBunk} more class${canBunk === 1 ? '' : 'es'} and still maintain ${target}%`
                : `Your attendance is exactly at ${target}%, don't miss any classes!`
        };
    } else {
        const needed = Math.ceil((target * total - attended * 100) / (100 - target));

        return {
            status: 'danger',
            current: Math.round(current * 100) / 100,
            canBunk: 0,
            needed: Math.max(0, needed),
            message: needed > 0
                ? `You need to attend ${needed} consecutive class${needed === 1 ? '' : 'es'} to reach ${target}%`
                : `Keep attending classes to improve your attendance`
        };
    }
}

/**
 * Enrich attendance record with daily stats
 * @param {Object} attendanceRecord - Base attendance record
 * @param {Object[]} dailyEntries - Parsed daily attendance entries
 * @returns {Object} Enriched attendance record
 */
export function enrichAttendanceWithDaily(attendanceRecord, dailyEntries) {
    const stats = calculateDailyStats(dailyEntries);
    const analysis = calculateClassesNeeded(stats.attended, stats.total);

    return {
        ...attendanceRecord,
        totalClasses: stats.total,
        attendedClasses: stats.attended,
        absentClasses: stats.absent,
        calculatedPercentage: stats.percentage,
        analysis,
        dailyEntries
    };
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
    // Batch & Subject Extractors (from Python)
    batchExtractor,
    subjectExtractor,
    facultyExtractor,
    expandBatch,
    locationExtractor,
    isBatchIncluded,
    isElective,
    doYouHaveSubject,
    subjectName,

    // Semester
    parseSemester,
    getLatestSemester,

    // Subjects
    parseComponentCode,
    parseSubject,
    parseSubjects,

    // Attendance
    extractField,
    parseAttendancePercentage,
    extractComponentIds,
    parseAttendanceRecord,
    parseAttendanceOverview,

    // Daily Attendance
    parseDailyAttendanceEntry,
    parseDailyAttendance,
    calculateDailyStats,

    // Personal Info
    parsePersonalInfo,

    // Statistics
    calculateOverallStats,
    calculateClassesNeeded,
    enrichAttendanceWithDaily
};