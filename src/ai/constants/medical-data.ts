import { getRandomElement, getRandomElements } from './patient-data';

export const EXAMINATION_REASONS = [
  'Khám sức khỏe định kỳ',
  'Đau bụng',
  'Đau đầu',
  'Sốt cao',
  'Ho khan kéo dài',
  'Khó thở',
  'Đau ngực',
  'Mệt mỏi',
  'Chóng mặt',
  'Nôn mửa',
  'Tiêu chảy',
  'Đau lưng',
  'Đau khớp',
  'Kiểm tra huyết áp',
  'Kiểm tra đường huyết',
  'Tái khám sau điều trị',
  'Đau bao tử',
  'Rối loạn giấc ngủ',
  'Stress, lo âu',
  'Kiểm tra sức khỏe trước phẫu thuật',
];

export const CURRENT_STATUSES = [
  'Bệnh nhân tỉnh, sinh hiệu ổn định',
  'Tình trạng tương đối ổn định',
  'Có cải thiện so với lần khám trước',
  'Bệnh nhân có dấu hiệu mệt mỏi',
  'Sinh hiệu trong giới hạn bình thường',
  'Bệnh nhân tươi tỉnh, hợp tác tốt',
  'Có triệu chứng đau nhẹ',
  'Cần theo dõi thêm',
  'Phản ứng tốt với điều trị',
  'Không có biến chứng',
];

export const TREATMENTS = [
  'Theo dõi huyết áp, điều chỉnh chế độ ăn',
  'Uống thuốc theo đơn, nghỉ ngơi đầy đủ',
  'Vật lý trị liệu, tập luyện nhẹ nhàng',
  'Điều chỉnh chế độ ăn uống, tăng cường vận động',
  'Theo dõi đường huyết, tuân thủ chế độ ăn',
  'Nghỉ ngơi, uống nhiều nước, theo dõi triệu chứng',
  'Điều trị triệu chứng, tái khám sau 1 tuần',
  'Thuốc giảm đau, chườm nóng vùng đau',
  'Dùng thuốc kháng viêm, hạn chế vận động mạnh',
  'Theo dõi tại nhà, tái khám nếu có biến chứng',
];

export const DIAGNOSES = [
  'Tăng huyết áp độ 1',
  'Tiểu đường type 2',
  'Viêm dạ dày mạn tính',
  'Hội chứng ruột kích thích',
  'Đau đầu căng thẳng',
  'Viêm khớp mạn tính',
  'Rối loạn lipid máu',
  'Thiếu máu nhẹ',
  'Viêm họng mạn tính',
  'Hội chứng mệt mỏi mạn tính',
  'Rối loạn lo âu',
  'Đau lưng cơ học',
  'Viêm amidan mạn tính',
  'Bệnh trào ngược dạ dày thực quản',
  'Hội chứng tiền tiểu đường',
];

export const LAB_TEST_TYPES = ['Xét nghiệm', 'Chẩn đoán hình ảnh'];

export const BLOOD_TESTS = [
  'Công thức máu toàn bộ',
  'Glucose máu đói',
  'HbA1c',
  'Lipid profile',
  'Chức năng gan',
  'Chức năng thận',
  'CRP',
  'ESR',
  'TSH',
  'Vitamin D',
  'Vitamin B12',
  'Acid Uric',
];

export const IMAGING_TESTS = [
  'X-quang ngực',
  'X-quang cột sống thắt lưng',
  'Siêu âm bụng tổng quát',
  'Siêu âm tuyến giáp',
  'CT scan não',
  'MRI cột sống',
  'Nội soi dạ dày',
  'Điện tâm đồ',
];

export const MEDICAL_MACHINES = [
  'Sysmex XN-1000',
  'Abbott Architect c4000',
  'Roche Cobas 6000',
  'Mindray BC-6800',
  'GE Vivid E95',
  'Philips CX50',
  'Canon Aplio 300',
  'Siemens Acuson S2000',
  'GE Revolution CT',
  'Philips MR 3.0T',
  'Fujifilm FCR',
  'Carestream DRX',
];

export const TECHNICIAN_NAMES = [
  'Nguyễn Văn Bình',
  'Trần Thị Hoa',
  'Lê Minh Tuấn',
  'Phạm Thu Hương',
  'Hoàng Đức Thành',
  'Vũ Thị Lan',
  'Đặng Quang Minh',
  'Bùi Thu Thảo',
  'Đỗ Văn Nam',
  'Hồ Thị Linh',
];

