'use strict';

const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const env = require('../config/env');
const aiService = require('../services/aiService');
const alertService = require('../services/alertService');

async function upsertUser({ full_name, email, phone, role, password, hospital_id, department_id }) {
  const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length) return existing[0].id;
  const hash = await bcrypt.hash(password, 10);
  const [result] = await pool.query(
    `INSERT INTO users (full_name, email, phone, password_hash, role, hospital_id, department_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
    [full_name, email, phone || null, hash, role, hospital_id || null, department_id || null]
  );
  return result.insertId;
}

async function seed() {
  console.log('Seeding demo data...');

  const [[{ cnt: hospitalCount }]] = await pool.query('SELECT COUNT(*) AS cnt FROM hospitals');
  if (hospitalCount === 0) {
    await pool.query(
      `INSERT INTO hospitals (hospital_code, name, phone, email, address, city, country) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['HOSP-001', 'Main General Hospital', '+250700000000', 'info@hospital.local', 'Hospital Address', 'Kigali', 'Rwanda']
    );
  }

  const [[{ cnt: deptCount }]] = await pool.query('SELECT COUNT(*) AS cnt FROM departments');
  if (deptCount === 0) {
    const depts = [
      ['Emergency', 'Emergency and critical care department'],
      ['Cardiology', 'Heart and cardiovascular department'],
      ['Pediatrics', 'Child healthcare department'],
      ['General Medicine', 'General medical care'],
      ['ICU', 'Intensive Care Unit'],
    ];
    for (const [name, description] of depts) {
      await pool.query('INSERT INTO departments (hospital_id, name, description) VALUES (1, ?, ?)', [name, description]);
    }
  }

  const adminId = await upsertUser({
    full_name: 'System Administrator',
    email: env.seed.adminEmail,
    phone: '+250700000001',
    role: 'ADMIN',
    password: env.seed.adminPassword,
    hospital_id: 1,
  });

  const doctorUserId = await upsertUser({
    full_name: 'Dr. Alice Uwase',
    email: 'doctor@healthcare.local',
    phone: '+250700000002',
    role: 'DOCTOR',
    password: 'Doctor123!',
    hospital_id: 1,
    department_id: 2,
  });
  const [docRows] = await pool.query('SELECT id FROM doctors WHERE user_id = ?', [doctorUserId]);
  if (docRows.length === 0) {
    await pool.query(
      `INSERT INTO doctors (user_id, hospital_id, department_id, license_number, specialization, qualification, years_of_experience)
       VALUES (?, 1, 2, 'LIC-DOC-001', 'Cardiology', 'MD, MSc', 10)`,
      [doctorUserId]
    );
  }

  const nurseUserId = await upsertUser({
    full_name: 'Nurse Jean Bosco',
    email: 'nurse@healthcare.local',
    phone: '+250700000003',
    role: 'NURSE',
    password: 'Nurse123!',
    hospital_id: 1,
    department_id: 1,
  });
  const [nurRows] = await pool.query('SELECT id FROM nurses WHERE user_id = ?', [nurseUserId]);
  if (nurRows.length === 0) {
    await pool.query(
      `INSERT INTO nurses (user_id, hospital_id, department_id, license_number, qualification, shift)
       VALUES (?, 1, 1, 'LIC-NUR-001', 'BSN', 'MORNING')`,
      [nurseUserId]
    );
  }

  const patientUserIds = [];
  const patientSeeds = [
    { full_name: 'Patient Eric Mugisha', email: 'patient@healthcare.local', first: 'Eric', last: 'Mugisha', dob: '1988-04-12', gender: 'MALE', bg: 'O+', dept: 5 },
    { full_name: 'Patient Grace Uwimana', email: 'grace@healthcare.local', first: 'Grace', last: 'Uwimana', dob: '1995-09-23', gender: 'FEMALE', bg: 'A+', dept: 2 },
    { full_name: 'Patient Kevin Habimana', email: 'kevin@healthcare.local', first: 'Kevin', last: 'Habimana', dob: '1979-01-05', gender: 'MALE', bg: 'B+', dept: 4 },
  ];

  const patientIds = [];
  for (const ps of patientSeeds) {
    const pid = await upsertUser({
      full_name: ps.full_name,
      email: ps.email,
      phone: null,
      role: 'PATIENT',
      password: 'Patient123!',
      hospital_id: 1,
      department_id: ps.dept,
    });
    patientUserIds.push(pid);
    const [existing] = await pool.query('SELECT id FROM patients WHERE user_id = ?', [pid]);
    if (existing.length) {
      patientIds.push(existing[0].id);
      continue;
    }
    const number = `PT-${Math.floor(10000 + Math.random() * 89999)}`;
    const [result] = await pool.query(
      `INSERT INTO patients
        (user_id, hospital_id, department_id, patient_number, first_name, last_name, date_of_birth, gender, blood_group, status)
       VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      [pid, ps.dept, number, ps.first, ps.last, ps.dob, ps.gender, ps.bg]
    );
    patientIds.push(result.insertId);
  }

  const [[{ cnt: doctorCount }]] = await pool.query('SELECT COUNT(*) AS cnt FROM doctors');
  const [[{ cnt: nurseCount }]] = await pool.query('SELECT COUNT(*) AS cnt FROM nurses');

  const [[{ cnt: assignCount }]] = await pool.query('SELECT COUNT(*) AS cnt FROM patient_assignments');
  if (assignCount === 0 && doctorCount > 0 && nurseCount > 0) {
    const [doctors] = await pool.query('SELECT id FROM doctors ORDER BY id LIMIT 1');
    const [nurses] = await pool.query('SELECT id FROM nurses ORDER BY id LIMIT 1');
    for (const patientId of patientIds) {
      await pool.query(
        `INSERT INTO patient_assignments (patient_id, doctor_id, nurse_id, assigned_by, status)
         VALUES (?, ?, ?, ?, 'ACTIVE')`,
        [patientId, doctors[0].id, nurses[0].id, adminId]
      );
    }
  }

  const [[{ cnt: deviceCount }]] = await pool.query('SELECT COUNT(*) AS cnt FROM medical_devices');
  if (deviceCount === 0) {
    const devices = [
      ['DEV-1001', 'Pulse Oximeter Alpha', 'SPO2', 'MedTech', 'OX-200'],
      ['DEV-1002', 'Heart Rate Monitor', 'HEART_RATE', 'MedTech', 'HR-300'],
      ['DEV-1003', 'BP Cuff Pro', 'BLOOD_PRESSURE', 'VitalSigns Inc', 'BP-500'],
      ['DEV-1004', 'Temp Sensor 360', 'TEMPERATURE', 'VitalSigns Inc', 'TS-100'],
      ['DEV-1005', 'Multi-Vital Monitor', 'MULTI_SENSOR', 'MedTech', 'MV-900'],
    ];
    for (const [code, name, type, manufacturer, model] of devices) {
      await pool.query(
        `INSERT INTO medical_devices (device_code, device_name, device_type, manufacturer, model, status)
         VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
        [code, name, type, manufacturer, model]
      );
    }
    const [deviceRows] = await pool.query('SELECT id FROM medical_devices ORDER BY id');
    for (let i = 0; i < Math.min(deviceRows.length, patientIds.length); i++) {
      await pool.query(
        `INSERT INTO device_assignments (device_id, patient_id, status) VALUES (?, ?, 'ACTIVE')`,
        [deviceRows[i].id, patientIds[i]]
      );
    }
  }

  const [[{ cnt: thresholdCount }]] = await pool.query('SELECT COUNT(*) AS cnt FROM alert_thresholds');
  if (thresholdCount === 0) {
    const thresholds = [
      ['HEART_RATE', 60, 100, 'MEDIUM'],
      ['SPO2', 95, null, 'HIGH'],
      ['TEMPERATURE', 36.1, 37.8, 'MEDIUM'],
      ['SYSTOLIC', 90, 140, 'HIGH'],
      ['DIASTOLIC', 60, 90, 'HIGH'],
      ['RESPIRATORY_RATE', 12, 20, 'MEDIUM'],
      ['GLUCOSE', 70, 140, 'MEDIUM'],
    ];
    for (const [vt, minv, maxv, sev] of thresholds) {
      await pool.query(
        `INSERT INTO alert_thresholds (hospital_id, vital_type, min_value, max_value, severity, enabled)
         VALUES (1, ?, ?, ?, ?, 1)`,
        [vt, minv, maxv, sev]
      );
    }
  }

  const [[{ cnt: readingCount }]] = await pool.query('SELECT COUNT(*) AS cnt FROM vital_readings');
  if (readingCount === 0 && patientIds.length > 0) {
    const [devices] = await pool.query('SELECT id, device_code FROM medical_devices');
    let generated = 0;
    for (let i = 0; i < patientIds.length; i++) {
      const patientId = patientIds[i];
      const device = devices[i % devices.length];
      const baseHr = [78, 95, 118, 85][i % 4];
      const baseSpo2 = [98, 97, 91, 99][i % 4];
      const baseTemp = [36.8, 37.1, 38.6, 36.6][i % 4];
      for (let h = 0; h < 24; h++) {
        const variance = Math.sin(h / 4) * 6;
        const heart_rate = Math.round(baseHr + variance + (Math.random() * 6 - 3));
        const spo2 = Math.max(88, Math.min(100, Math.round(baseSpo2 + (Math.random() * 2 - 1))));
        const temperature = Number((baseTemp + (Math.random() * 0.6 - 0.3)).toFixed(1));
        const systolic = Math.round(120 + (Math.random() * 14 - 7));
        const diastolic = Math.round(78 + (Math.random() * 10 - 5));
        const respiratory = Math.round(16 + (Math.random() * 4 - 2));
        const recordedAt = new Date(Date.now() - (23 - h) * 3600 * 1000);
        const [result] = await pool.query(
          `INSERT INTO vital_readings
            (patient_id, device_id, heart_rate, spo2, temperature, systolic_pressure, diastolic_pressure, respiratory_rate, blood_glucose, recorded_at, source)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DEVICE')`,
          [patientId, device.id, heart_rate, spo2, temperature, systolic, diastolic, respiratory, null, recordedAt]
        );
        const reading = { id: result.insertId, patient_id: patientId, hospital_id: 1, heart_rate, spo2, temperature, systolic_pressure: systolic, diastolic_pressure: diastolic, respiratory_rate: respiratory };
        await alertService.processReading(reading);
        generated++;
        if (h % 6 === 0) {
          try {
            await aiService.generatePrediction(patientId, reading);
          } catch (e) {
            // ignore individual prediction failures
          }
        }
      }
    }
    console.log(`Generated ${generated} historical vital readings`);
  }

  const [[{ cnt: recordCount }]] = await pool.query('SELECT COUNT(*) AS cnt FROM medical_records');
  if (recordCount === 0 && patientIds.length > 0) {
    const [doctors] = await pool.query('SELECT id FROM doctors ORDER BY id LIMIT 1');
    const [nurses] = await pool.query('SELECT id FROM nurses ORDER BY id LIMIT 1');
    const docId = doctors.length ? doctors[0].id : null;
    const nurseId = nurses.length ? nurses[0].id : null;

    await pool.query(
      `INSERT INTO medical_records (patient_id, doctor_id, chief_complaint, symptoms, diagnosis, treatment_plan, clinical_notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'OPEN')`,
      [patientIds[0], docId, 'Chest discomfort and shortness of breath', 'Chest pain, fatigue, dyspnea on exertion', 'Hypertension with suspected cardiac involvement', 'Prescribed antihypertensives, cardiac monitoring, reduced sodium intake', 'Patient stable, scheduled for follow-up ECG', ]
    );
    await pool.query(
      `INSERT INTO prescriptions (patient_id, doctor_id, notes, status) VALUES (?, ?, ?, 'ACTIVE')`,
      [patientIds[0], docId, 'Continue monitoring blood pressure twice daily']
    );
    const [prescription] = await pool.query('SELECT id FROM prescriptions ORDER BY id DESC LIMIT 1');
    await pool.query(
      `INSERT INTO prescription_items (prescription_id, medicine_name, dosage, frequency, route, duration, quantity, instructions)
       VALUES (?, 'Amlodipine', '5 mg', 'Once daily', 'Oral', '30 days', '30 tablets', 'Take in the morning')`,
      [prescription[0].id]
    );
    await pool.query(
      `INSERT INTO medical_history (patient_id, condition_name, description, diagnosed_date, status)
       VALUES (?, ?, ?, ?, 'CHRONIC')`,
      [patientIds[0], 'Hypertension', 'Chronic high blood pressure managed with medication', '2022-03-15']
    );
    await pool.query(
      `INSERT INTO laboratory_tests (patient_id, doctor_id, test_name, test_type, result, reference_range, status)
       VALUES (?, ?, 'Complete Blood Count', 'Hematology', 'Normal', 'WBC 4.5-11.0', 'COMPLETED')`,
      [patientIds[0], docId]
    );
    await pool.query(
      `INSERT INTO appointments (patient_id, doctor_id, appointment_date, reason, status)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 2 DAY), 'Routine follow-up', 'CONFIRMED')`,
      [patientIds[0], docId]
    );
    await pool.query(
      `INSERT INTO nurse_notes (patient_id, nurse_id, note) VALUES (?, ?, 'Vitals stable, patient resting comfortably.')`,
      [patientIds[0], nurseId]
    );
  }

  console.log('Seed complete.');
  console.log('-----------------------------------');
  console.log('Demo login accounts:');
  console.log(`  ADMIN   -> ${env.seed.adminEmail} / ${env.seed.adminPassword}`);
  console.log('  DOCTOR  -> doctor@healthcare.local / Doctor123!');
  console.log('  NURSE   -> nurse@healthcare.local / Nurse123!');
  console.log('  PATIENT -> patient@healthcare.local / Patient123!');
  console.log('  PATIENT -> grace@healthcare.local / Patient123!');
  console.log('  PATIENT -> kevin@healthcare.local / Patient123!');
  console.log('-----------------------------------');
  console.log('Sensor API key (for /api/sensors/ingest):', env.sensorApiKey);
  console.log('Device codes: DEV-1001 ... DEV-1005');
}

if (require.main === module) {
  pool.getConnection()
    .then(async (conn) => {
      conn.release();
      try {
        await seed();
      } catch (err) {
        console.error('Seed failed:', err);
      } finally {
        await pool.end();
      }
    })
    .catch((err) => {
      console.error('Could not connect to database. Is MySQL running?', err.message);
      process.exit(1);
    });
}

module.exports = { seed };
