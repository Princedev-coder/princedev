'use strict';

const { z } = require('zod');

const ROLES = ['ADMIN', 'DOCTOR', 'NURSE', 'PATIENT'];
const VITAL_TYPES = ['HEART_RATE', 'SPO2', 'TEMPERATURE', 'SYSTOLIC', 'DIASTOLIC', 'RESPIRATORY_RATE', 'GLUCOSE'];
const DEVICE_TYPES = ['HEART_RATE', 'SPO2', 'TEMPERATURE', 'BLOOD_PRESSURE', 'ECG', 'GLUCOSE', 'RESPIRATORY_RATE', 'MULTI_SENSOR', 'OTHER'];
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const email = z.string().email('Invalid email address').max(150);
const password = z.string().min(6, 'Password must be at least 6 characters').max(100);

const loginSchema = z.object({ email, password });

const refreshSchema = z.object({ refresh_token: z.string().min(10) });

const changePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: password,
});

const createUserSchema = z.object({
  full_name: z.string().min(2).max(150),
  email,
  phone: z.string().max(30).optional().nullable(),
  role: z.enum(ROLES),
  password,
  hospital_id: z.number().int().positive().optional().nullable(),
  department_id: z.number().int().positive().optional().nullable(),
  license_number: z.string().min(2).max(100).optional(),
}).refine((v) => !['DOCTOR', 'NURSE'].includes(v.role) || v.license_number, { message: 'License number is required for doctors and nurses', path: ['license_number'] });

const updateUserSchema = z.object({
  full_name: z.string().min(2).max(150).optional(),
  email: email.optional(),
  phone: z.string().max(30).optional().nullable(),
  role: z.enum(ROLES).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  hospital_id: z.number().int().positive().optional().nullable(),
  department_id: z.number().int().positive().optional().nullable(),
  password: z.string().min(6).max(100).optional(),
});

const createHospitalSchema = z.object({
  hospital_code: z.string().min(2).max(50),
  name: z.string().min(2).max(150),
  phone: z.string().max(30).optional().nullable(),
  email: email.optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
});

const createDepartmentSchema = z.object({
  hospital_id: z.number().int().positive(),
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional().nullable(),
});

const createPatientSchema = z.object({
  email: email,
  password: z.string().min(6).max(100).optional(),
  full_name: z.string().max(150).optional(),
  phone: z.string().max(30).optional().nullable(),
  patient_prefix: z.string().max(10).optional(),
  hospital_id: z.number().int().positive().optional(),
  department_id: z.number().int().positive().optional().nullable(),
  first_name: z.string().min(1).max(100),
  middle_name: z.string().max(100).optional().nullable(),
  last_name: z.string().min(1).max(100),
  date_of_birth: z.string().optional().nullable(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional().nullable(),
  blood_group: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'UNKNOWN']).optional().nullable(),
  national_id: z.string().max(100).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  emergency_contact_name: z.string().max(150).optional().nullable(),
  emergency_contact_phone: z.string().max(30).optional().nullable(),
  emergency_contact_relationship: z.string().max(100).optional().nullable(),
  allergies: z.string().max(500).optional().nullable(),
  existing_conditions: z.string().max(500).optional().nullable(),
  admission_date: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'ADMITTED', 'DISCHARGED', 'CRITICAL', 'DECEASED']).optional(),
});

const createStaffSchema = z.object({
  full_name: z.string().min(2).max(150),
  email,
  phone: z.string().max(30).optional().nullable(),
  password: z.string().min(6).max(100).optional(),
  hospital_id: z.number().int().positive().optional(),
  department_id: z.number().int().positive().optional().nullable(),
  license_number: z.string().min(2).max(100),
  specialization: z.string().max(150).optional().nullable(),
  qualification: z.string().max(500).optional().nullable(),
  years_of_experience: z.number().int().min(0).optional(),
  shift: z.enum(['MORNING', 'AFTERNOON', 'NIGHT']).optional().nullable(),
});

const createDeviceSchema = z.object({
  device_code: z.string().min(2).max(100),
  device_name: z.string().min(2).max(150),
  device_type: z.enum(DEVICE_TYPES),
  manufacturer: z.string().max(150).optional().nullable(),
  model: z.string().max(150).optional().nullable(),
  api_endpoint: z.string().max(500).optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'OFFLINE']).optional(),
});