export const MEDICATIONS = [
  {
    name: 'Amlodipine 5mg',
    dosage: '1 viên/ngày',
    route: 'Uống',
    frequency: '1 lần/ngày',
    duration: '30 ngày',
    instruction: 'Uống vào buổi sáng sau khi ăn',
    quantity: 30,
  },
  {
    name: 'Metformin 500mg',
    dosage: '2 viên/ngày',
    route: 'Uống',
    frequency: '2 lần/ngày',
    duration: '30 ngày',
    instruction: 'Uống sau bữa ăn sáng và tối',
    quantity: 60,
  },
  {
    name: 'Omeprazole 20mg',
    dosage: '1 viên/ngày',
    route: 'Uống',
    frequency: '1 lần/ngày',
    duration: '14 ngày',
    instruction: 'Uống vào buổi sáng trước khi ăn 30 phút',
    quantity: 14,
  },
  {
    name: 'Paracetamol 500mg',
    dosage: '1-2 viên/lần',
    route: 'Uống',
    frequency: 'Khi cần thiết',
    duration: '7 ngày',
    instruction: 'Uống khi đau hoặc sốt, cách nhau ít nhất 4 giờ',
    quantity: 20,
  },
  {
    name: 'Ibuprofen 400mg',
    dosage: '1 viên/lần',
    route: 'Uống',
    frequency: '2-3 lần/ngày',
    duration: '7 ngày',
    instruction: 'Uống sau khi ăn để tránh đau dạ dày',
    quantity: 21,
  },
  {
    name: 'Losartan 50mg',
    dosage: '1 viên/ngày',
    route: 'Uống',
    frequency: '1 lần/ngày',
    duration: '30 ngày',
    instruction: 'Uống vào cùng một giờ mỗi ngày',
    quantity: 30,
  },
  {
    name: 'Atorvastatin 20mg',
    dosage: '1 viên/ngày',
    route: 'Uống',
    frequency: '1 lần/ngày',
    duration: '30 ngày',
    instruction: 'Uống vào buổi tối',
    quantity: 30,
  },
];

export const PRESCRIPTION_NOTES = [
  'Theo dõi huyết áp mỗi ngày tại nhà. Tái khám sau 2 tuần.',
  'Kiểm tra đường huyết hàng tuần. Tái khám sau 1 tháng.',
  'Uống thuốc đều đặn, không tự ý ngừng thuốc. Tái khám sau 2 tuần.',
  'Nghỉ ngơi đầy đủ, uống nhiều nước. Tái khám nếu triệu chứng không cải thiện.',
  'Tránh thức khuya, hạn chế stress. Tái khám sau 1 tuần.',
  'Chế độ ăn ít muối, nhiều rau xanh. Tái khám sau 3 tuần.',
  'Tập thể dục nhẹ nhàng, đi bộ 30 phút/ngày. Tái khám sau 1 tháng.',
  'Theo dõi triệu chứng, ghi chép nhật ký. Tái khám sau 2 tuần.',
];

export interface BloodTestResult {
  name: string;
  value: string;
  units: string;
  reference_range: string;
}

export const BLOOD_TEST_RESULTS: Record<string, BloodTestResult[]> = {
  'Công thức máu toàn bộ': [
    {
      name: 'Hồng cầu',
      value: '4.8',
      units: '10^12/L',
      reference_range: '4.2 - 5.4',
    },
    {
      name: 'Bạch cầu',
      value: '6.5',
      units: '10^9/L',
      reference_range: '4.0 - 10.0',
    },
    {
      name: 'Tiểu cầu',
      value: '280',
      units: '10^9/L',
      reference_range: '150 - 400',
    },
    { name: 'Hematocrit', value: '42', units: '%', reference_range: '37 - 47' },
    {
      name: 'Hemoglobin',
      value: '135',
      units: 'g/L',
      reference_range: '120 - 160',
    },
  ],
  'Glucose máu đói': [
    {
      name: 'Glucose',
      value: '5.8',
      units: 'mmol/L',
      reference_range: '3.9 - 6.1',
    },
  ],
  HbA1c: [
    { name: 'HbA1c', value: '6.2', units: '%', reference_range: '< 5.7' },
  ],
  'Lipid profile': [
    {
      name: 'Cholesterol toàn phần',
      value: '5.2',
      units: 'mmol/L',
      reference_range: '< 5.2',
    },
    { name: 'LDL-C', value: '3.1', units: 'mmol/L', reference_range: '< 2.6' },
    { name: 'HDL-C', value: '1.3', units: 'mmol/L', reference_range: '> 1.0' },
    {
      name: 'Triglyceride',
      value: '1.8',
      units: 'mmol/L',
      reference_range: '< 1.7',
    },
  ],
  'Chức năng gan': [
    { name: 'ALT', value: '32', units: 'U/L', reference_range: '< 40' },
    { name: 'AST', value: '28', units: 'U/L', reference_range: '< 40' },
    {
      name: 'Bilirubin toàn phần',
      value: '15',
      units: 'μmol/L',
      reference_range: '< 21',
    },
  ],
  'Chức năng thận': [
    {
      name: 'Creatinine',
      value: '85',
      units: 'μmol/L',
      reference_range: '62 - 106',
    },
    {
      name: 'Urea',
      value: '5.5',
      units: 'mmol/L',
      reference_range: '2.5 - 7.5',
    },
  ],
};

export const TEST_CONCLUSIONS = [
  'Không có bất thường.',
  'Chỉ số trong giới hạn bình thường.',
  'Có một số chỉ số cao hơn bình thường, cần theo dõi.',
  'Kết quả bình thường.',
  'Cần theo dõi và tái khám.',
  'Chỉ số ổn định so với lần trước.',
  'Có cải thiện so với kết quả trước đó.',
];

export const TEST_NOTES = [
  'Bệnh nhân tuân thủ tốt việc nhịn ăn trước xét nghiệm.',
  'Mẫu bệnh phẩm đạt yêu cầu.',
  'Không có can thiệp từ thuốc.',
  'Bệnh nhân không có triệu chứng bất thường trong quá trình lấy mẫu.',
  'Kết quả phù hợp với tình trạng lâm sàng.',
  'Cần so sánh với kết quả trước đó.',
  'Khuyến nghị theo dõi định kỳ.',
];
