"use client";

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Modal component for adding/editing schedule entries
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal is visible
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onSave - Save handler (receives schedule data)
 * @param {Function} props.onDelete - Delete handler (for edit mode)
 * @param {Array} props.subjects - Available subjects for dropdown
 * @param {Object} props.attendance - Attendance data keyed by subject code
 * @param {Object|null} props.editData - Existing data for edit mode, null for add mode
 */
export default function ScheduleModal({
    isOpen,
    onClose,
    onSave,
    onDelete,
    subjects = [],
    attendance = {},
    editData = null
}) {
    const isEditMode = !!editData;

    const [formData, setFormData] = useState({
        subjectCode: '',
        type: 'L',
        startTime: '09:00',
        duration: 50,
        teacher: '',
        room: ''
    });

    const [errors, setErrors] = useState({});

    // Populate form when editing
    useEffect(() => {
        if (editData) {
            setFormData({
                subjectCode: editData.subjectCode || '',
                type: editData.type || 'L',
                startTime: editData.startTime || '09:00',
                duration: editData.duration || 50,
                teacher: editData.teacher || '',
                room: editData.room || ''
            });
        } else {
            // Reset form for add mode
            setFormData({
                subjectCode: subjects[0]?.code || '',
                type: 'L',
                startTime: '09:00',
                duration: 50,
                teacher: '',
                room: ''
            });
        }
        setErrors({});
    }, [editData, subjects, isOpen]);

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: null }));
        }
    };

    const validate = () => {
        const newErrors = {};

        if (!formData.subjectCode) {
            newErrors.subjectCode = 'Please select a subject';
        }

        if (!formData.startTime) {
            newErrors.startTime = 'Please enter a start time';
        }

        if (!formData.duration || formData.duration < 1) {
            newErrors.duration = 'Duration must be at least 1 minute';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!validate()) return;

        // Get subject name from code
        const subject = subjects.find(s => s.code === formData.subjectCode);

        onSave({
            ...formData,
            subjectName: subject?.name || formData.subjectCode,
            id: editData?.id || `schedule_${Date.now()}`
        });
    };

    const handleDelete = () => {
        if (confirm('Are you sure you want to delete this schedule entry?')) {
            onDelete(editData.id);
        }
    };

    if (!isOpen) return null;

    // Get attendance % for selected subject
    const selectedAttendance = attendance[formData.subjectCode];

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{isEditMode ? 'Edit Schedule' : 'Add Schedule'}</h2>
                    <button className="btn btn-ghost" onClick={onClose}><X size={18} /></button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {/* Subject Dropdown */}
                        <div className="input-group">
                            <label htmlFor="subject">Subject *</label>
                            <select
                                id="subject"
                                className={`input ${errors.subjectCode ? 'input-error' : ''}`}
                                value={formData.subjectCode}
                                onChange={(e) => handleChange('subjectCode', e.target.value)}
                            >
                                <option value="">Select a subject</option>
                                {subjects.map(subject => (
                                    <option key={subject.code} value={subject.code}>
                                        {subject.code} - {subject.name}
                                    </option>
                                ))}
                            </select>
                            {errors.subjectCode && (
                                <span style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>
                                    {errors.subjectCode}
                                </span>
                            )}
                            {selectedAttendance !== undefined && (
                                <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                                    Current attendance: {selectedAttendance}%
                                </span>
                            )}
                        </div>

                        {/* Subject Type */}
                        <div className="input-group">
                            <label htmlFor="type">Type *</label>
                            <select
                                id="type"
                                className="input"
                                value={formData.type}
                                onChange={(e) => handleChange('type', e.target.value)}
                            >
                                <option value="L">Lecture (L)</option>
                                <option value="T">Tutorial (T)</option>
                                <option value="P">Practical (P)</option>
                            </select>
                        </div>

                        {/* Start Time */}
                        <div className="input-group">
                            <label htmlFor="startTime">Start Time *</label>
                            <input
                                type="time"
                                id="startTime"
                                className={`input ${errors.startTime ? 'input-error' : ''}`}
                                value={formData.startTime}
                                onChange={(e) => handleChange('startTime', e.target.value)}
                            />
                            {errors.startTime && (
                                <span style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>
                                    {errors.startTime}
                                </span>
                            )}
                        </div>

                        {/* Duration */}
                        <div className="input-group">
                            <label htmlFor="duration">Duration (minutes)</label>
                            <input
                                type="number"
                                id="duration"
                                className={`input ${errors.duration ? 'input-error' : ''}`}
                                value={formData.duration}
                                onChange={(e) => handleChange('duration', parseInt(e.target.value) || 0)}
                                min="1"
                                max="300"
                            />
                            {errors.duration && (
                                <span style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>
                                    {errors.duration}
                                </span>
                            )}
                        </div>

                        {/* Teacher (optional) */}
                        <div className="input-group">
                            <label htmlFor="teacher">Teacher</label>
                            <input
                                type="text"
                                id="teacher"
                                className="input"
                                placeholder="Optional"
                                value={formData.teacher}
                                onChange={(e) => handleChange('teacher', e.target.value)}
                            />
                        </div>

                        {/* Room (optional) */}
                        <div className="input-group">
                            <label htmlFor="room">Room</label>
                            <input
                                type="text"
                                id="room"
                                className="input"
                                placeholder="Optional"
                                value={formData.room}
                                onChange={(e) => handleChange('room', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="modal-footer">
                        {isEditMode && (
                            <button
                                type="button"
                                className="btn btn-danger"
                                onClick={handleDelete}
                            >
                                Delete
                            </button>
                        )}
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary">
                            {isEditMode ? 'Update' : 'Add'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
