'use strict';

const pool = require('../config/db');
const realtime = require('./realtimeService');
const { writeAuditLog } = require('../middleware/audit');

const MODEL_NAME = 'heuristic-risk-v1';
const MODEL_VERSION = '1.0.0';

const RANGES = {
  HEART_RATE: { min: 60, max: 100, weight: 0.25, label: 'heart rate (60-100 bpm)' },
  SPO2: { min: 95, max: null, weight: 0.3, label: 'oxygen saturation (>=95%)' },
  TEMPERATURE: { min: 36.1, max: 37.8, weight: 0.15, label: 'temperature (36.1-37.8 C)' },
  SYSTOLIC: { min: 90, max: 140, weight: 0.1, label: 'systolic pressure (90-140 mmHg)' },
  DIASTOLIC: { min: 60, max: 90, weight: 0.05, label: 'diastolic pressure (60-90 mmHg)' },
  RESPIRATORY_RATE: { min: 12, max: 20, weight: 0.05, label: 'respiratory rate (12-20/min)' },
  GLUCOSE: { min: 70, max: 140, weight: 0.1, label: 'blood glucose (70-140 mg/dL)' },
};

const FIELD_MAP = {
  HEART_RATE: 'heart_rate',
  SPO2: 'spo2',
  TEMPERATURE: 'temperature',
  SYSTOLIC: 'systolic_pressure',
  DIASTOLIC: 'diastolic_pressure',
  RESPIRATORY_RATE: 'respiratory_rate',
  GLUCOSE: 'blood_glucose',
};

function normalize(vitalType, value) {
  const range = RANGES[vitalType];
  const lower = range.min;
  const upper = range.max;
  if (value >= lower && (upper === null || value <= upper)) return 0;

  let band;
  if (upper !== null) {
    band = (upper - lower) / 2;
  } else {
    band = lower / 2;
  }
  band = Math.max(band, 0.1);

  let distance;
  if (value < lower) {
    distance = lower - value;
  } else {
    distance = value - upper;
  }
  return Math.min(1, Math.max(0, distance / band));
}

function analyzeReading(reading) {
  let totalScore = 0;
  let maxPossible = 0;
  const factors = [];

  for (const [vitalType, field] of Object.entries(FIELD_MAP)) {
    const value = reading[field];
    if (value === null || value === undefined) continue;
    const weight = RANGES[vitalType].weight;
    maxPossible += weight;
    const deviation = normalize(vitalType, Number(value));
    const contribution = weight * deviation;
    totalScore += contribution;
    if (deviation > 0) {
      factors.push({
        vital: vitalType,
        value: Number(value),
        severity: deviation < 0.3 ? 'MILD' : deviation < 0.6 ? 'MODERATE' : 'SEVERE',
        detail: `${RANGES[vitalType].label}: current ${value}`,
      });
    }
  }

  let riskScore = maxPossible > 0 ? totalScore / maxPossible : 0;
  riskScore = Math.min(1, Math.max(0, Number(riskScore.toFixed(5))));

  let riskLevel = 'LOW';
  if (riskScore >= 0.75) riskLevel = 'CRITICAL';
  else if (riskScore >= 0.5) riskLevel = 'HIGH';
  else if (riskScore >= 0.25) riskLevel = 'MEDIUM';

  return { riskScore, riskLevel, factors };
}

async function generatePrediction(patientId, reading) {
  const { riskScore, riskLevel, factors } = analyzeReading(reading);

  let prediction;
  if (factors.length === 0) {
    prediction = 'All monitored vitals are within normal ranges. Risk of acute deterioration is low.';
  } else if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
    prediction = 'Elevated risk detected. Immediate clinical review recommended based on current vital deviations.';
  } else if (riskLevel === 'MEDIUM') {
    prediction = 'Moderate risk. Closer monitoring and a follow-up assessment are advised.';
  } else {
    prediction = 'Mild deviations present. Routine monitoring should continue.';
  }

  const [result] = await pool.query(
    `INSERT INTO ai_predictions
      (patient_id, model_name, model_version, prediction_type, risk_score, risk_level, prediction, contributing_factors)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      patientId,
      MODEL_NAME,
      MODEL_VERSION,
      'ACUTE_DETERIORATION_RISK',
      riskScore,
      riskLevel,
      prediction,
      JSON.stringify(factors),
    ]
  );

  const record = {
    id: result.insertId,
    patient_id: patientId,
    model_name: MODEL_NAME,
    model_version: MODEL_VERSION,
    prediction_type: 'ACUTE_DETERIORATION_RISK',
    risk_score: riskScore,
    risk_level: riskLevel,
    prediction,
    contributing_factors: factors,
    generated_at: new Date(),
  };

  realtime.emitPrediction(patientId, record);

  if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
    await writeAuditLog({
      action: 'AI_PREDICTION_GENERATED',
      entityType: 'ai_predictions',
      entityId: result.insertId,
      description: `Generated ${riskLevel} risk prediction for patient #${patientId} (score ${riskScore})`,
    });
  }

  return record;
}

async function getLatestPrediction(patientId) {
  const [rows] = await pool.query(
    `SELECT * FROM ai_predictions WHERE patient_id = ? ORDER BY generated_at DESC, id DESC LIMIT 1`,
    [patientId]
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  row.contributing_factors = row.contributing_factors ? JSON.parse(row.contributing_factors) : [];
  return row;
}

module.exports = {
  MODEL_NAME,
  MODEL_VERSION,
  analyzeReading,
  generatePrediction,
  getLatestPrediction,
};