const vitalValues = z.object({
  heart_rate: z.number().optional(),
  spo2: z.number().optional(),
  temperature: z.number().optional(),
  systolic_pressure: z.number().optional(),
  diastolic_pressure: z.number().optional(),
  respiratory_rate: z.number().optional(),
  blood_glucose: z.number().optional(),
  weight: z.number().optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'At least one vital value is required' });

const manualVitalSchema = z.object({
  patient_id: z.number().int().positive(),
  values: vitalValues,
});

const sensorIngestSchema = z.object({
  device_code: z.string().min(2),
  patient_id: z.number().int().positive().optional(),
  values: vitalValues,
});

const assignStaffSchema = z.object({
  doctor_id: z.number().int().positive().optional().nullable(),
  nurse_id: z.number().int().positive().optional().nullable(),
}).refine((v) => v.doctor_id || v.nurse_id, { message: 'Provide at least one of doctor_id or nurse_id' });

const thresholdSchema = z.object({
  hospital_id: z.number().int().positive(),
  vital_type: z.enum(VITAL_TYPES),
  min_value: z.number().optional().nullable(),
  max_value: z.number().optional().nullable(),
  severity: z.enum(SEVERITIES),
  enabled: z.number().int().min(0).max(1).optional(),
});

const recordSchema = z.object({
  patient_id: z.number().int().positive(),
  doctor_id: z.number().int().positive().optional().nullable(),
  chief_complaint: z.string().optional().nullable(),
  symptoms: z.string().optional().nullable(),
  diagnosis: z.string().optional().nullable(),
  treatment_plan: z.string().optional().nullable(),
  clinical_notes: z.string().optional().nullable(),
  status: z.enum(['OPEN', 'CLOSED']).optional(),
});

const prescriptionSchema = z.object({
  patient_id: z.number().int().positive(),
  doctor_id: z.number().int().positive(),
  medical_record_id: z.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
});

const historySchema = z.object({
  patient_id: z.number().int().positive(),
  condition_name: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  diagnosed_date: z.string().optional().nullable(),
  resolved_date: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'RESOLVED', 'CHRONIC']).optional(),
});

const labSchema = z.object({
  patient_id: z.number().int().positive(),
  doctor_id: z.number().int().positive().optional().nullable(),
  test_name: z.string().min(1).max(200),
  test_type: z.string().max(150).optional().nullable(),
  requested_date: z.string().optional().nullable(),
  completed_date: z.string().optional().nullable(),
  result: z.string().optional().nullable(),
  reference_range: z.string().max(200).optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(['REQUESTED', 'PROCESSING', 'COMPLETED', 'CANCELLED']).optional(),
});

const appointmentSchema = z.object({
  patient_id: z.number().int().positive(),
  doctor_id: z.number().int().positive(),
  appointment_date: z.string().min(1),
  reason: z.string().optional().nullable(),
  status: z.enum(['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
  notes: z.string().optional().nullable(),
});

const nurseNoteSchema = z.object({
  patient_id: z.number().int().positive(),
  nurse_id: z.number().int().positive(),
  note: z.string().min(1),
});

const ecgSchema = z.object({
  patient_id: z.number().int().positive(),
  device_id: z.number().int().positive().optional().nullable(),
  heart_rate: z.number().optional().nullable(),
  rhythm: z.string().max(100).optional().nullable(),
  waveform_data: z.array(z.number()).optional().nullable(),
});

const prescriptionItemSchema = z.object({
  items: z.array(z.object({
    medicine_name: z.string().min(1).max(200),
    dosage: z.string().max(100).optional().nullable(),
    frequency: z.string().max(100).optional().nullable(),
    route: z.string().max(100).optional().nullable(),
    duration: z.string().max(100).optional().nullable(),
    quantity: z.string().max(100).optional().nullable(),
    instructions: z.string().optional().nullable(),
  })).min(1),
});

module.exports = {
  loginSchema,
  refreshSchema,
  changePasswordSchema,
  createUserSchema,
  updateUserSchema,
  createHospitalSchema,
  createDepartmentSchema,
  createPatientSchema,
  createStaffSchema,
  createDeviceSchema,
  manualVitalSchema,
  sensorIngestSchema,
  assignStaffSchema,
  thresholdSchema,
  recordSchema,
  prescriptionSchema,
  historySchema,
  labSchema,
  appointmentSchema,
  nurseNoteSchema,
  ecgSchema,
  prescriptionItemSchema,
};
