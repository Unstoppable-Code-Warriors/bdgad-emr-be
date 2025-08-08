export interface DoctorInfo {
  id: string;
  email: string;
  name: string;
  phone: string;
  address: string;
}

export const PREDEFINED_DOCTORS: DoctorInfo[] = [
  {
    id: 'eb5bdf82-255e-4861-85e5-8699d9d350a3',
    email: 'phamphong137.dev@gmail.com',
    name: 'Bác sĩ một',
    phone: '0901234567',
    address: '123 Đường Lê Lợi, Hà Nội',
  },
  {
    id: '940dd619-3c16-4ed6-b31e-6d4fb23a143d',
    email: 'Fptaiez@gmail.com',
    name: 'Bác sĩ hai',
    phone: '0902345678',
    address: '456 Đường Nguyễn Huệ, TP.HCM',
  },
  {
    id: '03a81de5-35f5-4d50-b344-3e59e85f3110',
    email: 'ppp072003@gmail.com',
    name: 'Bác sĩ ba',
    phone: '0903456789',
    address: '789 Đường Trần Hưng Đạo, Đà Nẵng',
  },
  {
    id: 'f8c92b47-7d8e-4a6f-b234-1a5d8c9e0f21',
    email: 'phongphhe176151@gmail.com',
    name: 'Bác sĩ bốn',
    phone: '0904567890',
    address: '321 Đường Hai Bà Trưng, Cần Thơ',
  },
  {
    id: 'a9b3d8f2-4e5c-4b1a-8f7e-3d2c1b9a8e7f',
    email: 'quydx.work@gmail.com',
    name: 'Đào Xuân Quý',
    phone: '0393270555',
    address:
      'Số Nhà 46, Ngõ A1, đường Duy Tân, Khối Trung Hưng. phường Hưng Dũng, Thành phố Vinh, Tỉnh Nghệ An, Việt Nam',
  },
];
