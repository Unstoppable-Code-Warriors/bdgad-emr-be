/**
 * Type definitions for AI-generated medical data
 */

export interface PatientData {
  patient: {
    fullname: string;
    ethnicity: string;
    marital_status: string;
    address1: string;
    address2: string;
    phone: string;
    gender: string;
    nation: string;
    work_address: string;
    allergies: string;
    personal_history: string;
    family_history: string;
    birth_year?: number;
    citizen_id?: string;
    date_of_birth?: string;
  };
}

export interface TestResult {
  name: string;
  value: string;
  units: string;
  reference_range: string;
}

export interface TakenBy {
  id: string;
  name: string;
}

export interface LabTest {
  test_type: string;
  test_name: string;
  machine: string;
  taken_by: TakenBy;
  results?: TestResult[];
  notes: string;
  conclusion: string;
  file_attachments?: Array<{
    filename: string;
    url: string;
    file_type: string;
    file_size: number;
  }>;
}

export interface Medication {
  name: string;
  dosage: string;
  route: string;
  frequency: string;
  duration: string;
  instruction: string;
  quantity: number;
}

export interface Prescription {
  issuedDate: string;
  notes: string;
  medications: Medication[];
}

export interface MedicalRecordData {
  start_at: string;
  reason: string;
  current_status: string;
  treatment: string;
  diagnoses: string;
  lab_test: LabTest[];
  prescription: Prescription;
}
