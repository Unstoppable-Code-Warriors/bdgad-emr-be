export interface DoctorInfo {
  id: number;
  email: string;
  name: string;
  phone: string;
  address: string;
}

export const PREDEFINED_DOCTORS: DoctorInfo[] = [
  {
    id: 12,
    email: 'phamphong137.dev@gmail.com',
    name: 'Bác sĩ một',
    phone: '0901234567',
    address: '123 Đường Lê Lợi, Hà Nội',
  },
  {
    id: 13,
    email: 'Fptaiez@gmail.com',
    name: 'Bác sĩ hai',
    phone: '0902345678',
    address: '456 Đường Nguyễn Huệ, TP.HCM',
  },
  {
    id: 14,
    email: 'ppp072003@gmail.com',
    name: 'Bác sĩ ba',
    phone: '0903456789',
    address: '789 Đường Trần Hưng Đạo, Đà Nẵng',
  },
  {
    id: 15,
    email: 'phongphhe176151@gmail.com',
    name: 'Bác sĩ bốn',
    phone: '0904567890',
    address: '321 Đường Hai Bà Trưng, Cần Thơ',
  },
  {
    id: 7,
    email: 'quydx.work@gmail.com',
    name: 'Đào Xuân Quý',
    phone: '0393270555',
    address:
      'Số Nhà 46, Ngõ A1, đường Duy Tân, Khối Trung Hưng. phường Hưng Dũng, Thành phố Vinh, Tỉnh Nghệ An, Việt Nam',
  },
];
